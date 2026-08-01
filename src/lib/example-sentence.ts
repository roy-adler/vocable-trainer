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

export function mapExampleSentenceError(error: unknown): {
  status: number;
  error: string;
} {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("leere Antwort")) {
    return { status: 422, error: message };
  }
  if (message.includes("OLLAMA_BASE_URL")) {
    return { status: 503, error: message };
  }
  if (message) {
    return { status: 502, error: message };
  }
  return { status: 502, error: "Beispielsatz konnte nicht erzeugt werden." };
}

export async function generateExampleSentence(
  fields: { hebrew: string; transliteration: string; german: string },
  options?: { model?: string; fetchImpl?: typeof fetch },
): Promise<string> {
  const prompt = renderExampleSentencePrompt(fields);
  return ollamaChatPlain(prompt, options);
}
