"use client";

import type { Vocable } from "@/lib/types";

type Props = {
  vocable: Vocable;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

export function VocableRow({
  vocable,
  expanded,
  onToggle,
  onEdit,
  onDelete,
}: Props) {
  return (
    <article className={`vocable-row ${expanded ? "expanded" : ""}`}>
      <button type="button" className="vocable-main" onClick={onToggle}>
        <div className="hebrew" dir="rtl" lang="he">
          {vocable.hebrew}
        </div>
        <div className="meta">
          <span>{vocable.transliteration}</span>
          <span className="dot">·</span>
          <span>{vocable.german}</span>
        </div>
        {vocable.tags.length > 0 && (
          <div className="row-tags">
            {vocable.tags.map((t) => (
              <span key={t.id} className="mini-tag">
                {t.name}
              </span>
            ))}
          </div>
        )}
      </button>

      {expanded && (
        <div className="vocable-details">
          {vocable.exampleSentence ? (
            <p>
              <strong>Beispiel:</strong>{" "}
              <span dir="auto">{vocable.exampleSentence}</span>
            </p>
          ) : (
            <p className="muted">Kein Beispielsatz.</p>
          )}
          {vocable.notes ? (
            <p>
              <strong>Notizen:</strong> {vocable.notes}
            </p>
          ) : (
            <p className="muted">Keine Notizen.</p>
          )}
          <div className="row-actions">
            <button type="button" className="btn secondary" onClick={onEdit}>
              Bearbeiten
            </button>
            <button type="button" className="text-btn danger" onClick={onDelete}>
              Löschen
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
