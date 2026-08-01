import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  parseExistingSnapshot,
  parseFieldChoices,
} from "@/lib/extraction-merge";
import { toDateKey } from "@/lib/dates";
import { modelForRetry } from "@/lib/extraction-model";
import { kickExtractionWorker } from "@/lib/extraction-worker";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const job = await prisma.extractionJob.findUnique({
      where: { id },
      include: {
        suggestions: { orderBy: { sortIndex: "asc" } },
      },
    });
    if (!job) {
      return NextResponse.json({ error: "Job nicht gefunden." }, { status: 404 });
    }

    return NextResponse.json({
      id: job.id,
      status: job.status,
      sourceType: job.sourceType,
      sourceLabel: job.sourceLabel,
      learnedOn: toDateKey(job.learnedOn, "UTC"),
      error: job.error,
      model: job.model,
      createdAt: job.createdAt.toISOString(),
      readyAt: job.readyAt?.toISOString() ?? null,
      suggestions: job.suggestions.map((s) => ({
        id: s.id,
        sortIndex: s.sortIndex,
        hebrew: s.hebrew,
        transliteration: s.transliteration,
        german: s.german,
        exampleSentence: s.exampleSentence,
        notes: s.notes,
        learnedOn: toDateKey(s.learnedOn, "UTC"),
        existingVocableId: s.existingVocableId,
        existing: parseExistingSnapshot(s.existingSnapshot),
        status: s.status,
        fieldChoices: parseFieldChoices(s.fieldChoices),
        resolvedVocableId: s.resolvedVocableId,
      })),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Job konnte nicht geladen werden." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as { action?: string };
    const job = await prisma.extractionJob.findUnique({ where: { id } });
    if (!job) {
      return NextResponse.json({ error: "Job nicht gefunden." }, { status: 404 });
    }

    if (body.action === "dismiss") {
      await prisma.extractionJob.update({
        where: { id },
        data: { status: "dismissed" },
      });
      return NextResponse.json({ ok: true });
    }

    if (body.action === "retry") {
      if (job.status !== "failed") {
        return NextResponse.json(
          { error: "Nur fehlgeschlagene Jobs können wiederholt werden." },
          { status: 400 },
        );
      }
      await prisma.extractionSuggestion.deleteMany({ where: { jobId: id } });
      await prisma.extractionJob.update({
        where: { id },
        data: {
          status: "queued",
          error: "",
          readyAt: null,
          model: modelForRetry(),
        },
      });
      void kickExtractionWorker();
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unbekannte Aktion." }, { status: 400 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Job konnte nicht aktualisiert werden." },
      { status: 500 },
    );
  }
}
