// change-record.mjs: the approval for this tool call, read from Linear.
//
// Drop-in for the Felspar coding-agent hook. It finds the ticket key in the
// branch name, reads that issue from Linear with a read-only key, and returns
// what Linear itself recorded, in words. It never judges the record: Felspar
// decides whether it covers the call, against your released policy.
//
// Approval can be a workflow status or a label, whichever your team uses:
//   FELSPAR_LINEAR_APPROVAL=status:Approved   (default) the issue moved into
//                                             the "Approved" status
//   FELSPAR_LINEAR_APPROVAL=label:approved    someone added the "approved"
//                                             label
// Names match without regard to case.
//
// Every fact comes from Linear's own history, not from text the developer or
// the agent can edit:
//   - approver:  who moved the issue into the status, or added the label.
//   - requester: the issue's creator.
//   - withdrawn: status mode: it moved back to backlog, unstarted, triage or
//                canceled. Label mode: the label was removed, or the issue
//                was canceled.
//   - changed:   its description or other labels changed after approval, so
//                the approver didn't see what the ticket says now.
//   - unknown:   the issue is approved now but Linear recorded no one doing it
//                (Linear folds a creator's first minutes of edits into the
//                creation). Reported as not approved.
//
// Linear also merges one person's changes made close together into a single
// history entry. An entry that grants approval may therefore include that
// same person's edits; those are the approver's own, so they don't count as
// changes after approval. Status mode can lose the approval step entirely when
// the approver moves the issue on within minutes (Todo → Approved → In
// Progress is recorded as Todo → In Progress); that reads as not approved,
// never the reverse. A label doesn't have this problem.
//   - scope:     the title, labels and description as written.
//   - valid until: the issue's due date, sent on its own as change-expiry
//                (YYYY-MM-DD), never inside the record's text.
//
// Other settings:
//   LINEAR_API_KEY   a read-only Linear key, kept where the agent's tools can't
//                    read it
//
// When the branch names no ticket, or Linear has no such issue, it sends a
// record saying no change record was found, so the policy decides a
// production change has no approval instead of waiting for evidence. Throws
// when Linear can't be read or the setting is malformed; in enforce mode the
// hook then blocks, because an unreadable record is never an approval.

import { execFileSync } from "node:child_process";

const MAX_SCOPE = 1500;
const RESETS = new Set(["backlog", "unstarted", "triage", "canceled"]);

function approvalSetting() {
  const raw = process.env.FELSPAR_LINEAR_APPROVAL
    ?? (process.env.FELSPAR_LINEAR_APPROVED_STATE ? `status:${process.env.FELSPAR_LINEAR_APPROVED_STATE}` : "status:Approved");
  const match = /^(status|state|label):(.+)$/i.exec(raw.trim());
  if (!match) throw new Error(`FELSPAR_LINEAR_APPROVAL must be status:<name> or label:<name>, not "${raw}"`);
  const mode = match[1].toLowerCase() === "label" ? "label" : "status";
  return { mode, name: match[2].trim() };
}

export function ticketKey(cwd) {
  try {
    const branch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      cwd, encoding: "utf8", timeout: 2_000, stdio: ["ignore", "pipe", "ignore"],
    });
    return branch.toUpperCase().match(/\b[A-Z][A-Z0-9]+-\d+\b/)?.[0] ?? null;
  } catch {
    return null;
  }
}

// Fixed wording: it never repeats the branch name, which the agent can choose.
const NO_TICKET = "No change record was found: the current branch names no Linear ticket.";
const noIssue = (key) => `No change record was found for ${key}: Linear has no such issue.`;

const QUERY = `query($id: String!) { issue(id: $id) {
  identifier title description dueDate
  state { name type }
  creator { name email }
  labels { nodes { name } }
  history(first: 100) { nodes {
    createdAt actor { name email }
    fromState { name type } toState { name type }
    updatedDescription
    addedLabels { name } removedLabels { name }
  } }
} }`;

