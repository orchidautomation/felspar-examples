// Offline tests for the Linear reader: fake Linear responses, no network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const repo = mkdtempSync(join(tmpdir(), "felspar-linear-"));
execFileSync("git", ["init", "-q", "-b", "TDW-412-fix-billing-sync", repo]);
execFileSync("git", ["-C", repo, "-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-q", "--allow-empty", "-m", "init"]);
process.env.LINEAR_API_KEY = "test";

const dana = { name: "Dana Lee", email: "dana@example.com" };
const priya = { name: "Priya Shah", email: "priya@example.com" };
const at = (minute) => `2026-11-09T10:${String(minute).padStart(2, "0")}:00.000Z`;
const st = (name, type) => ({ name, type });
function issue({ state = st("In Progress", "started"), labels = ["production"], history = [], dueDate = "2026-12-31" } = {}) {
  return { identifier: "TDW-412", title: "Billing migration", description: "Production migration of billing-db.", dueDate,
    state, creator: dana, labels: { nodes: labels.map((name) => ({ name })) }, history: { nodes: history } };
}
const ev = (minute, actor, extra) => ({ createdAt: at(minute), actor, fromState: null, toState: null, updatedDescription: false, addedLabels: [], removedLabels: [], ...extra });
let reply;
let last;
globalThis.fetch = async () => ({ ok: true, json: async () => reply });
const { changeRecord } = await import("../.claude/hooks/change-record.mjs");
async function read(data, approval) {
  if (approval) process.env.FELSPAR_LINEAR_APPROVAL = approval; else delete process.env.FELSPAR_LINEAR_APPROVAL;
  reply = data;
  const out = await changeRecord({ cwd: repo });
  last = out;
  return out[0]?.text ?? null;
}

test("status: approved by someone else, then moved forward", async () => {
  const text = await read({ data: { issue: issue({ history: [ev(1, priya, { toState: st("Approved", "unstarted") }), ev(2, dana, { toState: st("In Progress", "started") })] }) } });
  assert.match(text, /status: approved\./);
  assert.match(text, /Requested by Dana Lee/);
  assert.match(text, /Approved by Priya Shah .* by moving the issue to Approved/);
  assert.deepEqual(last[1], { kind: "change-expiry", id: "TDW-412", text: "2026-12-31" });
  assert.doesNotMatch(text, /2026-12-31/);
});
test("status: self-approval is reported as such, for the policy to judge", async () => {
  const text = await read({ data: { issue: issue({ history: [ev(1, dana, { toState: st("Approved", "unstarted") })] }) } });
  assert.match(text, /Requested by Dana Lee/);
  assert.match(text, /Approved by Dana Lee/);
});
test("status: moved back to Todo withdraws it", async () => {
  const text = await read({ data: { issue: issue({ state: st("Todo", "unstarted"), history: [ev(1, priya, { toState: st("Approved", "unstarted") }), ev(2, dana, { toState: st("Todo", "unstarted") })] }) } });
  assert.match(text, /not approved \(withdrawn: Dana Lee .* moved it to Todo/);
  assert.match(text, /No approval recorded/);
});
test("status: description edited after approval needs re-approval", async () => {
  const text = await read({ data: { issue: issue({ history: [ev(1, priya, { toState: st("Approved", "unstarted") }), ev(2, dana, { updatedDescription: true })] }) } });
  assert.match(text, /pending re-approval \(changed after approval: Dana Lee .* edited the description/);
});
test("status: shows Approved but no recorded mover means approver unknown", async () => {
  const text = await read({ data: { issue: issue({ state: st("Approved", "unstarted"), history: [] }) } });
  assert.match(text, /not approved: it shows Approved, but Linear recorded no one/);
});
test("status: re-approval after a withdrawal counts again", async () => {
  const text = await read({ data: { issue: issue({ state: st("Approved", "unstarted"), history: [ev(1, priya, { toState: st("Approved", "unstarted") }), ev(2, dana, { toState: st("Backlog", "backlog") }), ev(3, priya, { toState: st("Approved", "unstarted") })] }) } });
  assert.match(text, /status: approved\./);
});
test("label: added by someone else counts; work moving on keeps it", async () => {
  const text = await read({ data: { issue: issue({ labels: ["production", "approved"], history: [ev(1, priya, { addedLabels: [{ name: "Approved" }] }), ev(2, dana, { toState: st("In Review", "started") })] }) } }, "label:approved");
  assert.match(text, /status: approved\./);
  assert.match(text, /Approved by Priya Shah .* by adding the approved label/);
});
test("label: removing it withdraws approval", async () => {
  const text = await read({ data: { issue: issue({ history: [ev(1, priya, { addedLabels: [{ name: "approved" }] }), ev(2, dana, { removedLabels: [{ name: "approved" }] })] }) } }, "label:approved");
  assert.match(text, /withdrawn: Dana Lee .* removed the approved label/);
});
test("label: changing another label after approval needs re-approval", async () => {
  const text = await read({ data: { issue: issue({ labels: ["production", "approved"], history: [ev(1, priya, { addedLabels: [{ name: "approved" }] }), ev(2, dana, { addedLabels: [{ name: "production" }] })] }) } }, "label:approved");
  assert.match(text, /pending re-approval .*changed its labels \(production\)/);
});
test("label: moving between statuses doesn't withdraw, canceling does", async () => {
  const text = await read({ data: { issue: issue({ labels: ["approved"], history: [ev(1, priya, { addedLabels: [{ name: "approved" }] }), ev(2, dana, { toState: st("Canceled", "canceled") })] }) } }, "label:approved");
  assert.match(text, /withdrawn: .* moved it to Canceled/);
});
test("status: the approver's own edit merged into the approval entry still counts", async () => {
  const text = await read({ data: { issue: issue({ history: [ev(1, priya, { toState: st("Approved", "unstarted"), updatedDescription: true })] }) } });
  assert.match(text, /status: approved\./);
});
test("status: an approval step merged away reads as not approved, never approved", async () => {
  const text = await read({ data: { issue: issue({ history: [ev(1, priya, { fromState: st("Todo", "unstarted"), toState: st("In Progress", "started") })] }) } });
  assert.match(text, /status: not approved\./);
});
test("no due date: no change-expiry is sent", async () => {
  await read({ data: { issue: issue({ dueDate: null, history: [ev(1, priya, { toState: st("Approved", "unstarted") })] }) } });
  assert.equal(last.length, 1);
});
test("no such issue: no record", async () => {
  assert.equal(await read({ errors: [{ message: "Entity not found: Issue" }] }), null);
});
test("Linear error: throws, so enforce blocks", async () => {
  await assert.rejects(() => read({ errors: [{ message: "Authentication required" }] }), /Linear error/);
});
test("bad setting: throws", async () => {
  await assert.rejects(() => read({ data: { issue: issue() } }, "approved"), /must be status:<name> or label:<name>/);
});
