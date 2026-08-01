# Hebrew–German Wörterbuch MVP — Design

**Date:** 2026-08-01  
**Status:** Approved for implementation planning  
**Stack choice:** Next.js (App Router) + TypeScript + SQLite, single Docker Compose service

## Goal

A personal Hebrew ↔ German vocabulary trainer (Wörterbuch) usable on phone and desktop, hosted locally and reachable on a Tailscale network. MVP focuses on managing and browsing vocabulary; practice modes and Teams/AI import come later.

## Scope

### In MVP

- Scrollable vocabulary list
- Search across Hebrew script, German-lettered transliteration, and German translation
- Create, edit, delete entries
- Tags (many-to-many); filter by tag
- Expandable “more info”: example sentence + notes
- Responsive UI: compact list + tag chips on phone; tag sidebar + same list on desktop
- German UI labels
- One `docker compose` service; SQLite on a named volume
- No app-level auth (Tailscale is the gate; Authelia may sit in front later)

### Out of MVP

- Practice / flashcard modes
- Microsoft Teams chat import
- Ollama / AI extraction (env hook only if trivial; no feature UI)
- Multi-user accounts / Authelia integration inside the app
- Postgres, multi-container DB stack

## Data model

### Vocable (entry)

| Field | Type | Required | Notes |
|-------|------|----------|--------|
| `id` | string/cuid | yes | Primary key |
| `hebrew` | string | yes | Hebrew script; render RTL |
| `transliteration` | string | yes | German-lettered writing of the Hebrew word |
| `german` | string | yes | German translation |
| `exampleSentence` | string | no | Shown in expanded “more info” |
| `notes` | string | no | Free-text tips / context |
| `createdAt` | datetime | yes | |
| `updatedAt` | datetime | yes | |

### Tag

| Field | Type | Required |
|-------|------|----------|
| `id` | string/cuid | yes |
| `name` | string | yes (unique, case-insensitive uniqueness preferred) |

### VocableTag

Join table: many vocables ↔ many tags.

## Architecture

```
Browser (phone / desktop)
        │
        ▼
┌───────────────────────────┐
│  Next.js app (one container) │
│  UI + Route Handlers (API)   │
│  Prisma → SQLite             │
└───────────────────────────┘
        │
        ▼
  Volume: /data/vocable.db
```

- **Runtime:** Node.js serving Next.js
- **Persistence:** SQLite file at `DATABASE_URL` (default `file:/data/vocable.db` in Docker)
- **Compose:** single `app` service, port `3000:3000`, volume `vocable-data:/data`
- **Future:** optional `OLLAMA_BASE_URL` for AI features; reverse proxy (Authelia) in front of 3000

### API surface (same process)

- `GET /api/vocables?q=&tag=` — list / search / filter
- `GET /api/vocables/[id]` — one entry
- `POST /api/vocables` — create
- `PATCH /api/vocables/[id]` — update
- `DELETE /api/vocables/[id]` — delete
- `GET /api/tags` — list tags
- `POST /api/tags` — create tag (also creatable inline when assigning)

Search: case-insensitive substring over `hebrew`, `transliteration`, and `german`. Optional tag filter via `?tag=<tagId>`.

## UI / UX

### Layout

- **Phone:** header (“Wörterbuch”) + Add; search field; horizontal tag chips (including “Alle”); compact list rows
- **Desktop:** left tag sidebar (“Alle”, tags, “+ neuer Tag”); main area with search + Add + list
- **Row (collapsed):** Hebrew (RTL, prominent) · transliteration · German
- **Row (expanded):** example sentence (“Beispiel”), notes, Edit / Delete actions

### Flows

- **Add:** form (modal on desktop, full-screen sheet on phone) with required fields, optional example/notes, tag picker (create tag inline)
- **Edit:** same form prefilled
- **Delete:** confirm dialog (“Eintrag löschen?”)
- **Filter:** selecting a tag narrows the list; “Alle” clears filter
- **Search:** debounced input (~200–300ms); combines with active tag filter (AND)

### i18n / direction

- Chrome/labels in German
- Hebrew fields: `dir="rtl"`
- Transliteration and German: LTR

## Errors & empty states

- Missing required fields → inline validation; do not save
- Empty list / no search hits → short German empty state
- Persistence/API failure → non-blocking error banner; retry possible
- Delete requires explicit confirmation

## Ops

```yaml
# Conceptual compose shape
services:
  app:
    build: .
    ports: ["3000:3000"]
    volumes:
      - vocable-data:/data
    environment:
      DATABASE_URL: file:/data/vocable.db
volumes:
  vocable-data:
```

- Start: `docker compose up --build`
- Backup: copy volume / SQLite file
- No auth middleware in MVP

## Testing (MVP bar)

- Manual: CRUD, search, tag filter, expand more info, phone + desktop widths
- Optional light automated tests for API CRUD + search if low-cost

## Success criteria

1. User can add a Hebrew word with transliteration and German translation and see it in the list
2. User can search and find it by any of the three main fields
3. User can tag entries and filter by tag
4. User can expand an entry to see/edit example sentence and notes
5. App runs via one Docker Compose stack and is usable on phone and desktop over the network (e.g. Tailscale)

## Later (non-blocking design notes)

- Practice modes against the same SQLite data
- Teams chat window selection → Ollama extract → review-before-save import
- Authelia (or similar) as external auth gateway
- Migrate to Postgres only if single-user SQLite becomes a real constraint
