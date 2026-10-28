// eve-agent-agentmail is eve-agent plus the AgentMail parts. Keep the files
// they share identical, so a fix in one reaches the other.
import { readFile } from "node:fs/promises";

const shared = [
  ".gitignore",
  "agent/agent.ts",
  "agent/connections/exa.ts",
  "agent/connections/felspar.ts",
  "agent/skills/writing/SKILL.md",
  "agent/tools/current_time.ts",
  "agent/tools/web_fetch.ts",
  "agent/tools/web_search.ts",
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
