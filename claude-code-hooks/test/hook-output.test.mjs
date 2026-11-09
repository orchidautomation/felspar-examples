// What the hook tells the agent for each kind of answer, one fact per line.
// Felspar is stubbed: nothing is sent anywhere and no tool call runs.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

const hook = new URL("../.claude/hooks/felspar-hook.mjs", import.meta.url).pathname;
function reply(body, mode = "enforce") {
  const dir = mkdtempSync(path.join(tmpdir(), "felspar-hook-"));
  const stub = path.join(dir, "fetch.mjs");
  writeFileSync(stub, `globalThis.fetch = async () => Response.json(${JSON.stringify(body)});`);
  const run = spawnSync(process.execPath, ["--import", stub, hook], {
    input: JSON.stringify({ tool_use_id: "toolu_1", tool_name: "Bash", tool_input: { command: "ls" }, cwd: dir }),
    env: { PATH: process.env.PATH, FELSPAR_AGENT_KEY: "test", FELSPAR_MODE: mode },
    encoding: "utf8",
  });
  return run.stdout.trim() ? JSON.parse(run.stdout).hookSpecificOutput : null;
}

test("a decided block: why, next, who takes it and the receipt", () => {
  const out = reply({
    status: "ready",
    decision: {
      action: "block", reason: "Cloud spending changes are blocked.", rule: "spend-blocked",
      nextStep: "Don't retry or work around it.", missing: [],
      escalation: { id: "infra", trigger: "outcome", text: "Infrastructure owner's review." },
      resultId: "result-01", receiptUrl: "https://app.felspar.ai/owner/runs/result-01", open: [], toProceed: null,
    },
  });
  assert.equal(out.permissionDecision, "deny");
  assert.equal(out.permissionDecisionReason, [
    "Felspar blocked this.",
    "Why: Cloud spending changes are blocked.",
    "Next: Don't retry or work around it.",
    "Hand off to: Infrastructure owner's review.",
    "Receipt: rule spend-blocked · https://app.felspar.ai/owner/runs/result-01",
  ].join("\n"));
});

test("an undecided block: what it couldn't settle, the policy and what would settle it", () => {
  const out = reply({
    status: "blocked",
    decision: {
      action: "block", reason: "Felspar couldn't settle what the action is from the evidence.", rule: null,
      nextStep: "If it is unclear what an action does, block it.", missing: [], escalation: null,
      resultId: "result-02", receiptUrl: null, open: [{ key: "action", label: "what the action is" }],
      toProceed: "Send evidence that shows what the action is plainly, or ask a person to decide.",
    },
  });
  assert.equal(out.permissionDecisionReason, [
    "Felspar blocked this: it couldn't tell enough to decide.",
    "Couldn't settle: what the action is.",
    'Policy: "If it is unclear what an action does, block it."',
    "To proceed: Send evidence that shows what the action is plainly, or ask a person to decide.",
    "Receipt: result-02",
  ].join("\n"));
});

test("an older answer without the later fields leaves those lines out; shadow and allow say nothing", () => {
  const older = { status: "ready", decision: { action: "block", reason: "Secrets are blocked.", missing: [], escalation: null } };
  assert.equal(reply(older).permissionDecisionReason, "Felspar blocked this.\nWhy: Secrets are blocked.");
  assert.equal(reply(older, "shadow"), null);
  assert.equal(reply({ status: "ready", decision: { action: "allow", reason: "ok", missing: [], escalation: null } }), null);
});
