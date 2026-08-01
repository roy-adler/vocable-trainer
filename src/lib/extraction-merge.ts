export type FieldKey =
  | "hebrew"
  | "transliteration"
  | "german"
  | "exampleSentence"
  | "notes";

export type FieldChoice = "suggestion" | "existing";

export type FieldChoices = Partial<Record<FieldKey, FieldChoice>>;

export type ExistingSnapshot = {
  id: string;
  hebrew: string;
  transliteration: string;
  german: string;
  exampleSentence: string;
  notes: string;
  learnedOn: string;
};

export const FIELD_KEYS: FieldKey[] = [
  "hebrew",
  "transliteration",
  "german",
  "exampleSentence",
  "notes",
];

export function defaultFieldChoices(hasExisting: boolean): FieldChoices {
  if (!hasExisting) {
    return {
      hebrew: "suggestion",
      transliteration: "suggestion",
      german: "suggestion",
      exampleSentence: "suggestion",
      notes: "suggestion",
    };
  }
  return {
    hebrew: "existing",
    transliteration: "suggestion",
    german: "suggestion",
    exampleSentence: "suggestion",
    notes: "suggestion",
  };
}

export function mergeFields(
  suggestion: Record<FieldKey, string>,
  existing: Record<FieldKey, string> | null,
  choices: FieldChoices,
): Record<FieldKey, string> {
  const out = {} as Record<FieldKey, string>;
  for (const key of FIELD_KEYS) {
    const choice = choices[key] ?? "suggestion";
    if (choice === "existing" && existing) {
      out[key] = existing[key] ?? "";
    } else {
      out[key] = suggestion[key] ?? "";
    }
  }
  return out;
}

export function parseFieldChoices(raw: string): FieldChoices {
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw) as FieldChoices;
  } catch {
    return {};
  }
}

export function parseExistingSnapshot(raw: string): ExistingSnapshot | null {
  if (!raw.trim()) return null;
  try {
    return JSON.parse(raw) as ExistingSnapshot;
  } catch {
    return null;
  }
}
