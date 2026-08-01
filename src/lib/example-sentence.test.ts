import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, it, vi } from "vitest";
import { ensureExampleSentencePromptFile } from "./prompt";
import { generateExampleSentence } from "./example-sentence";

describe("generateExampleSentence", () => {
  it("calls chat with settings model and returns trimmed content", async () => {
    process.env.OLLAMA_BASE_URL = "http://ollama.test:11434";
    process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "ex-sent-"));
    ensureExampleSentencePromptFile();

    let body: { model?: string; format?: unknown };
    const fetchImpl = vi.fn(async (_u, init) => {
      body = JSON.parse(String(init?.body));
      return new Response(
        JSON.stringify({
          message: { content: "שלום לכולם\nHallo zusammen" },
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const text = await generateExampleSentence(
      { hebrew: "שלום", transliteration: "shalom", german: "Hallo" },
      { fetchImpl, model: "test:1b" },
    );

    expect(text).toBe("שלום לכולם\nHallo zusammen");
    expect(body!.model).toBe("test:1b");
    expect(body!.format).toBeUndefined();
  });

  it("throws when Ollama returns empty content", async () => {
    process.env.OLLAMA_BASE_URL = "http://ollama.test:11434";
    process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "ex-sent-"));
    ensureExampleSentencePromptFile();

    const fetchImpl = vi.fn(async () => {
      return new Response(
        JSON.stringify({ message: { content: "   " } }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    await expect(
      generateExampleSentence(
        { hebrew: "שלום", transliteration: "shalom", german: "Hallo" },
        { fetchImpl, model: "test:1b" },
      ),
    ).rejects.toThrow("Ollama lieferte eine leere Antwort.");
  });
});
