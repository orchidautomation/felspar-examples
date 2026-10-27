import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Each eve example's felspar skill is the one @felspar/sdk ships, unchanged.
// Refresh a copy with: npx @felspar/sdk skill agent --force
for (const example of ["eve-agent", "eve-agent-agentmail"]) {
  test(`${example}'s felspar skill is the SDK's`, async () => {
    const read = (path) => readFile(new URL(`../${example}/${path}`, import.meta.url), "utf8");
    const shipped = await read("node_modules/@felspar/sdk/skills/felspar/SKILL.md");
    assert.equal(await read("agent/skills/felspar/SKILL.md"), shipped);
  });
}
