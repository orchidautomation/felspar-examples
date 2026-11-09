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
  // An undecided case blocks under the policy's own words for unclear cases;
  // say which fact couldn't be settled and quote that sentence.
  const policy = body.result?.nextStep?.text;
  if (decision.missing?.length && policy && !decision.reason?.includes(policy)) {
    // Facts that only wait on another one aren't the reason; leave them out.
    const needs = body.result?.explanation?.needs ?? [];
    const open = needs.filter((need) => !need.reasons?.includes("activation_unresolved")).map((need) => need.key);
    decision.reason = `Couldn't settle: ${(open.length ? open : decision.missing).join(", ")}. Policy: "${policy}"`;
  }
} catch (error) {
  decision.reason = `No decision (${error.message}).`;
}
if (process.env.FELSPAR_LOG) {
  try {
    appendFileSync(process.env.FELSPAR_LOG, `${JSON.stringify({ at: new Date().toISOString(), mode: MODE, case: call.tool_use_id, tool: call.tool_name, action: decision.action, reason: decision.reason })}\n`);
  } catch {}
}
const reply = decision.action === "flag"
  ? { additionalContext: `Felspar flagged this for review: ${decision.reason}` }
  : { permissionDecision: "deny", permissionDecisionReason: `Felspar blocked this: ${decision.reason}` };
if (MODE === "enforce" && decision.action !== "allow") console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", ...reply } }));
