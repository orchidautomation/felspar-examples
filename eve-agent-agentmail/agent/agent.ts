import { defineAgent } from "eve";

// Only the tools this agent needs: read the web for evidence, and Felspar
// (through its connection) for the decision. No shell, no file writes.
// A Vercel AI Gateway model, ready to run with AI_GATEWAY_API_KEY. To run on
// a local ChatGPT subscription instead, use /login in `npm run dev`: it
// rewrites this line in your copy, which you keep out of commits.
export default defineAgent({
  model: "anthropic/claude-opus-5.5",
  defaultTools: false,
});
