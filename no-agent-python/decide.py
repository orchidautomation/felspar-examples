"""One support ticket in, the company's decision out: no agent, and no model on
your side. Run: python decide.py, with FELSPAR_AGENT_KEY in the environment."""

import os
import uuid
from datetime import datetime, timezone

from felspar import Client
from felspar.generated.api.agents import decide_job, describe_job
from felspar.generated.models.decision_input_any_of_variant_0 import (
    DecisionInputAnyOfVariant0 as FactsRequest,
)

job = "support-ticket-routing"
origin = os.environ.get("FELSPAR_ORIGIN", "https://api.felspar.ai")
felspar = Client(origin, os.environ["FELSPAR_AGENT_KEY"])

# The evidence: what each source says, in its own words, and where it came from.
# Send the facts, never your system's answer: Felspar decides what they mean
# from the definitions in the company's released policy.
now = datetime.now(timezone.utc).isoformat()
facts = {
    "request": {
        "text": "We were charged twice this month, please refund one payment.",
        "source": {"class": "ticket-thread", "id": "helpdesk:ticket/HC-1002", "observedAt": now},
    },
    "plan": {
        "text": "Plan: Business (monthly)",
        "source": {"class": "account-record", "id": "crm:account/acct-7781", "observedAt": now},
    },
}

# The release Felspar runs this job on for your key.
brief = describe_job.sync(job, client=felspar.transport).to_dict()

response = decide_job.sync_detailed(
    job,
    client=felspar.transport,
    body=FactsRequest.from_dict({
        "mode": "facts",
        "jobId": job,
        "executionId": str(uuid.uuid4()),
        "expectedReleaseDigest": brief["release"]["releaseDigest"],
        "facts": facts,
    }),
)
if response.status_code != 200:
    raise SystemExit(f"Felspar refused the request ({response.status_code}): {response.content.decode()}")
result = response.parsed.to_dict()["result"]
if result is None:
    raise SystemExit("Still running: run it again in a few seconds")

rules = ((result.get("explanation") or {}).get("why") or {}).get("rules") or [{}]
entries = (result.get("context") or {}).get("entries") or [{}]
print("outcome:  ", result.get("outcome") or "none: held for a person")
print("why:      ", (rules[0].get("text") or {}).get("text"))
print("next step:", entries[0].get("body") if result.get("outcome") else (result.get("nextStep") or {}).get("text"))
print("receipt:  ", result["executionObjectId"])

# Anyone can later ask Felspar to re-run the decision and confirm the receipt.
decided = felspar.verify(result)
print("verified: ", "reproduced" if decided is not None else "not reproduced")
