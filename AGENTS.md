# Vocable Trainer — Agent Guide

## What this is

Personal **Hebrew ↔ German Wörterbuch** (vocabulary trainer). Users manage vocables with Hebrew script, German-lettered transliteration, German translation, optional example sentence + notes, tags, and `learnedOn` (lesson/learning date).

Specs:
- `docs/superpowers/specs/2026-08-01-hebrew-german-worterbuch-design.md`
- `docs/superpowers/specs/2026-08-01-teams-meeting-chat-import-design.md`

## Stack

- Next.js App Router + TypeScript
- Prisma + SQLite
- Single Docker Compose service (`app` on port 3000)
- German UI labels; Hebrew fields use `dir="rtl"`
- Optional: Ollama (`OLLAMA_BASE_URL`) + Microsoft Graph device-code (`MICROSOFT_CLIENT_ID`)

## How to run (Docker only)

```bash
docker compose up --build
```

Open `http://localhost:3000` (or the Tailscale hostname). Data persists in the `vocable-data` volume (`/data/vocable.db`).

If host port 3000 is busy: `$env:APP_PORT=3080; docker compose up --build`

Tests without local Node: `docker compose --profile test run --rm test`

### Import / Ollama / Microsoft

- UI: `/import`
- Editable extract prompt: `/data/prompts/extract-vocables.md` (default copied from `prompts/extract-vocables.md` on first start). Edit on the volume; placeholder `{{messages}}`.
- Env: `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `MICROSOFT_CLIENT_ID`, `TZ` (default Europe/Berlin), `DATA_DIR=/data`
- Azure app: personal Microsoft account, public client, device code, scopes `User.Read Chat.Read offline_access`
- Paste fallback works without Microsoft

## Project map

- `src/app/api/vocables` — list/search/create/update/delete
- `src/app/api/tags` — list/create tags
- `src/app/api/import` — extract (Ollama) + commit
- `src/app/api/microsoft` — device-code auth, chats, day messages
- `src/app/import` — import wizard
- `src/lib/dates.ts`, `prompt.ts`, `ollama.ts`, `microsoft/*`
- `prisma/schema.prisma` — Vocable (+ `learnedOn`), Tag, VocableTag
- `docker/entrypoint.sh` — `prisma db push`, ensure prompt + learnedOn backfill, start server

## Conventions

- Do not smoke-test the API with Windows PowerShell `Invoke-RestMethod`: it encodes request bodies as ISO-8859-1, so Hebrew becomes `?` and umlauts become mojibake in the database. Post test data from inside the container (`docker compose exec app node <script>`) or with `curl.exe --data-binary "@file.json"`.
- Prefer small focused files; keep API routes thin and validation in `src/lib`
- Do not add auth inside the app (Tailscale / Authelia outside)
- Do not add practice modes unless explicitly requested
- UI copy stays German
- CI must stay green: typecheck, tests, production build

## CI

GitHub Actions workflow `.github/workflows/ci.yml` runs install, Prisma generate, typecheck, Vitest, and `next build`.
