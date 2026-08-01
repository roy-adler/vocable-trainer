# Hebrew–German Wörterbuch MVP — Implementation Plan

> **For agentic workers:** Execute task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Dockerized Next.js Hebrew–German vocabulary app with CRUD, search, tags, expandable details, AGENTS.md, and GitHub Actions CI.

**Architecture:** Single Next.js App Router process serves UI + Route Handlers; Prisma + SQLite on a Docker volume; responsive list (chips on mobile, tag sidebar on desktop).

**Tech Stack:** Next.js 15, TypeScript, Prisma, SQLite, Docker Compose, GitHub Actions, Vitest (API smoke tests).

## Global Constraints

- German UI labels; Hebrew fields `dir="rtl"`
- No auth in app; no practice/Teams/Ollama UI in MVP
- One compose service; `DATABASE_URL=file:/data/vocable.db` in Docker
- Spec: `docs/superpowers/specs/2026-08-01-hebrew-german-worterbuch-design.md`

---

## File structure

- `package.json`, `tsconfig.json`, `next.config.ts`, `Dockerfile`, `docker-compose.yml`, `.dockerignore`
- `prisma/schema.prisma`, `src/lib/prisma.ts`, `src/lib/types.ts`
- `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`
- `src/app/api/vocables/route.ts`, `src/app/api/vocables/[id]/route.ts`
- `src/app/api/tags/route.ts`
- `src/components/*` — VocableList, VocableRow, TagNav, SearchBar, VocableForm, ErrorBanner
- `AGENTS.md`, `.github/workflows/ci.yml`, `README.md`
- `src/lib/vocables.test.ts` — pure helpers / validation tests where cheap

---

### Task 1: Project scaffold + Prisma schema + Docker + CI + AGENTS.md

**Files:** create all scaffolding files listed above (empty/stub UI ok)

- [ ] Init Next.js (App Router, TS, no src-optional → use `src/`), add Prisma + SQLite
- [ ] Schema: Vocable, Tag, VocableTag as in spec
- [ ] Dockerfile multi-stage + compose + volume
- [ ] `AGENTS.md` with stack, conventions, out-of-scope
- [ ] CI: install, prisma generate, lint/typecheck, test, build (use temp SQLite)
- [ ] README: how to run locally and with compose

### Task 2: API routes

**Files:** `src/app/api/vocables/*`, `src/app/api/tags/route.ts`, `src/lib/prisma.ts`

- [ ] Implement GET/POST vocables, GET/PATCH/DELETE by id, GET/POST tags
- [ ] Search `q` + filter `tag` as spec
- [ ] Validate required fields; return 400 on bad input

### Task 3: UI

**Files:** components + `page.tsx` + `globals.css`

- [ ] Responsive hybrid layout (A phone / C desktop)
- [ ] Debounced search, tag filter, expand row, add/edit form, delete confirm
- [ ] Error banner + empty states in German

### Task 4: Verify

- [ ] `npm test` / `npm run build` pass
- [ ] Manual sanity if server available

---

## Execution note

User requested immediate implementation — execute inline in this session (skip execution-choice prompt).
