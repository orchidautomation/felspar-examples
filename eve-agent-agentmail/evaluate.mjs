// Run cases through the running agent, one session each, and print what
// happened: each Felspar call and its status, then the agent's answer. A case
// is a domain or a record such as a support ticket; --file reads one case per
// blank-line-separated block. --job picks the job (default: FELSPAR_JOB; with
// neither, the agent picks from list_jobs). Start the agent first with
// `npm run serve` (eve dev without the UI).
//   npm run evaluate -- stripe.com ramp.com
//   npm run evaluate -- --job <job-id> --file harbor-tickets.txt
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";

const base = process.env.EVE_URL ?? "http://127.0.0.1:2000";
// The job named in .env.local, so a server started earlier still runs the current job.
function configuredJob() {
  try {
    return /^FELSPAR_JOB=(.+)$/mu.exec(readFileSync(".env.local", "utf8"))?.[1]?.trim();
  } catch {
    return undefined;
  }
}
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { job: { type: "string" }, file: { type: "string" } },
});
const job = values.job ?? process.env.FELSPAR_JOB ?? configuredJob();
const fromFile = values.file
  ? readFileSync(values.file, "utf8")
      .split(/\n\s*\n/u)
      .map((block) => block.trim())
      .filter(Boolean)
  : [];
const cases = [...positionals, ...fromFile];
if (cases.length === 0) {
  console.error("Usage: npm run evaluate -- [--job <job>] [--file <cases.txt>] [case...]");
  process.exit(2);
}

async function startSession(item) {
  const response = await fetch(`${base}/eve/v1/session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      message: job
        ? `Run the Felspar job ${job} for this case:\n\n${item}`
        : `Run the Felspar job that fits this case:\n\n${item}`,
    }),
  });
  if (!response.ok) {
    throw new Error(`Could not start a session: ${response.status} ${await response.text()}`);
  }
  const { sessionId } = await response.json();
  return sessionId;
}

const short = (value, length) => String(value).replaceAll(/\s+/gu, " ").slice(0, length);
function describeResult(output) {
  const text = typeof output === "string" ? output : JSON.stringify(output ?? "");
  const status = /"status":"([a-z_]+)"/u.exec(text)?.[1];
  const outcome = /"outcome":"([a-z_-]+)"/u.exec(text)?.[1];
  const error = /"error":"([a-z_]+)"/u.exec(text)?.[1];
  return [status && `status=${status}`, outcome && `outcome=${outcome}`, error && `error=${error}`]
    .filter(Boolean)
    .join(" ");
}

async function follow(sessionId) {
  const started = Date.now();
  const response = await fetch(`${base}/eve/v1/session/${sessionId}/stream`);
  const decoder = new TextDecoder();
  let buffered = "";
  let answer = "";
  for await (const chunk of response.body) {
    buffered += decoder.decode(chunk, { stream: true });
    const lines = buffered.split("\n");
    buffered = lines.pop() ?? "";
    for (const line of lines) {
      if (line.trim() === "") {
        continue;
      }
      const event = JSON.parse(line);
      const { data = {} } = event;
      if (event.type === "actions.requested") {
        for (const action of data.actions ?? []) {
          console.log(
            `  → ${action.name ?? action.toolName} ${short(JSON.stringify(action.input ?? ""), 120)}`
          );
        }
      } else if (event.type === "action.result") {
        const described = describeResult(data.result?.output ?? data.output);
        if (described) {
          console.log(`    ${described}`);
        }
      } else if (event.type === "input.requested") {
        console.log("  ⏸ paused for a person (approval or question)");
      } else if (event.type === "message.completed") {
        answer = data.message ?? data.text ?? answer;
      } else if (event.type === "turn.failed" || event.type === "step.failed") {
        console.log(`  ✖ ${event.type}: ${short(data.message ?? JSON.stringify(data), 300)}`);
      }
      if (
        ["session.waiting", "turn.failed", "session.failed", "turn.waiting"].includes(event.type)
      ) {
        if (event.type !== "turn.waiting" || data.on === "input") {
          console.log(`\n${answer}\n`);
          console.log(`  (${Math.round((Date.now() - started) / 1000)}s, session ${sessionId})`);
          return;
        }
      }
    }
  }
}

console.log(`job ${job ?? "(the agent picks from list_jobs)"}`);
for (const item of cases) {
  console.log(`\n=== ${short(item, 100)}`);
  // eslint-disable-next-line no-await-in-loop -- One case at a time keeps the output readable.
  await follow(await startSession(item));
}
