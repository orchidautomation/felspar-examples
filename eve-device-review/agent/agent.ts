import { defineAgent } from "eve";

// No shell, no file writes, no web: the agent reads the research systems,
// asks Felspar for the decision, and takes only the review action it allows.
// A Vercel AI Gateway model, ready to run with AI_GATEWAY_API_KEY. To run on
// a local ChatGPT subscription instead, use /login in `npm run dev`.
export default defineAgent({
  model: "anthropic/claude-opus-5.5",
  defaultTools: false,
});
