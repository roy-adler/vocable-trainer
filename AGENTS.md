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
- Extraction runs as a **background job** (`ExtractionJob`); header badge notifies when ready. Review at `/import/review`.
- Default Ollama model in `/data/settings.json` (`ollamaModel`); `OLLAMA_MODEL` only seeds when the file or key is missing. The import UI writes the chosen model to that file on the volume.
- `GET /api/ollama/models`, `GET|PUT /api/settings`
- Env: `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `MICROSOFT_CLIENT_ID`, `MICROSOFT_TENANT` (default `common`), `MICROSOFT_SCOPES` (default `User.Read Chat.Read offline_access`), `TZ` (default Europe/Berlin), `DATA_DIR=/data`
- Put these in the gitignored `.env` next to `docker-compose.yml`. Values exported with `$env:` in one PowerShell session are lost as soon as the container is recreated from another shell.
- `.env` is loaded into the container via `env_file`, so never put `DATABASE_URL` or `DATA_DIR` there — host paths like `file:./dev.db` would silently move the app off the `/data` volume onto an empty throwaway database. `docker-compose.yml` pins both after `env_file` for exactly that reason.
- Azure app: public client, device code, scopes `User.Read Chat.Read offline_access`
- **Graph cannot read Teams chats with a personal Microsoft account** — `List chats` and `List chat messages` are documented as "Delegated (personal Microsoft account): Not supported". No app-registration setting changes this. The owner of this project has a personal account, so **paste is the real import path**; the Microsoft button is gated behind a checkbox on `/import`.
- `MICROSOFT_TENANT` must match the account used at the login page (`consumers` = personal, device page `www.microsoft.com/link`; `organizations` = work/school, device page `login.microsoft.com/device`; `common` = Entra page, which a personal account cannot complete — it authenticates and then reports the code as expired).
- Device-code polling must honour `slow_down` (RFC 8628) and stay above the returned `interval`; polling too fast makes Microsoft terminate the flow, which also surfaces as "code expired".
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

GitHub Actions workflow `.github/workflows/ci.yml` runs install, Prisma generate, typecheck, and Vitest, then builds the Docker image once (that image build is the production compile).

On success it also:
- uploads a downloadable artifact `vocable-trainer-docker-image` (gzipped `docker save` tarball, 14 days)
- on push to `main`/`master`, pushes `ghcr.io/<owner>/vocable-trainer:latest` (and `:sha`)

Load a downloaded artifact:

```bash
gunzip -c vocable-trainer-image.tar.gz | docker load
docker tag vocable-trainer:ci vocable-trainer-app
docker compose up -d
```
