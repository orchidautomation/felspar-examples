# Felspar examples

[Felspar](https://felspar.ai) holds a company's approved decisions. You send a case's facts; Felspar returns the company's decision: the outcome, the rule from its policy that decided it, the next step, and a receipt anyone can verify later.

Each folder is a complete project. Copy one, `npm install`, add your key, run it.

| Example | What it shows |
| --- | --- |
| [`eve-agent`](eve-agent) | An [Eve](https://github.com/vercel/eve) agent that gathers the evidence and asks Felspar for the decision instead of making its own. |
| [`eve-agent-agentmail`](eve-agent-agentmail) | The same agent with an email inbox. Every draft passes Felspar's action gate: only for a decided case, only what the decision allows, only text Felspar checked. |
| [`no-agent`](no-agent) | One script, no agent: a ticket's facts in, the decision and its receipt out. |
| [`crm-and-agent`](crm-and-agent) | A CRM workflow and an agent qualify the same companies from one sales policy, and get the same decisions. |

You need Node.js 24.15 or later and a Felspar agent key: in [Felspar](https://app.felspar.ai) → Workspace → Company agents, register an agent for a released job and create its key. The Eve examples also need a model: a [Vercel AI Gateway](https://vercel.com/ai-gateway) key, or a ChatGPT subscription through `/login`.

The samples come from two fictional companies: Harbor Cloud's support-ticket routing and Kestrel Analytics' sales qualification. Nothing else is job-specific: the agents learn what each job needs from Felspar.

Docs: [docs.felspar.ai](https://docs.felspar.ai) · SDK: [`@felspar/sdk`](https://www.npmjs.com/package/@felspar/sdk) · License: Apache-2.0
