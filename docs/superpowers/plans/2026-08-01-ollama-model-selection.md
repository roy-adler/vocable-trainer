# Ollama Model Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users list models from the configured Ollama endpoint, pick one before extract, and persist that choice as the server default in `/data/settings.json`.

**Architecture:** Thin libs for settings file I/O and Ollama `/api/tags` listing; API routes proxy those to the UI; `ExtractionJob.model` freezes the model per job; the extraction worker and `extractVocablesFromMessagesText` use that name. `OLLAMA_MODEL` only seeds the first default when settings have none.

**Tech Stack:** Existing Next.js App Router, Prisma/SQLite, Vitest, Docker Compose (`DATA_DIR=/data`).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-01-ollama-model-selection-design.md`
- German UI labels; no English user-facing copy
- Browser must never call Ollama directly — always via app API
- Settings path: `{DATA_DIR}/settings.json` with key `ollamaModel` only (merge on write)
- Models API: unset base → 503; unreachable → 502; empty list handled in UI
- CI: `npm test`, `npm run typecheck`; Docker tests via `docker compose --profile test run --rm test`
- Do not smoke-test APIs with PowerShell `Invoke-RestMethod` (encoding)

---

## File structure

| File | Responsibility |
|------|----------------|
| `src/lib/settings.ts` | Read/write `/data/settings.json`; resolve default model |
| `src/lib/settings.test.ts` | Temp-dir tests for seed/merge/validation helpers |
| `src/lib/ollama.ts` | Export base URL helper; `listOllamaModels` / `mapOllamaTagNames`; extract accepts `{ model, fetchImpl }` |
| `src/lib/ollama.test.ts` | Tag mapping + extract uses explicit model in body |
| `src/app/api/settings/route.ts` | `GET` / `PUT` settings |
| `src/app/api/ollama/models/route.ts` | `GET` proxy tags + `defaultModel` |
| `prisma/schema.prisma` | `ExtractionJob.model String @default("")` |
| `src/app/api/extraction-jobs/route.ts` | Persist `model` on create |
| `src/app/api/extraction-jobs/[id]/route.ts` | Return `model`; retry refreshes from settings |
| `src/lib/extraction-worker.ts` | Pass `job.model` (or settings fallback) into extract |
| `src/app/api/import/extract/route.ts` | Optional `model` → extract options |
| `src/components/import/OllamaModelPicker.tsx` | Shared select + load/save |
| `src/components/import/ImportWizard.tsx` | Mount picker on `source`, `paste`, `days`; send `model` on enqueue |
| `src/components/import/ExtractionReview.tsx` | Show job model read-only |
| `AGENTS.md`, `README.md`, `.env.example` | Document settings file + env as seed only |

---

### Task 1: Settings lib (`/data/settings.json`)

**Files:**
- Create: `src/lib/settings.ts`
- Create: `src/lib/settings.test.ts`
- Consumes: `getDataDir` from `src/lib/prompt.ts`
- Produces: `getSettingsPath()`, `readAppSettings()`, `writeOllamaModel(model: string)`, `resolveOllamaModel(override?: string | null): string`, type `AppSettings`

**Interfaces:**
- `AppSettings = { ollamaModel: string }`
- `readAppSettings()`: if file missing or `ollamaModel` blank → seed from `process.env.OLLAMA_MODEL?.trim() || "llama3.1"`, write file, return settings
- `writeOllamaModel(model)`: trim; throw `Error("Modellname fehlt.")` if empty; merge only `ollamaModel` into existing JSON (preserve unknown keys); return settings
- `resolveOllamaModel(override?)`: non-empty override wins; else `readAppSettings().ollamaModel`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/settings.test.ts`:

