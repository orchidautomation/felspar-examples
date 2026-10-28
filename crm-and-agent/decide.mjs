// One released definition, two consumers: a CRM workflow (REST) and an agent's
// tool call (MCP) send the same facts about six companies, and get the same
// decision from the same release. Receipts go to receipts.json for verify.mjs.
import { writeFileSync } from "node:fs";
import { createHostedFelsparClient } from "@felspar/sdk/draft/hosted-client";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { cases } from "./cases.mjs";

const job = process.env.FELSPAR_JOB ?? "kestrel-sales-qualification";
const agentKey = process.env.FELSPAR_AGENT_KEY;
const headers = { Authorization: `Bearer ${agentKey}` };

// Consumer 1: a CRM workflow calls the REST API on the release Felspar runs now.
const felspar = createHostedFelsparClient({ origin: "https://api.felspar.ai", agentKey });
const brief = await felspar.describeCurrentJob(job);
const workflow = async ({ domain, facts }) => {
  try {
    return await felspar.resolveFacts(brief.release.releaseId, {
      jobId: job,
      executionId: crypto.randomUUID(),
      entityId: domain,
      facts,
    });
  } catch (error) {
    // A held case that has used its attempts is refused with the escalation to follow.
    if (error.refusal?.escalation) {
      return error.refusal;
    }
    throw error;
  }
};

// Consumer 2: an agent calls Felspar's get_job_decision tool over MCP.
const mcp = new Client({ name: "crm-and-agent", version: "1.0.0" });
await mcp.connect(
  new StreamableHTTPClientTransport(new URL("https://mcp.felspar.ai/mcp"), { requestInit: { headers } })
);
const agent = async ({ domain, facts }) => {
  const reply = await mcp.callTool({ name: "get_job_decision", arguments: { job, entity_id: domain, facts } });
  return reply.structuredContent;
};

const decided = (response) =>
  response.result?.outcome ?? `held: ${(response.result ?? response).escalation?.id ?? response.status}`;
const receipts = [];
console.log(`${job}, release ${brief.release.releaseId.slice(0, 20)}…\n`);
console.log("case  workflow (REST)          agent (MCP)              same?  teaches");
for (const item of cases) {
  // eslint-disable-next-line no-await-in-loop -- One case at a time keeps the output readable.
  const [fromWorkflow, fromAgent] = [await workflow(item), await agent(item)];
  const same = decided(fromWorkflow) === decided(fromAgent);
  console.log(`${item.id}     ${decided(fromWorkflow).padEnd(24)} ${decided(fromAgent).padEnd(24)} ${same ? "yes" : "NO "}    ${item.teaches}`);
  if (fromWorkflow.result?.receipt) {
    const { executionObjectId, receipt, context } = fromWorkflow.result;
    receipts.push({ case: item.id, outcome: decided(fromWorkflow), executionObjectId, receipt, context });
  }
}
await mcp.close();
writeFileSync("receipts.json", JSON.stringify(receipts, null, 1));
console.log(`\n${receipts.length} receipts saved to receipts.json. After the policy changes, npm run verify.`);
