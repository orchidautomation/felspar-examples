import { defineMcpClientConnection } from "eve/connections";
import { felsparGate } from "@felspar/sdk/eve";
import { gate } from "../lib/felspar-gate.ts";

// Email through AgentMail's hosted MCP server (an inbox for the agent), key in
// AGENTMAIL_API_KEY. Drafts only: no tool that sends or rewrites a draft is
// exposed. Every call uses the agent's own inbox (FELSPAR_AGENT_INBOX), set by
// the app, not the model. Writing a draft passes Felspar's action gate.
const agentInbox = process.env.FELSPAR_AGENT_INBOX;
const gated = felsparGate(gate);

export default defineMcpClientConnection({
  url: "https://mcp.agentmail.to/mcp",
  description:
    "AgentMail: the agent's own email inbox. Write email drafts for a person to review and send.",
  headers: { "x-api-key": process.env.AGENTMAIL_API_KEY ?? "" },
  tools: { allow: ["get_inbox", "list_drafts", "get_draft", "create_draft"] },
  // Without a configured inbox, every gated call is denied below.
  toolCall: { providedArguments: { inboxId: agentInbox ?? "(not set)" } },
  approval: async (call) => (agentInbox === undefined ? "denied" : await gated(call)),
});
