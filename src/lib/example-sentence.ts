import { ollamaChatPlain } from "./ollama";
import { renderExampleSentencePrompt } from "./prompt";

export type ExampleSentenceFields = {
  hebrew: string;
  transliteration: string;
  german: string;
};

export type ParseExampleSentenceResult =
  | { ok: true; data: ExampleSentenceFields }
  | { ok: false; error: string };

export function parseExampleSentenceRequest(
  body: unknown,
): ParseExampleSentenceResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Ungültige Eingabe." };
  }

  const raw = body as Record<string, unknown>;
  const hebrew = typeof raw.hebrew === "string" ? raw.hebrew.trim() : "";
  const transliteration =
    typeof raw.transliteration === "string" ? raw.transliteration.trim() : "";
  const german = typeof raw.german === "string" ? raw.german.trim() : "";

  if (!hebrew || !transliteration || !german) {
    return {
      ok: false,
      error:
        "Hebräisch, Umschreibung und deutsche Übersetzung sind erforderlich.",
    };
  }

  return { ok: true, data: { hebrew, transliteration, german } };
}

const EXAMPLE_SENTENCE_GENERIC_ERROR =
  "Beispielsatz konnte nicht erzeugt werden.";
const EXAMPLE_SENTENCE_EMPTY_ANSWER =
  "Ollama lieferte eine leere Antwort.";
const EXAMPLE_SENTENCE_OLLAMA_UNCONFIGURED =
  "OLLAMA_BASE_URL ist nicht gesetzt.";
const EXAMPLE_SENTENCE_OLLAMA_FAILED = "Ollama-Anfrage fehlgeschlagen.";

function isKnownOllamaFailure(message: string): boolean {
  return (
    message.startsWith("Ollama-Anfrage fehlgeschlagen") ||
    message.startsWith("Ollama-Fehler (") ||
    message.includes("warte auf Ollama")
  );
}

export function mapExampleSentenceError(error: unknown): {
  status: number;
  error: string;
} {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("leere Antwort")) {
    return { status: 422, error: EXAMPLE_SENTENCE_EMPTY_ANSWER };
  }
  if (message.includes("OLLAMA_BASE_URL")) {
    return { status: 503, error: EXAMPLE_SENTENCE_OLLAMA_UNCONFIGURED };
  }
  if (message && isKnownOllamaFailure(message)) {
    return { status: 502, error: EXAMPLE_SENTENCE_OLLAMA_FAILED };
  }
  return { status: 502, error: EXAMPLE_SENTENCE_GENERIC_ERROR };
}

export function cleanExampleSentence(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/```[^\r\n`]*/g, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 4)
    .join("\n");
}

export async function generateExampleSentence(
  fields: { hebrew: string; transliteration: string; german: string },
  options?: { model?: string; fetchImpl?: typeof fetch; timeoutMs?: number },
): Promise<string> {
  const prompt = renderExampleSentencePrompt(fields);
  const exampleSentence = cleanExampleSentence(
    await ollamaChatPlain(prompt, options),
  );
  if (!exampleSentence) {
    throw new Error(EXAMPLE_SENTENCE_EMPTY_ANSWER);
  }
  return exampleSentence;
}
