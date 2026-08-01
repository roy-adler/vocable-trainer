import { NextRequest, NextResponse } from "next/server";
import { formatMessagesForPrompt, parseDateKey, type TimedMessage } from "@/lib/dates";
import { extractVocablesFromMessagesText } from "@/lib/ollama";
import { prisma } from "@/lib/prisma";
import { ensureExtractPromptFile } from "@/lib/prompt";

export async function POST(request: NextRequest) {
  try {
    ensureExtractPromptFile();
    const body = (await request.json()) as {
      text?: string;
      messages?: Array<{ sentAt?: string; body?: string; from?: string }>;
      learnedOn?: string;
    };

    let messagesText = "";
    if (typeof body.text === "string" && body.text.trim()) {
      messagesText = body.text.trim();
    } else if (Array.isArray(body.messages) && body.messages.length > 0) {
      const timed: TimedMessage[] = body.messages
        .filter((m) => typeof m.body === "string" && m.body.trim())
        .map((m) => ({
          sentAt: m.sentAt ? new Date(m.sentAt) : new Date(),
          body: m.body!.trim(),
          from: m.from,
        }));
      messagesText = formatMessagesForPrompt(timed);
    } else {
      return NextResponse.json(
        { error: "Kein Chat-Text oder Nachrichten übergeben." },
        { status: 400 },
      );
    }

    const learnedOnKey = body.learnedOn?.slice(0, 10);
    if (learnedOnKey && !parseDateKey(learnedOnKey)) {
      return NextResponse.json(
        { error: "Ungültiges learnedOn (YYYY-MM-DD)." },
        { status: 400 },
      );
    }

    const candidates = await extractVocablesFromMessagesText(messagesText);
    if (candidates.length === 0) {
      return NextResponse.json(
        { error: "Keine Vokabeln erkannt.", candidates: [] },
        { status: 422 },
      );
    }

    const existing = await prisma.vocable.findMany({ select: { hebrew: true } });
    const hebrewSet = new Set(existing.map((v) => v.hebrew.trim()));

    return NextResponse.json({
      candidates: candidates.map((c) => ({
        ...c,
        learnedOn: learnedOnKey ?? null,
        duplicate: hebrewSet.has(c.hebrew),
        selected: !hebrewSet.has(c.hebrew),
      })),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Extraktion fehlgeschlagen.",
      },
      { status: 500 },
    );
  }
}
