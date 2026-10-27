# Felspar with no agent

One script, one support ticket in, the company's decision out. Nothing on your side runs a model: any system that has the facts, such as a help desk, a CRM workflow or a scheduled job, can call Felspar the same way.

```text
$ npm run decide
outcome:   billing-team
why:       A billing or refund request from a Business or Starter customer goes to the Billing team.
next step: Tag the ticket billing, tell the customer the Billing team will reply within one business day, and do not promise a refund.
receipt:   execution-82db6834…
verified:  reproduced
```

## Run it

1. In [Felspar](https://app.felspar.ai) → Workspace → Agents, register an agent for a released job and create its key.
2. `npm install` (Node.js 24.15 or later).
3. `cp .env.example .env.local` and paste in the key.
4. Set `job` and `facts` in `decide.mjs` to your job's questions, then `npm run decide`.

## Send facts, not answers

Each fact is what a source says, in its own words, and where it came from:

```js
request: {
  text: "We were charged twice this month, please refund one payment.",
  source: { class: "ticket-thread", id: "helpdesk:ticket/HC-1002", observedAt: now },
},
```

Felspar decides what the words mean, using the definitions in the company's released policy. So send the facts underneath an answer, not your system's own answer: a dropdown value such as `Tier = Enterprise` is someone's opinion of the answer, and anyone with access can change it. A bare label is refused with `label_needs_mapping`. Numbers and dates may be sent as typed values, such as `{ value: 1800, source }`.

The job's questions, and the sources each accepts, are in its brief: `GET https://api.felspar.ai/v0/jobs/<job>/brief` with your key. [REST guide](https://docs.felspar.ai/integrations/rest-and-n8n).

## What comes back

- **An outcome**, the rule that decided it and the company's next step, quoted from its policy.
- **Or no outcome**: the case is held for a person, with the next step and the escalation the policy names.
- **A receipt.** `verifyReceipt` asks Felspar to re-run the decision; `reproduced` means the same policy release and evidence give the same outcome. A receipt records what Felspar decided from the evidence it was given. It is not a factual, legal or security certification.
