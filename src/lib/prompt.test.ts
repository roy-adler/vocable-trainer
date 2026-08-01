import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ensureExampleSentencePromptFile,
  renderExampleSentencePrompt,
} from "./prompt";

describe("example sentence prompt", () => {
  let dir: string;
  const prev = process.env.DATA_DIR;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "ex-prompt-"));
    process.env.DATA_DIR = dir;
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = prev;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("seeds data prompt and substitutes placeholders", () => {
    const p = ensureExampleSentencePromptFile();
    expect(fs.existsSync(p)).toBe(true);
    const out = renderExampleSentencePrompt({
      hebrew: "שלום",
      transliteration: "shalom",
      german: "Hallo",
    });
    expect(out).toContain("שלום");
    expect(out).toContain("shalom");
    expect(out).toContain("Hallo");
    expect(out).not.toContain("{{hebrew}}");
  });
});
