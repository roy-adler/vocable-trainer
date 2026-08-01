"use client";

import { useCallback, useEffect, useState } from "react";
import type { Tag, Vocable } from "@/lib/types";
import { ErrorBanner } from "./ErrorBanner";
import { JobBadge } from "./JobBadge";
import { SearchBar } from "./SearchBar";
import { TagNav } from "./TagNav";
import { VocableForm, type VocableFormValues } from "./VocableForm";
import { VocableRow } from "./VocableRow";

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

export function VocableApp() {
  const [vocables, setVocables] = useState<Vocable[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounced(query, 250);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Vocable | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadTags = useCallback(async () => {
    const res = await fetch("/api/tags");
    if (!res.ok) throw new Error("tags");
    const data = (await res.json()) as Tag[];
    setTags(data);
  }, []);

  const loadVocables = useCallback(async () => {
    const params = new URLSearchParams();
    if (debouncedQuery.trim()) params.set("q", debouncedQuery.trim());
    if (selectedTagId) params.set("tag", selectedTagId);
    const res = await fetch(`/api/vocables?${params.toString()}`);
    if (!res.ok) throw new Error("vocables");
    const data = (await res.json()) as Vocable[];
    setVocables(data);
  }, [debouncedQuery, selectedTagId]);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      await Promise.all([loadTags(), loadVocables()]);
    } catch {
      setError("Daten konnten nicht geladen werden. Bitte erneut versuchen.");
    } finally {
      setLoading(false);
    }
  }, [loadTags, loadVocables]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleCreateTag(name: string) {
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error("create-tag");
      await loadTags();
    } catch {
      setError("Tag konnte nicht angelegt werden.");
    }
  }

  async function handleSave(values: VocableFormValues) {
    const url = editing ? `/api/vocables/${editing.id}` : "/api/vocables";
    const method = editing ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      throw new Error("save");
    }
    setEditing(null);
    await refresh();
  }

  async function handleDelete(vocable: Vocable) {
    const ok = window.confirm(`Eintrag löschen?\n${vocable.hebrew} — ${vocable.german}`);
    if (!ok) return;
    try {
      const res = await fetch(`/api/vocables/${vocable.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete");
      if (expandedId === vocable.id) setExpandedId(null);
      await refresh();
    } catch {
      setError("Eintrag konnte nicht gelöscht werden.");
    }
  }

  return (
    <div className="app-shell">
      <TagNav
        tags={tags}
        selectedTagId={selectedTagId}
        onSelect={setSelectedTagId}
        onCreateTag={handleCreateTag}
        variant="sidebar"
      />

      <div className="main-pane">
        <header className="app-header">
          <h1>Wörterbuch</h1>
          <div className="header-actions">
            <JobBadge />
            <a className="btn secondary" href="/import">
              Import
            </a>
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              + Hinzufügen
            </button>
          </div>
        </header>

        <ErrorBanner message={error} onDismiss={() => setError(null)} />

        <div className="toolbar">
          <SearchBar value={query} onChange={setQuery} />
        </div>

        <div className="mobile-only">
          <TagNav
            tags={tags}
            selectedTagId={selectedTagId}
            onSelect={setSelectedTagId}
            onCreateTag={handleCreateTag}
            variant="chips"
          />
        </div>

        <section className="vocable-list" aria-live="polite">
          {loading && <p className="empty">Laden…</p>}
          {!loading && vocables.length === 0 && (
            <p className="empty">
              {debouncedQuery || selectedTagId
                ? "Keine Einträge gefunden."
                : "Noch keine Vokabeln. Füge den ersten Eintrag hinzu."}
            </p>
          )}
          {vocables.map((vocable) => (
            <VocableRow
              key={vocable.id}
              vocable={vocable}
              expanded={expandedId === vocable.id}
              onToggle={() =>
                setExpandedId((id) => (id === vocable.id ? null : vocable.id))
              }
              onEdit={() => {
                setEditing(vocable);
                setFormOpen(true);
              }}
              onDelete={() => void handleDelete(vocable)}
            />
          ))}
        </section>
      </div>

      {formOpen && (
        <VocableForm
          initial={editing}
          tags={tags}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          onSubmit={handleSave}
        />
      )}
    </div>
  );
}
