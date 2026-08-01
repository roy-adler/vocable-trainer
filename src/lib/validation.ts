export type VocableInput = {
  hebrew: string;
  transliteration: string;
  german: string;
  exampleSentence?: string;
  notes?: string;
  tagIds?: string[];
  newTags?: string[];
};

export type ValidationResult =
  | { ok: true; data: Required<Pick<VocableInput, "hebrew" | "transliteration" | "german">> & {
      exampleSentence: string;
      notes: string;
      tagIds: string[];
      newTags: string[];
    } }
  | { ok: false; errors: Record<string, string> };

export function validateVocableInput(body: unknown): ValidationResult {
  if (!body || typeof body !== "object") {
    return { ok: false, errors: { form: "Ungültige Eingabe." } };
  }

  const raw = body as Record<string, unknown>;
  const errors: Record<string, string> = {};

  const hebrew = typeof raw.hebrew === "string" ? raw.hebrew.trim() : "";
  const transliteration =
    typeof raw.transliteration === "string" ? raw.transliteration.trim() : "";
  const german = typeof raw.german === "string" ? raw.german.trim() : "";
  const exampleSentence =
    typeof raw.exampleSentence === "string" ? raw.exampleSentence.trim() : "";
  const notes = typeof raw.notes === "string" ? raw.notes.trim() : "";

  if (!hebrew) errors.hebrew = "Hebräisch ist erforderlich.";
  if (!transliteration) errors.transliteration = "Umschreibung ist erforderlich.";
  if (!german) errors.german = "Deutsche Übersetzung ist erforderlich.";

  const tagIds = Array.isArray(raw.tagIds)
    ? raw.tagIds.filter((t): t is string => typeof t === "string" && t.length > 0)
    : [];
  const newTags = Array.isArray(raw.newTags)
    ? raw.newTags
        .filter((t): t is string => typeof t === "string")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: { hebrew, transliteration, german, exampleSentence, notes, tagIds, newTags },
  };
}

export function matchesSearch(
  vocable: { hebrew: string; transliteration: string; german: string },
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    vocable.hebrew.toLowerCase().includes(q) ||
    vocable.transliteration.toLowerCase().includes(q) ||
    vocable.german.toLowerCase().includes(q)
  );
}
