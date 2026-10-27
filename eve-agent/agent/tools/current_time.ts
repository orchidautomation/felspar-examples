import { defineTool } from "eve/tools";

// The time now, for an excerpt's observedAt: when the agent fetched the page.
// Without it the agent fetched time services to find out.
export default defineTool({
  description: "Get the current time (UTC, ISO 8601). Use it as observedAt for pages you fetch.",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
  execute() {
    return { now: new Date().toISOString() };
  },
});
