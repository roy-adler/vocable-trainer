import { NextRequest, NextResponse } from "next/server";
import {
  formatMessagesForPrompt,
  parseDateKey,
  todayDateKey,
  type TimedMessage,
} from "@/lib/dates";
import { kickExtractionWorker } from "@/lib/extraction-worker";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const jobs = await prisma.extractionJob.findMany({
      where: {
        status: { in: ["queued", "running", "ready", "failed"] },
      },
      orderBy: { updatedAt: "desc" },
      include: {
        _count: {
          select: {
            suggestions: true,
          },
        },
        suggestions: {
          where: { status: "pending" },
          select: { id: true },
        },
      },
    });

    return NextResponse.json(
      jobs.map((j) => ({
        id: j.id,
        status: j.status,
        sourceType: j.sourceType,
        sourceLabel: j.sourceLabel,
        learnedOn: j.learnedOn.toISOString().slice(0, 10),
        error: j.error,
        suggestionCount: j._count.suggestions,
        pendingCount: j.suggestions.length,
        createdAt: j.createdAt.toISOString(),
        readyAt: j.readyAt?.toISOString() ?? null,
      })),
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Jobs konnten nicht geladen werden." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      text?: string;
      messages?: Array<{ sentAt?: string; body?: string; from?: string }>;
      learnedOn?: string;
      sourceType?: string;
      sourceLabel?: string;
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

    const learnedOnKey = (body.learnedOn?.slice(0, 10) || todayDateKey()).slice(
      0,
      10,
    );
    const learnedOn = parseDateKey(learnedOnKey);
    if (!learnedOn) {
      return NextResponse.json(
        { error: "Ungültiges learnedOn (YYYY-MM-DD)." },
        { status: 400 },
      );
    }

    const job = await prisma.extractionJob.create({
      data: {
        status: "queued",
        sourceType: body.sourceType === "teams" ? "teams" : "paste",
        sourceLabel:
          body.sourceLabel?.trim() ||
          (body.sourceType === "teams" ? learnedOnKey : "Eingefügter Text"),
        learnedOn,
        inputText: messagesText,
      },
    });

    void kickExtractionWorker();

    return NextResponse.json(
      {
        id: job.id,
        status: job.status,
        message: "Extraktion läuft im Hintergrund.",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Job konnte nicht gestartet werden." },
      { status: 500 },
    );
  }
}
