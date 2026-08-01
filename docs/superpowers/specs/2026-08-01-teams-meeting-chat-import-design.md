# Teams meeting-chat import + `learnedOn` — Design

**Date:** 2026-08-01  
**Status:** Approved for implementation planning  
**Depends on:** `docs/superpowers/specs/2026-08-01-hebrew-german-worterbuch-design.md` (MVP Wörterbuch)

## Goal

Import vocabulary discussed in a recurring Teams **meeting chat** with a teacher: pick the chat, pick a **calendar day** of messages (so the same long thread is not re-sent whole each time), extract vocables via **Ollama**, review them, then save into the Wörterbuch. Every vocable has a **Lern-/Lektionsdatum** (`learnedOn`) for later practice filters by date or range.

## Context & constraints

- User uses a **personal Microsoft account** (MSA) for Teams
- Recurring **meeting chat** (same call over time)
- Ollama already available on the Tailscale network (`OLLAMA_BASE_URL`)
- Single-user app behind Tailscale; no in-app multi-user auth
- Graph for MSA meeting chats may be unreliable → **Graph first, paste fallback** with the same extract/review UX

## Scope

### In

- Schema + UI: `learnedOn` on every vocable (date semantics)
- Backfill existing rows: `learnedOn` ← date of `createdAt`
- Manual add/edit: field “Gelernt am”, default today
- Import wizard (German UI):
  1. Connect Microsoft (device-code login) **or** paste text
  2. Choose chat (Graph path)
  3. Choose day (message dates with counts)
  4. Extract via Ollama → structured vocable candidates
  5. Review checklist (edit, select, duplicate hints)
  6. Import selected rows with `learnedOn` = selected day (overridable in review)
- Persist Microsoft tokens on the data volume (single user)
- Env: `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `MICROSOFT_CLIENT_ID` (+ secret if required)
- Ollama prompt template as an editable file on the data volume (default shipped in repo; override without rebuilding the image)

### Out

- Practice / training UI that filters by `learnedOn` (field exists for later)
- Auto-import without review
- Multi-day extract in one shot (single day per run for v1)
- Work/school-only Graph features as a hard requirement
- Teams channel import (meeting chat + paste only)

## Data model changes

### Vocable (add)

| Field | Type | Required | Notes |
|-------|------|----------|--------|
| `learnedOn` | `DateTime` (store as UTC midnight or date-only convention) | yes | Lesson / learning date; used later for practice filters |
| `createdAt` | existing | yes | When row was created in the app |
| `updatedAt` | existing | yes | Last edit |

**Backfill:** `UPDATE Vocable SET learnedOn = date(createdAt)` (or equivalent Prisma migration strategy).

**Import:** each accepted candidate sets `learnedOn` from the wizard’s selected day unless the user overrides it in review.

## Architecture

```
Browser
  → Next.js (same Docker service)
       ├─ Microsoft device-code OAuth (MSA)
       │     Graph: /me/chats → messages → group by local calendar day
       ├─ Paste fallback (optional timestamps; else “today” or user-picked date)
       ├─ Ollama HTTP API → JSON array of vocable fields
       └─ Review payload → create many vocables (transaction)
```

### Microsoft Graph

- Azure app registration for personal Microsoft accounts where supported
- Auth: **device code** (Tailscale hostname friendly); browser redirect optional later
- Scopes: at least `User.Read`, `Chat.Read` (adjust if Graph docs require more for meeting chats)
- List chats; user picks one (remember last `chatId` in local settings or DB)
- Fetch messages for that chat; aggregate by calendar day (timezone: Europe/Berlin or browser-local — pick **Europe/Berlin** for consistency in Docker unless `TZ` env set)
- If message fetch fails or returns empty for the meeting thread → UI offers paste on the same step

### Day selection

- UI lists days that have ≥1 message: `YYYY-MM-DD · N Nachrichten`
- User selects **one** day
- Only messages from that day are sent to Ollama

### Ollama extraction

- Input: concatenated messages (sender + timestamp + body), truncated if over model context with a clear warning
- Output: JSON array of objects:
  - `hebrew`, `transliteration`, `german` (required)
  - `exampleSentence`, `notes` (optional)
- Validate with existing `validateVocableInput` (or shared schema) before showing review
- No write to DB until user confirms

**Editable prompt (required):** The system/user prompt template must be easy to change without a code edit or image rebuild.

- Store the prompt as a plain-text (or Markdown) file on the data volume, e.g. `/data/prompts/extract-vocables.md`
- Ship a default template in the repo (`prompts/extract-vocables.md`); on first start, copy to `/data/prompts/` if missing
- Template supports simple placeholders (e.g. `{{messages}}`) that the app fills in
- Document in README/AGENTS how to edit the file (volume mount / `docker compose exec` / host bind if used)
- Optional later: small “Prompt bearbeiten” UI — **not required** for v1 if the file path is documented and bind-mountable

### Review & import

- Table/list: checkbox (default on), editable fields, `learnedOn`, duplicate flag if same `hebrew` already exists (case-sensitive match on trimmed Hebrew for v1)
- “Übernehmen” creates only checked rows
- Optional later: auto-tag `Lektion YYYY-MM-DD` — **not required** in v1; `learnedOn` is the primary lesson signal

### Token storage

- Refresh/access tokens in a file under `/data` (volume), file permissions restricted
- Not committed to git; document rotation / “Abmelden”

## UI flow (German)

Nav entry: **Import** (or “Aus Teams”).

1. **Quelle:** Microsoft verbinden (device code instructions) | Text einfügen  
2. **Chat:** list (Graph)  
3. **Tag:** day list with counts  
4. **Extrahieren:** progress / errors  
5. **Prüfen:** review checklist  
6. **Übernehmen:** success count → link back to list  

Main vocable form: add **Gelernt am** date input.

## Errors

| Case | Behavior |
|------|----------|
| Device code / token failure | German message + retry connect |
| Graph messages unavailable | Offer paste fallback |
| Ollama unreachable / timeout | Banner; keep selection; retry |
| Invalid / empty model JSON | “Keine Vokabeln erkannt”; retry |
| Zero rows checked on import | Hint; no DB writes |

## Ops

```yaml
# Additional env (conceptual)
OLLAMA_BASE_URL: http://ollama:11434   # or Tailscale host
OLLAMA_MODEL: llama3.1                 # user-chosen multilingual model
MICROSOFT_CLIENT_ID: ...
# MICROSOFT_CLIENT_SECRET: ...         # if registration requires it
TZ: Europe/Berlin
```

Same Compose `app` service; no new containers required (Ollama stays external).

## Testing

- Unit: group messages by day; `learnedOn` backfill/default; duplicate detection; Ollama JSON parse/validate (fixtures)
- Integration: paste → extract (mocked Ollama) → import
- Manual: device-code login + real chat when credentials available
- CI: mock Graph and Ollama; no network calls to Microsoft/Ollama

## Success criteria

1. User can set/see `learnedOn` on manual entries; existing data backfilled  
2. User can pick a chat day (Graph) or paste, extract with Ollama, review, and import  
3. Imported words get `learnedOn` = selected lesson day  
4. Graph failure does not block import (paste path works)  
5. Tokens and DB remain on the Docker volume  

## Later (non-blocking)

- Practice mode: filter by `learnedOn` date or “not older than X”  
- Multi-day select; optional lesson tags  
- Browser redirect OAuth as alternative to device code  
- Richer duplicate matching (transliteration / German similarity)  
- In-app UI to edit the Ollama prompt (v1 uses file on volume)
