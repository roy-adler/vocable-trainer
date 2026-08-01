"use client";

import { useCallback, useEffect, useState } from "react";
import { ErrorBanner } from "@/components/ErrorBanner";
import { JobBadge } from "@/components/JobBadge";

type Chat = {
  id: string;
  topic: string | null;
  chatType: string;
  lastMessagePreview?: string;
};

type DaySummary = { dateKey: string; count: number };

type Step = "source" | "chats" | "days" | "paste" | "queued";

export function ImportWizard() {
  const [step, setStep] = useState<Step>("source");
  const [error, setError] = useState<string | null>(null);
  const [msConfigured, setMsConfigured] = useState(false);
  const [msConnected, setMsConnected] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<{
    deviceCode: string;
    userCode: string;
    verificationUri: string;
    message: string;
    interval: number;
  } | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [days, setDays] = useState<DaySummary[]>([]);
  const [learnedOn, setLearnedOn] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [pasteText, setPasteText] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refreshMsStatus = useCallback(async () => {
    const res = await fetch("/api/microsoft/auth");
    const data = (await res.json()) as {
      configured: boolean;
      connected: boolean;
    };
    setMsConfigured(data.configured);
    setMsConnected(data.connected);
  }, []);

  useEffect(() => {
    void refreshMsStatus();
  }, [refreshMsStatus]);

  async function startDeviceLogin() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/microsoft/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Start fehlgeschlagen");
      setDeviceInfo({
        deviceCode: data.deviceCode,
        userCode: data.userCode,
        verificationUri: data.verificationUri,
        message: data.message,
        interval: data.interval || 5,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Anmeldung fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!deviceInfo) return;
    let cancelled = false;
    const intervalMs = Math.max(3, deviceInfo.interval) * 1000;
    const id = window.setInterval(async () => {
      try {
        const res = await fetch("/api/microsoft/auth/poll", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceCode: deviceInfo.deviceCode }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (data.status === "ok") {
          setDeviceInfo(null);
          await refreshMsStatus();
          window.clearInterval(id);
        } else if (data.status === "error") {
          setError(data.error || "Anmeldung fehlgeschlagen");
          setDeviceInfo(null);
          window.clearInterval(id);
        }
      } catch {
        /* keep polling */
      }
    }, intervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [deviceInfo, refreshMsStatus]);

  async function loadChats() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/microsoft/chats");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Chats laden fehlgeschlagen");
      setChats(data as Chat[]);
      setStep("chats");
    } catch (e) {
      setError(
        (e instanceof Error ? e.message : "Graph-Fehler") +
          " — du kannst stattdessen Text einfügen.",
      );
      setStep("paste");
    } finally {
      setBusy(false);
    }
  }

  async function loadDays(id: string) {
    setError(null);
    setBusy(true);
    setChatId(id);
    try {
      const res = await fetch(
        `/api/microsoft/chats/${encodeURIComponent(id)}/days`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Tage laden fehlgeschlagen");
      setDays(data as DaySummary[]);
      setStep("days");
    } catch (e) {
      setError(
        (e instanceof Error ? e.message : "Graph-Fehler") +
          " — bitte Text einfügen.",
      );
      setStep("paste");
    } finally {
      setBusy(false);
    }
  }

  async function enqueueJob(payload: Record<string, unknown>) {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/extraction-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Start fehlgeschlagen");
      setJobId(data.id);
      setStep("queued");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Start fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  async function extractFromDay(dateKey: string) {
    if (!chatId) return;
    setLearnedOn(dateKey);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/microsoft/chats/${encodeURIComponent(chatId)}/days?day=${dateKey}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Nachrichten fehlen");
      await enqueueJob({
        messages: data.messages,
        learnedOn: dateKey,
        sourceType: "teams",
        sourceLabel: `Teams · ${dateKey}`,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tag laden fehlgeschlagen");
      setBusy(false);
    }
  }

  return (
    <div className="import-page">
      <header className="app-header">
        <h1>Import</h1>
        <div className="header-actions">
          <JobBadge />
          <a className="btn secondary" href="/import/review">
            Prüfungen
          </a>
          <a className="btn secondary" href="/">
            ← Wörterbuch
          </a>
        </div>
      </header>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {step === "source" && (
        <section className="import-card">
          <h2>Quelle wählen</h2>
          <p className="muted">
            Extraktion läuft im Hintergrund (auch wenn du die Seite schließt).
            Fertige Jobs erscheinen als Hinweis in der Kopfzeile.
          </p>
          <div className="import-actions">
            <button
              type="button"
              className="btn primary"
              disabled={busy || !msConfigured}
              onClick={() => void startDeviceLogin()}
            >
              Mit Microsoft verbinden
            </button>
            <button
              type="button"
              className="btn secondary"
              disabled={busy || !msConnected}
              onClick={() => void loadChats()}
            >
              Chats laden
            </button>
            <button
              type="button"
              className="btn secondary"
              onClick={() => setStep("paste")}
            >
              Text einfügen
            </button>
          </div>
          {!msConfigured && (
            <p className="muted">
              Hinweis: <code>MICROSOFT_CLIENT_ID</code> ist nicht gesetzt —
              Paste-Pfad funktioniert trotzdem.
            </p>
          )}
          {msConnected && <p className="muted">Microsoft: verbunden.</p>}
          {deviceInfo && (
            <div className="device-code-box">
              <p>{deviceInfo.message}</p>
              <p>
                Code: <strong>{deviceInfo.userCode}</strong>
              </p>
              <p>
                <a
                  href={deviceInfo.verificationUri}
                  target="_blank"
                  rel="noreferrer"
                >
                  {deviceInfo.verificationUri}
                </a>
              </p>
            </div>
          )}
        </section>
      )}

      {step === "chats" && (
        <section className="import-card">
          <h2>Chat wählen</h2>
          <ul className="import-list">
            {chats.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="list-btn"
                  onClick={() => void loadDays(c.id)}
                >
                  <strong>{c.topic || c.chatType || "Chat"}</strong>
                  {c.lastMessagePreview && (
                    <span className="muted">
                      {c.lastMessagePreview.slice(0, 80)}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="btn secondary"
            onClick={() => setStep("paste")}
          >
            Stattdessen einfügen
          </button>
        </section>
      )}

      {step === "days" && (
        <section className="import-card">
          <h2>Tag wählen</h2>
          <p className="muted">Nur Nachrichten dieses Tages gehen an Ollama.</p>
          <ul className="import-list">
            {days.map((d) => (
              <li key={d.dateKey}>
                <button
                  type="button"
                  className="list-btn"
                  disabled={busy}
                  onClick={() => void extractFromDay(d.dateKey)}
                >
                  <strong>{d.dateKey}</strong>
                  <span className="muted">{d.count} Nachrichten</span>
                </button>
              </li>
            ))}
          </ul>
          {days.length === 0 && (
            <p className="muted">Keine Nachrichten gefunden — Text einfügen.</p>
          )}
          <button
            type="button"
            className="btn secondary"
            onClick={() => setStep("paste")}
          >
            Text einfügen
          </button>
        </section>
      )}

      {step === "paste" && (
        <section className="import-card">
          <h2>Chat-Text einfügen</h2>
          <label>
            Gelernt am
            <input
              type="date"
              value={learnedOn}
              onChange={(e) => setLearnedOn(e.target.value)}
            />
          </label>
          <label>
            Nachrichten
            <textarea
              rows={12}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Chatverlauf hier einfügen…"
            />
          </label>
          <div className="import-actions">
            <button
              type="button"
              className="btn primary"
              disabled={busy || !pasteText.trim()}
              onClick={() =>
                void enqueueJob({
                  text: pasteText,
                  learnedOn,
                  sourceType: "paste",
                  sourceLabel: `Text · ${learnedOn}`,
                })
              }
            >
              Im Hintergrund extrahieren
            </button>
            <button
              type="button"
              className="btn secondary"
              onClick={() => setStep("source")}
            >
              Zurück
            </button>
          </div>
        </section>
      )}

      {step === "queued" && (
        <section className="import-card">
          <h2>Läuft im Hintergrund</h2>
          <p>
            Die Extraktion wurde gestartet. Du kannst das Wörterbuch weiter
            nutzen; sobald sie fertig ist, erscheint ein Hinweis oben.
          </p>
          <div className="import-actions">
            <a className="btn primary" href="/">
              Zum Wörterbuch
            </a>
            {jobId && (
              <a className="btn secondary" href={`/import/review/${jobId}`}>
                Fortschritt ansehen
              </a>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
