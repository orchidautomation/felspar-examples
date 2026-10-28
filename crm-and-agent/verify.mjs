// Re-verify saved receipts: Felspar re-runs each decision on the release that
// made it. After the policy changes, an old decision still proves which
// version of the rule decided it.
import { readFileSync } from "node:fs";
import { createHostedFelsparClient } from "@felspar/sdk/draft/hosted-client";

const felspar = createHostedFelsparClient({ origin: "https://api.felspar.ai", agentKey: process.env.FELSPAR_AGENT_KEY });
const receipts = JSON.parse(readFileSync("receipts.json", "utf8"));

for (const saved of receipts) {
  // eslint-disable-next-line no-await-in-loop -- One receipt at a time keeps the output readable.
  const check = await felspar.verifyReceipt(saved.executionObjectId, {
    receipt: saved.receipt,
    expectedReceiptDigest: saved.receipt.receiptDigest,
    deliveredCapsule: saved.context,
  });
  console.log(`${saved.case}  ${saved.outcome.padEnd(14)} ${check.status}  on ${check.decided?.releaseId?.slice(0, 20)}…`);
}
