import assert from "node:assert/strict";
import test from "node:test";
import { MappingError, factsFor } from "./lib/facts.mjs";

// A job description as Felspar returns it, cut to what the mapping reads.
const question = (key, type, send, classes) => ({
  key,
  type,
  answer: { send, applies: "always" },
  evidencePolicy: { allowedSourceClasses: classes },
});
const description = {
  job: "review-claim",
  questions: [
    question("cause", "enum", "text", ["claim-form"]),
    question("amount", "number", "text_or_value", ["claim-form", "ledger"]),
    question("incident_date", "date", "text_or_value", ["claim-form"]),
  ],
};
const record = { id: "CL-9", description: "A pipe burst in the kitchen.", amount: 1800, date: "2026-10-01" };
const source = (cls) => ({ class: cls, id: "claims:CL-9", observedAt: "2026-10-20T00:00:00.000Z" });

test("words for a choice, typed values for a number and a date", () => {
  const { facts, unmapped } = factsFor(
    description,
    {
      cause: (r) => ({ text: r.description, source: source("claim-form") }),
      amount: (r) => ({ value: r.amount, source: source("ledger") }),
    },
    record
  );
  assert.deepEqual(Object.keys(facts), ["cause", "amount"]);
  assert.equal(facts.amount.value, 1800);
  assert.deepEqual(unmapped, ["incident_date"]);
});

test("a label for a choice question is refused before anything is sent", () => {
  assert.throws(
    () => factsFor(description, { cause: () => ({ value: "water-damage", source: source("claim-form") }) }, record),
    (error) => error instanceof MappingError && /label_needs_mapping/u.test(error.message)
  );
});

test("an unknown question or a source class the job doesn't accept is refused", () => {
  assert.throws(
    () => factsFor(description, { seats: () => ({ text: "42", source: source("claim-form") }) }, record),
    /not a question of review-claim/u
  );
  assert.throws(
    () => factsFor(description, { cause: (r) => ({ text: r.description, source: source("email") }) }, record),
    /not one of claim-form/u
  );
});

test("a field the record leaves empty is left out", () => {
  const { facts } = factsFor(description, { incident_date: () => null }, record);
  assert.deepEqual(facts, {});
});
