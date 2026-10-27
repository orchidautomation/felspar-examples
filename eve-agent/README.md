# Felspar agent on eve

A small [eve](https://github.com/vercel/eve) agent that runs a company's Felspar jobs: you give it a case (a support ticket, a company's domain, any record a job is about), it gathers the exact evidence from that record or its own pages, asks Felspar for the decision, and answers with Felspar's outcome and next step, or with an escalation when Felspar holds the case.

```text
you: evaluate example.com
  └─ get_job_requirements ─► questions, answer meanings, where to look, next steps
  └─ web_fetch https://example.com ─► exact quotes per question
  └─ get_job_decision ─► outcome · why · next step · receipt
        ├─ decided ─────────────► answer block
        ├─ held: gather more ───► fetch the named page once, decide again
        └─ held: a person ──────► answer block with status "escalated"
```

Felspar decides; the agent never does. Held outcomes carry the company's own next step (its escalation path), quoted from the policy the pack was built from.

## What connects it to Felspar

Two pieces, both from [`@felspar/sdk`](https://www.npmjs.com/package/@felspar/sdk) on npm:

- `agent/connections/felspar.ts`, the whole connection:

  ```ts
  import { defineMcpClientConnection } from "eve/connections";
  import { felsparConnection } from "@felspar/sdk/eve";
  export default defineMcpClientConnection(felsparConnection());
  ```

- `agent/skills/felspar/SKILL.md`, the method for any Felspar job. It is the SDK's skill, unchanged; refresh it with `npx @felspar/sdk skill agent --force` (a test checks the copy matches).

Everything else is this example's own: web reading (`tools/`, the Exa connection) and the writing skill. To let the agent act on a decision, such as writing an email draft, behind Felspar's action gate, see [`../eve-agent-agentmail`](../eve-agent-agentmail).

## Writing: the team's own skill

Felspar decides and checks what the policy requires; how a message reads is the team's. `agent/skills/writing/SKILL.md` says how to turn a decision into a reply or email a person is glad to read: open with them, say the decision and its reason plainly, say what happens next, and add no promise the decision or its approved context doesn't make. Before Felspar's `check_output`, the agent runs `check_writing` (`agent/tools/check_writing.ts`), plain code over the house style in `agent/lib/writing-style.ts`: paragraph count, length, questions, em dashes, links and unfilled placeholders, per output id with a default. Change that file to match your own style; Felspar never sees it. `node --test writing-style.test.mjs` runs its tests.

## Run it

1. In Felspar at https://app.felspar.ai (Workspace → Agents), register an agent for one or more of your released jobs and create its key. The job IDs are your workspace's own; the agent finds them with `list_jobs`.
2. `npm install` (Node.js 24.15 or later), then save the key with `npm run add-key -- FELSPAR_AGENT_KEY` in your own terminal (nothing is shown on screen; surrounding quotes or backticks are removed). Keep it out of chat and Git.
3. Choose a model (below), then `npm run dev`.
4. Give it a case: a company's domain such as `evaluate example.com` for a job about companies, or a pasted record for a job about records. For several cases without the UI, `npm run serve` in one terminal and `npm run evaluate -- stripe.com ramp.com` in another; add `--job <job-id>` to name the job.

### Choose a model

- **Vercel AI Gateway (ready to run).** The agent uses `anthropic/claude-opus-5.5` through the Gateway. Save your Gateway key with `npm run add-key -- AI_GATEWAY_API_KEY`, or connect it with `/login` in `npm run dev`. Any Gateway model ID works in `agent/agent.ts`.
- **A local ChatGPT subscription.** In `npm run dev`, `/login` and choose ChatGPT. eve rewrites the `model` line in your copy of `agent/agent.ts`; keep that change out of commits. A subscription model can't run in a deployment.

## Switch jobs

One agent runs every job its Felspar key is registered for (Workspace → Agents → the agent's jobs). Name the job in your request, or let the agent pick: it calls `list_jobs`, which gives each job's purpose, and chooses the one that fits what you gave it.

```text
you: route this ticket with support-ticket-routing:
     Ticket HC-1005: "Please delete all data you hold about me and my company under GDPR."
     Account record: "Plan: Business (yearly)"
```

For a ticket, the evidence is the ticket's own words: the agent quotes them and doesn't browse. `harbor-tickets.txt` holds sample tickets from Harbor Cloud, a fictional company, for a support-routing job built from its routing policy. To run them without the UI: `npm run serve`, then `npm run evaluate -- --job <your support job> --file harbor-tickets.txt`.

`FELSPAR_JOB` sets the default job for `npm run evaluate` (unset, the agent picks from `list_jobs`). The agent can only fetch web pages, check its own writing style (`check_writing`) and call Felspar's `list_jobs`, `get_job_requirements`, `get_job_decision` and `check_output`; it has no shell or file access. Its `felspar` skill is the method and is the same for every job; everything job-specific comes from Felspar. What the agent writes comes from the released pack too: when a decision lists `outputs` (such as a reply for a decided ticket), the agent writes each from the case's evidence and that output's approved context, checks it with `check_output`, and shows the checked text; when it lists none, it writes nothing.
