import { describe, expect, it, vi } from "vitest";
import {
  extractVocablesFromMessagesText,
  listOllamaModels,
  mapOllamaTagNames,
  normalizeCandidates,
  parseVocableJson,
} from "./ollama";
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

describe("extractVocablesFromMessagesText", () => {
  function mockEnv() {
    process.env.OLLAMA_BASE_URL = "http://ollama.test:11434";
    process.env.OLLAMA_MODEL = "gemma:2b";
    process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "prompt-"));
    const prompts = path.join(process.env.DATA_DIR, "prompts");
    fs.mkdirSync(prompts);
    fs.writeFileSync(
      path.join(prompts, "extract-vocables.md"),
      "PROMPT\n{{messages}}\n",
      "utf8",
    );
  }

  it("requests a JSON array schema so small models return many items", async () => {
    mockEnv();
    let requestBody: unknown;
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      requestBody = JSON.parse(String(init?.body ?? "{}"));
      return new Response(
        JSON.stringify({
          message: {
            content: JSON.stringify([
              { hebrew: "שלום", transliteration: "shalom", german: "Hallo" },
              { hebrew: "תודה", transliteration: "toda", german: "Danke" },
            ]),
          },
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const rows = await extractVocablesFromMessagesText("chat", { fetchImpl });
    expect(rows).toHaveLength(2);
    const format = (requestBody as { format?: unknown }).format;
    expect(format).toEqual(
      expect.objectContaining({
        type: "array",
        items: expect.objectContaining({
          type: "object",
          required: expect.arrayContaining([
            "hebrew",
            "transliteration",
            "german",
          ]),
        }),
      }),
    );
  });

  it("unwraps common object wrappers like vocabulary", async () => {
    mockEnv();
    const fetchImpl = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          message: {
            content: JSON.stringify({
              vocabulary: [
                { hebrew: "שלום", transliteration: "shalom", german: "Hallo" },
                { hebrew: "תודה", transliteration: "toda", german: "Danke" },
              ],
            }),
          },
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const rows = await extractVocablesFromMessagesText("chat", { fetchImpl });
    expect(rows).toHaveLength(2);
    expect(rows[1].hebrew).toBe("תודה");
  });

  it("surfaces undici/network causes instead of bare fetch failed", async () => {
    mockEnv();
    const fetchImpl = vi.fn(async () => {
      const err = new TypeError("fetch failed");
      Object.assign(err, { cause: new Error("Headers Timeout Error") });
      throw err;
    }) as unknown as typeof fetch;

    await expect(
      extractVocablesFromMessagesText("chat", { fetchImpl }),
    ).rejects.toThrow(/Headers Timeout Error/);
  });

  it("uses explicit model option instead of env", async () => {
    mockEnv();
    let requestBody: { model?: string } = {};
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      requestBody = JSON.parse(String(init?.body ?? "{}"));
      return new Response(
        JSON.stringify({
          message: {
            content: JSON.stringify([
              { hebrew: "א", transliteration: "a", german: "a" },
            ]),
          },
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    await extractVocablesFromMessagesText("chat", {
      fetchImpl,
      model: "chosen:7b",
    });
    expect(requestBody.model).toBe("chosen:7b");
  });
});

describe("mapOllamaTagNames", () => {
  it("extracts model names", () => {
    expect(
      mapOllamaTagNames({
        models: [{ name: "llama3.1:latest" }, { name: "gemma2:9b" }, {}],
      }),
    ).toEqual(["llama3.1:latest", "gemma2:9b"]);
  });

  it("returns empty for junk", () => {
    expect(mapOllamaTagNames(null)).toEqual([]);
    expect(mapOllamaTagNames({})).toEqual([]);
  });
});

describe("listOllamaModels", () => {
  it("calls /api/tags and returns names", async () => {
    process.env.OLLAMA_BASE_URL = "http://ollama.test:11434";
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      expect(String(url)).toBe("http://ollama.test:11434/api/tags");
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return new Response(
        JSON.stringify({ models: [{ name: "a" }, { name: "b" }] }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;
    await expect(listOllamaModels(fetchImpl)).resolves.toEqual(["a", "b"]);
  });

  it("throws when base URL unset", async () => {
    delete process.env.OLLAMA_BASE_URL;
    await expect(listOllamaModels(async () => new Response())).rejects.toThrow(
      /OLLAMA_BASE_URL/,
    );
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
