// A hold is not a decision, so Felspar's action gate has no decided outcome to
// replay for it and denies every action. One action is still right on a hold:
// handing the case to the person the job names for it. This module allows
// exactly that, and nothing else: the tool must have a hold route, Felspar's
// latest result for that subject must be a hold, and the hold must route to
// that tool's escalation (its own escalation, or the job's route for
// unresolved cases when its next step is the unresolved one).
// It reads only host-recorded Felspar tool results, never model-written text.

export interface HoldRule {
  // The escalation this tool hands a held case to, e.g. "analyst-review".
  escalation: string;
  // The action field that names the subject; the only field the action may set.
  entityField: string;
}

export interface RecordedCall {
  toolName: string;
  input: unknown;
  output: unknown;
}

export interface HoldRequest {
  job: string;
  decisionTool: string;
  toolName: string;
  input: unknown;
  completed: readonly RecordedCall[];
  rules: Readonly<Record<string, HoldRule>>;
  // The job's route for unresolved cases, from its release; null when it has none.
  unresolvedRoute: (releaseId: string | undefined) => Promise<string | null>;
}

export type HoldVerdict = { allow: true; reason: string } | { allow: false };

type Row = Record<string, unknown>;
const isRow = (value: unknown): value is Row =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function parsed(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// One layer of an MCP or Eve tool output; undefined when it is already the reply.
function inner(value: unknown): unknown {
  if (typeof value === "string") return parsed(value);
  if (Array.isArray(value)) return value.find((part) => isRow(part) && part.type === "text") ?? null;
  if (!isRow(value)) return undefined;
  if (value.isError === true) return null;
  if (isRow(value.structuredContent)) return value.structuredContent;
  if (Array.isArray(value.content)) return value.content;
  return value.type === "text" && typeof value.text === "string" ? value.text : undefined;
}

// The `result` of a get_job_decision reply, or null for a refusal or anything else.
export function decisionResultOf(output: unknown): Row | null {
  let value = output;
  for (let depth = 0; depth < 5; depth += 1) {
    const next = inner(value);
    if (next === undefined) break;
    value = next;
  }
  return isRow(value) && isRow(value.result) ? value.result : null;
}

const key = (value: unknown) => (typeof value === "string" ? value.trim().toLowerCase() : "");

function subjectOf(call: RecordedCall, result: Row): string {
  const found = isRow(result.case) ? result.case.id : undefined;
  return key(found ?? (isRow(call.input) ? call.input.entity_id : undefined));
}

function isHold(result: Row): boolean {
  const status = isRow(result.receipt) ? result.receipt.status : undefined;
  return result.outcome === null && status === "blocked";
}

export async function holdVerdict(request: HoldRequest): Promise<HoldVerdict> {
  const rule = Object.hasOwn(request.rules, request.toolName) ? request.rules[request.toolName] : undefined;
  const input = request.input;
  if (rule === undefined || !isRow(input)) return { allow: false };
  if (Object.keys(input).some((field) => field !== rule.entityField)) return { allow: false };
  const subject = key(input[rule.entityField]);
  if (subject === "") return { allow: false };

  // Felspar's latest result for this subject on this job; refusals carry no result and don't count.
  let latest: Row | null = null;
  for (const call of request.completed) {
    if (call.toolName !== request.decisionTool) continue;
    if (!isRow(call.input) || call.input.job !== request.job) continue;
    const result = decisionResultOf(call.output);
    if (result !== null && subjectOf(call, result) === subject) latest = result;
  }
  if (latest === null || !isHold(latest)) return { allow: false };

  const escalation = isRow(latest.escalation) && typeof latest.escalation.id === "string" ? latest.escalation.id : undefined;
  const step = isRow(latest.nextStep) ? latest.nextStep.entryId : undefined;
  const releaseId = typeof latest.releaseId === "string" ? latest.releaseId : undefined;
  const route = escalation ?? (step === "unresolved" ? await request.unresolvedRoute(releaseId) : null);
  return route === rule.escalation
    ? { allow: true, reason: `Felspar held ${subject} for ${route}; handing it off is the next step` }
    : { allow: false };
}
