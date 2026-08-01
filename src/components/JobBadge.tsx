"use client";

import { useCallback, useEffect, useState } from "react";

type JobSummary = {
  id: string;
  status: string;
  sourceLabel: string;
  pendingCount: number;
  suggestionCount: number;
  error: string;
};

export function JobBadge() {
  const [jobs, setJobs] = useState<JobSummary[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/extraction-jobs");
      if (!res.ok) return;
      const data = (await res.json()) as JobSummary[];
      setJobs(data);
    } catch {
      /* ignore poll errors */
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 4000);
    return () => window.clearInterval(id);
  }, [load]);

  if (jobs.length === 0) return null;

  const ready = jobs.filter((j) => j.status === "ready");
  const running = jobs.filter(
    (j) => j.status === "queued" || j.status === "running",
  );
  const failed = jobs.filter((j) => j.status === "failed");

  let label = `${jobs.length} Extraktion(en)`;
  let href = "/import/review";
  if (ready.length > 0) {
    const first = ready[0];
    label =
      first.pendingCount > 0
        ? `${first.pendingCount} Vorschläge bereit`
        : "Extraktion bereit";
    href = `/import/review/${first.id}`;
  } else if (running.length > 0) {
    label = "Extraktion läuft…";
    href = "/import/review";
  } else if (failed.length > 0) {
    label = "Extraktion fehlgeschlagen";
    href = `/import/review/${failed[0].id}`;
  }

  return (
    <a
      className={`job-badge ${ready.length ? "ready" : ""} ${failed.length && !ready.length ? "failed" : ""}`}
      href={href}
      title={failed[0]?.error || undefined}
    >
      {label}
    </a>
  );
}
