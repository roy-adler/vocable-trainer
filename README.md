# Vocable Trainer (Wörterbuch Hebräisch–Deutsch)

Persönliches Vokabel-Wörterbuch: Hebräisch, Umschreibung, deutsche Übersetzung, Tags, Beispielsatz, Notizen und Lern-/Lektionsdatum (`learnedOn`).

## Starten (Docker)

```bash
docker compose up --build
```

App: [http://localhost:3000](http://localhost:3000)

Falls Port 3000 belegt ist:

```bash
# PowerShell
$env:APP_PORT=3080; docker compose up --build
```

Daten: Volume `vocable-data` (`/data/vocable.db`, Tokens, editierbarer Prompt).

Tests:

```bash
docker compose --profile test run --rm test
```

## Funktionen

- Liste, Suche, Tags, CRUD, erweiterte Infos
- **Gelernt am** an jedem Eintrag
- **Import** (`/import`): Teams/Graph (Device-Code) oder Text einfügen → Tag wählen → Ollama → prüfen → übernehmen

### Umgebungsvariablen

Werte in die `.env` neben der `docker-compose.yml` eintragen (gitignored), dann `docker compose up -d`. Siehe `.env.example`: `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `MICROSOFT_CLIENT_ID`, `MICROSOFT_TENANT`.

`MICROSOFT_TENANT` muss zum Konto passen, mit dem du dich anmeldest: `consumers` (privates Konto), `organizations` (Arbeits-/Schulkonto) oder eine Tenant-GUID. Passt es nicht, meldet die Anmeldeseite den Code als abgelaufen.

> **Teams-Import nur mit Arbeits-/Schulkonto.** Microsoft Graph gibt Teams-Chats für private Microsoft-Konten nicht frei ([List chats](https://learn.microsoft.com/en-us/graph/api/chat-list?view=graph-rest-1.0): „Delegated (personal Microsoft account): Not supported“). Mit privatem Konto ist **„Text einfügen“** der Weg — Extraktion, Hintergrund-Job und Review sind identisch.

### Prompt bearbeiten

Datei im Volume: `/data/prompts/extract-vocables.md` (Platzhalter `{{messages}}`). Ohne Image-Rebuild änderbar.

## Docs

- [AGENTS.md](./AGENTS.md)
- Specs unter `docs/superpowers/specs/`

## CI artifacts

Successful GitHub Actions runs attach **vocable-trainer-docker-image** (download from the run’s Artifacts). On `main`, the image is also pushed to GHCR as `ghcr.io/roy-adler/vocable-trainer:latest`.
