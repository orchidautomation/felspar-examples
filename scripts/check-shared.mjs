// The two eve examples share everything but the AgentMail parts; keep the
// shared files identical so a fix in one reaches the other.
import { readFile } from "node:fs/promises";

const shared = [
  ".gitignore",
  "agent/agent.ts",
  "agent/connections/exa.ts",
  "agent/connections/felspar.ts",
  "agent/lib/writing-style.ts",
  "agent/skills/felspar/SKILL.md",
  "agent/skills/writing/SKILL.md",
  "agent/tools/check_writing.ts",
  "agent/tools/current_time.ts",
  "agent/tools/web_fetch.ts",
  "agent/tools/web_search.ts",
  "evaluate.mjs",
  "harbor-tickets.txt",
  "skill.test.mjs",
  "writing-style.test.mjs",
];
const differing = [];
for (const file of shared) {
  const [basic, gated] = await Promise.all(
    ["eve-agent", "eve-agent-agentmail"].map((example) => readFile(`${example}/${file}`, "utf8"))
  );
  if (basic !== gated) {
    differing.push(file);
  }
}
if (differing.length > 0) {
  console.error(`eve-agent and eve-agent-agentmail differ in: ${differing.join(", ")}`);
  process.exit(1);
}
console.log(`${shared.length} shared files identical`);
