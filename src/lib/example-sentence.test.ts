import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, it, vi } from "vitest";
import { ensureExampleSentencePromptFile } from "./prompt";
import {
  generateExampleSentence,
  mapExampleSentenceError,
  parseExampleSentenceRequest,
} from "./example-sentence";

describe("parseExampleSentenceRequest", () => {
  it("accepts three non-empty trimmed strings", () => {
    const result = parseExampleSentenceRequest({
      hebrew: "  שלום  ",
      transliteration: " shalom ",
      german: " Hallo ",
    });
    expect(result).toEqual({
      ok: true,
      data: { hebrew: "שלום", transliteration: "shalom", german: "Hallo" },
    });
  });

  it("rejects non-object bodies", () => {
    expect(parseExampleSentenceRequest(null)).toEqual({
      ok: false,
      error: "Ungültige Eingabe.",
    });
  });

  it("rejects when any required field is missing or blank", () => {
    const expected = {
      ok: false,
      error:
        "Hebräisch, Umschreibung und deutsche Übersetzung sind erforderlich.",
    };
    expect(parseExampleSentenceRequest({})).toEqual(expected);
    expect(
      parseExampleSentenceRequest({
        hebrew: "שלום",
        transliteration: "",
        german: "Hallo",
      }),
    ).toEqual(expected);
  });
});

describe("mapExampleSentenceError", () => {
  it("maps empty Ollama output to 422", () => {
    expect(
      mapExampleSentenceError(new Error("Ollama lieferte eine leere Antwort.")),
    ).toEqual({
      status: 422,
      error: "Ollama lieferte eine leere Antwort.",
    });
  });

  it("maps missing OLLAMA_BASE_URL to 503", () => {
    expect(
      mapExampleSentenceError(new Error("OLLAMA_BASE_URL ist nicht gesetzt.")),
    ).toEqual({
      status: 503,
      error: "OLLAMA_BASE_URL ist nicht gesetzt.",
    });
  });

  it("maps other Ollama failures to 502", () => {
    expect(
      mapExampleSentenceError(new Error("Ollama-Anfrage fehlgeschlagen.")),
    ).toEqual({
      status: 502,
      error: "Ollama-Anfrage fehlgeschlagen.",
    });
  });

  it("maps Ollama HTTP errors to 502 with fixed German text", () => {
    expect(
      mapExampleSentenceError(
        new Error("Ollama-Fehler (404): model not found"),
      ),
    ).toEqual({
      status: 502,
      error: "Ollama-Anfrage fehlgeschlagen.",
    });
  });

  it("maps Ollama timeout to 502 with fixed German text", () => {
    expect(
      mapExampleSentenceError(
        new Error("Zeitüberschreitung nach 15 Minuten warte auf Ollama."),
      ),
    ).toEqual({
      status: 502,
      error: "Ollama-Anfrage fehlgeschlagen.",
    });
  });

  it("uses generic German text for unknown errors", () => {
    expect(mapExampleSentenceError("boom")).toEqual({
      status: 502,
      error: "Beispielsatz konnte nicht erzeugt werden.",
    });
    expect(mapExampleSentenceError(new Error("fetch failed"))).toEqual({
      status: 502,
      error: "Beispielsatz konnte nicht erzeugt werden.",
    });
  });
});

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
