// How each job's questions read your records: one entry per job, keyed by the
// job's question keys (`npm run describe -- <job>` lists them, with the source
// classes each accepts and whether it takes text or a typed value).
//
// Send the record's own words as `text` for an answer-choice or yes/no
// question: Felspar decides what they mean against the released definitions.
// A bare picklist label such as { value: "business" } is refused with
// label_needs_mapping. A number or date question may take a typed `value`
// (a date as YYYY-MM-DD). `source` says where the words came from and when
// they were true; Felspar checks the class and the age against the job.
export const mappings = {
  "support-ticket-routing": {
    request: ({ ticket }) => ({
      text: ticket.body,
      source: { class: "ticket-thread", id: `helpdesk:ticket/${ticket.id}`, observedAt: ticket.createdAt },
    }),
    // The plan is dated by when it was last verified, not when the record was read.
    plan: ({ account }) => ({
      text: `Plan: ${account.plan}`,
      source: { class: "account-record", id: `crm:account/${account.id}`, observedAt: account.planVerifiedAt },
    }),
  },
};
