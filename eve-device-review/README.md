# Device review agent on Eve

The agent from the [Felspar walkthrough](https://felspar-walkthrough.vercel.app): an [Eve](https://github.com/vercel/eve) agent at Meridell Device Review, a made-up company that reviews medical devices for hospitals. The agent does the research. Felspar answers the rubric's questions from the records the agent found, picks the next step, and signs a receipt. An action runs only if it matches what Felspar decided.

This folder is here to read. Its research systems and review actions were simulated, with fictional records, so you'd point the two connections at your own MCP servers before running it.

```text
review request: "Evaluate catalog number CRV-48380 for our operating rooms."

agent ─ get_job_requirements ─► the rubric's questions and the records each one needs
      ─ research search/open ─► FDA record, recall search, adverse events, studies, quote, contract
      ─ get_job_decision ─────► outcome: scoring  (or a hold for a person, with what's missing)
                                answers quoted from the records, receipt: execution-…
      ─ send_to_scoring ──────► gate: decided this device, receipt verified, outcome matches ─► runs
```

## What's in it

| File | What it does |
| --- | --- |
| `agent/instructions.md` | Three sentences. The job's requirements come from Felspar, not the prompt |
| `agent/connections/felspar.ts` | Felspar, as a registered company agent, in two lines with [`@felspar/sdk`](https://www.npmjs.com/package/@felspar/sdk) |
| `agent/connections/research.ts` | Your research systems: search returns hits, the agent opens each record by ID |
| `agent/connections/review.ts` | Your review actions. Every call goes through Felspar's action gate first |
| `agent/lib/felspar-gate.ts` | Which outcome each action belongs to. The clinical-trial note must match text Felspar checked |
| `agent/hooks/felspar-decisions.ts`, `agent/lib/felspar-state.ts` | Record each decision and output check so the gate can verify them |
| `agent/agent.ts` | The model. No shell, file writes or web |

The rubric itself isn't in the code. It lives in the company's Google Doc and the Decision Pack released from it. Change the Doc, release the new version, and the agent and gate follow.

## What the gate checks

| Action | Runs only when Felspar decided |
| --- | --- |
| `send_to_scoring` | `scoring` |
| `send_to_safety_review` | `safety-review` |
| `send_to_price_review` | `price-review` |
| `send_to_analyst` | `analyst-review`, or Felspar held the device and its next step is analyst review |
| `recommend_clinical_trial` | `clinical-trial`, and the `note` is exactly the text `check_output` passed |

A "do not recommend" outcome has no action here: it goes to a person first.

A hold is not a decision, so no other action runs on a held device. The gate reads only Felspar's own replies, recorded by the host, never the model's text.

## One lesson from the run

Freshness rules ("records from the last 30 days") are only as good as the record's date. Have your research server stamp each record with the date its own system produced it. Don't let the agent supply it, since the time it read a page is not the time the page was written.

## Run it with your own systems

1. In [Felspar](https://app.felspar.ai), release a device-review job and register an agent for it (Workspace → Company agents), then create its key.
2. `npm install` (Node.js 24.15 or later).
3. `cp .env.example .env.local`. Add the key, a [Vercel AI Gateway](https://vercel.com/ai-gateway) key, your job ID and your two MCP server URLs.
4. `npm run dev`, then paste a review request.

Everything named here is fictional: the company, its rubric, devices, catalog numbers and records.
