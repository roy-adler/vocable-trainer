# Vocable Trainer — Agent Guide

## What this is

Personal **Hebrew ↔ German Wörterbuch** (vocabulary trainer). Users manage vocables with Hebrew script, German-lettered transliteration, German translation, optional example sentence + notes, and tags.

Spec: `docs/superpowers/specs/2026-08-01-hebrew-german-worterbuch-design.md`  
Plan: `docs/superpowers/plans/2026-08-01-hebrew-german-worterbuch-mvp.md`

## Stack

- Next.js App Router + TypeScript
- Prisma + SQLite
- Single Docker Compose service (`app` on port 3000)
- German UI labels; Hebrew fields use `dir="rtl"`

## How to run (Docker only)

```bash
docker compose up --build
```

Open `http://localhost:3000` (or the Tailscale hostname). Data persists in the `vocable-data` volume (`/data/vocable.db`).

Optional later: set `OLLAMA_BASE_URL` in the environment (unused in MVP).

If host port 3000 is busy: `$env:APP_PORT=3080; docker compose up --build`

Tests without local Node: `docker compose --profile test run --rm test`

## Project map

- `src/app/api/vocables` — list/search/create/update/delete
- `src/app/api/tags` — list/create tags
- `src/components` — client UI (list, tags, form)
- `src/lib/validation.ts` — shared input validation
- `prisma/schema.prisma` — Vocable, Tag, VocableTag
- `docker/entrypoint.sh` — `prisma db push` then start server

## Conventions

- Prefer small focused files; keep API routes thin and validation in `src/lib`
- Do not add auth inside the app (Tailscale / Authelia outside)
- Do not add practice modes, Teams import, or Ollama UI unless explicitly requested
- UI copy stays German
- CI must stay green: typecheck, tests, production build

## CI

GitHub Actions workflow `.github/workflows/ci.yml` runs install, Prisma generate, typecheck, Vitest, and `next build`.
