import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// The agent's felspar skill is the one the installed @felspar/sdk ships.
test("the agent's felspar skill is the SDK's, unchanged", async () => {
  const shipped = await readFile(
    new URL("node_modules/@felspar/sdk/skills/felspar/SKILL.md", import.meta.url),
    "utf8"
  );
  const copy = await readFile(new URL("agent/skills/felspar/SKILL.md", import.meta.url), "utf8");
  assert.equal(copy, shipped, "run: npx @felspar/sdk skill agent --force");
});
