# Felspar from your records, with no agent

Decide cases straight from a help desk or CRM: map a record's fields to a Felspar job's questions, send them, and get the company's decision, its reason, the next step and a receipt. No agent and no model run on your side. Felspar reads each answer-choice question from the record's own words against the released definitions, and the decision itself is deterministic.

```text
$ npm run decide -- --job support-ticket-routing --record HC-1002 --again

HC-1002  702 ms
  outcome:    billing-team
  why:        A billing or refund request from a Business or Starter customer goes to the Billing team.
  next step:  Tag the ticket billing, tell the customer the Billing team will reply within one business day, and do not promise a refund.
  receipt:    execution-f0ed4fc0…
              sha256:c684dfe0…
  verified:   reproduced
  again:      billing-team, same receipt: yes
```

## Run it

1. In Felspar at https://app.felspar.ai (Workspace → Agents), register an agent for a released job and create its key.
2. `npm install` (Node.js 24.15 or later), then `npm run add-key -- FELSPAR_AGENT_KEY` in your own terminal (nothing is shown; surrounding quotes or backticks are removed).
3. `npm run decide` lists the jobs the key may run; `npm run describe -- <job>` shows each question, what it takes and which sources it accepts.
4. Add your job to `mapping.mjs`, then `npm run decide -- --job <job>`. `--record <id>` decides one record; `--again` sends the same call again to show the same decision comes back.

The sample records in `records.mjs` are Harbor Cloud's, a fictional company, for a support-routing job built from its routing policy (`support-ticket-routing`, with the questions `request` and `plan`). Replace them with an export from your own system.

## Mapping fields to facts

`mapping.mjs` has one function per question key. Each returns what the record says and where it came from:

```js
plan: ({ account }) => ({
  text: `Plan: ${account.plan}`,
  source: { class: "account-record", id: `crm:account/${account.id}`, observedAt: account.planVerifiedAt },
}),
```

- **Answer-choice and yes/no questions take the record's words** (`text`), such as a ticket's body or "Plan: Business (monthly)". Felspar decides what they mean. A bare picklist label such as `{ value: "business" }` is refused with `label_needs_mapping`, and `lib/facts.mjs` refuses it before sending.
- **Number and date questions may take a typed value**: `{ value: 1800, source }`, or a date as `YYYY-MM-DD`.
- **`source.class` must be one the question accepts** (`npm run describe` lists them), and `source.observedAt` is when the value was true. Felspar applies the job's age limit to it, so use the field's own timestamp (here, when the plan was last verified), not when you read the record.
- Only the job's own question keys are accepted. A question with no mapping is simply not sent; Felspar decides on what it receives and says what is still open.

## What comes back

- `outcome`, with the rule that decided it and the company's next step, quoted from the policy the job was built from.
- Or no outcome: the case is held, with what is still open and the escalation the policy names.
- A receipt. `verifyReceipt` asks Felspar to re-run the decision and compare it; `reproduced` means the same release, evidence and outcome. A receipt records what Felspar decided from the evidence it was given. It is not a factual, legal or security certification.

`decide.mjs` uses [`@felspar/sdk`](https://www.npmjs.com/package/@felspar/sdk): `listJobs`, `resolveFacts` and `verifyReceipt`. It reads the job's description from `GET /v0/jobs/{job}/brief`. `npm test` runs the mapping checks offline.
