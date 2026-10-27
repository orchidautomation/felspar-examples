// Fictional help desk tickets and CRM account records for Harbor Cloud, a
// made-up company, shaped the way a help desk or CRM export gives them.
// Timestamps are relative to now so the sample stays within a job's evidence
// age limits; with your own data, use each field's real timestamp.
const hoursAgo = (hours) => new Date(Date.now() - hours * 3_600_000).toISOString();

export const records = [
  {
    ticket: {
      id: "HC-1001",
      subject: "Dashboard down",
      body: "Our dashboard has shown error 503 since this morning and our whole team is blocked.",
      createdAt: hoursAgo(2),
    },
    account: { id: "acct-1204", plan: "Enterprise (annual contract)", planVerifiedAt: hoursAgo(30), seats: 900 },
  },
  {
    ticket: {
      id: "HC-1002",
      subject: "Charged twice",
      body: "We were charged twice this month, please refund one payment.",
      createdAt: hoursAgo(1),
    },
    account: { id: "acct-7781", plan: "Business (monthly)", planVerifiedAt: hoursAgo(5), seats: 42 },
  },
  {
    ticket: {
      id: "HC-1004",
      subject: "Locked out",
      body: "I lost my phone and cannot get past two-factor sign-in.",
      createdAt: hoursAgo(3),
    },
    account: { id: "acct-0310", plan: "Enterprise (annual contract)", planVerifiedAt: hoursAgo(48), seats: 260 },
  },
];
