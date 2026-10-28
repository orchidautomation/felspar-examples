// Six fictional companies, each with what its sources say. The same facts go
// to both consumers. Numbers are read exactly from the words ("800 employees").
const now = new Date().toISOString();
const source = (cls, id) => ({ class: cls, id, observedAt: now });
const employees = (text, id) => ({ text, source: source("crm-record", `crm:account/${id}`) });
const aiWork = (text, domain) => ({ text, source: source("company-site", `https://${domain}/about`) });

export const cases = [
  {
    id: "A",
    domain: "northpeak.example",
    teaches: "a clear yes stays a yes",
    facts: {
      employees: employees("Northpeak has 800 employees.", "a-1"),
      ai_work: aiWork("Our AI assistant is live for every customer.", "northpeak.example"),
    },
  },
  {
    id: "B",
    domain: "bluecrest.example",
    teaches: "the case a change of the threshold would move",
    facts: {
      employees: employees("Bluecrest has 600 employees.", "b-1"),
      ai_work: aiWork("We are piloting AI-assisted underwriting with our brokers now.", "bluecrest.example"),
    },
  },
  {
    id: "C",
    domain: "cedarworks.example",
    teaches: "a plan is not progress",
    facts: {
      employees: employees("Cedarworks has 800 employees.", "c-1"),
      ai_work: aiWork("We plan to pilot generative AI in the second half of next year.", "cedarworks.example"),
    },
  },
  {
    id: "D",
    domain: "driftwood.example",
    teaches: "missing evidence is not a yes",
    facts: {
      ai_work: aiWork("Our AI forecasting runs in production for every customer.", "driftwood.example"),
    },
  },
  {
    id: "E",
    domain: "emberly.example",
    teaches: "a clear no stays a no",
    facts: {
      employees: employees("Emberly has 300 employees.", "e-1"),
      ai_work: aiWork("Our AI assistant is live for every customer.", "emberly.example"),
    },
  },
  {
    id: "F",
    domain: "foxglove.example",
    teaches: "sources that disagree go to a person",
    facts: {
      employees: [
        employees("Foxglove has 450 employees.", "f-1"),
        { text: "Foxglove: 900 employees", source: source("linkedin-page", "https://linkedin.example/company/foxglove") },
      ],
      ai_work: aiWork("Our AI assistant is live for every customer.", "foxglove.example"),
    },
  },
];
