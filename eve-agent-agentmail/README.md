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

## Candidate Eve adapter update

This branch's durable-state wiring needs the unreleased SDK update; the proposed minimum is `@felspar/sdk 0.5.0`. The dependency range and lockfile still describe the published `0.4.x` example. Update both in the separate release handoff before merging or distributing this example. Eve remains pinned to `0.71.0`.

Use the same host-controlled state handle in the hook and approval policy. Keep it private to this tenant and session. Each subagent needs its own decision and output check. Resume local sessions with `eve dev --resume`. Missing usable evidence requires a fresh decision and output check. Do not overwrite the hook's `*` handler.

Previously saved evidence can remain usable after a recorder error or missed callback only when fresh action-time receipt verification and output-check readback succeed, with the exact text, session, case and tenant credentials still matching. Corrupt or unreadable state, a rejected receipt, an unavailable output check or any mismatch denies the action. Silent hook removal/replacement is not detected: successful verification does not establish that the recorder is still running.

To run the deterministic runtime proof against a candidate SDK, install exact Eve and AI SDK versions in a scratch directory, then run from the repository root:

```sh
npm install --prefix /tmp/eve-proof --no-audit --no-fund eve@0.71.0 ai@7.0.163
npm run test:eve -- /tmp/eve-proof /path/to/felspar/packages/sdk/src
```

The probe uses local mock MCP servers and a scripted model. It checks the action executor count for decisions, output checks, negative cases, child sessions and cold resume. No real inbox or model API is used. Repeat with Eve `0.83.0` or `1.0.0-rc.6` in a separate scratch directory.

Each spawned Eve process explicitly disables CLI telemetry, including after cold restart. It also replaces inherited Node preloads with a guard that rejects non-loopback global `fetch` calls, including incidental gateway metadata requests. These changes affect only the child environment, not machine preferences. Other host configuration and network APIs remain outside the guard; this is not a general network sandbox.

The example's own `npm test` runs this proof using its installed Eve and SDK. The existing SDK examples check invokes that script, and this repository's CI runs it after installation.
