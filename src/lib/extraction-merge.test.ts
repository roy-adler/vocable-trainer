import { describe, expect, it } from "vitest";
import { defaultFieldChoices, mergeFields } from "./extraction-merge";

describe("mergeFields", () => {
  it("prefers suggestion when chosen", () => {
    const merged = mergeFields(
      {
        hebrew: "חדש",
        transliteration: "chadash",
        german: "neu",
        exampleSentence: "a",
        notes: "b",
      },
      {
        hebrew: "ישן",
        transliteration: "yashan",
        german: "alt",
        exampleSentence: "c",
        notes: "d",
      },
      {
        hebrew: "existing",
        transliteration: "suggestion",
        german: "suggestion",
        exampleSentence: "existing",
        notes: "suggestion",
      },
    );
    expect(merged.hebrew).toBe("ישן");
    expect(merged.transliteration).toBe("chadash");
    expect(merged.german).toBe("neu");
    expect(merged.exampleSentence).toBe("c");
    expect(merged.notes).toBe("b");
  });
});

describe("defaultFieldChoices", () => {
  it("uses suggestion for all when new", () => {
    expect(defaultFieldChoices(false).german).toBe("suggestion");
  });
});
