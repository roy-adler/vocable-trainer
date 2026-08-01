"use client";

import { FormEvent, useMemo, useState } from "react";
import type { Tag, Vocable } from "@/lib/types";

export type VocableFormValues = {
  hebrew: string;
  transliteration: string;
  german: string;
  exampleSentence: string;
  notes: string;
  learnedOn: string;
  tagIds: string[];
  newTags: string[];
};

type Props = {
  initial?: Vocable | null;
  tags: Tag[];
  onClose: () => void;
  onSubmit: (values: VocableFormValues) => Promise<void>;
};

export function VocableForm({ initial, tags, onClose, onSubmit }: Props) {
  const [hebrew, setHebrew] = useState(initial?.hebrew ?? "");
  const [transliteration, setTransliteration] = useState(
    initial?.transliteration ?? "",
  );
  const [german, setGerman] = useState(initial?.german ?? "");
  const [exampleSentence, setExampleSentence] = useState(
    initial?.exampleSentence ?? "",
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [learnedOn, setLearnedOn] = useState(
    initial?.learnedOn?.slice(0, 10) ??
      new Date().toISOString().slice(0, 10),
  );
  const [tagIds, setTagIds] = useState<string[]>(
    initial?.tags.map((t) => t.id) ?? [],
  );
  const [newTagInput, setNewTagInput] = useState("");
  const [newTags, setNewTags] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const title = initial ? "Eintrag bearbeiten" : "Neuer Eintrag";

  const allNewTagLabels = useMemo(() => newTags, [newTags]);

  function toggleTag(id: string) {
    setTagIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );
  }

  function addNewTag() {
    const name = newTagInput.trim();
    if (!name) return;
    if (
      tags.some((t) => t.name.toLowerCase() === name.toLowerCase()) ||
      newTags.some((t) => t.toLowerCase() === name.toLowerCase())
    ) {
      const existing = tags.find(
        (t) => t.name.toLowerCase() === name.toLowerCase(),
      );
      if (existing && !tagIds.includes(existing.id)) {
        setTagIds((prev) => [...prev, existing.id]);
      }
      setNewTagInput("");
      return;
    }
    setNewTags((prev) => [...prev, name]);
    setNewTagInput("");
  }

  async function generateExample() {
    if (exampleSentence.trim()) return;
    setGenerateError(null);
    setGenerating(true);
    try {
      const res = await fetch("/api/vocables/example-sentence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hebrew: hebrew.trim(),
          transliteration: transliteration.trim(),
          german: german.trim(),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          (data && typeof data.error === "string" && data.error) ||
            "Beispielsatz konnte nicht erzeugt werden.",
        );
      }
      if (
        !data ||
        typeof data.exampleSentence !== "string" ||
        !data.exampleSentence.trim()
      ) {
        throw new Error("Keine Antwort vom Modell.");
      }
      setExampleSentence((current) =>
        current.trim() ? current : data.exampleSentence.trim(),
      );
    } catch (e) {
      setGenerateError(
        e instanceof Error ? e.message : "Erzeugen fehlgeschlagen.",
      );
    } finally {
      setGenerating(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!hebrew.trim()) nextErrors.hebrew = "Hebräisch ist erforderlich.";
    if (!transliteration.trim())
      nextErrors.transliteration = "Umschreibung ist erforderlich.";
    if (!german.trim()) nextErrors.german = "Deutsche Übersetzung ist erforderlich.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    try {
      await onSubmit({
        hebrew: hebrew.trim(),
        transliteration: transliteration.trim(),
        german: german.trim(),
        exampleSentence: exampleSentence.trim(),
        notes: notes.trim(),
        learnedOn,
        tagIds,
        newTags,
      });
      onClose();
    } catch {
      setErrors({ form: "Speichern fehlgeschlagen." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vocable-form-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="vocable-form-title">{title}</h2>
          <button type="button" className="text-btn" onClick={onClose}>
            Schließen
          </button>
        </div>

        <form className="vocable-form" onSubmit={handleSubmit}>
          {errors.form && <p className="field-error">{errors.form}</p>}

          <label>
            Hebräisch
            <input
              dir="rtl"
              lang="he"
              value={hebrew}
              onChange={(e) => setHebrew(e.target.value)}
              required
            />
            {errors.hebrew && <span className="field-error">{errors.hebrew}</span>}
          </label>

          <label>
            Umschreibung (deutsch geschrieben)
            <input
              value={transliteration}
              onChange={(e) => setTransliteration(e.target.value)}
              required
            />
            {errors.transliteration && (
              <span className="field-error">{errors.transliteration}</span>
            )}
          </label>

          <label>
            Deutsche Übersetzung
            <input
              value={german}
              onChange={(e) => setGerman(e.target.value)}
              required
            />
            {errors.german && <span className="field-error">{errors.german}</span>}
          </label>

          <div className="field-with-action">
            <label>
              Beispielsatz
              <textarea
                dir="auto"
                rows={2}
                value={exampleSentence}
                onChange={(e) => setExampleSentence(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="btn secondary"
              disabled={
                generating ||
                !!exampleSentence.trim() ||
                !hebrew.trim() ||
                !transliteration.trim() ||
                !german.trim()
              }
              onClick={() => void generateExample()}
            >
              {generating ? "Erzeugen…" : "Beispielsatz erzeugen"}
            </button>
            {generateError && <p className="field-error">{generateError}</p>}
          </div>

          <label>
            Notizen
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>

          <label>
            Gelernt am
            <input
              type="date"
              value={learnedOn}
              onChange={(e) => setLearnedOn(e.target.value)}
              required
            />
            {errors.learnedOn && (
              <span className="field-error">{errors.learnedOn}</span>
            )}
          </label>

          <fieldset>
            <legend>Tags</legend>
            <div className="tag-picker">
              {tags.map((tag) => (
                <label key={tag.id} className="check-tag">
                  <input
                    type="checkbox"
                    checked={tagIds.includes(tag.id)}
                    onChange={() => toggleTag(tag.id)}
                  />
                  {tag.name}
                </label>
              ))}
              {allNewTagLabels.map((name) => (
                <span key={name} className="mini-tag">
                  neu: {name}
                </span>
              ))}
            </div>
            <div className="new-tag-row">
              <input
                placeholder="Neuen Tag hinzufügen"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addNewTag();
                  }
                }}
              />
              <button type="button" className="btn secondary" onClick={addNewTag}>
                Hinzufügen
              </button>
            </div>
          </fieldset>

          <div className="modal-actions">
            <button type="button" className="btn secondary" onClick={onClose}>
              Abbrechen
            </button>
            <button type="submit" className="btn primary" disabled={saving}>
              {saving ? "Speichern…" : "Speichern"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
