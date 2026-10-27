# Felspar examples

[Felspar](https://felspar.ai) turns a company's policy documents into released decision packs. An agent, or any system, sends a case's evidence and gets back the company's decision: the outcome, the rule that decided it, the next step from the policy, an escalation when a person must decide, and a receipt it can verify.

Each folder here is a complete project. Copy one out, `npm install` and run it.

| Example | What it shows |
| --- | --- |
| [`eve-agent`](eve-agent) | An [eve](https://github.com/vercel/eve) agent that runs any of your Felspar jobs: it reads the evidence (a pasted ticket, a company's own pages), asks Felspar for the decision, writes only what the decision asks for and checks it with Felspar. |
| [`eve-agent-agentmail`](eve-agent-agentmail) | The same agent with an [AgentMail](https://agentmail.to) inbox. Every email draft passes Felspar's action gate: allowed only for a case Felspar decided, with an outcome that permits that output, and only with text Felspar checked. |
| [`crm-direct`](crm-direct) | No agent: map help desk or CRM fields to a job's questions, get the decision and its receipt, and verify the receipt. |

## What you need

- Node.js 24.15 or later.
- A Felspar agent key: in https://app.felspar.ai, Workspace → Agents, register an agent for one or more released jobs and create its key. Each example's README says where to save it; keep it out of chat and Git.
- For the eve examples, a model: a [Vercel AI Gateway](https://vercel.com/ai-gateway) key, or a local ChatGPT subscription through eve's `/login`.

The sample cases are Harbor Cloud's, a fictional company, for a support-routing job built from its routing policy. Everything job-specific comes from your released pack, so the same code runs your jobs.

All three use [`@felspar/sdk`](https://www.npmjs.com/package/@felspar/sdk). Documentation: [docs.felspar.ai](https://docs.felspar.ai).

## License

Apache-2.0
