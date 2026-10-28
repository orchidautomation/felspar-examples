// One support ticket in, the company's decision out: no agent, and no model on
// your side. Run: node --env-file=.env.local decide.mjs
import { createHostedFelsparClient } from "@felspar/sdk/draft/hosted-client";

const job = "support-ticket-routing";
const agentKey = process.env.FELSPAR_AGENT_KEY;
const felspar = createHostedFelsparClient({ origin: "https://api.felspar.ai", agentKey });

// The evidence: what each source says, in its own words, and where it came from.
// Send the facts, never your system's answer: Felspar decides what they mean
// from the definitions in the company's released policy.
const now = new Date().toISOString();
const facts = {
  request: {
    text: "We were charged twice this month, please refund one payment.",
    source: { class: "ticket-thread", id: "helpdesk:ticket/HC-1002", observedAt: now },
  },
  plan: {
    text: "Plan: Business (monthly)",
    source: { class: "account-record", id: "crm:account/acct-7781", observedAt: now },
  },
};

// The release Felspar runs this job on for your key.
const brief = await felspar.describeCurrentJob(job);

const { result } = await felspar.resolveFacts(brief.release.releaseId, {
  jobId: job,
  executionId: crypto.randomUUID(),
  facts,
});

console.log("outcome:  ", result.outcome ?? "none: held for a person");
console.log("why:      ", result.explanation?.why?.rules?.[0]?.text?.text);
console.log("next step:", result.outcome ? result.context?.entries?.[0]?.body : result.nextStep?.text);
console.log("receipt:  ", result.executionObjectId);

// Anyone can later ask Felspar to re-run the decision and confirm the receipt.
const check = await felspar.verifyReceipt(result.executionObjectId, {
  receipt: result.receipt,
  expectedReceiptDigest: result.receipt.receiptDigest,
  deliveredCapsule: result.context,
});
console.log("verified: ", check.status);
