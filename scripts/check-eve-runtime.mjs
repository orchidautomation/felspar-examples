// Scripted local Eve proof. No model, Felspar or action-provider credentials.
// Usage: node scripts/check-eve-runtime.mjs <directory with eve + ai installed> <SDK src or dist directory>
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
const sdk = path.resolve(process.argv[3]);
const extension = existsSync(path.join(sdk, "draft-action-gate.ts"))
  ? "ts"
  : "js";
const { outputTextDigest } = await import(
  pathToFileURL(path.join(sdk, `draft-action-gate.${extension}`))
);

const install = path.resolve(process.argv[2]);
const requireFrom = createRequire(path.join(install, "package.json"));
const { Client } = await import(
  pathToFileURL(requireFrom.resolve("eve/client"))
);
const eveVersion = JSON.parse(
  await readFile(path.join(install, "node_modules/eve/package.json")),
).version;
const artifacts = path.join(install, ".agent-artifacts", "eve-runtime");
await mkdir(artifacts, { recursive: true });
const project = await mkdtemp(path.join(artifacts, "gate-proof-"));
const artifactDigest = await outputTextDigest("Approved reply");
const decision = {
  status: "ready",
  result: {
    outcome: "respond",
    executionObjectId: "execution-42",
    receipt: { receiptDigest: "sha256:original" },
  },
};
const checked = {
  status: "pass",
  checkId: "check-42",
  output: "reply",
  receipt: { receiptDigest: "sha256:checked", artifactDigest },
  decision: { executionId: "execution-42", receiptDigest: "sha256:original" },
};
const executions = [];
const verdicts = [];
let drop = false;
const server = http.createServer(async (req, res) => {
  let body = "";
  for await (const chunk of req) body += chunk;
  if (req.url === "/verdict") {
    verdicts.push(JSON.parse(body));
    res.end("{}");
    return;
  }
  if (req.url === "/drop") {
    res.end(JSON.stringify(drop));
    return;
  }
  const msg = JSON.parse(body || "{}");
  if (msg.id === undefined) {
    res.writeHead(202).end();
    return;
  }
  let result = {};
  if (msg.method === "initialize")
    result = {
      protocolVersion: msg.params.protocolVersion,
      capabilities: { tools: {} },
      serverInfo: { name: "fixture", version: "1" },
    };
  if (msg.method === "tools/list")
    result = {
      tools: (req.url === "/felspar"
        ? ["get_job_decision", "check_output"]
        : ["reply"]
      ).map((name) => ({
        name,
        inputSchema: {
          type: "object",
          properties: {
            job: { type: "string" },
            entity_id: { type: "string" },
            ticket: { type: "string" },
            text: { type: "string" },
          },
        },
      })),
    };
  if (msg.method === "tools/call") {
    const { name, arguments: args } = msg.params;
    if (name === "reply") executions.push(args);
    result = {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            name === "get_job_decision"
              ? decision
              : name === "check_output"
                ? checked
                : { ok: true },
          ),
        },
      ],
    };
  }
  res
    .writeHead(200, { "content-type": "application/json" })
    .end(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result }));
});
server.listen(0, "127.0.0.1");
await once(server, "listening");
const origin = `http://127.0.0.1:${server.address().port}`;
async function file(name, text) {
  const dest = path.join(project, name);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, text);
}
await file(
  "package.json",
  JSON.stringify({
    name: "eve-gate-proof",
    private: true,
    type: "module",
    dependencies: { eve: eveVersion },
  }),
);
await file(
  "agent/lib/gate.ts",
  `
import { defineState } from 'eve/context';
import { createActionGate } from ${JSON.stringify(sdk + "/draft-action-gate." + extension)};
import { felsparGate, felsparDecisionEvents } from ${JSON.stringify(sdk + "/draft-action-gate-eve." + extension)};
import type { EveGateState } from ${JSON.stringify(sdk + "/draft-action-gate-eve." + extension)};
export const state = defineState<EveGateState | null>('proof.felspar', () => null);
export const gate = createActionGate({ job:'route-ticket', decisionTool:'felspar__get_job_decision', outputCheckTool:'felspar__check_output',
 tools:{desk__reply:{outcomes:['respond'],fields:['ticket','text'],entity:{field:'ticket'},outputCheck:{fields:['text']}}},
 verify: async d => d.receipt.receiptDigest === 'sha256:original' ? { jobId:'route-ticket',entityId:'T-42',outcome:'respond' } : null,
 verifyOutputCheck: async () => ({ status:'pass', receiptDigest:'sha256:checked', artifactDigest:${JSON.stringify(artifactDigest)}, decisionReceiptDigest:'sha256:original' }) });
export const policy = felsparGate(gate,{state});
export const events = felsparDecisionEvents(gate,{state});
`,
);
await file(
  "agent/connections/felspar.ts",
  `import {defineMcpClientConnection} from 'eve/connections'; export default defineMcpClientConnection({url:'${origin}/felspar',description:'Fixture decisions', tools:{allow:['get_job_decision','check_output']}});`,
);
await file(
  "agent/connections/desk.ts",
  `import {defineMcpClientConnection} from 'eve/connections'; import {policy} from '../lib/gate.ts'; export default defineMcpClientConnection({url:'${origin}/desk',description:'Fixture action executor',tools:{allow:['reply']},approval:async ctx=>{ const verdict=await policy(ctx); await fetch('${origin}/verdict',{method:'POST',body:JSON.stringify({session:ctx.session.id,...verdict})}); return verdict; }});`,
);
await file(
  "agent/hooks/decisions.ts",
  `import {defineHook} from 'eve/hooks'; import {events} from '../lib/gate.ts'; export default defineHook({ events:{ '*':async (e,c)=>{ if ((e.type==='call.settled' || e.type==='action.result') && await (await fetch('${origin}/drop')).json()) return; events['*'](e,c); }} });`,
);
const modelRest = await readFile(
  new URL("../tests/fixtures/eve-scripted-model.txt", import.meta.url),
  "utf8",
);
await file(
  "agent/lib/model.ts",
  `import { MockLanguageModelV4 } from 'ai/test';
const action = (ticket='T-42', text='Approved reply') => ({tool:'eve__tool',input:{name:'desk__reply',input:{ticket,text}}});
const plans = {
 decide:[{tool:'eve__tool',input:{name:'felspar__get_job_decision',input:{job:'route-ticket',entity_id:'T-42'}}},{tool:'eve__tool',input:{name:'felspar__check_output',input:{job:'route-ticket',text:'Approved reply'}}},{text:'done'}],
 draft:[action(),{text:'done'}], wrong:[action('T-99'),{text:'done'}], altered:[action('T-42','Altered reply'),{text:'done'}],
 corrupt:[{tool:'corruptEvidence',input:{}},{text:'done'}],
 child:[{tool:'worker',input:{message:'draft'}},{text:'done'}]
};
${modelRest}`,
);
await file("agent/instructions.md", "Follow the scripted fixture command.");
await file(
  "agent/subagents/worker/instructions.md",
  "Follow the scripted fixture command.",
);
await file(
  "agent/tools/corruptEvidence.ts",
  `import {defineTool} from 'eve/tools'; import {z} from 'zod'; import {state} from '../lib/gate.ts'; export default defineTool({description:'Test-only evidence corruption',inputSchema:z.object({}),execute:async()=>{state.update(current=>current===null?null:{...current,completed:current.completed.map(row=>row.toolName==='felspar__get_job_decision'?{...row,output:${JSON.stringify({ ...decision, result: { ...decision.result, receipt: { receiptDigest: "sha256:altered" } } })}}:row)});return {ok:true};}});`,
);
await file(
  "agent/agent.ts",
  `import {defineAgent} from 'eve'; import {scriptModel} from './lib/model.ts'; export default defineAgent({model:scriptModel,defaultTools:false,modelContextWindowTokens:64000});`,
);
await file(
  "agent/subagents/worker/agent.ts",
  `import {defineAgent} from 'eve'; import {scriptModel} from '../../lib/model.ts'; export default defineAgent({description:'Fixture child',model:scriptModel,defaultTools:false,modelContextWindowTokens:64000});`,
);
for (const [name, target] of [
  ["connections/desk.ts", "connections/desk.ts"],
  ["connections/felspar.ts", "connections/felspar.ts"],
  ["hooks/decisions.ts", "hooks/decisions.ts"],
])
  await file(
    "agent/subagents/worker/" + name,
    `export {default} from '../../../${target}';`,
  );