async function readIssue(key) {
  if (!process.env.LINEAR_API_KEY) throw new Error("LINEAR_API_KEY is not set");
  const response = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: { Authorization: process.env.LINEAR_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ query: QUERY, variables: { id: key } }),
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`Linear answered ${response.status}`);
  const body = await response.json();
  if (body.errors?.some((error) => /not found|entity/i.test(error.message ?? ""))) return null;
  if (body.errors) throw new Error(`Linear error: ${body.errors[0]?.message ?? "unknown"}`);
  return body.data?.issue ?? null;
}

const same = (a, b) => a?.toLowerCase() === b.toLowerCase();
const who = (person) => (person ? `${person.name}${person.email ? ` (${person.email})` : ""}` : "an unknown person");
const day = (iso) => iso.slice(0, 10);
const names = (labels) => (labels ?? []).map((label) => label.name);

// Walks the history oldest first and reports where the approval stands now.
function approvalState(issue, setting) {
  const events = [...issue.history.nodes].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  let approval = null;
  const notes = [];
  for (const event of events) {
    const added = names(event.addedLabels);
    const removed = names(event.removedLabels);
    const grants = setting.mode === "status"
      ? same(event.toState?.name, setting.name)
      : added.some((name) => same(name, setting.name));
    if (grants) {
      approval = event;
      notes.length = 0;
      continue;
    }
    if (!approval) continue;
    const resetBy = setting.mode === "status"
      ? event.toState && RESETS.has(event.toState.type) && `moved it to ${event.toState.name}`
      : (removed.some((name) => same(name, setting.name)) && `removed the ${setting.name} label`)
        || (event.toState?.type === "canceled" && `moved it to ${event.toState.name}`);
    if (resetBy) {
      notes.push(`withdrawn: ${who(event.actor)} ${resetBy} on ${day(event.createdAt)}`);
      approval = null;
      continue;
    }
    if (event.updatedDescription) {
      notes.push(`changed after approval: ${who(event.actor)} edited the description on ${day(event.createdAt)}`);
    }
    const otherLabels = [...added, ...removed].filter((name) => !same(name, setting.name));
    if (otherLabels.length > 0) {
      notes.push(`changed after approval: ${who(event.actor)} changed its labels (${otherLabels.join(", ")}) on ${day(event.createdAt)}`);
    }
  }
  return { approval, notes };
}

export async function changeRecord(call) {
  const setting = approvalSetting();
  const key = ticketKey(call.cwd);
  if (!key) return [{ kind: "change-record", id: "no-ticket", text: NO_TICKET }];
  const issue = await readIssue(key);
  if (!issue) return [{ kind: "change-record", id: key, text: noIssue(key) }];

  const labels = names(issue.labels.nodes);
  const approvedNow = setting.mode === "status"
    ? same(issue.state.name, setting.name)
    : labels.some((name) => same(name, setting.name));
  const how = setting.mode === "status" ? `moving the issue to ${setting.name}` : `adding the ${setting.name} label`;
  const { approval, notes } = approvalState(issue, setting);
  const changed = notes.some((note) => note.startsWith("changed"));

  let status;
  if (!approval && notes.length > 0) {
    status = `not approved (${notes.join("; ")})`;
  } else if (!approval && approvedNow) {
    status = `not approved: it shows ${setting.name}, but Linear recorded no one ${how}, so the approver is unknown`;
  } else if (!approval) {
    status = "not approved";
  } else if (changed) {
    status = `pending re-approval (${notes.join("; ")})`;
  } else {
    status = "approved";
  }

  const scope = (issue.description ?? "").trim();
  const lines = [
    `${issue.identifier} status: ${status}. Current Linear status: ${issue.state.name}.`,
    `Title: ${issue.title}`,
    `Requested by ${who(issue.creator)}.`,
    approval ? `Approved by ${who(approval.actor)} on ${day(approval.createdAt)}, by ${how}.` : "No approval recorded.",
    `Labels: ${labels.join(", ") || "none"}.`,
    scope
      ? `Scope as written in the ticket: ${scope.length > MAX_SCOPE ? `${scope.slice(0, MAX_SCOPE)} … [${scope.length - MAX_SCOPE} more characters not shown]` : scope}`
      : "The ticket has no description.",
  ];
  return [
    { kind: "change-record", id: issue.identifier, text: lines.join("\n") },
    ...(issue.dueDate ? [{ kind: "change-expiry", id: issue.identifier, text: issue.dueDate }] : []),
  ];
}
