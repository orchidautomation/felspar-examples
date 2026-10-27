import { defineTool } from "eve/tools";
import { checkWriting } from "../lib/writing-style.ts";

// The writing skill's code check: this team's house style, run on the agent's
// side. Felspar's check_output still decides whether the text follows policy.
export default defineTool({
  description:
    "Check a message you wrote against this team's house style (paragraphs, length, questions, em dashes, links, placeholders) before you check it with Felspar. Returns pass or revise with what to fix. A pass here is style only, never a policy check.",
  inputSchema: {
    type: "object",
    properties: {
      text: { type: "string", description: "The full text, exactly as you would send it." },
      output: {
        type: "string",
        description: "The output's id from the Felspar decision, when it lists one.",
      },
    },
    required: ["text"],
    additionalProperties: false,
  },
  execute({ text, output }: { text: string; output?: string }) {
    return checkWriting(text, output);
  },
});
