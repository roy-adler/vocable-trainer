# Vocable Trainer (Wörterbuch Hebräisch–Deutsch)

Persönliches Vokabel-Wörterbuch: Hebräisch, Umschreibung, deutsche Übersetzung, Tags, Beispielsatz und Notizen.

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

Daten liegen im Docker-Volume `vocable-data` (`/data/vocable.db`).

Tests (ohne lokales Node):

```bash
docker compose --profile test run --rm test
```

## Funktionen (MVP)

- Liste scrollen, suchen, nach Tag filtern
- Einträge anlegen / bearbeiten / löschen
- Mehr Infos aufklappen (Beispiel + Notizen)
- Handy: Tag-Chips · Desktop: Tag-Sidebar

## Entwicklungshinweise

Siehe [AGENTS.md](./AGENTS.md) und das Design unter `docs/superpowers/specs/`.
