# Example Sentence Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a „Beispielsatz erzeugen“ button on the create/edit form that calls Ollama with an editable volume prompt and fills an empty example field with a Hebrew sentence plus German translation.

**Architecture:** Seed `/data/prompts/example-sentence.md` from a bundled default; render placeholders; plain-text Ollama chat via existing HTTP helper + settings model; thin `POST /api/vocables/example-sentence`; button on `VocableForm` only fills local state when the field is empty.

**Tech Stack:** Next.js App Router, existing `src/lib/ollama.ts` / `prompt.ts` / `settings.ts`, Vitest, Docker Compose tests.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-01-example-sentence-generation-design.md`
- German UI labels and API errors
- Output: Hebrew sentence + German translation (plain text)
- Fill only when Beispielsatz is empty; create + edit form
- Prompt: `/data/prompts/example-sentence.md` with `{{hebrew}}`, `{{transliteration}}`, `{{german}}`
- Model: `resolveOllamaModel()` (no form picker)
- Sync API; no DB write on generate
- No host npm: `docker compose --profile test run --rm --build test` (always `--build`)

---

## File structure

| File | Responsibility |
|------|----------------|
| `prompts/example-sentence.md` | Bundled default prompt |
| `src/lib/prompt.ts` | Ensure/load/render example-sentence prompt |
| `src/lib/prompt.test.ts` | Placeholder / ensure tests (new or extend if extract tests live in ollama.test — prefer dedicated file) |
| `src/lib/example-sentence.ts` | `generateExampleSentence(...)` Ollama plain-text call |
| `src/lib/example-sentence.test.ts` | Mocked fetch tests |
| `src/app/api/vocables/example-sentence/route.ts` | POST validation + generate |
| `src/components/VocableForm.tsx` | Button + busy/error UX |
| `AGENTS.md` | Prompt path + endpoint |

---

### Task 1: Prompt file + render helpers

**Files:**
- Create: `prompts/example-sentence.md`
- Modify: `src/lib/prompt.ts`
- Create: `src/lib/prompt.test.ts` (example-sentence cases; extract tests may stay in `ollama.test.ts`)
- Produces: `ensureExampleSentencePromptFile()`, `loadExampleSentencePromptTemplate()`, `renderExampleSentencePrompt({ hebrew, transliteration, german })`

- [ ] **Step 1: Write failing tests**

```ts
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
```

- [ ] **Step 2: Run — expect FAIL**

```
docker compose --profile test run --rm --build test sh -c "npm test -- src/lib/prompt.test.ts"
```

- [ ] **Step 3: Add bundled prompt `prompts/example-sentence.md`**

```markdown
# Beispielsatz erzeugen

Erzeuge einen natürlichen hebräischen Beispielsatz, der das folgende Wort verwendet, und danach eine deutsche Übersetzung dieses Satzes.

Vokabel:
- Hebräisch: {{hebrew}}
- Umschreibung: {{transliteration}}
- Bedeutung (Deutsch): {{german}}

Regeln:
- Genau ein Beispielsatz auf Hebräisch, dann eine Zeile deutsche Übersetzung.
- Nur Klartext (keine Markdown-Formatierung, kein JSON, keine Erklärung).
- Der hebräische Satz muss das Wort sinnvoll verwenden.
```

- [ ] **Step 4: Extend `src/lib/prompt.ts`**

Add parallel helpers to extract (same ensure/copy pattern), e.g.:

```ts
const EXAMPLE_RELATIVE = path.join("prompts", "example-sentence.md");

export function getExampleSentencePromptPaths() {
  const dataPrompt = path.join(getDataDir(), "prompts", "example-sentence.md");
  const bundledPrompt = path.join(process.cwd(), EXAMPLE_RELATIVE);
  return { dataPrompt, bundledPrompt };
}

export function ensureExampleSentencePromptFile(): string {
  // same mkdir/copy/fallback pattern as ensureExtractPromptFile
  // fallback body if bundled missing: short German template with the three placeholders
}

