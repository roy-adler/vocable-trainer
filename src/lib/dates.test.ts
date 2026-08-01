import { describe, expect, it } from "vitest";
import {
  groupMessagesByDay,
  parseDateKey,
  toDateKey,
  formatMessagesForPrompt,
} from "./dates";

describe("parseDateKey", () => {
  it("parses valid keys", () => {
    const d = parseDateKey("2026-08-01");
    expect(d?.toISOString()).toBe("2026-08-01T00:00:00.000Z");
  });

  it("rejects invalid keys", () => {
    expect(parseDateKey("2026-13-01")).toBeNull();
    expect(parseDateKey("nope")).toBeNull();
  });
});

describe("toDateKey", () => {
  it("formats UTC instant in Europe/Berlin", () => {
    // 2026-07-31 22:30 UTC = 2026-08-01 00:30 in Berlin (CEST)
    const d = new Date("2026-07-31T22:30:00.000Z");
    expect(toDateKey(d, "Europe/Berlin")).toBe("2026-08-01");
  });
});

describe("groupMessagesByDay", () => {
  it("groups and sorts days descending", () => {
    const buckets = groupMessagesByDay(
      [
        {
          sentAt: new Date("2026-08-01T10:00:00.000Z"),
          body: "a",
          from: "Teacher",
        },
        {
          sentAt: new Date("2026-08-02T10:00:00.000Z"),
          body: "b",
          from: "Me",
        },
        {
          sentAt: new Date("2026-08-01T11:00:00.000Z"),
          body: "c",
          from: "Me",
        },
      ],
      "UTC",
    );
    expect(buckets.map((b) => b.dateKey)).toEqual(["2026-08-02", "2026-08-01"]);
    expect(buckets[1].count).toBe(2);
    expect(buckets[1].messages.map((m) => m.body)).toEqual(["a", "c"]);
  });
});

describe("formatMessagesForPrompt", () => {
  it("includes sender and body", () => {
    const text = formatMessagesForPrompt([
      {
        sentAt: new Date("2026-08-01T10:00:00.000Z"),
        body: "שלום",
        from: "Lehrerin",
      },
    ]);
    expect(text).toContain("Lehrerin");
    expect(text).toContain("שלום");
  });
});
