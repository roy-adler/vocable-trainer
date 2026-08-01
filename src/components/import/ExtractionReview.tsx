"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ErrorBanner } from "@/components/ErrorBanner";
import {
  FIELD_KEYS,
  type FieldChoice,
  type FieldChoices,
  type FieldKey,
} from "@/lib/extraction-merge";

type Existing = {
  id: string;
  hebrew: string;
  transliteration: string;
  german: string;
  exampleSentence: string;
  notes: string;
  learnedOn: string;
};

type Suggestion = {
  id: string;
  sortIndex: number;
  hebrew: string;
  transliteration: string;
  german: string;
  exampleSentence: string;
  notes: string;
  learnedOn: string;
  existingVocableId: string | null;
  existing: Existing | null;
  status: string;
  fieldChoices: FieldChoices;
};

type Job = {
  id: string;
  status: string;
  sourceLabel: string;
  error: string;
  suggestions: Suggestion[];
};

const LABELS: Record<FieldKey, string> = {
  hebrew: "Hebräisch",
  transliteration: "Umschreibung",
  german: "Deutsch",
  exampleSentence: "Beispiel",
  notes: "Notizen",
};

type Props = { jobId?: string };

export function ExtractionReview({ jobId }: Props) {
  const [jobs, setJobs] = useState<
    Array<{ id: string; status: string; sourceLabel: string; pendingCount: number }>
  >([]);
  const [job, setJob] = useState<Job | null>(null);
  const [mode, setMode] = useState<"list" | "detail">("list");
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadJobs = useCallback(async () => {
    const res = await fetch("/api/extraction-jobs");
    if (!res.ok) return;
    const data = await res.json();
    setJobs(data);
  }, []);

  const loadJob = useCallback(async (id: string) => {
    const res = await fetch(`/api/extraction-jobs/${id}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Laden fehlgeschlagen");
    setJob(data as Job);
  }, []);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    if (!jobId) return;
    void loadJob(jobId).catch((e) =>
      setError(e instanceof Error ? e.message : "Fehler"),
    );
  }, [jobId, loadJob]);

  useEffect(() => {
    if (!jobId) return;
    if (job?.status === "queued" || job?.status === "running") {
      const id = window.setInterval(() => {
        void loadJob(jobId).catch(() => undefined);
      }, 3000);
      return () => window.clearInterval(id);
    }
  }, [job?.status, jobId, loadJob]);

  const pendingSuggestions = useMemo(
    () => job?.suggestions.filter((s) => s.status === "pending") ?? [],
    [job],
  );

  const current = pendingSuggestions[index] ?? null;

  async function saveChoices(suggestion: Suggestion, choices: FieldChoices) {
    await fetch(
      `/api/extraction-jobs/${job!.id}/suggestions/${suggestion.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fieldChoices: choices }),
      },
    );
  }

  async function applyOrSkip(action: "apply" | "skip") {
    if (!job || !current) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/extraction-jobs/${job.id}/suggestions/${current.id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Aktion fehlgeschlagen");
      await loadJob(job.id);
      await loadJobs();
      setIndex((i) => Math.min(i, Math.max(0, pendingSuggestions.length - 2)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  }

  function setChoice(field: FieldKey, choice: FieldChoice) {
    if (!current || !job) return;
    const next = { ...current.fieldChoices, [field]: choice };
    setJob({
      ...job,
      suggestions: job.suggestions.map((s) =>
        s.id === current.id ? { ...s, fieldChoices: next } : s,
      ),
    });
    void saveChoices(current, next);
  }

  if (!jobId) {
    return (
      <div className="import-page">
        <header className="app-header">
          <h1>Extraktionen</h1>
          <a className="btn secondary" href="/">
            ← Wörterbuch
          </a>
        </header>
        <section className="import-card">
          {jobs.length === 0 && (
            <p className="muted">Keine offenen Extraktionen.</p>
          )}
          <ul className="import-list">
            {jobs.map((j) => (
              <li key={j.id}>
                <a className="list-btn" href={`/import/review/${j.id}`}>
                  <strong>{j.sourceLabel}</strong>
                  <span className="muted">
                    {j.status}
                    {j.pendingCount > 0 ? ` · ${j.pendingCount} offen` : ""}
                  </span>
                </a>
              </li>
            ))}
          </ul>
          <a className="btn secondary" href="/import">
            Neue Extraktion
          </a>
        </section>
      </div>
    );
  }

  return (
    <div className="import-page">
      <header className="app-header">
        <h1>Prüfung</h1>
        <div className="header-actions">
          <a className="btn secondary" href="/import/review">
            Alle Jobs
          </a>
          <a className="btn secondary" href="/">
            Wörterbuch
          </a>
        </div>
      </header>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {job && (job.status === "queued" || job.status === "running") && (
        <section className="import-card">
          <p>Extraktion läuft im Hintergrund… ({job.sourceLabel})</p>
          <p className="muted">Du kannst das Fenster schließen; der Fortschritt bleibt erhalten.</p>
        </section>
      )}

      {job?.status === "failed" && (
        <section className="import-card">
          <p className="field-error">{job.error || "Extraktion fehlgeschlagen."}</p>
          <button
            type="button"
            className="btn primary"
            onClick={async () => {
              await fetch(`/api/extraction-jobs/${job.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "retry" }),
              });
              await loadJob(job.id);
            }}
          >
            Erneut versuchen
          </button>
        </section>
      )}

      {job && (job.status === "ready" || job.status === "done") && mode === "list" && (
        <section className="import-card">
          <h2>
            {job.sourceLabel} · {job.suggestions.length} Vorschläge
          </h2>
          <p className="muted">
            Offen: {pendingSuggestions.length} · Gesamtliste unten; Klick öffnet
            Detail (mit Zähler).
          </p>
          <ul className="import-list">
            {job.suggestions.map((s, i) => (
              <li key={s.id}>
                <button
                  type="button"
                  className="list-btn"
                  onClick={() => {
                    const pendingIndex = pendingSuggestions.findIndex(
                      (p) => p.id === s.id,
                    );
                    setIndex(pendingIndex >= 0 ? pendingIndex : 0);
                    setMode("detail");
                  }}
                >
                  <strong dir="rtl">{s.hebrew}</strong>
                  <span className="muted">
                    {i + 1}/{job.suggestions.length} · {s.german} · {s.status}
                    {s.existingVocableId ? " · Duplikat" : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {pendingSuggestions.length > 0 && (
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                setIndex(0);
                setMode("detail");
              }}
            >
              Offene prüfen (1 von {pendingSuggestions.length})
            </button>
          )}
          {pendingSuggestions.length === 0 && (
            <p className="muted">Alle Vorschläge bearbeitet.</p>
          )}
        </section>
      )}

      {job && mode === "detail" && current && (
        <section className="import-card">
          <div className="review-progress">
            <strong>
              Offener Vorschlag {index + 1} von {pendingSuggestions.length}
            </strong>
            <span className="muted">
              (Gesamt {current.sortIndex + 1}/{job.suggestions.length})
            </span>
          </div>

          {current.existing ? (
            <div className="compare-grid">
              {FIELD_KEYS.map((field) => (
                <div key={field} className="compare-row">
                  <div className="compare-label">{LABELS[field]}</div>
                  <label className="compare-opt">
                    <input
                      type="radio"
                      name={`f-${field}`}
                      checked={current.fieldChoices[field] === "existing"}
                      onChange={() => setChoice(field, "existing")}
                    />
                    <span dir={field === "hebrew" ? "rtl" : undefined}>
                      {current.existing![field] || "—"}
                    </span>
                    <em>Bestehend</em>
                  </label>
                  <label className="compare-opt">
                    <input
                      type="radio"
                      name={`f-${field}`}
                      checked={current.fieldChoices[field] !== "existing"}
                      onChange={() => setChoice(field, "suggestion")}
                    />
                    <span dir={field === "hebrew" ? "rtl" : undefined}>
                      {current[field] || "—"}
                    </span>
                    <em>Vorschlag</em>
                  </label>
                </div>
              ))}
            </div>
          ) : (
            <div className="review-row">
              {FIELD_KEYS.map((field) => (
                <p key={field}>
                  <strong>{LABELS[field]}:</strong>{" "}
                  <span dir={field === "hebrew" ? "rtl" : undefined}>
                    {current[field] || "—"}
                  </span>
                </p>
              ))}
            </div>
          )}

          <div className="import-actions">
            <button
              type="button"
              className="btn secondary"
              disabled={index === 0}
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
            >
              Zurück
            </button>
            <button
              type="button"
              className="btn secondary"
              disabled={index >= pendingSuggestions.length - 1}
              onClick={() =>
                setIndex((i) =>
                  Math.min(pendingSuggestions.length - 1, i + 1),
                )
              }
            >
              Weiter
            </button>
            <button
              type="button"
              className="btn secondary"
              disabled={busy}
              onClick={() => void applyOrSkip("skip")}
            >
              Überspringen
            </button>
            <button
              type="button"
              className="btn primary"
              disabled={busy}
              onClick={() => void applyOrSkip("apply")}
            >
              Übernehmen
            </button>
            <button
              type="button"
              className="text-btn"
              onClick={() => setMode("list")}
            >
              Zur Liste
            </button>
          </div>
        </section>
      )}

      {job && mode === "detail" && !current && (
        <section className="import-card">
          <p>Keine offenen Vorschläge mehr.</p>
          <button type="button" className="btn primary" onClick={() => setMode("list")}>
            Zur Übersicht
          </button>
        </section>
      )}
    </div>
  );
}