```ts
import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getSettingsPath,
  readAppSettings,
  resolveOllamaModel,
  writeOllamaModel,
} from "./settings";

describe("settings", () => {
  let dir: string;
  const prevData = process.env.DATA_DIR;
  const prevModel = process.env.OLLAMA_MODEL;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "settings-"));
    process.env.DATA_DIR = dir;
    delete process.env.OLLAMA_MODEL;
  });

  afterEach(() => {
    if (prevData === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = prevData;
    if (prevModel === undefined) delete process.env.OLLAMA_MODEL;
    else process.env.OLLAMA_MODEL = prevModel;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("seeds from env when file missing", () => {
    process.env.OLLAMA_MODEL = "gemma:2b";
    const s = readAppSettings();
    expect(s.ollamaModel).toBe("gemma:2b");
    expect(fs.existsSync(getSettingsPath())).toBe(true);
  });

  it("defaults to llama3.1 when env unset", () => {
    expect(readAppSettings().ollamaModel).toBe("llama3.1");
  });

  it("writeOllamaModel merges without wiping unknown keys", () => {
    fs.writeFileSync(
      getSettingsPath(),
      JSON.stringify({ ollamaModel: "a", extra: 1 }),
      "utf8",
    );
    writeOllamaModel("b");
    const raw = JSON.parse(fs.readFileSync(getSettingsPath(), "utf8"));
    expect(raw.ollamaModel).toBe("b");
    expect(raw.extra).toBe(1);
  });

  it("writeOllamaModel rejects empty", () => {
    expect(() => writeOllamaModel("  ")).toThrow(/Modellname fehlt/);
  });

  it("resolveOllamaModel prefers override", () => {
    writeOllamaModel("saved");
    expect(resolveOllamaModel("override")).toBe("override");
    expect(resolveOllamaModel("")).toBe("saved");
    expect(resolveOllamaModel(null)).toBe("saved");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/settings.test.ts`

Expected: FAIL (module not found / exports missing)

- [ ] **Step 3: Implement `src/lib/settings.ts`**

```ts
import fs from "fs";
import path from "path";
import { getDataDir } from "./prompt";

export type AppSettings = {
  ollamaModel: string;
};

export function getSettingsPath(): string {
  return path.join(getDataDir(), "settings.json");
}

function envSeedModel(): string {
  return process.env.OLLAMA_MODEL?.trim() || "llama3.1";
}

function readRawFile(): Record<string, unknown> {
  const p = getSettingsPath();
  if (!fs.existsSync(p)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(p, "utf8")) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

function writeRaw(data: Record<string, unknown>): void {
  const p = getSettingsPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n", "utf8");
}

export function readAppSettings(): AppSettings {
  const raw = readRawFile();
  const fromFile =
    typeof raw.ollamaModel === "string" ? raw.ollamaModel.trim() : "";
  if (fromFile) {
    return { ollamaModel: fromFile };
  }
  const seeded = envSeedModel();
  writeRaw({ ...raw, ollamaModel: seeded });
  return { ollamaModel: seeded };
}

export function writeOllamaModel(model: string): AppSettings {
  const trimmed = model.trim();
  if (!trimmed) {
    throw new Error("Modellname fehlt.");
  }
  const raw = readRawFile();
  writeRaw({ ...raw, ollamaModel: trimmed });
  return { ollamaModel: trimmed };
}

export function resolveOllamaModel(override?: string | null): string {
  const o = typeof override === "string" ? override.trim() : "";
  if (o) return o;
  return readAppSettings().ollamaModel;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/settings.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/settings.ts src/lib/settings.test.ts
git commit -m "Add persisted app settings for Ollama model default"
```

---

### Task 2: Settings API route

**Files:**
- Create: `src/app/api/settings/route.ts`
- Consumes: `readAppSettings`, `writeOllamaModel` from Task 1
- Produces: `GET` → `{ ollamaModel }`; `PUT` body `{ ollamaModel }` → same or 400

- [ ] **Step 1: Implement route**

```ts
import { NextRequest, NextResponse } from "next/server";
import { readAppSettings, writeOllamaModel } from "@/lib/settings";

export async function GET() {
  try {
    return NextResponse.json(readAppSettings());
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Einstellungen konnten nicht geladen werden." },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as { ollamaModel?: unknown };
    if (typeof body.ollamaModel !== "string") {
      return NextResponse.json(
        { error: "Modellname fehlt." },
        { status: 400 },
      );
    }
    const settings = writeOllamaModel(body.ollamaModel);
    return NextResponse.json(settings);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Speichern fehlgeschlagen.";
    const status = message.includes("Modellname fehlt") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`

Expected: PASS (no errors from new route)

- [ ] **Step 3: Commit**

```bash
git add src/app/api/settings/route.ts
git commit -m "Add GET/PUT /api/settings for Ollama model default"
```

---

### Task 3: List Ollama models (lib + API)

