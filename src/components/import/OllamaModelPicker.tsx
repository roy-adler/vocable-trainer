"use client";

import { useEffect, useState } from "react";

type Props = {
  value: string;
  onChange: (model: string) => void;
  disabled?: boolean;
  onAvailabilityChange?: (ok: boolean) => void;
};

export function OllamaModelPicker({
  value,
  onChange,
  disabled,
  onAvailabilityChange,
}: Props) {
  const [models, setModels] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadModels(isCancelled: () => boolean = () => false) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ollama/models");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Modelle fehlen");
      if (isCancelled()) return;

      const list: string[] = Array.isArray(data.models) ? data.models : [];
      const defaultModel =
        typeof data.defaultModel === "string" ? data.defaultModel : "";
      setModels(list);
      if (!value && defaultModel) onChange(defaultModel);

      const available = list.length > 0;
      if (!available) setError("Keine Modelle auf Ollama gefunden.");
      onAvailabilityChange?.(available);
    } catch (cause) {
      if (isCancelled()) return;
      setError(cause instanceof Error ? cause.message : "Modelle fehlen");
      onAvailabilityChange?.(false);
    } finally {
      if (!isCancelled()) setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    void loadModels(() => cancelled);
    return () => {
      cancelled = true;
    };
    // Load once when the picker mounts (per Import step that includes it).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const options =
    value && !models.includes(value) ? [...models, value] : models;
  const missingOnServer = Boolean(
    value && models.length > 0 && !models.includes(value),
  );

  async function handleChange(next: string) {
    onChange(next);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ollamaModel: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Speichern fehlgeschlagen");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Speichern fehlgeschlagen");
    }
  }

  return (
    <div className="ollama-model-picker">
      <label>
        Ollama-Modell
        <select
          value={value}
          disabled={disabled || loading || options.length === 0}
          onChange={(event) => void handleChange(event.target.value)}
        >
          {options.length === 0 && <option value="">—</option>}
          {options.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </select>
      </label>
      {loading && <p className="muted">Modelle werden geladen…</p>}
      {error && <p className="muted">{error}</p>}
      <button
        type="button"
        className="btn secondary"
        disabled={disabled || loading}
        onClick={() => void loadModels()}
      >
        Erneut laden
      </button>
      {missingOnServer && (
        <p className="muted">
          Gespeichertes Modell ist auf Ollama nicht installiert.
        </p>
      )}
    </div>
  );
}
