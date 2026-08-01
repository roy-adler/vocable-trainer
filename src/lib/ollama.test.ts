import { describe, expect, it } from "vitest";
import { normalizeCandidates, parseVocableJson } from "./ollama";
import { renderExtractPrompt } from "./prompt";
import fs from "fs";
import os from "os";
import path from "path";

describe("parseVocableJson", () => {
  it("parses fenced json", () => {
    const raw = parseVocableJson('```json\n[{"hebrew":"א","transliteration":"a","german":"a"}]\n```');
    expect(Array.isArray(raw)).toBe(true);
  });
});

describe("normalizeCandidates", () => {
  it("drops incomplete rows", () => {
    const rows = normalizeCandidates([
      { hebrew: "שלום", transliteration: "shalom", german: "Hallo" },
      { hebrew: "x" },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].hebrew).toBe("שלום");
  });
});

describe("renderExtractPrompt", () => {
  it("substitutes messages placeholder from data dir", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "prompt-"));
    process.env.DATA_DIR = dir;
    const prompts = path.join(dir, "prompts");
    fs.mkdirSync(prompts);
    fs.writeFileSync(
      path.join(prompts, "extract-vocables.md"),
      "BEFORE\n{{messages}}\nAFTER\n",
      "utf8",
    );
    const out = renderExtractPrompt("HELLO");
    expect(out).toContain("BEFORE");
    expect(out).toContain("HELLO");
    expect(out).toContain("AFTER");
    delete process.env.DATA_DIR;
  });
});
