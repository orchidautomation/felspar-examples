# Felspar agent on Eve, with gated email drafts

The [`eve-agent`](../eve-agent) example, plus an [AgentMail](https://agentmail.to) inbox the agent can write drafts in. Every draft passes Felspar's **action gate** first. The gate allows a draft only when all of these hold:

- Felspar decided this case, and Felspar re-verifies that decision's receipt.
- The decided outcome lists the output the draft writes (here, a `customer-reply`).
- The draft's text is exactly what Felspar's `check_output` passed.

Anything else is denied, with the company's next step instead. The agent never sends email; a person reviews and sends each draft.

```text
agent ─ get_job_decision ─► outcome: billing-team   (lists the output customer-reply)
      ─ check_output ─────► pass
      ─ create_draft ─────► gate: receipt verified, outcome allows customer-reply, text matches ─► draft saved
```

## Run it

1. Do steps 1–2 of [`eve-agent`](../eve-agent#run-it).
2. In [AgentMail](https://agentmail.to), create an inbox for the agent and an API key.
3. `cp .env.example .env.local` and fill in both keys, the inbox, and your job and output ids. The defaults are for a support-routing job.
4. `npm run dev`, then paste a ticket.

## What's added to `eve-agent`

| File | What it does |
| --- | --- |
| `agent/connections/agentmail.ts` | The inbox: list, read and create drafts. No tool that sends or edits one |
| `agent/lib/felspar-gate.ts` | The gate, from [`@felspar/sdk`](https://www.npmjs.com/package/@felspar/sdk): which tool writes which output, and the fields it may set |
| `agent/hooks/felspar-decisions.ts` | Records each Felspar decision and output check so the gate can check them |

The rules come from the released pack, not from this code: change the policy, release it, and the gate follows. [How the gate works](https://docs.felspar.ai/guides/pre-action-gate).
