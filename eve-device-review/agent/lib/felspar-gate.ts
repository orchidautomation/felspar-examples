import {
  createActionGate,
  felsparJobDescriber,
  felsparOutputCheckVerifier,
  felsparVerifier,
} from "@felspar/sdk/draft/action-gate";

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

// Every action names the device by its catalog number, and may set no other field.
const forOutcome = (outcome: string) => ({
  outcomes: [outcome],
  entity: { field: "catalog_number" },
  fields: ["catalog_number"],
});

export const gate = createActionGate({
  job: process.env.FELSPAR_JOB ?? "",
  // Eve's qualified connection tool names.
  decisionTool: "felspar__get_job_decision",
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
  describe: felsparJobDescriber(felspar),
  onVerdict: (toolName, verdict) =>
    console.info(
      `[felspar gate] ${toolName}: ${verdict.allow ? "allowed" : "denied"}: ${verdict.reason}`
    ),
});
