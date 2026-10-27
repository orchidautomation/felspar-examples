import assert from "node:assert/strict";
import test from "node:test";
import { felsparDecisionEvents, felsparGate } from "@felspar/sdk/eve";

// This agent's gate configuration, wired through the SDK's Eve adapter. The
// rules themselves are tested in @felspar/sdk; every case here is decided
// before Felspar's verification, so the test makes no network call. Each
// configuration reads the environment when it loads, so each is its own import.
process.env.FELSPAR_MCP_URL = "https://felspar.invalid/mcp";
async function gateWith(environment, tag) {
  Object.assign(process.env, environment);
  const { gate } = await import(`../eve-agent-agentmail/agent/lib/felspar-gate.ts?${tag}`);
  return gate;
}
const company = await gateWith(
  {
    FELSPAR_JOB: "classify-company-icp",
    FELSPAR_GATE_OUTPUT: "outreach-email",
    FELSPAR_GATE_ENTITY_FIELD: "",
  },
  "company"
);
const tickets = await gateWith(
  {
    FELSPAR_JOB: "route-support-ticket",
    FELSPAR_GATE_OUTPUT: "billing-team-reply",
    FELSPAR_GATE_ENTITY_FIELD: "labels",
  },
  "tickets"
);
const unset = await gateWith(
  { FELSPAR_JOB: "route-support-ticket", FELSPAR_GATE_OUTPUT: "", FELSPAR_GATE_ENTITY_FIELD: "" },
  "unset"
);
const session = { id: "s" };
const draftWith = (gate) => (toolInput) =>
  felsparGate(gate)({ session, toolName: "agentmail__create_draft", toolInput });

test("the example gates create_draft and nothing else", async () => {
  const draft = draftWith(company);
  assert.equal(company.rules.job, "classify-company-icp");
  assert.equal(
    await felsparGate(company)({ session, toolName: "agentmail__list_drafts", toolInput: {} }),
    "not-applicable"
  );
  for (const field of ["attachments", "sendAt", "send_at", "SendAt", "inReplyTo", "html"]) {
    const verdict = await draft({ to: ["ceo@stripe.com"], [field]: "x" });
    assert.equal(verdict.type, "denied");
    assert.match(verdict.reason, new RegExp(`the call sets ${field}`, "u"));
  }
  // A full AgentMail draft passes the field check and reaches the company check.
  const full = {
    inboxId: "agent@agentmail.to",
    to: ["ceo@stripe.com"],
    cc: ["cfo@stripe.com"],
    bcc: [],
    replyTo: "ceo@stripe.com",
    subject: "Hello",
    text: "Hi",
    labels: ["outreach"],
  };
  assert.match((await draft(full)).reason, /not at a company/u);
  // Only the exact qualified name is gated.
  assert.equal(
    await felsparGate(company)({ session, toolName: "othermail__create_draft", toolInput: full }),
    "not-applicable"
  );
});

test("for tickets, the draft's one label is the ticket the decision is for", async () => {
  const draft = draftWith(tickets);
  const reply = { inboxId: "agent@agentmail.to", to: ["sam@gmail.com"], text: "Hi" };
  assert.match((await draft(reply)).reason, /must set labels to exactly one ID/u);
  assert.match(
    (await draft({ ...reply, labels: ["HC-1201", "billing"] })).reason,
    /must set labels to exactly one ID/u
  );
  assert.match((await draft({ ...reply, labels: ["HC-1201"] })).reason, /no decision for HC-1201/u);
  assert.equal(tickets.rules.tools.agentmail__create_draft.writes, "billing-team-reply");
});

test("without a configured output, every draft is denied", async () => {
  const verdict = await draftWith(unset)({ to: ["ceo@stripe.com"], text: "Hi" });
  assert.equal(verdict.type, "denied");
  assert.match(verdict.reason, /exactly one of outcomes or writes/u);
});

test("the example's hook records Felspar's decisions for the gate", () => {
  const events = felsparDecisionEvents(tickets);
  const output = JSON.stringify({
    result: {
      outcome: "billing-team",
      executionObjectId: "exec-1201",
      receipt: { receiptDigest: "sha256:abc" },
      context: null,
    },
  });
  events["actions.requested"]({
    data: {
      actions: [
        { callId: "c1", toolName: "felspar__get_job_decision", input: { entity_id: "HC-1201" } },
      ],
    },
  });
  events["action.result"](
    { data: { result: { callId: "c1", toolName: "felspar__get_job_decision", output } } },
    { session }
  );
  assert.deepEqual(
    tickets.decisions.decisionsIn("s").map((row) => row.entity),
    ["HC-1201"]
  );
});