**Files:**
- Modify: `src/lib/ollama.ts` — export `getOllamaBaseUrl`, add `mapOllamaTagNames`, `listOllamaModels`
- Modify: `src/lib/ollama.test.ts` — tests for mapping + list errors
- Create: `src/app/api/ollama/models/route.ts`
- Consumes: settings `readAppSettings`
- Produces: `mapOllamaTagNames(payload: unknown): string[]`, `listOllamaModels(fetchImpl?: typeof fetch): Promise<string[]>`, `GET /api/ollama/models` → `{ models: string[], defaultModel: string }`

**Interfaces:**
- Ollama tags shape: `{ models?: Array<{ name?: string }> }`
- Unset base: throw Error with German text containing `OLLAMA_BASE_URL` (route maps to 503)
- Network failure: throw; route maps to 502

- [ ] **Step 1: Write failing tests in `src/lib/ollama.test.ts`**

Add:

```ts
import { mapOllamaTagNames, listOllamaModels } from "./ollama";

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
    const fetchImpl = vi.fn(async (url: string) => {
      expect(String(url)).toBe("http://ollama.test:11434/api/tags");
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
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npm test -- src/lib/ollama.test.ts`

Expected: FAIL on missing exports

- [ ] **Step 3: Implement in `src/lib/ollama.ts`**

Export the existing private `getOllamaBaseUrl` as `export function getOllamaBaseUrl`.

Add:

```ts
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
    res = await fetchImpl(url);
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
```

- [ ] **Step 4: Implement `src/app/api/ollama/models/route.ts`**

```ts
import { NextResponse } from "next/server";
import { listOllamaModels } from "@/lib/ollama";
import { readAppSettings } from "@/lib/settings";

export async function GET() {
  try {
    const models = await listOllamaModels();
    const { ollamaModel } = readAppSettings();
    return NextResponse.json({ models, defaultModel: ollamaModel });
  } catch (error) {
    console.error(error);
    const message =
      error instanceof Error
        ? error.message
        : "Modelle konnten nicht geladen werden.";
    const status = message.includes("OLLAMA_BASE_URL") ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
```

- [ ] **Step 5: Run tests + typecheck**

Run: `npm test -- src/lib/ollama.test.ts`

Run: `npm run typecheck`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/ollama.ts src/lib/ollama.test.ts src/app/api/ollama/models/route.ts
git commit -m "Proxy Ollama /api/tags for model listing"
```

---

### Task 4: Extract accepts explicit model + schema column

**Files:**
- Modify: `prisma/schema.prisma` — `ExtractionJob.model String @default("")`
- Modify: `src/lib/ollama.ts` — change extract signature
- Modify: `src/lib/ollama.test.ts` — assert body.model from options; update call sites
- Modify: `src/app/api/import/extract/route.ts` — optional `model`
- Consumes: `resolveOllamaModel` from settings
- Produces: `extractVocablesFromMessagesText(text, options?: { model?: string; fetchImpl?: typeof fetch })`

- [ ] **Step 1: Write failing test for explicit model**

In `extractVocablesFromMessagesText` describe block, add:

```ts
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
```

Update existing calls from `extractVocablesFromMessagesText("chat", fetchImpl)` to `extractVocablesFromMessagesText("chat", { fetchImpl })`.

- [ ] **Step 2: Run test — expect FAIL** (signature / model still from env)

Run: `npm test -- src/lib/ollama.test.ts`

- [ ] **Step 3: Change extract implementation**

Use a static top-level `import { resolveOllamaModel } from "./settings"`.

Replace signature and model resolution:

```ts
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
  // ... rest unchanged: body uses `model`, fetchImpl vs ollamaChatRequest
}
```

Remove private `getOllamaModel` if unused.

- [ ] **Step 4: Update `src/app/api/import/extract/route.ts`**

Accept `model?: string` on body; call:

```ts
const candidates = await extractVocablesFromMessagesText(messagesText, {
  model: typeof body.model === "string" ? body.model : undefined,
});
```

- [ ] **Step 5: Add Prisma field**

In `prisma/schema.prisma` on `ExtractionJob` (after `inputText`):

```prisma
  model         String                 @default("")
```

Entrypoint already runs `prisma db push` — no separate migration file.

- [ ] **Step 6: Run tests**

Run: `npm test -- src/lib/ollama.test.ts`

Run: `npx prisma generate`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma src/lib/ollama.ts src/lib/ollama.test.ts src/app/api/import/extract/route.ts
git commit -m "Pass explicit Ollama model into extract and job schema"
```

