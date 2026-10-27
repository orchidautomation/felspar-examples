import { defineMcpClientConnection } from "eve/connections";

// Web search and page reading through Exa's hosted MCP server, which needs no
// key at its free rate limit; set EXA_API_KEY for more. It works with any
// model, including a ChatGPT subscription, which has no search of its own.
// Exa reads pages through its own crawler, so it can read sites that block a
// plain fetch.
export default defineMcpClientConnection({
  url: process.env.EXA_API_KEY
    ? `https://mcp.exa.ai/mcp?exaApiKey=${encodeURIComponent(process.env.EXA_API_KEY)}`
    : "https://mcp.exa.ai/mcp",
  description:
    "Exa: search the web (web_search_exa) and read a page's text (web_fetch_exa), including sites that block a plain fetch.",
  tools: { allow: ["web_search_exa", "web_fetch_exa"] },
});
