import { defineMcpClientConnection } from "eve/connections";

// Your research systems, behind one MCP server: search returns a list of hits,
// and the agent opens each record by its ID. Send Felspar the whole record with
// the date its system produced it, set by your integration, not by the agent.
export default defineMcpClientConnection({
  url: process.env.RESEARCH_MCP_URL ?? "http://127.0.0.1:8790/research/mcp",
  description:
    "The research systems: FDA device databases (510(k), De Novo and PMA, registration and listing, recalls), the adverse event summary, the literature search, vendor quotes, the hospital's contracts, vendor web pages and review requests. Search records for a device, then open them by ID.",
});
