# Teams import + learnedOn — Implementation Plan

> **For agentic workers:** Execute task-by-task. User requested immediate implementation (inline).

**Goal:** Add `learnedOn` to vocables and an Import wizard (paste + Graph device-code + day picker + editable Ollama prompt + review-before-save).

**Architecture:** Same Next.js/Docker app. Pure libs for day-grouping, prompt loading, Ollama JSON parse; API routes for Microsoft, extract, bulk import; Import page wizard UI.

**Tech Stack:** Existing Next.js + Prisma + SQLite; `fetch` to Ollama; Microsoft identity device-code + Graph REST.

## Global Constraints

- German UI; Hebrew `dir="rtl"`
- Docker-only local workflow; editable prompt at `/data/prompts/extract-vocables.md`
- Graph first, paste fallback; no auto-import without review
- Spec: `docs/superpowers/specs/2026-08-01-teams-meeting-chat-import-design.md`
- TZ default Europe/Berlin via `TZ` env

---

## File structure

- `prisma/schema.prisma` — add `learnedOn`
- `docker/entrypoint.sh` — ensure prompt file + backfill learnedOn if needed
- `prompts/extract-vocables.md` — default prompt template
- `src/lib/dates.ts` — date-only helpers, day grouping
- `src/lib/prompt.ts` — load/render prompt template
- `src/lib/ollama.ts` — call Ollama, parse JSON
- `src/lib/microsoft/*` — device code, token store, graph chats/messages
- `src/app/api/import/*` — extract, commit; `src/app/api/microsoft/*` — auth + chats + days
- `src/app/import/page.tsx` + `src/components/import/*` — wizard
- Update vocable API/UI for `learnedOn`

---

### Task 1: `learnedOn` schema + API + form

- [ ] Add `learnedOn DateTime` to Vocable; entrypoint backfill SQL for nulls after push
- [ ] Extend validation + types + serialize
- [ ] Form field “Gelernt am”; show date on expanded row
- [ ] Tests for date parsing defaults

### Task 2: Day grouping + prompt + Ollama libs

- [ ] `groupMessagesByDay(messages, timeZone)` with tests
- [ ] Default `prompts/extract-vocables.md` with `{{messages}}`
- [ ] `loadExtractPrompt` / `renderPrompt` (data dir override)
- [ ] `extractVocablesFromText` calling Ollama `/api/chat` or `/api/generate`
- [ ] Unit tests with mocked fetch / fixtures

### Task 3: Paste import path (E2E in app)

- [ ] `POST /api/import/extract` — body: `{ text, learnedOn }`
- [ ] `POST /api/import/commit` — body: selected vocables + learnedOn
- [ ] Import wizard UI: paste → pick date → extract → review → commit
- [ ] Nav link from main app
- [ ] Duplicate hints vs existing hebrew

### Task 4: Microsoft Graph (device code)

- [ ] Token store under `/data/microsoft-tokens.json`
- [ ] Device-code start/poll endpoints
- [ ] List chats, list day summaries for a chat, fetch day messages
- [ ] Wizard steps for Graph; on failure show paste

### Task 5: Docs / compose env / AGENTS

- [ ] Document env vars, prompt editing, Azure app registration sketch
- [ ] `docker-compose` env placeholders
- [ ] CI still green (no live Graph/Ollama)

---

## Execution note

Implement inline in this session; verify via Docker build/test.
