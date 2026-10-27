// This agent's own house style: how its team wants a message to read. It is
// the team's choice, not company policy, so Felspar never sees or checks it;
// Felspar's check_output owns what the policy requires. Edit freely.
export interface WritingStyle {
  // Blocks of text separated by a blank line, greeting and sign-off included.
  paragraphs: { min: number; max: number };
  words: { min: number; max: number };
  maxQuestions: number;
  noEmDashes: boolean;
  noLinks: boolean;
}

const defaultStyle: WritingStyle = {
  paragraphs: { min: 3, max: 5 },
  words: { min: 40, max: 220 },
  maxQuestions: 2,
  noEmDashes: true,
  noLinks: true,
};

// Per output, by its id in the released pack (get_job_requirements lists each
// outcome's outputs). An output not named here uses the default.
const styleByOutput: Record<string, Partial<WritingStyle>> = {
  "outreach-email": {
    paragraphs: { min: 3, max: 3 },
    words: { min: 50, max: 125 },
    maxQuestions: 1,
  },
  "billing-team-reply": { paragraphs: { min: 3, max: 5 }, words: { min: 60, max: 200 } },
};

export function styleFor(output: string | undefined): WritingStyle {
  return { ...defaultStyle, ...(output === undefined ? {} : styleByOutput[output]) };
}

export interface StyleFinding {
  rule: string;
  found: string;
  fix: string;
}

const between = (value: number, range: { min: number; max: number }) =>
  value >= range.min && value <= range.max;
const range = ({ min, max }: { min: number; max: number }) =>
  min === max ? `exactly ${min}` : `${min} to ${max}`;

export function checkWriting(text: string, output?: string) {
  const style = styleFor(output);
  const paragraphs = text.split(/\n\s*\n/u).filter((block) => block.trim().length > 0).length;
  const words = text.split(/\s+/u).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
  const questions = (text.match(/\?/gu) ?? []).length;
  const findings: StyleFinding[] = [];
  if (!between(paragraphs, style.paragraphs)) {
    findings.push({
      rule: "paragraphs",
      found: `${paragraphs} paragraphs`,
      fix: `Use ${range(style.paragraphs)} paragraphs, separated by a blank line.`,
    });
  }
  if (!between(words, style.words)) {
    findings.push({
      rule: "words",
      found: `${words} words`,
      fix: `Use ${range(style.words)} words.`,
    });
  }
  if (questions > style.maxQuestions) {
    findings.push({
      rule: "questions",
      found: `${questions} questions`,
      fix: `Ask at most ${style.maxQuestions}.`,
    });
  }
  if (style.noEmDashes && text.includes("—")) {
    findings.push({
      rule: "em-dashes",
      found: "an em dash",
      fix: "Use a comma, colon, period or a shorter sentence instead.",
    });
  }
  if (style.noLinks && /https?:\/\/|\bwww\./iu.test(text)) {
    findings.push({ rule: "links", found: "a link", fix: "Remove the link; write in plain text." });
  }
  if (/\[[^\]\n]*\]|\{\{/u.test(text)) {
    findings.push({
      rule: "placeholders",
      found: "an unfilled placeholder",
      fix: "Replace every [placeholder] with the case's real detail, or drop it.",
    });
  }
  return {
    status: findings.length === 0 ? ("pass" as const) : ("revise" as const),
    counts: { paragraphs, words, questions },
    findings,
  };
}
