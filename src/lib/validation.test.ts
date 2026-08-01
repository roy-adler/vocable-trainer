import { describe, expect, it } from "vitest";
import { matchesSearch, validateVocableInput } from "./validation";

describe("validateVocableInput", () => {
  it("rejects missing required fields", () => {
    const result = validateVocableInput({ hebrew: "שלום" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.transliteration).toBeTruthy();
      expect(result.errors.german).toBeTruthy();
    }
  });

  it("accepts a valid payload", () => {
    const result = validateVocableInput({
      hebrew: " שלום ",
      transliteration: " shalom ",
      german: " Hallo ",
      exampleSentence: "שלום!",
      notes: "Gruß",
      tagIds: ["t1"],
      newTags: ["  verbs  "],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.hebrew).toBe("שלום");
      expect(result.data.transliteration).toBe("shalom");
      expect(result.data.german).toBe("Hallo");
      expect(result.data.newTags).toEqual(["verbs"]);
      expect(result.data.learnedOn.toISOString()).toMatch(
        /^\d{4}-\d{2}-\d{2}T00:00:00.000Z$/,
      );
    }
  });

  it("parses learnedOn date key", () => {
    const result = validateVocableInput({
      hebrew: "א",
      transliteration: "a",
      german: "a",
      learnedOn: "2026-07-15",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.learnedOn.toISOString()).toBe("2026-07-15T00:00:00.000Z");
    }
  });
});

describe("matchesSearch", () => {
  const sample = {
    hebrew: "תודה",
    transliteration: "toda",
    german: "Danke",
  };

  it("matches transliteration case-insensitively", () => {
    expect(matchesSearch(sample, "TODA")).toBe(true);
  });

  it("matches german substring", () => {
    expect(matchesSearch(sample, "dank")).toBe(true);
  });

  it("returns false when nothing matches", () => {
    expect(matchesSearch(sample, "xyz")).toBe(false);
  });
});
