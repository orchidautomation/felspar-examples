import { readFileSync } from "node:fs";

// Public fictional policy only. These are reviewed fixture expectations,
// never customer authority or a copy of a hosted release.
export const text = readFileSync(
  new URL("./policy.md", import.meta.url),
  "utf8",
);
const paragraphs = text.split("\n\n");
const quote = (prefix) => {
  const found = paragraphs.find((paragraph) => paragraph.startsWith(prefix));
  if (!found) throw new Error(`Policy quote missing: ${prefix}`);
  return found;
};
export const draft = {
  schema: "felspar.pack-draft/v1",
  job: "kestrel-sales-qualification",
  purpose: quote("This policy decides"),
  evidenceKinds: ["crm-record", "company-site", "linkedin"],
  maxEvidenceAgeDays: 90,
  questions: [
    {
      key: "employees",
      type: "number",
      unit: "employees",
      unitWords: ["employees"],
      meaning: quote("Count the company's employees"),
    },
    {
      key: "ai_work",
      meaning: quote("What is the state"),
      answers: [
        { value: "in-progress", meaning: quote("In progress:") },
        { value: "planned", meaning: quote("Planned:") },
        {
          value: "other",
          meaning: quote("Other AI activity:"),
          noneOfThese: true,
        },
      ],
    },
  ],
  outcomes: [
    { id: "qualified", nextStep: quote("Qualified:") },
    { id: "not-qualified", nextStep: quote("Not qualified:") },
  ],
  whenUnresolved: quote("If the employee count"),
  rules: [
    {
      id: "too-small",
      meaning: quote("A company with fewer"),
      when: { employees: { lt: 500, quote: "fewer than 500 employees" } },
      outcome: "not-qualified",
    },
    {
      id: "qualified",
      meaning: quote("A company is qualified"),
      when: {
        employees: { gte: 500, quote: "at least 500 employees" },
        ai_work: "in-progress",
      },
      outcome: "qualified",
    },
    {
      id: "not-in-progress",
      meaning: quote("A company whose AI work"),
      when: { ai_work: ["planned", "other"] },
      outcome: "not-qualified",
    },
  ],
  attempts: { max: 2, escalate: "sales-ops-review" },
  escalations: [
    { id: "sales-ops-review", quote: quote("If the employee count") },
  ],
  cases: [
    {
      id: "a",
      why: "A clear yes stays a yes.",
      facts: { employees: 900, ai_work: "in-progress" },
      expect: { outcome: "qualified", rule: "qualified" },
    },
    {
      id: "b",
      why: "A higher threshold would move this company.",
      facts: { employees: 600, ai_work: "in-progress" },
      expect: { outcome: "qualified", rule: "qualified" },
    },
    {
      id: "c",
      why: "A plan is not progress.",
      facts: { employees: 900, ai_work: "planned" },
      expect: { outcome: "not-qualified", rule: "not-in-progress" },
    },
    {
      id: "boundary",
      why: "The threshold includes 500.",
      facts: { employees: 500, ai_work: "in-progress" },
      expect: { outcome: "qualified", rule: "qualified" },
    },
    {
      id: "under",
      why: "499 is below the threshold.",
      facts: { employees: 499, ai_work: "in-progress" },
      expect: { outcome: "not-qualified", rule: "too-small" },
    },
  ],
};