---

### Task 5: Wire jobs create, worker, retry

**Files:**
- Create: `src/lib/extraction-model.ts`
- Create: `src/lib/extraction-model.test.ts`
- Modify: `src/app/api/extraction-jobs/route.ts`
- Modify: `src/app/api/extraction-jobs/[id]/route.ts`
- Modify: `src/lib/extraction-worker.ts`

**Interfaces:**
- Create body may include `model?: string`
- Job create: `model: modelForNewJob(body.model)`
- Worker: `extractVocablesFromMessagesText(job.inputText, { model: resolveOllamaModel(job.model) })`
- GET job JSON includes `model: job.model`
- Retry PATCH: set `model: modelForRetry()` (current settings)

- [ ] **Step 1: Write unit test for create/retry helpers**

Create `src/lib/extraction-model.ts`:

```ts
import { resolveOllamaModel } from "./settings";

/** Model frozen onto a new or retried extraction job. */
export function modelForNewJob(requestModel?: string | null): string {
  return resolveOllamaModel(requestModel);
}

export function modelForRetry(): string {
  return resolveOllamaModel();
}
```

Create `src/lib/extraction-model.test.ts`:

```ts
import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { modelForNewJob, modelForRetry } from "./extraction-model";
import { writeOllamaModel } from "./settings";

describe("extraction-model", () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "em-"));
    process.env.DATA_DIR = dir;
    delete process.env.OLLAMA_MODEL;
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    delete process.env.DATA_DIR;
  });

  it("create uses request override", () => {
    writeOllamaModel("saved");
    expect(modelForNewJob("override")).toBe("override");
  });

  it("retry uses current settings", () => {
    writeOllamaModel("new-default");
    expect(modelForRetry()).toBe("new-default");
  });
});
```

- [ ] **Step 2: Run — FAIL then implement — PASS**

Run: `npm test -- src/lib/extraction-model.test.ts`

- [ ] **Step 3: Wire create route**

In `POST` of `src/app/api/extraction-jobs/route.ts`:

- Import `modelForNewJob`
- Extend body type with `model?: string`
- In `create` data: `model: modelForNewJob(body.model)`

- [ ] **Step 4: Wire GET + retry**

In `[id]/route.ts` GET response add `model: job.model`.

On retry:

```ts
import { modelForRetry } from "@/lib/extraction-model";
// ...
await prisma.extractionJob.update({
  where: { id },
  data: {
    status: "queued",
    error: "",
    readyAt: null,
    model: modelForRetry(),
  },
});
```

- [ ] **Step 5: Wire worker**

```ts
import { resolveOllamaModel } from "@/lib/settings";

const candidates = await extractVocablesFromMessagesText(job.inputText, {
  model: resolveOllamaModel(job.model),
});
```

- [ ] **Step 6: Run full unit tests + typecheck**

Run: `npm test`

Run: `npm run typecheck`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/extraction-model.ts src/lib/extraction-model.test.ts \
  src/app/api/extraction-jobs/route.ts \
  src/app/api/extraction-jobs/[id]/route.ts \
  src/lib/extraction-worker.ts
git commit -m "Store and use per-job Ollama model on extract and retry"
```

---

### Task 6: Import UI — `OllamaModelPicker` + wizard

**Files:**
- Create: `src/components/import/OllamaModelPicker.tsx`
- Modify: `src/components/import/ImportWizard.tsx`

**Interfaces:**
- Props: `value: string`, `onChange: (model: string) => void`, `disabled?: boolean`, `onAvailabilityChange?: (ok: boolean) => void`
- On mount: `GET /api/ollama/models`
- On user change: `PUT /api/settings` with `{ ollamaModel }`, then `onChange`
- If `defaultModel` not in `models`, append it to options and show warning: `Gespeichertes Modell ist auf Ollama nicht installiert.`
- On error / empty models: German error; `onAvailabilityChange(false)`

- [ ] **Step 1: Implement `OllamaModelPicker`**

```tsx
"use client";

import { useEffect, useState } from "react";

type Props = {
  value: string;
  onChange: (model: string) => void;
  disabled?: boolean;
  onAvailabilityChange?: (ok: boolean) => void;
};

