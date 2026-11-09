# Felspar with no agent, in Python

The [`no-agent`](../no-agent) example in Python: one script, one support ticket in, the company's decision out. Nothing on your side runs a model: any system that has the facts, such as a help desk, a CRM workflow or a scheduled job, can call Felspar the same way.

It uses [`felspar`](https://pypi.org/project/felspar/) 0.1.0a1, the Python package. It is an **alpha**: its API, including the generated model names, may change between releases, so `requirements.txt` pins the exact version.

It prints the same lines as `no-agent`:

```text
$ python decide.py
outcome:   billing-team
why:       A billing or refund request from a Business or Starter customer goes to the Billing team.
next step: Tag the ticket billing, tell the customer the Billing team will reply within one business day, and do not promise a refund.
receipt:   execution-82db6834…
verified:  reproduced
```

## Run it

1. In [Felspar](https://app.felspar.ai) → Workspace → Company agents, register an agent for a released job and create its key.
2. Install it (Python 3.11 or later):

   ```sh
   python -m venv .venv && . .venv/bin/activate
   pip install -r requirements.txt
   ```

3. `cp .env.example .env.local`, paste in the key, then load it: `set -a && . ./.env.local && set +a`.
4. Set `job` and `facts` in `decide.py` to your job's questions, then `python decide.py`.

## Send facts, not answers

Each fact is what a source says, in its own words, and where it came from:

```python
"request": {
    "text": "We were charged twice this month, please refund one payment.",
    "source": {"class": "ticket-thread", "id": "helpdesk:ticket/HC-1002", "observedAt": now},
},
```

Felspar decides what the words mean, using the definitions in the company's released policy. So send the facts underneath an answer, not your system's own answer: a dropdown value such as `Tier = Enterprise` is someone's opinion of the answer, and anyone with access can change it. A bare label is refused with `label_needs_mapping`. Numbers and dates may be sent as typed values, such as `{"value": 1800, "source": ...}`.

The job's questions, and the sources each accepts, are in its brief: `GET https://api.felspar.ai/v0/jobs/<job>/brief` with your key. [Build an integration](https://docs.felspar.ai/guides/build-an-integration) walks through every step in curl, TypeScript and Python.

## What comes back

- **An outcome**, the rule that decided it and the company's next step, quoted from its policy.
- **Or no outcome**: the case is held for a person, with the next step and the escalation the policy names.
- **A receipt.** `felspar.verify(result)` asks Felspar to re-run the decision and returns what it reproduced, or `None`. `reproduced` means the same policy release and evidence give the same outcome. A receipt records what Felspar decided from the evidence it was given. It is not a factual, legal or security certification.