export function renderExampleSentencePrompt(fields: {
  hebrew: string;
  transliteration: string;
  german: string;
}): string {
  let template = fs.readFileSync(ensureExampleSentencePromptFile(), "utf8");
  template = template.split("{{hebrew}}").join(fields.hebrew);
  template = template.split("{{transliteration}}").join(fields.transliteration);
  template = template.split("{{german}}").join(fields.german);
  return template;
}
```

- [ ] **Step 5: Run tests — PASS; commit**

```
docker compose --profile test run --rm --build test sh -c "npm test -- src/lib/prompt.test.ts"
git add prompts/example-sentence.md src/lib/prompt.ts src/lib/prompt.test.ts
git commit -m "Add editable example-sentence prompt template"
```

---

### Task 2: `generateExampleSentence` lib

**Files:**
- Create: `src/lib/example-sentence.ts`
- Create: `src/lib/example-sentence.test.ts`
- Consumes: `renderExampleSentencePrompt`, `getOllamaBaseUrl`, `resolveOllamaModel`, reuse chat transport

**Interfaces:**

```ts
export async function generateExampleSentence(
  fields: { hebrew: string; transliteration: string; german: string },
  options?: { model?: string; fetchImpl?: typeof fetch },
): Promise<string>;
```

- Plain chat body (no `format` JSON schema)
- Empty content → throw `Error("Ollama lieferte eine leere Antwort.")`
- Prefer exporting a small shared `ollamaChat` from `ollama.ts` **or** duplicate the minimal chat call in `example-sentence.ts` by importing what you can. Prefer: add `export async function ollamaChatPlain(prompt: string, options?: { model?: string; fetchImpl?: typeof fetch }): Promise<string>` in `ollama.ts` and call it from `generateExampleSentence` to avoid copying `ollamaChatRequest`.

- [ ] **Step 1: Failing test**

```ts
it("calls chat with settings model and returns trimmed content", async () => {
  process.env.OLLAMA_BASE_URL = "http://ollama.test:11434";
  process.env.DATA_DIR = fs.mkdtempSync(...);
  // seed prompt file via ensureExampleSentencePromptFile or write template
  let body: { model?: string; format?: unknown };
  const fetchImpl = vi.fn(async (_u, init) => {
    body = JSON.parse(String(init?.body));
    return new Response(
      JSON.stringify({ message: { content: "שלום לכולם\nHallo zusammen" } }),
      { status: 200 },
    );
  });
  const text = await generateExampleSentence(
    { hebrew: "שלום", transliteration: "shalom", german: "Hallo" },
    { fetchImpl, model: "test:1b" },
  );
  expect(text).toBe("שלום לכולם\nHallo zusammen");
  expect(body.model).toBe("test:1b");
  expect(body.format).toBeUndefined();
});
```

- [ ] **Step 2: Implement → PASS → commit**

```
git commit -m "Add Ollama helper to generate example sentences"
```

---

### Task 3: API route

**Files:**
- Create: `src/app/api/vocables/example-sentence/route.ts`
- Optional thin validation in route (trim + 400 if any empty)

```ts
export async function POST(request: NextRequest) {
  // parse body; require three non-empty strings
  // call generateExampleSentence
  // empty/throw → map to 422/502 with German messages (do not leak English internals for unexpected errors)
  // return { exampleSentence }
}
```

- [ ] **Step 1: Add a small unit test for a pure validate helper if extracted**, e.g. `parseExampleSentenceRequest(body): { hebrew, transliteration, german } | { error }` in `src/lib/example-sentence.ts`, tested without Next.

- [ ] **Step 2: Implement route; typecheck via Docker full suite**

```
docker compose --profile test run --rm --build test
git commit -m "Add POST /api/vocables/example-sentence endpoint"
```

Error mapping sketch:

- validation → 400 `{ error: "…" }` German
- message includes `leere Antwort` → 422
- message includes `OLLAMA_BASE_URL` → 503
- other Ollama failures → 502 with German `error` (prefer fixed text or existing Error.message if already German)

---

### Task 4: VocableForm UI + docs

**Files:**
- Modify: `src/components/VocableForm.tsx`
- Modify: `AGENTS.md` (and README one-liner optional)

- [ ] **Step 1: UI**

State: `generating`, `generateError`.

Near Beispielsatz label/textarea:

```tsx
<div className="field-with-action">
  <label>
    Beispielsatz
    <textarea ... />
  </label>
  <button
    type="button"
    className="btn secondary"
    disabled={
      generating ||
      !!exampleSentence.trim() ||
      !hebrew.trim() ||
      !transliteration.trim() ||
      !german.trim()
    }
    onClick={() => void generateExample()}
  >
    {generating ? "Erzeugen…" : "Beispielsatz erzeugen"}
  </button>
  {generateError && <p className="field-error">{generateError}</p>}
</div>
```

`generateExample`:

```ts
async function generateExample() {
  if (exampleSentence.trim()) return;
  setGenerateError(null);
  setGenerating(true);
  try {
    const res = await fetch("/api/vocables/example-sentence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hebrew: hebrew.trim(),
        transliteration: transliteration.trim(),
        german: german.trim(),
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erzeugen fehlgeschlagen.");
    if (typeof data.exampleSentence !== "string" || !data.exampleSentence.trim()) {
      throw new Error("Keine Antwort vom Modell.");
    }
    setExampleSentence(data.exampleSentence.trim());
  } catch (e) {
    setGenerateError(e instanceof Error ? e.message : "Erzeugen fehlgeschlagen.");
  } finally {
    setGenerating(false);
  }
}
```

Reuse existing button styles; add minimal CSS only if layout needs a row (optional `.field-with-action` with gap).

- [ ] **Step 2: AGENTS.md** — under Import/Ollama or project map: `/data/prompts/example-sentence.md`, `POST /api/vocables/example-sentence`.

- [ ] **Step 3: Full Docker verify + commit**

```
docker compose --profile test run --rm --build test
git commit -m "Add Beispielsatz erzeugen button to vocable form"
```

---

## Spec coverage

| Spec | Task |
|------|------|
| Volume prompt + placeholders | 1 |
| Generate helper + settings model | 2 |
| POST API | 3 |
| Form button / empty-only | 4 |
| Docs | 4 |
| Tests | 1–3 |

## Self-review

- No TBD; plain text chat (no JSON schema); UI does not overwrite non-empty field
