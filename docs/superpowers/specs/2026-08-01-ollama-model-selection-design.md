# Ollama model selection before extract — Design

**Date:** 2026-08-01  
**Status:** Approved for implementation  
**Depends on:** `docs/superpowers/specs/2026-08-01-background-extraction-jobs-design.md`

## Goal

Let the user see which models are available on the configured Ollama endpoint and choose one before starting an extraction. The chosen model becomes the **server-side default** (persisted on the data volume) so `.env` is only a bootstrap seed, not the ongoing source of truth.

## Decisions locked

- List models by proxying Ollama `GET /api/tags` (browser never talks to Ollama directly)
- Persist default in `/data/settings.json` (`ollamaModel`), not Prisma
- `OLLAMA_MODEL` (else `llama3.1`) seeds the default only when the settings file has no model yet
- UI: set default on Import start page **and** still editable on paste / day extract steps
- Each `ExtractionJob` stores the model used; worker uses `job.model`
- Retry failed jobs: refresh `job.model` from current settings default before re-queue

## Scope

### In

- `GET /api/ollama/models` — proxy tags → `{ models: string[], defaultModel: string }`
- `GET` / `PUT /api/settings` — read/write `/data/settings.json`
- Shared German UI control „Ollama-Modell“ on Import `source`, `paste`, and `days` steps
- Persist selection immediately on change (`PUT`)
- `ExtractionJob.model` column; create-job accepts optional `model`
- `extractVocablesFromMessagesText(text, { model })` uses the explicit model
- Show job model read-only on review / job detail
- Sync `/api/import/extract` also accepts optional `model` (settings default if omitted)
- Tests for settings file, models proxy mapping, model in Ollama request body, job persistence / retry

### Out

- Pulling / deleting models from the UI
- Per-user settings (single-user app)
- Parallel Ollama jobs
- Changing model of an already running job

## Settings file

Path: `{DATA_DIR}/settings.json` (same volume root as the DB / prompts).

```json
{
  "ollamaModel": "llama3.1"
}
```

- Missing file or missing `ollamaModel`: treat as unset → seed from `OLLAMA_MODEL` or `llama3.1` on first read; optionally write the seeded value so the file exists.
- `PUT` with empty / non-string model → 400 with German error.
- Unknown keys: ignore on read; do not wipe on write (merge `ollamaModel` only).

## Data model

### ExtractionJob (additive)

| Field | Type | Notes |
|-------|------|--------|
| model | string | Ollama model name for this job; required for new jobs |

Existing rows: column default `""`; worker uses settings default when `job.model` is blank.

## Architecture

```
UI select  →  PUT /api/settings  →  /data/settings.json
UI select  →  GET /api/ollama/models  →  OLLAMA_BASE_URL/api/tags
POST /api/extraction-jobs { model? }  →  Job(queued, model)  →  worker → Ollama chat(model)
```

**Resolution order for a new job:** request body `model` if non-empty → else current settings default.

**Retry:** on `action: "retry"`, set `model` from current settings default, clear error, re-queue.

## UI

- Label: **Ollama-Modell**
- `<select>` populated from `models`; preselect `defaultModel`
- If saved default is not in the list (model removed on Ollama): still offer it as an option plus a short German warning; user should pick another
- Ollama unreachable / unset `OLLAMA_BASE_URL` / empty list: show German error; disable extract until models load successfully
- Reload models when entering Import steps that show the control
- Review / job detail: show „Modell: …“ read-only

## Errors

| Case | Behaviour |
|------|-----------|
| `OLLAMA_BASE_URL` unset | `GET /api/ollama/models` → 503, German message |
| Ollama unreachable | `GET /api/ollama/models` → 502, German message; UI surfaces it |
| Empty tags list | UI error; extract disabled |
| Missing model at chat time | Job `failed` with Ollama error text |
| Invalid settings PUT | 400 |

## Testing

- Settings read/write against a temp `DATA_DIR`
- Models helper maps Ollama tags payload → name list
- Extract request body includes the chosen `model`
- Job create stores `model`; retry updates `model` from settings

## Docs / env

- Keep `OLLAMA_MODEL` in `.env.example` / README / AGENTS as **initial default only** once settings exist
- Note `/data/settings.json` in AGENTS project map briefly
