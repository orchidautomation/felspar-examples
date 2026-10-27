// Decide cases straight from help desk and CRM records, with no agent and no
// model on your side: map each record's fields to the job's questions
// (mapping.mjs), send them to Felspar, and print the decision, its reason,
// the company's next step and the receipt, which Felspar then re-verifies.
//
//   npm run describe -- <job>              the job's questions and what each takes
//   npm run decide -- --job <job>          decide every record in records.mjs
//   npm run decide -- --job <job> --record HC-1002 --again
//                                           decide one, then send the same call again
import { randomUUID } from "node:crypto";
import { parseArgs } from "node:util";
import { FelsparRequestError, createHostedFelsparClient } from "@felspar/sdk/draft/hosted-client";
import { MappingError, factsFor } from "./lib/facts.mjs";
import { mappings } from "./mapping.mjs";
import { records } from "./records.mjs";

const origin = process.env.FELSPAR_API_URL || "https://api.felspar.ai";
const agentKey = process.env.FELSPAR_AGENT_KEY;
if (!agentKey) {
  console.error("No agent key: run `npm run add-key -- FELSPAR_AGENT_KEY` first.");
  process.exit(2);
}
const felspar = createHostedFelsparClient({ origin, agentKey });
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { job: { type: "string" }, record: { type: "string" }, again: { type: "boolean" } },
});

// The job's description on the release Felspar runs for this key now.
async function describe(job) {
  const response = await fetch(`${origin}/v0/jobs/${encodeURIComponent(job)}/brief`, {
    headers: { Authorization: `Bearer ${agentKey}` },
  });
  if (!response.ok) {
    throw new Error(`Felspar refused ${job}: ${response.status} ${await response.text()}`);
  }
  return await response.json();
}

function printQuestions(description) {
  console.log(`${description.job}: ${description.purpose?.text ?? ""}\n`);
  for (const question of description.questions) {
    const takes = question.answer.send === "text" ? "the record's words (text)" : "text, or a typed value";
    const classes = question.evidencePolicy?.allowedSourceClasses?.join(", ") ?? "any";
    const applies = question.answer.applies === "always" ? "" : ` (only when: ${question.answer.appliesWhen})`;
    console.log(`  ${question.key} [${question.type}]: ${takes}; sources: ${classes}${applies}`);
  }
}

const short = (text, length = 220) => String(text ?? "").replaceAll(/\s+/gu, " ").slice(0, length);
function printResult(id, response, ms) {
  const result = response.result ?? {};
  const why = result.explanation?.why?.rules?.map((rule) => rule.text?.text).filter(Boolean) ?? [];
  const next = result.outcome ? result.context?.entries?.[0]?.body : result.nextStep?.text;
  console.log(`\n${id}  ${ms} ms`);
  console.log(`  outcome:    ${result.outcome ?? `none (${response.status}${response.reason ? `: ${response.reason}` : ""})`}`);
  if (why.length > 0) console.log(`  why:        ${short(why.join(" "))}`);
  if (next) console.log(`  next step:  ${short(next)}`);
  if (result.escalation) console.log(`  escalation: ${result.escalation.id} (${result.escalation.trigger})`);
  const open = result.explanation?.needs?.map((need) => need.key) ?? [];
  if (open.length > 0) console.log(`  open:       ${open.join(", ")}`);
  if (result.receipt) console.log(`  receipt:    ${result.executionObjectId}\n              ${result.receipt.receiptDigest}`);
}

async function verified(result) {
  const check = await felspar.verifyReceipt(result.executionObjectId, {
    receipt: result.receipt,
    expectedReceiptDigest: result.receipt.receiptDigest,
    deliveredCapsule: result.context,
  });
  return `${check.status}${check.mismatches.length > 0 ? ` (${check.mismatches.join(", ")})` : ""}`;
}

async function decideOne(description, mapping, record) {
  const id = record.ticket?.id ?? record.id ?? "record";
  const { facts, unmapped } = factsFor(description, mapping, record);
  if (unmapped.length > 0) {
    console.log(`\n${id}: no mapping for ${unmapped.join(", ")}; Felspar decides on what it is sent.`);
  }
  const request = { jobId: description.job, executionId: randomUUID(), facts };
  const started = Date.now();
  const response = await felspar.resolveFacts(description.release.releaseId, request);
  printResult(id, response, Date.now() - started);
  if (response.result?.receipt) {
    console.log(`  verified:   ${await verified(response.result)}`);
  }
  if (values.again) {
    const again = await felspar.resolveFacts(description.release.releaseId, request);
    const same = again.result?.receipt?.receiptDigest === response.result?.receipt?.receiptDigest;
    console.log(`  again:      ${again.result?.outcome ?? again.status}, same receipt: ${same ? "yes" : "no"}`);
  }
}

try {
  const [command] = positionals;
  const job = values.job ?? positionals[1];
  if (!job) {
    const { jobs } = await felspar.listJobs();
    console.log(`Jobs this key may run: ${jobs.map((row) => row.id).join(", ") || "none"}`);
    console.log("Then: npm run describe -- <job>, or npm run decide -- --job <job>");
    process.exit(0);
  }
  const description = await describe(job);
  if (command === "describe") {
    printQuestions(description);
    process.exit(0);
  }
  const mapping = mappings[job];
  if (!mapping) {
    printQuestions(description);
    console.log(`\nAdd a mapping for ${job} to mapping.mjs, one entry per question key above.`);
    process.exit(2);
  }
  const chosen = values.record
    ? records.filter((record) => (record.ticket?.id ?? record.id) === values.record)
    : records;
  for (const record of chosen) {
    // eslint-disable-next-line no-await-in-loop -- One record at a time keeps the output readable.
    await decideOne(description, mapping, record);
  }
} catch (error) {
  if (error instanceof MappingError) {
    console.error(`Mapping: ${error.message}`);
  } else if (error instanceof FelsparRequestError) {
    console.error(`Felspar refused the request (${error.status}): ${JSON.stringify(error.refusal)}`);
  } else {
    throw error;
  }
  process.exit(1);
}
