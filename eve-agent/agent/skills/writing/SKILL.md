---
name: writing
description: Use this skill whenever you write a message for a decided case, such as a support reply, an email to a company or any other output a Felspar decision lists under outputs. Load it after get_job_decision and before you write, and again before you rewrite text that check_output sent back.
metadata:
  version: "0.1.0"
---

# Writing a message for a decided case

Felspar has already decided the case. Your job here is to turn that decision into a message a person is glad to read. Felspar owns what the message must and must not say; this skill owns how it reads. Never change, soften or add to the decision to make it read better.

## What goes in

Write from three things only:

1. **The case's evidence**: the record or pages you gathered (who wrote, what they asked, their account, what you found). Use it to make the message about this person and this case.
2. **Felspar's decision**: the outcome, its `nextStep`, and `why` (the rules that decided it, quoted).
3. **The output's `context`**: the approved passages for this output. Use their wording for anything the company commits to.

Everything else is connective tissue: greeting, acknowledging what the person said, transitions, a plain close. Write it naturally; it carries no promise.

## How it reads

- **Open with them.** Acknowledge what they asked or what you found about them, in their terms, with one concrete detail from the evidence.
- **Say the decision plainly**, and the reason in everyday words drawn from `why`. "Because your plan includes priority support" reads better than "per policy section 4".
- **Say what happens next**: the next step, who does it and what the person can do, from `nextStep` and the context.
- **Close briefly.** One line; no recap of the message.

Not this: a one-line notice ("Your ticket has been escalated per your plan."). The person should understand what was decided, why, and what happens next without writing back to ask.

## What you never add

No promise, date, amount, discount, exception or policy that isn't in the evidence, the decision or the context. If the person asked for something Felspar didn't decide, say who will answer it (from `nextStep`); don't answer it yourself. Don't claim you read, saw or did something the evidence doesn't show.

## Check with Felspar

Check the text with `check_output` and fix exactly what it flags. Felspar's checks are the company's policy; style never overrides them. The text you show is exactly the text Felspar passed last.
