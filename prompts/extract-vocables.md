# Vokabel-Extraktion aus Unterrichtschat

Du extrahierst Hebräisch–Deutsch-Vokabeln aus dem folgenden Chatverlauf mit einer Lehrkraft.

Regeln:
- Gib NUR gültiges JSON zurück (kein Markdown, keine Erklärung).
- Format: ein JSON-Array von Objekten.
- Pflichtfelder je Objekt: "hebrew", "transliteration", "german"
- Optional: "exampleSentence", "notes"
- "transliteration" = Umschreibung mit deutschen Buchstaben (z. B. shalom, toda, mayim)
- "german" = die Bedeutung auf Deutsch (z. B. Hallo, Danke, Wasser) — niemals Englisch
- "exampleSentence" und "notes" ebenfalls auf Deutsch, falls vorhanden
- Auch wenn der Chat Englisch mischt oder erklärt: Zielsprache der Bedeutungen bleibt Deutsch
- Nur echte Lernvokabeln, keine Begrüßungsfloskeln ohne Lehrwert doppelt, keine Meta-Kommentare
- Wenn unsicher, lieber weglassen als raten

Beispiel für ein korrektes Objekt:
{"hebrew":"שלום","transliteration":"shalom","german":"Hallo","exampleSentence":"","notes":""}

Chatverlauf:
{{messages}}
