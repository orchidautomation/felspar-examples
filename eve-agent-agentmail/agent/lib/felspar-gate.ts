import {
  createActionGate,
  felsparJobDescriber,
  felsparOutputCheckVerifier,
  felsparVerifier,
} from "@felspar/sdk/draft/action-gate";

// Felspar's action gate for this agent: whatever acts verifies first. The
// rules live in the SDK and the policy in the released pack; this file only
// says which tool writes which output. The AgentMail connection's approval
// policy runs the gate, and the felspar-decisions hook records each Felspar
// decision and output check as Felspar returned it.
const felsparOrigin = (
  process.env.FELSPAR_MCP_URL || "https://mcp.felspar.ai/mcp"
).replace(/\/mcp\/?$/u, "");
const agentKey = process.env.FELSPAR_AGENT_KEY;
const felspar = { origin: felsparOrigin, ...(agentKey ? { agentKey } : {}) };
const listed = (value: string | undefined) =>
  value
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean) ?? [];
// The output a draft writes, by its id in the released pack (get_job_requirements
// lists each outcome's outputs). Unset, every draft is denied.
const output = process.env.FELSPAR_GATE_OUTPUT?.trim() || undefined;
// The draft field holding the case's ID (labels: the draft's one label is the
// ticket ID, or the case.id Felspar issued). Unset, the released job's subject
// decides: recipients' domains pick a company, any other case is the one decided.
const entityField = process.env.FELSPAR_GATE_ENTITY_FIELD?.trim() || undefined;
// Test mode: drafts go only to these people.
const testRecipients = listed(process.env.FELSPAR_GATE_RECIPIENTS).map((address) =>
  address.toLowerCase()
);

export const gate = createActionGate({
  job: process.env.FELSPAR_JOB ?? "",
  // Eve's qualified connection tool names.
  decisionTool: "felspar__get_job_decision",
  outputCheckTool: "felspar__check_output",
  tools: {
    agentmail__create_draft: {
      ...(output === undefined ? {} : { writes: output }),
      ...(entityField === undefined ? {} : { entity: { field: entityField } }),
      // Any other field denies the call: attachment URLs are fetched by the
      // server, sendAt schedules sending, and html could carry text Felspar
      // never checked.
      fields: ["inboxId", "to", "cc", "bcc", "replyTo", "subject", "text", "labels"],
      // The draft's text must be exactly what check_output passed.
      outputCheck: { fields: ["text"] },
    },
  },
  refuse: ["attachments", "sendAt", "send_at", "html"],
  ...(testRecipients.length > 0 ? { testRecipients } : {}),
  verify: felsparVerifier(felspar),
  verifyOutputCheck: felsparOutputCheckVerifier(felspar),
  describe: felsparJobDescriber(felspar),
  onVerdict: (toolName, verdict) =>
    console.info(
      `[felspar gate] ${toolName}: ${verdict.allow ? "allowed" : "denied"}: ${verdict.reason}`
    ),
});