const portServer = http.createServer();
portServer.listen(0, "127.0.0.1");
await once(portServer, "listening");
const port = portServer.address().port;
await new Promise((r) => portServer.close(r));
const logs = [];
let proc;
async function start(resume = false) {
  proc = spawn(
    path.join(install, "node_modules/.bin/eve"),
    [
      "dev",
      "--no-ui",
      "--no-default-extensions",
      "--port",
      String(port),
      ...(resume ? ["--resume"] : []),
    ],
    {
      cwd: project,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...Object.fromEntries(
          Object.entries(process.env).filter(([name]) => !/KEY|TOKEN|SECRET|PASSWORD/i.test(name)),
        ),
        // Override ambient preferences for every start, including cold resume.
        // This is per-process; never change the machine's Eve configuration.
        EVE_TELEMETRY_DISABLED: "1",
      },
    },
  );
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Eve startup timed out")),
      60000,
    );
    const got = (chunk) => {
      const text = String(chunk);
      logs.push(text);
      if (text.includes("server listening")) {
        clearTimeout(timer);
        resolve();
      }
    };
    proc.stdout.on("data", got);
    proc.stderr.on("data", got);
    proc.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error("Eve exited " + code));
    });
  });
}
async function stop() {
  if (proc?.exitCode === null) {
    process.kill(-proc.pid, "SIGTERM");
    await once(proc, "exit");
  }
}
try {
  await start();
  const client = new Client({
    baseUrl: `http://127.0.0.1:${port}`,
    host: `http://127.0.0.1:${port}`,
  });
  const create = async () => {
    const s = (await client.sessions.create()).session;
    if (!s.id) Object.defineProperty(s, "id", { value: s.state.sessionId });
    return s;
  };
  const send = async (session, text) => {
    console.error(`Checking ${text} in ${session.id ?? "resumed session"}`);
    let timer;
    try {
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Eve turn timed out: ${text}`)), 180000);
      });
      const turn = async () => (await session.send(text, { signal: AbortSignal.timeout(45000) })).result();
      const result = await Promise.race([turn(), timeout]);
      assert.ok(
        ["completed", "waiting"].includes(result.status),
        JSON.stringify(result),
      );
    } finally {
      clearTimeout(timer);
    }
  };
  const session = await create();
  await send(session, "draft");
  assert.equal(executions.length, 0);
  assert.equal(verdicts.at(-1).type, "denied");
  await send(session, "decide");
  await send(session, "draft");
  assert.equal(executions.length, 1);
  await send(session, "wrong");
  await send(session, "altered");
  assert.equal(executions.length, 1);
  const other = await create();
  await send(other, "draft");
  assert.equal(executions.length, 1);
  drop = true;
  const lost = await create();
  await send(lost, "decide");
  drop = false;
  await send(lost, "draft");
  assert.equal(executions.length, 1);
  const corrupted = await create();
  await send(corrupted, "decide");
  await send(corrupted, "corrupt");
  await send(corrupted, "draft");
  assert.equal(executions.length, 1);
  assert.match(verdicts.at(-1).reason, /did not reproduce/);
  await send(session, "child");
  // Child tasks run asynchronously. Wait for its approval callback, then assert no effect.
  for (
    let i = 0;
    i < 100 &&
    !verdicts.some(
      (v) => ![session.id, other.id, lost.id, corrupted.id].includes(v.session),
    );
    i++
  )
    await new Promise((r) => setTimeout(r, 100));
  const child = verdicts.find(
    (v) => ![session.id, other.id, lost.id, corrupted.id].includes(v.session),
  );
  assert.equal(child?.type, "denied");
  assert.equal(executions.length, 1);
  await stop();
  await start(true);
  await send(client.sessions.attach(session.id), "draft");
  assert.equal(executions.length, 2);
  console.log(
    JSON.stringify(
      {
        eveVersion,
        project,
        scenarios: [
          "missing",
          "decision+output-check",
          "wrong-case",
          "altered-output",
          "altered-evidence",
          "wrong-session",
          "interrupted-hook",
          "subagent",
          "cold-restart",
        ],
        executions: executions.length,
        verdicts,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(logs.join("").slice(-10000));
  throw error;
} finally {
  await stop();
  server.closeAllConnections();
  server.close();
  await writeFile(path.join(project, "proof.log"), logs.join(""));
}
