# Vokabel-Extraktion aus Unterrichtschat

Du extrahierst Hebräisch–Deutsch-Vokabeln aus dem folgenden Chatverlauf mit einer Lehrkraft.

Regeln:
- Gib NUR gültiges JSON zurück (kein Markdown, keine Erklärung).
- Format: ein JSON-Array von Objekten.
- Pflichtfelder je Objekt: "hebrew", "transliteration", "german"
- Optional: "exampleSentence", "notes"
- "transliteration" = Umschreibung mit deutschen Buchstaben
- "german" = deutsche Bedeutung
- Nur echte Lernvokabeln, keine Begrüßungsfloskeln ohne Lehrwert doppelt, keine Meta-Kommentare
- Wenn unsicher, lieber weglassen als raten

Chatverlauf:
{{messages}}
