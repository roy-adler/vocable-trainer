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
    expiresAt: number;
  } | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [copied, setCopied] = useState(false);
  const [msTenant, setMsTenant] = useState("common");
  const [msEnabled, setMsEnabled] = useState(false);
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
      tenant?: string;
    };
    setMsConfigured(data.configured);
    setMsConnected(data.connected);
    setMsTenant(data.tenant || "common");
  }, []);

  useEffect(() => {
    void refreshMsStatus();
  }, [refreshMsStatus]);

  async function startDeviceLogin() {
    setError(null);
    setCopied(false);
    setDeviceInfo(null);
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
        expiresAt: Date.now() + (data.expiresIn || 900) * 1000,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Anmeldung fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!deviceInfo) {
      setSecondsLeft(0);
      return;
    }
    const tick = () =>
      setSecondsLeft(Math.max(0, Math.round((deviceInfo.expiresAt - Date.now()) / 1000)));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [deviceInfo]);

  useEffect(() => {
    if (!deviceInfo) return;
    let cancelled = false;
    let timer = 0;
    // One second on top of the interval Microsoft asks for; polling at exactly
    // the boundary triggers slow_down and eventually kills the code.
    let delayMs = (Math.max(5, deviceInfo.interval) + 1) * 1000;

    const stop = (message?: string) => {
      cancelled = true;
      window.clearTimeout(timer);
      if (message) setError(message);
      setDeviceInfo(null);
    };

    const poll = async () => {
      if (cancelled) return;
      if (Date.now() >= deviceInfo.expiresAt) {
        stop("Der Code ist abgelaufen. Bitte einen neuen Code anfordern.");
        return;
      }
      try {
        const res = await fetch("/api/microsoft/auth/poll", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceCode: deviceInfo.deviceCode }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (data.status === "ok") {
          cancelled = true;
          window.clearTimeout(timer);
          setDeviceInfo(null);
          await refreshMsStatus();
          return;
        }
        if (data.status === "error") {
          const parts = [data.error || "Anmeldung fehlgeschlagen"];
          if (data.detail && data.detail !== data.error) parts.push(data.detail);
          stop(parts.join(" — "));
          return;
        }
        if (data.slowDown) delayMs += 5000;
      } catch {
        /* network hiccup: keep polling */
      }
      if (!cancelled) timer = window.setTimeout(poll, delayMs);
    };

    timer = window.setTimeout(poll, delayMs);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
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
              onClick={() => setStep("paste")}
            >
              Text einfügen
            </button>
          </div>

          <details className="import-advanced">
            <summary>Teams-Import über Microsoft (nur Arbeits-/Schulkonto)</summary>
            <p className="muted">
              Microsoft Graph gibt Teams-Chats ausschließlich für Arbeits- und
              Schulkonten frei. Mit einem privaten Microsoft-Konto schlägt der
              Abruf fehl, auch wenn die Anmeldung klappt — dann bitte „Text
              einfügen“ nutzen.
            </p>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={msEnabled}
                onChange={(e) => setMsEnabled(e.target.checked)}
              />
              Ich habe ein Arbeits-/Schulkonto — Microsoft-Anmeldung aktivieren
            </label>
            <div className="import-actions">
              <button
                type="button"
                className="btn secondary"
                disabled={busy || !msConfigured || !msEnabled}
                onClick={() => void startDeviceLogin()}
              >
                Mit Microsoft verbinden
              </button>
              <button
                type="button"
                className="btn secondary"
                disabled={busy || !msConnected || !msEnabled}
                onClick={() => void loadChats()}
              >
                Chats laden
              </button>
            </div>
            {msEnabled && (
              <p className="muted">
                Authority: <code>{msTenant}</code> — für Arbeits-/Schulkonten{" "}
                <code>MICROSOFT_TENANT=organizations</code> in der{" "}
                <code>.env</code> setzen.
              </p>
            )}
            {!msConfigured && (
              <p className="muted">
                <code>MICROSOFT_CLIENT_ID</code> ist im Container nicht gesetzt
                — in die <code>.env</code> neben der{" "}
                <code>docker-compose.yml</code> eintragen und neu starten.
              </p>
            )}
            {msConnected && <p className="muted">Microsoft: verbunden.</p>}
          </details>
          {deviceInfo && (
            <div className="device-code-box">
              <p>
                Öffne die Seite, gib den Code ein und melde dich an. Der Code
                gilt nur für diesen Versuch — er wird ungültig, sobald du einen
                neuen anforderst.
              </p>
              <p className="device-code-value">
                <strong>{deviceInfo.userCode}</strong>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => {
                    void navigator.clipboard
                      ?.writeText(deviceInfo.userCode)
                      .then(() => setCopied(true))
                      .catch(() => setCopied(false));
                  }}
                >
                  {copied ? "Kopiert" : "Kopieren"}
                </button>
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
              <p className="muted">
                Gültig noch {Math.floor(secondsLeft / 60)}:
                {String(secondsLeft % 60).padStart(2, "0")} Min. · Tenant{" "}
                <code>{msTenant}</code>
              </p>
              <button
                type="button"
                className="btn secondary"
                disabled={busy}
                onClick={() => void startDeviceLogin()}
              >
                Neuen Code anfordern
              </button>
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
          <p className="muted">
            Den Chatverlauf in Teams markieren, kopieren und hier einfügen.
            Namen und Zeitstempel dürfen drin bleiben — die KI sucht sich die
            Vokabeln heraus.
          </p>
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
              className="paste-area"
              rows={20}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Chatverlauf hier einfügen…"
            />
          </label>
          <p className="muted">
            {pasteText.trim()
              ? `${pasteText.trim().split(/\s+/).length} Wörter, ${
                  pasteText.split("\n").filter((l) => l.trim()).length
                } Zeilen`
              : "Noch nichts eingefügt."}
          </p>
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
