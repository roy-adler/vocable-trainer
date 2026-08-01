/** Date-only helpers (YYYY-MM-DD) using a fixed timezone for grouping. */

export function getAppTimeZone(): string {
  return process.env.TZ?.trim() || "Europe/Berlin";
}

/** Format a Date as YYYY-MM-DD in the given IANA timezone. */
export function toDateKey(date: Date, timeZone: string = getAppTimeZone()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  if (!y || !m || !d) {
    throw new Error("Could not format date key");
  }
  return `${y}-${m}-${d}`;
}

/** Parse YYYY-MM-DD into a Date at UTC midnight (date-only storage). */
export function parseDateKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    return null;
  }
  return dt;
}

export function todayDateKey(timeZone: string = getAppTimeZone()): string {
  return toDateKey(new Date(), timeZone);
}

export function formatDateKeyDisplay(key: string): string {
  return key;
}

export type TimedMessage = {
  id?: string;
  sentAt: Date;
  body: string;
  from?: string;
};

export type DayBucket = {
  dateKey: string;
  count: number;
  messages: TimedMessage[];
};

export function groupMessagesByDay(
  messages: TimedMessage[],
  timeZone: string = getAppTimeZone(),
): DayBucket[] {
  const map = new Map<string, TimedMessage[]>();
  for (const msg of messages) {
    const key = toDateKey(msg.sentAt, timeZone);
    const list = map.get(key) ?? [];
    list.push(msg);
    map.set(key, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([dateKey, msgs]) => ({
      dateKey,
      count: msgs.length,
      messages: msgs.sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime()),
    }));
}

export function formatMessagesForPrompt(messages: TimedMessage[]): string {
  return messages
    .map((m) => {
      const who = m.from?.trim() || "Unbekannt";
      const when = m.sentAt.toISOString();
      return `[${when}] ${who}:\n${m.body.trim()}`;
    })
    .join("\n\n");
}
