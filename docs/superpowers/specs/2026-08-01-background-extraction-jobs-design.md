# Background extraction jobs + review queue — Design

**Date:** 2026-08-01  
**Status:** Approved for implementation  
**Depends on:** `docs/superpowers/specs/2026-08-01-teams-meeting-chat-import-design.md`

## Goal

Ollama extraction runs as a **server-side background job** so the user can keep using the Wörterbuch. When finished, an in-app **header notification** opens a durable **review queue** (list + one-by-one with “n von N”). Duplicates (same trimmed Hebrew) are compared **field-by-field** against the existing entry; the user merges, skips, or continues later without losing work. Closing or refreshing the browser does not cancel the job.

## Decisions locked

- Job storage: SQLite + in-process serial worker (no extra Compose service)
- Notification: persistent header badge/banner (Wörterbuch + Import)
- Review: overview list **and** focused stepper with counter
- Duplicates: exact trimmed Hebrew match; side-by-side per-field merge into existing row
- Unfinished reviews remain until applied/dismissed

## Scope

### In

- Replace synchronous `/api/import/extract` wait with job enqueue
- `ExtractionJob` + `ExtractionSuggestion` models
- Worker: queue → Ollama → suggestions → `ready` / `failed`
- Crash recovery: `running` → `queued` on process start
- Header notification for open jobs (`queued`/`running`/`ready`/`failed`)
- Review UI: list + detail stepper (“3 von 17”), progress persisted
- Duplicate compare UI; apply creates or updates vocable
- Keep paste + Graph day as job sources

### Out

- Browser push notifications
- Parallel Ollama jobs
- Fuzzy duplicate matching
- Separate worker container

## Data model

### ExtractionJob

| Field | Type | Notes |
|-------|------|--------|
| id | cuid | |
| status | string | `queued` \| `running` \| `ready` \| `failed` \| `done` \| `dismissed` |
| sourceType | string | `paste` \| `teams` |
| sourceLabel | string | e.g. day key or “Eingefügter Text” |
| learnedOn | DateTime | default lesson date for suggestions |
| inputText | string | messages text sent to Ollama |
| error | string | optional |
| createdAt / updatedAt | DateTime | |
| readyAt | DateTime? | when extraction finished |

### ExtractionSuggestion

| Field | Type | Notes |
|-------|------|--------|
| id | cuid | |
| jobId | FK | cascade delete |
| sortIndex | int | stable order |
| hebrew, transliteration, german, exampleSentence, notes | string | candidate |
| learnedOn | DateTime | |
| existingVocableId | string? | if Hebrew match |
| existingSnapshot | string | JSON snapshot of existing fields at extract time |
| status | string | `pending` \| `imported` \| `skipped` |
| fieldChoices | string | JSON: per-field `suggestion` \| `existing` for merge |
| resolvedVocableId | string? | after import/update |

## Architecture

```
POST /api/extraction-jobs  →  Job(queued)  →  kick worker
worker (serial)            →  Ollama      →  Suggestions + Job(ready|failed)
GET  /api/extraction-jobs  →  header badge poll (~3–5s while open jobs)
Review UI                  →  PATCH suggestions / POST apply / dismiss
```

**Worker kick:** after enqueue; and from `ensure-runtime` / module init on server start (reset stuck `running` → `queued`).

**Duplicate detection:** at end of extract, for each candidate `findFirst` where `hebrew` equals trimmed text; store id + JSON snapshot.

## UI

### Header

- Badge: count of jobs in `queued`|`running`|`ready`|`failed` (or only non-done)
- Copy examples: “Extraktion läuft…”, “12 Vorschläge bereit”, “Extraktion fehlgeschlagen”
- Click → `/import/review` or `/import/review/[jobId]`

### Import flow change

- After paste/day choose: “Extraktion starten” → enqueue → toast/redirect to Wörterbuch with badge, not blocking spinner page
- Optional small “läuft im Hintergrund” confirmation on Import

### Review

- **List:** all suggestions with status chips (Neu / Duplikat / Übernommen / Übersprungen); show total count
- **Detail:** one suggestion; “Vorschlag X von Y”; prev/next; for duplicates two columns (Bestehend | Vorschlag) with per-field radio/toggle; actions: Übernehmen (merge/create), Überspringen, Zurück zur Liste
- Leaving mid-review keeps `pending` suggestions; job stays `ready` until all pending cleared or user dismisses
- When no pending left → job `done`

## Apply semantics

- **No duplicate:** create vocable from suggestion (editable before apply)
- **Duplicate:** build final fields from `fieldChoices` (default: non-empty suggestion fields win, or explicit picks); `PATCH` existing vocable; set suggestion `imported`
- **Skip:** `skipped`; does not change DB vocable

## Errors

- Ollama failure → job `failed` + error message; badge shows failure; retry = new job or re-queue same input
- Empty extract → `failed` or `ready` with 0 suggestions + message

## Testing

- Unit: duplicate match; field merge; job status transitions
- Integration: enqueue → mock Ollama → ready → apply
- Manual: start extract, leave page, return to badge + review

## Success criteria

1. Extract continues after closing the tab (container still up)
2. Header shows ready/failed state after reload
3. Review shows total and current index; unfinished work persists
4. Duplicates are comparable field-by-field; merge updates existing entry
