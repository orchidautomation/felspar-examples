import { defineMcpClientConnection } from "eve/connections";
import { approve } from "../lib/felspar-gate.ts";

// The review actions, behind your own MCP server. Every call passes Felspar's
// action gate first: it runs only for the outcome Felspar decided on that device,
// or, for send_to_analyst, when Felspar held the device for an analyst.

export default defineMcpClientConnection({
  url: process.env.REVIEW_MCP_URL ?? "http://127.0.0.1:8790/review/mcp",
  description:
    "Device review actions: send a review to scoring, recommend a clinical trial, or send it to price review, safety review or an analyst. Each is allowed only for the outcome Felspar decided on that device.",
  approval: (call) => approve(call),
});
