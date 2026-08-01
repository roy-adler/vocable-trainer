# Example sentence generation (Ollama) — Design

**Date:** 2026-08-01  
**Status:** Approved for implementation  
**Depends on:** Ollama model selection (`/data/settings.json` `ollamaModel`)

## Goal

On the create/edit vocable form, offer a button that asks Ollama for one example: a **Hebrew sentence** using the word, plus a **German translation** of that sentence. The result fills the empty **Beispielsatz** field; the user still saves the vocable explicitly.

## Decisions locked

- Output: Hebrew sentence + German translation of it (plain text in the field)
- Button only fills when Beispielsatz is **empty**; never auto-overwrites existing text
- Available on **create and edit** (`VocableForm`)
- Editable prompt on volume: `/data/prompts/example-sentence.md` (seeded from bundled default)
- Sync API (no background job)
- Model: current server default via `resolveOllamaModel()` (no per-form picker)
- No DB write from the generate endpoint — only returns text for the form

## Scope

### In

- Bundled `prompts/example-sentence.md` with placeholders `{{hebrew}}`, `{{transliteration}}`, `{{german}}`
- Ensure/copy to `/data/prompts/example-sentence.md` on first use
- Lib helper to render prompt + call Ollama chat + return trimmed text
- `POST /api/vocables/example-sentence` → `{ exampleSentence: string }`
- UI button **Beispielsatz erzeugen** on `VocableForm`
- German errors; tests for prompt render + generate + API validation
- Brief AGENTS.md note

### Out

- Overwrite / confirm when field non-empty
- Background jobs / review queue
- Model picker on the form
- Generating notes or other fields
- Streaming response

## Prompt file

Path: `{DATA_DIR}/prompts/example-sentence.md`  
Bundled default: `prompts/example-sentence.md`

Default instructions (German to the model): produce one natural Hebrew example sentence that uses the given word, then a German translation of that sentence; plain text only (Hebrew line, then German line); no markdown, no JSON, no extra commentary.

Placeholders replaced literally: `{{hebrew}}`, `{{transliteration}}`, `{{german}}`.

## Architecture

```
VocableForm button
  → POST /api/vocables/example-sentence { hebrew, transliteration, german }
  → ensure prompt file → render template → Ollama /api/chat (settings model)
  → { exampleSentence }
  → set textarea state (user Speichern separately)
```

Reuse existing Ollama request helpers / timeout behaviour where practical; keep extract-specific JSON schema out of this call (plain text response).

## API

`POST /api/vocables/example-sentence`

Request body:

```json
{
  "hebrew": "שלום",
  "transliteration": "shalom",
  "german": "Hallo"
}
```

All three required (non-empty after trim).

Responses:

| Status | Body |
|--------|------|
| 200 | `{ "exampleSentence": "…" }` |
| 400 | missing/invalid fields |
| 422 | empty / unusable model output |
| 502/503 | Ollama / config failures (German messages) |

## UI

- Button label: **Beispielsatz erzeugen** (busy: **Erzeugen…**)
- Enabled when hebrew, transliteration, german are non-empty **and** Beispielsatz is empty; disabled while busy or when field non-empty
- Errors shown near the Beispielsatz field
- Success replaces empty textarea content only

## Testing

- Prompt ensure + placeholder substitution
- Generate helper: mocked fetch includes resolved model; returns content string
- API: 400 when a required field is missing

## Docs

- AGENTS.md: prompt path + endpoint; note editable on volume like extract prompt
