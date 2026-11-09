#!/usr/bin/env node
// Felspar PreToolUse hook for the Claude Code CLI and the Codex CLI.
// Before a matched tool call runs, it asks Felspar for the company's decision
// and allows, flags or blocks the call with the reason quoted from the policy.
//
// Environment:
//   FELSPAR_AGENT_KEY  the company agent's key (required)
//   FELSPAR_JOB        the job ID (default check-agent-action)
//   FELSPAR_MODE       "shadow" (default): ask and record, never block
//                      "enforce": act on the decision
//   FELSPAR_LOG        optional file to append one JSON line per decision
import { appendFileSync } from "node:fs";

const JOB = process.env.FELSPAR_JOB || "check-agent-action";
const MODE = process.env.FELSPAR_MODE === "enforce" ? "enforce" : "shadow";
let decision = { action: "block", reason: "No decision." };
let call = {};
try {
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  call = JSON.parse(input);
  // Approval evidence from your change system, if this folder has a lookup.
  const approval = await import("./change-record.mjs").then((lookup) => lookup.changeRecord(call), (error) => {
    if (error?.code === "ERR_MODULE_NOT_FOUND") return [];
    throw error;
  });
  const evidence = [{ kind: "tool-call", toolCall: { name: call.tool_name, input: call.tool_input } }, ...approval];
  const response = await fetch(`https://api.felspar.ai/v0/jobs/${JOB}/decisions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.FELSPAR_AGENT_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ case: call.tool_use_id, shadow: MODE === "shadow", evidence }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = await response.json();
  decision = body.decision ?? decision;
  // Older APIs don't send the next step or receipt beside the decision; read
  // them from the result instead.
  decision.nextStep ??= body.result?.nextStep?.text ?? null;
  decision.resultId ??= body.result?.resultId ?? null;
  if (decision.escalation && !decision.escalation.text) decision.escalation.text = body.result?.escalation?.why?.text ?? null;
} catch (error) {
  decision.reason = `No decision (${error.message}).`;
}
// Everything the agent and its person need to act on a block, in the
// policy's own words: why, what to do now, who it goes to, and the receipt.
function explained(decision) {
  const lines = [decision.reason];
  if (decision.nextStep && !decision.reason.includes(decision.nextStep)) lines.push(`Next: ${decision.nextStep}`);
  if (decision.escalation?.text) lines.push(`Escalated to: ${decision.escalation.text}`);
  if (decision.resultId) lines.push(`Receipt: ${decision.resultId}`);
  return lines.join("\n");
}
if (process.env.FELSPAR_LOG) {
  try {
    appendFileSync(process.env.FELSPAR_LOG, `${JSON.stringify({ at: new Date().toISOString(), mode: MODE, case: call.tool_use_id, tool: call.tool_name, action: decision.action, reason: decision.reason, nextStep: decision.nextStep, escalation: decision.escalation?.id, receipt: decision.resultId })}\n`);
  } catch {}
}
const reply = decision.action === "flag"
  ? { additionalContext: `Felspar flagged this for review: ${explained(decision)}` }
  : { permissionDecision: "deny", permissionDecisionReason: `Felspar blocked this: ${explained(decision)}` };
if (MODE === "enforce" && decision.action !== "allow") console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", ...reply } }));
