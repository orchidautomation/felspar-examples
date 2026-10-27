// Add or replace one setting in .env.local without showing it on screen.
//   npm run add-key -- FELSPAR_AGENT_KEY
// Paste the value at the prompt (nothing is echoed) and press Enter. The file
// is created if needed and readable only by you; other settings are kept.
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { stdin, stdout } from "node:process";

const known = ["FELSPAR_AGENT_KEY", "FELSPAR_API_URL"];
const [name] = process.argv.slice(2);
if (!known.includes(name ?? "")) {
  console.error(`Usage: npm run add-key -- <name>\nNames: ${known.join(", ")}`);
  process.exit(2);
}

function readHidden(prompt) {
  return new Promise((resolve) => {
    stdout.write(prompt);
    let value = "";
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    function onData(chunk) {
      for (const character of chunk) {
        if (character === "\r" || character === "\n" || character === "\u0004") {
          stdin.setRawMode?.(false);
          stdin.pause();
          stdin.off("data", onData);
          stdout.write("\n");
          resolve(value.trim());
          return;
        }
        if (character === "\u0003") {
          stdout.write("\n");
          process.exit(130);
        }
        value = character === "\u007f" ? value.slice(0, -1) : value + character;
      }
    }
    stdin.on("data", onData);
  });
}

// The hidden prompt needs a keyboard: from a pipe or a non-interactive shell
// it would wait forever.
if (!stdin.isTTY) {
  console.error("Run this in your own terminal: the hidden prompt needs a keyboard.");
  process.exit(2);
}
// A key copied from chat or Markdown often arrives wrapped in quotes or
// backticks, which the service would read as part of the key.
const value = (await readHidden(`${name} (hidden): `)).replaceAll(/^[`'"]+|[`'"]+$/gu, "").trim();
if (value === "" || /[\r\n]/u.test(value)) {
  console.error("Nothing saved: the value was empty.");
  process.exit(1);
}
const path = ".env.local";
const lines = existsSync(path) ? readFileSync(path, "utf8").split("\n") : [];
const kept = lines.filter((line) => !line.startsWith(`${name}=`));
while (kept.length > 0 && kept.at(-1) === "") {
  kept.pop();
}
writeFileSync(path, `${[...kept, `${name}=${value}`].join("\n")}\n`, { mode: 0o600 });
chmodSync(path, 0o600);
console.log(`Saved ${name} to ${path}.`);
