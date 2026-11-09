// Sends each sample in samples.jsonl through the hook in enforce mode and
// prints what it would do. Nothing is run: the hook only asks Felspar.
// The approval lookup uses the current branch, so try it on a ticket branch.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const run = Date.now().toString(36);
for (const line of readFileSync(new URL("./samples.jsonl", import.meta.url), "utf8").split("\n").filter(Boolean)) {
  const call = { ...JSON.parse(line), cwd: process.cwd() };
  call.tool_use_id = `${call.tool_use_id}-${run}`;
  const hook = spawnSync(process.execPath, [new URL("./.claude/hooks/felspar-hook.mjs", import.meta.url).pathname], {
    input: JSON.stringify(call), encoding: "utf8", env: { ...process.env, FELSPAR_MODE: "enforce" },
  });
  const out = hook.stdout.trim() ? JSON.parse(hook.stdout).hookSpecificOutput : null;
  const verdict = !out ? "allow" : out.additionalContext ? `flag   ${out.additionalContext}` : `block  ${out.permissionDecisionReason}`;
  const label = call.tool_input.command ?? `${call.tool_name} ${call.tool_input.file_path ?? ""}`.trim();
  console.log(`${label.padEnd(48)} ${verdict.replaceAll("\n", " ")}`);
}
