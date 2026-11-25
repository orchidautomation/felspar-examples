import {
  createActionGate,
  felsparJobDescriber,
  felsparOutputCheckVerifier,
  felsparVerifier,
} from "@felspar/sdk/draft/action-gate";
import { felsparGate } from "@felspar/sdk/eve";
import { holdVerdict, type HoldRule } from "./felspar-holds.ts";
import { state } from "./felspar-state.ts";

// Felspar's action gate in front of the review actions. An action runs only when
// Felspar decided this device in this session, Felspar re-verifies that
// decision's receipt, and the decided outcome is the one the action belongs to.
// The rules are the SDK's and the policy is the released pack; this file only
// says which outcome each action belongs to.
const felsparOrigin = (
  process.env.FELSPAR_MCP_URL || "https://mcp.felspar.ai/mcp"
).replace(/\/mcp\/?$/u, "");
const agentKey = process.env.FELSPAR_AGENT_KEY;
const felspar = { origin: felsparOrigin, ...(agentKey ? { agentKey } : {}) };
const job = process.env.FELSPAR_JOB ?? "";
const decisionTool = "felspar__get_job_decision";
const describe = felsparJobDescriber(felspar);

// Every action names the device by its catalog number, and may set no other field.
const forOutcome = (outcome: string) => ({
  outcomes: [outcome],
  entity: { field: "catalog_number" },
  fields: ["catalog_number"],
});

export const gate = createActionGate({
  job,
  // Eve's qualified connection tool names.
  decisionTool,
  outputCheckTool: "felspar__check_output",
  tools: {
    review__send_to_scoring: forOutcome("scoring"),
    review__send_to_price_review: forOutcome("price-review"),
    review__send_to_safety_review: forOutcome("safety-review"),
    review__send_to_analyst: forOutcome("analyst-review"),
    // The clinical-trial note goes to the hospital, so its text must be exactly
    // what Felspar's check_output passed against the pack's hospital-note rules
    // (for example, a cleared device is never called "FDA approved").
    review__recommend_clinical_trial: {
      ...forOutcome("clinical-trial"),
      fields: ["catalog_number", "note"],
      outputCheck: { fields: ["note"], output: "hospital-note" },
    },
  },
  verify: felsparVerifier(felspar),
  verifyOutputCheck: felsparOutputCheckVerifier(felspar),
  describe,
  onVerdict: (toolName, verdict) =>
    console.info(
      `[felspar gate] ${toolName}: ${verdict.allow ? "allowed" : "denied"}: ${verdict.reason}`
    ),
});

// A hold is not a decision, so the gate above denies every action on it. One
// action is still right on a hold: handing the device to the analyst the job
// names for records that don't answer a question, or disagree. send_to_analyst
// is allowed when Felspar's latest result for that device is a hold routed to
// analyst-review; every other verdict stays the gate's.
const holds: Record<string, HoldRule> = {
  review__send_to_analyst: { escalation: "analyst-review", entityField: "catalog_number" },
};
const strict = felsparGate(gate, { state });
type Approval = Parameters<typeof strict>[0];

export async function approve(call: Approval): ReturnType<typeof strict> {
  const verdict = await strict(call);
  if (verdict === "not-applicable" || verdict.type === "approved" || !Object.hasOwn(holds, call.toolName)) {
    return verdict;
  }
  const recorded = state.get();
  if (recorded === null || recorded.sessionId !== call.session.id) return verdict;
  const held = await holdVerdict({
    job,
    decisionTool,
    toolName: call.toolName,
    input: call.toolInput,
    completed: recorded.completed,
    rules: holds,
    unresolvedRoute: async (releaseId) => {
      if (releaseId === undefined) return null;
      try {
        return (await describe(releaseId, job)).escalations?.unresolved ?? null;
      } catch {
        return null;
      }
    },
  });
  if (held.allow) console.info(`[felspar gate] ${call.toolName}: allowed: ${held.reason}`);
  return held.allow ? { type: "approved", reason: held.reason } : verdict;
}
