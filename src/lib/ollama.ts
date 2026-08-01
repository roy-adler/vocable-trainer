import http from "node:http";
import https from "node:https";
import { URL } from "node:url";
import { renderExtractPrompt } from "./prompt";
import { resolveOllamaModel } from "./settings";

export type ExtractedCandidate = {
  hebrew: string;
  transliteration: string;
  german: string;
  exampleSentence: string;
  notes: string;
};

/** Forces models to emit a JSON array (plain `format:"json"` often yields one object). */
export const VOCABLE_JSON_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: {
      hebrew: { type: "string" },
      transliteration: {
        type: "string",
        description: "German-letter transliteration, e.g. shalom",
      },
      german: {
        type: "string",
        description: "Meaning in German (Deutsch), never English — e.g. Hallo, Danke",
      },
      exampleSentence: {
        type: "string",
        description: "Optional example sentence in German",
      },
      notes: {
        type: "string",
        description: "Optional notes in German",
      },
    },
    required: ["hebrew", "transliteration", "german"],
  },
} as const;

/** Gemma 4 can think for several minutes on a lesson chat; undici fetch defaults are 5 min. */
const OLLAMA_TIMEOUT_MS = 15 * 60 * 1000;

const WRAPPER_KEYS = [
  "vocabulary",
  "vocables",
  "items",
  "words",
  "results",
  "entries",
] as const;

export function getOllamaBaseUrl(): string {
  const base = process.env.OLLAMA_BASE_URL?.trim();
  if (!base) {
    throw new Error("OLLAMA_BASE_URL ist nicht gesetzt.");
  }
  return base.replace(/\/$/, "");
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

/** Turn model JSON (array, single object, or common wrappers) into a candidate list. */
export function coerceToCandidateList(parsed: unknown): unknown {
  if (Array.isArray(parsed)) return parsed;
  if (!parsed || typeof parsed !== "object") return parsed;
  const obj = parsed as Record<string, unknown>;
  for (const key of WRAPPER_KEYS) {
    if (Array.isArray(obj[key])) return obj[key];
  }
  return [parsed];
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

function formatFetchError(error: unknown): Error {
  if (!(error instanceof Error)) {
    return new Error("Ollama-Anfrage fehlgeschlagen.");
  }
  const cause =
    error.cause instanceof Error
      ? error.cause.message
      : typeof error.cause === "string"
        ? error.cause
        : "";
  if (cause) {
    return new Error(`Ollama-Anfrage fehlgeschlagen: ${error.message} (${cause})`);
  }
  return new Error(`Ollama-Anfrage fehlgeschlagen: ${error.message}`);
}

export function mapOllamaTagNames(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") return [];
  const models = (payload as { models?: unknown }).models;
  if (!Array.isArray(models)) return [];
  const names: string[] = [];
  for (const m of models) {
    if (!m || typeof m !== "object") continue;
    const name = (m as { name?: unknown }).name;
    if (typeof name === "string" && name.trim()) names.push(name.trim());
  }
  return names;
}

export async function listOllamaModels(
  fetchImpl: typeof fetch = fetch,
): Promise<string[]> {
  const base = getOllamaBaseUrl();
  const url = `${base}/api/tags`;
  let res: Response;
  try {
    res = await fetchImpl(url, { signal: AbortSignal.timeout(8000) });
  } catch (error) {
    throw formatFetchError(error);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Ollama-Fehler (${res.status}): ${text.slice(0, 200) || res.statusText}`,
    );
  }
  const data = (await res.json()) as unknown;
  return mapOllamaTagNames(data);
}

/** Long-running Ollama chat via node:http so we are not bound by undici's 5 min body timeout. */
function ollamaChatRequest(url: string, body: string): Promise<Response> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === "https:" ? https : http;
    const req = lib.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
        path: `${parsed.pathname}${parsed.search}`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
        timeout: OLLAMA_TIMEOUT_MS,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          resolve(
            new Response(text, {
              status: res.statusCode ?? 500,
              statusText: res.statusMessage,
              headers: res.headers as HeadersInit,
            }),
          );
        });
      },
    );
    req.on("timeout", () => {
      req.destroy();
      reject(
        new Error(
          `Zeitüberschreitung nach ${Math.round(OLLAMA_TIMEOUT_MS / 60000)} Minuten warte auf Ollama.`,
        ),
      );
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

export async function extractVocablesFromMessagesText(
  messagesText: string,
  options?: {
    model?: string;
    fetchImpl?: typeof fetch;
  },
): Promise<ExtractedCandidate[]> {
  const prompt = renderExtractPrompt(messagesText);
  const base = getOllamaBaseUrl();
  const model = resolveOllamaModel(options?.model);
  const fetchImpl = options?.fetchImpl;
  const url = `${base}/api/chat`;
  const body = JSON.stringify({
    model,
    stream: false,
    format: VOCABLE_JSON_SCHEMA,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  let res: Response;
  try {
    if (fetchImpl) {
      res = await fetchImpl(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
    } else {
      res = await ollamaChatRequest(url, body);
    }
  } catch (error) {
    throw formatFetchError(error);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Ollama-Fehler (${res.status}): ${text.slice(0, 200) || res.statusText}`,
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

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = parseVocableJson(content);
  }

  return normalizeCandidates(coerceToCandidateList(parsed));
}
