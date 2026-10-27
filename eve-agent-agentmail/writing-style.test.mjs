import assert from "node:assert/strict";
import test from "node:test";
import { checkWriting, styleFor } from "./agent/lib/writing-style.ts";

// The writing skill's house-style check. It is the agent's own code, so the
// test makes no call to Felspar.
const reply = [
  "Hi Dana,",
  "Thanks for flagging the duplicate charge on your March invoice. I can see both payments on your Business plan account, and I know that is frustrating to find.",
  "Because refunds on yearly plans are handled by our billing team, I have passed your case to them with both payment references. They will confirm the refund and reply to you directly.",
  "Thanks for your patience,\nSam",
].join("\n\n");

test("a reply in the house style passes", () => {
  const result = checkWriting(reply, "billing-team-reply");
  assert.equal(result.status, "pass");
  assert.deepEqual(result.findings, []);
  assert.equal(result.counts.paragraphs, 4);
});

test("a one-line notice is sent back for length and shape", () => {
  const result = checkWriting("Your ticket has been escalated per your plan.");
  assert.equal(result.status, "revise");
  assert.deepEqual(
    result.findings.map((finding) => finding.rule),
    ["paragraphs", "words"]
  );
});

test("em dashes, links, extra questions and placeholders are each flagged", () => {
  const text = `${reply}\n\nWant a call — or a demo? See https://example.com? Booked for [date]?`;
  const rules = checkWriting(text).findings.map((finding) => finding.rule);
  for (const rule of ["questions", "em-dashes", "links", "placeholders"]) {
    assert.ok(rules.includes(rule), rule);
  }
});

test("an output's own style overrides the default; unknown outputs use the default", () => {
  assert.deepEqual(styleFor("outreach-email").paragraphs, { min: 3, max: 3 });
  assert.equal(styleFor("outreach-email").maxQuestions, 1);
  assert.deepEqual(styleFor("anything-else"), styleFor(undefined));
});
