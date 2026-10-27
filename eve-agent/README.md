# Felspar agent on Eve

An [Eve](https://github.com/vercel/eve) agent that asks Felspar for the company's decision instead of making its own.

```text
you: route this ticket: "We were charged twice this month, please refund one payment."
     Account: "Plan: Business (monthly)"

agent ─ get_job_requirements ─► what the job needs to know
      ─ get_job_decision ─────► outcome: billing-team
                                why: "A billing or refund request from a Business or Starter
                                      customer goes to the Billing team."
                                next step: "Tag the ticket billing, tell the customer the Billing
                                      team will reply within one business day, and do not
                                      promise a refund."
                                receipt: execution-…
```

The agent gathers the evidence. Felspar decides, using rules from the company's own policy documents, and returns a receipt anyone can verify later.

## Run it

1. In [Felspar](https://app.felspar.ai) → Workspace → Agents, register an agent for a released job and create its key.
2. `npm install` (Node.js 24.15 or later).
3. `cp .env.example .env.local` and paste in the key, plus a [Vercel AI Gateway](https://vercel.com/ai-gateway) key for the model.
4. `npm run dev`, then paste a ticket or name a company.

No Gateway key? In `npm run dev`, type `/login` and use a ChatGPT subscription instead.

## What's in it

| File | What it does |
| --- | --- |
| `agent/connections/felspar.ts` | Connects to Felspar in two lines with [`@felspar/sdk`](https://www.npmjs.com/package/@felspar/sdk) |
| `agent/skills/felspar/SKILL.md` | How to run any Felspar job: ask what it needs, send exact evidence, act on the decision |
| `agent/instructions.md` | Standing rules: Felspar decides, evidence is quoted, never act on its own |
| `agent/skills/writing/SKILL.md` | How to write a reply a person is glad to read, when the decision asks for one |
| `agent/connections/exa.ts`, `agent/tools/` | Web search and page reading, the clock |
| `agent/agent.ts` | The model |

Nothing in it is specific to one job. The agent runs every job its key is registered for and learns what each needs from Felspar.

## Next

- Let the agent act, only on a decision Felspar verifies: [`eve-agent-agentmail`](../eve-agent-agentmail).
- No agent at all: [`no-agent`](../no-agent).
- Docs: [docs.felspar.ai/integrations/eve](https://docs.felspar.ai/integrations/eve).
