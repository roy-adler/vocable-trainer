import { renderExtractPrompt } from "./prompt";

export type ExtractedCandidate = {
  hebrew: string;
  transliteration: string;
  german: string;
  exampleSentence: string;
  notes: string;
};

function getOllamaBaseUrl(): string {
  const base = process.env.OLLAMA_BASE_URL?.trim();
  if (!base) {
    throw new Error("OLLAMA_BASE_URL ist nicht gesetzt.");
  }
  return base.replace(/\/$/, "");
}

function getOllamaModel(): string {
  return process.env.OLLAMA_MODEL?.trim() || "llama3.1";
}

/** Pull a JSON array out of model output (tolerates ```json fences). */
export function parseVocableJson(text: string): unknown {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1].trim() : trimmed;
  const start = candidate.indexOf("[");
  const end = candidate.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("Modellantwort enthält kein JSON-Array.");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

export function normalizeCandidates(raw: unknown): ExtractedCandidate[] {
  if (!Array.isArray(raw)) {
    throw new Error("Erwartetes JSON-Array von Vokabeln.");
  }
  const out: ExtractedCandidate[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const hebrew = typeof row.hebrew === "string" ? row.hebrew.trim() : "";
    const transliteration =
      typeof row.transliteration === "string" ? row.transliteration.trim() : "";
    const german = typeof row.german === "string" ? row.german.trim() : "";
    if (!hebrew || !transliteration || !german) continue;
    out.push({
      hebrew,
      transliteration,
      german,
      exampleSentence:
        typeof row.exampleSentence === "string" ? row.exampleSentence.trim() : "",
      notes: typeof row.notes === "string" ? row.notes.trim() : "",
    });
  }
  return out;
}

export async function extractVocablesFromMessagesText(
  messagesText: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ExtractedCandidate[]> {
  const prompt = renderExtractPrompt(messagesText);
  const base = getOllamaBaseUrl();
  const model = getOllamaModel();

  const res = await fetchImpl(`${base}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      format: "json",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Ollama-Fehler (${res.status}): ${body.slice(0, 200) || res.statusText}`,
    );
  }

  const data = (await res.json()) as {
    message?: { content?: string };
    response?: string;
  };
  const content = data.message?.content ?? data.response ?? "";
  if (!content.trim()) {
    throw new Error("Ollama lieferte eine leere Antwort.");
  }

  // With format:json, content may be a single object or array
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
    if (!Array.isArray(parsed) && parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      if (Array.isArray(obj.vocables)) parsed = obj.vocables;
      else if (Array.isArray(obj.items)) parsed = obj.items;
      else parsed = [parsed];
    }
  } catch {
    parsed = parseVocableJson(content);
  }

  return normalizeCandidates(parsed);
}