export function OllamaModelPicker({
  value,
  onChange,
  disabled,
  onAvailabilityChange,
}: Props) {
  const [models, setModels] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/ollama/models");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Modelle fehlen");
        if (cancelled) return;
        const list: string[] = Array.isArray(data.models) ? data.models : [];
        const def =
          typeof data.defaultModel === "string" ? data.defaultModel : "";
        setModels(list);
        if (!value && def) onChange(def);
        const ok = list.length > 0;
        if (!ok) setError("Keine Modelle auf Ollama gefunden.");
        onAvailabilityChange?.(ok);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Modelle fehlen");
        onAvailabilityChange?.(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Load once when the picker mounts (per Import step that includes it).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const options =
    value && !models.includes(value) ? [...models, value] : models;
  const missingOnServer = Boolean(
    value && models.length > 0 && !models.includes(value),
  );

  async function handleChange(next: string) {
    onChange(next);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ollamaModel: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Speichern fehlgeschlagen");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
    }
  }

  return (
    <div className="ollama-model-picker">
      <label>
        Ollama-Modell
        <select
          value={value}
          disabled={disabled || loading || options.length === 0}
          onChange={(e) => void handleChange(e.target.value)}
        >
          {options.length === 0 && <option value="">—</option>}
          {options.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>
      {loading && <p className="muted">Modelle werden geladen…</p>}
      {error && <p className="muted">{error}</p>}
      {missingOnServer && (
        <p className="muted">
          Gespeichertes Modell ist auf Ollama nicht installiert.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire `ImportWizard`**

- State: `const [model, setModel] = useState("");` and `const [modelsOk, setModelsOk] = useState(false);`
- Render `<OllamaModelPicker value={model} onChange={setModel} disabled={busy} onAvailabilityChange={setModelsOk} />` near the top of steps `source`, `paste`, and `days`
- `enqueueJob`: include `model` in payload
- Disable extract when `!modelsOk || !model` (paste button and day buttons)

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/import/OllamaModelPicker.tsx src/components/import/ImportWizard.tsx
git commit -m "Add Ollama model picker to import wizard"
```

---

### Task 7: Review UI shows model + docs

**Files:**
- Modify: `src/components/import/ExtractionReview.tsx`
- Modify: `src/app/api/extraction-jobs/route.ts` (list includes `model`)
- Modify: `AGENTS.md`, `README.md`, `.env.example`

- [ ] **Step 1: ExtractionReview + list API**

Extend `Job` type with `model: string`. Near sourceLabel / status show:

```tsx
{job.model ? <p className="muted">Modell: {job.model}</p> : null}
```

In `GET /api/extraction-jobs` map, add `model: j.model`.

- [ ] **Step 2: Docs**

AGENTS.md — under Import / Ollama:

- Default model in `/data/settings.json` (`ollamaModel`); `OLLAMA_MODEL` only seeds when missing
- `GET /api/ollama/models`, `GET|PUT /api/settings`

README / `.env.example`: note UI choice writes settings on the volume.

- [ ] **Step 3: Full verification**

Run: `npm test`

Run: `npm run typecheck`

Optional: `docker compose --profile test run --rm test`

Expected: all green

- [ ] **Step 4: Commit**

```bash
git add src/components/import/ExtractionReview.tsx \
  src/app/api/extraction-jobs/route.ts \
  AGENTS.md README.md .env.example
git commit -m "Show job model in review and document settings default"
```

---

## Spec coverage check

| Spec item | Task |
|-----------|------|
| Proxy `/api/tags` | 3 |
| `/data/settings.json` | 1–2 |
| `OLLAMA_MODEL` seed only | 1 |
| UI start + paste/days | 6 |
| `ExtractionJob.model` | 4–5 |
| Worker uses job model | 5 |
| Review shows model | 7 |
| Sync extract optional model | 4 |
| Retry uses current default | 5 |
| 503 / 502 errors | 3 |
| Docs | 7 |
| Tests listed in spec | 1, 3, 4, 5 |

## Placeholder / consistency self-review

- No TBD left; signatures use `resolveOllamaModel` / `modelForNewJob` / `modelForRetry` consistently
- Extract options object `{ model?, fetchImpl? }` used everywhere after Task 4
- Settings key always `ollamaModel`
