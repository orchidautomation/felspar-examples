import assert from "node:assert/strict";
import { test } from "node:test";
import { holdVerdict, type HoldRequest, type RecordedCall } from "../agent/lib/felspar-holds.ts";

// Shapes follow Felspar's get_job_decision replies in the Nov 25 live run (a live run on real FDA records, Nov 25 2026).
const JOB = "real-device-review";
const TOOL = "felspar__get_job_decision";

const reply = (result: Record<string, unknown>) => ({
  content: [{ type: "text", text: JSON.stringify({ result }) }],
});
const held = (id: string, extra: Record<string, unknown> = {}) =>
  reply({
    outcome: null,
    releaseId: "release-1",
    case: { id, mode: "provided" },
    nextStep: { entryId: "unresolved", text: "an analyst reviews any device whose records don't answer a question, or disagree" },
    receipt: { status: "blocked", receiptDigest: "sha256:aa" },
    ...extra,
  });
const decided = (id: string, outcome: string) =>
  reply({ outcome, releaseId: "release-1", case: { id, mode: "provided" }, receipt: { status: "decided", receiptDigest: "sha256:bb" } });
const refused = { content: [{ type: "text", text: JSON.stringify({ error: "invalid_input", issues: [] }) }] };
const call = (entity: string, output: unknown, job = JOB): RecordedCall => ({
  toolName: TOOL,
  input: { job, entity_id: entity, facts: {} },
  output,
});

function request(completed: RecordedCall[], over: Partial<HoldRequest> = {}): HoldRequest {
  return {
    job: JOB,
    decisionTool: TOOL,
    toolName: "review__send_to_analyst",
    input: { catalog_number: "DC-201" },
    completed,
    rules: { review__send_to_analyst: { escalation: "analyst-review", entityField: "catalog_number" } },
    unresolvedRoute: async () => "analyst-review",
    ...over,
  };
}

test("a hold that escalates to analyst-review allows send_to_analyst", async () => {
  const escalated = held("dc-201", { escalation: { id: "analyst-review", trigger: "attempt_limit" } });
  const verdict = await holdVerdict(request([call("DC-201", escalated)], { unresolvedRoute: async () => null }));
  assert.equal(verdict.allow, true);
});

test("a hold whose next step is the job's unresolved route allows it, attempts left or not", async () => {
  assert.equal((await holdVerdict(request([call("DC-201", held("dc-201"))]))).allow, true);
});

test("a hold routed elsewhere is denied", async () => {
  const verdict = await holdVerdict(request([call("DC-201", held("dc-201"))], { unresolvedRoute: async () => "committee-chair" }));
  assert.equal(verdict.allow, false);
});

test("a decided outcome after the hold is the latest result, so the hold no longer counts", async () => {
  const completed = [call("DC-201", held("dc-201")), call("DC-201", decided("dc-201", "scoring"))];
  assert.equal((await holdVerdict(request(completed))).allow, false);
});

test("a later refusal is not a result and doesn't erase the hold", async () => {
  const completed = [call("DC-201", held("dc-201")), call("DC-201", refused)];
  assert.equal((await holdVerdict(request(completed))).allow, true);
});

test("a hold on another device doesn't count", async () => {
  assert.equal((await holdVerdict(request([call("TA3035S", held("ta3035s"))]))).allow, false);
});

test("a hold on another job doesn't count", async () => {
  assert.equal((await holdVerdict(request([call("DC-201", held("dc-201"), "other-job")]))).allow, false);
});

test("other actions stay strict on a hold", async () => {
  const verdict = await holdVerdict(request([call("DC-201", held("dc-201"))], { toolName: "review__send_to_scoring" }));
  assert.equal(verdict.allow, false);
});

test("an action that sets any field besides the device is denied", async () => {
  const verdict = await holdVerdict(request([call("DC-201", held("dc-201"))], { input: { catalog_number: "DC-201", note: "x" } }));
  assert.equal(verdict.allow, false);
});

test("no Felspar result for the device is denied", async () => {
  assert.equal((await holdVerdict(request([]))).allow, false);
});
