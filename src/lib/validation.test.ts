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
