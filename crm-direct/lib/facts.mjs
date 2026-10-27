// Facts for one record from a job's description and its mapping, checked
// against the description before anything is sent. Pure: no network.
export class MappingError extends Error {}

function checked(question, key, fact) {
  if (fact === undefined || fact === null) {
    return null;
  }
  const isTyped = Object.hasOwn(fact, "value");
  if (isTyped && question.answer.send === "text") {
    throw new MappingError(
      `${key}: send the record's words as text; Felspar decides what they mean (a label is refused with label_needs_mapping).`
    );
  }
  if (!isTyped && (typeof fact.text !== "string" || fact.text.trim() === "")) {
    throw new MappingError(`${key}: no text from the record.`);
  }
  const allowed = question.evidencePolicy?.allowedSourceClasses ?? [];
  if (allowed.length > 0 && !allowed.includes(fact.source?.class)) {
    throw new MappingError(`${key}: source class ${fact.source?.class} is not one of ${allowed.join(", ")}.`);
  }
  return fact;
}

export function factsFor(description, mapping, record) {
  const questions = new Map(description.questions.map((question) => [question.key, question]));
  const facts = {};
  for (const [key, read] of Object.entries(mapping)) {
    const question = questions.get(key);
    if (!question) {
      throw new MappingError(`${key}: not a question of ${description.job}; its questions are ${[...questions.keys()].join(", ")}.`);
    }
    const fact = checked(question, key, read(record));
    if (fact !== null) {
      facts[key] = fact;
    }
  }
  const unmapped = [...questions.keys()].filter((key) => !(key in facts));
  return { facts, unmapped };
}
