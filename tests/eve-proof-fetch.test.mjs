import assert from "node:assert/strict";
import test from "node:test";
import { localFetch } from "../scripts/eve-proof-fetch.mjs";

test("the proof never dispatches external telemetry or gateway fetches", async () => {
  let calls = 0;
  const fetch = localFetch(async () => { calls++; });
  for (const url of [
    "https://telemetry.vercel.com/api/eve-cli/v1/events",
    "https://ai-gateway.vercel.sh/v1/models",
    "https://localhost.example.invalid/",
    "https://127.0.0.1.example.invalid/",
    "https://user@external.invalid/",
    "file:///tmp/fixture",
  ]) {
    for (const input of [url, new URL(url)]) {
      await assert.rejects(fetch(input), /blocked a non-loopback fetch/);
    }
  }
  await assert.rejects(fetch(new Request("https://external.invalid/")), /blocked/);
  assert.equal(calls, 0);
});

test("the proof passes local requests while preventing redirect escape", async () => {
  for (const input of [
    "http://127.0.0.1:8123/mcp",
    new URL("http://localhost:8123/verdict"),
    new Request("http://[::1]:8123/session"),
  ]) {
    const options = { method: "POST", body: "fictional", redirect: "follow" };
    const response = new Response("fixture");
    const fetch = localFetch(async (actual, init) => {
      assert.equal(actual, input);
      assert.deepEqual(init, { ...options, redirect: "error" });
      return response;
    });
    assert.equal(await fetch(input, options), response);
  }
});
