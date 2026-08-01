import { NextRequest, NextResponse } from "next/server";
import { parseDateKey } from "@/lib/dates";
import {
  FIELD_KEYS,
  mergeFields,
  parseExistingSnapshot,
  parseFieldChoices,
  type FieldChoices,
  type FieldKey,
} from "@/lib/extraction-merge";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string; suggestionId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id, suggestionId } = await context.params;
    const body = (await request.json()) as {
      fieldChoices?: FieldChoices;
      hebrew?: string;
      transliteration?: string;
      german?: string;
      exampleSentence?: string;
      notes?: string;
      learnedOn?: string;
    };

    const suggestion = await prisma.extractionSuggestion.findFirst({
      where: { id: suggestionId, jobId: id },
    });
    if (!suggestion) {
      return NextResponse.json(
        { error: "Vorschlag nicht gefunden." },
        { status: 404 },
      );
    }
    if (suggestion.status !== "pending") {
      return NextResponse.json(
        { error: "Vorschlag ist bereits bearbeitet." },
        { status: 400 },
      );
    }

    const data: {
      fieldChoices?: string;
      hebrew?: string;
      transliteration?: string;
      german?: string;
      exampleSentence?: string;
      notes?: string;
      learnedOn?: Date;
    } = {};

    if (body.fieldChoices) {
      data.fieldChoices = JSON.stringify(body.fieldChoices);
    }
    for (const key of FIELD_KEYS) {
      if (typeof body[key] === "string") {
        data[key] = body[key]!.trim();
      }
    }
    if (body.learnedOn) {
      const d = parseDateKey(body.learnedOn.slice(0, 10));
      if (!d) {
        return NextResponse.json(
          { error: "Ungültiges Datum." },
          { status: 400 },
        );
      }
      data.learnedOn = d;
    }

    const updated = await prisma.extractionSuggestion.update({
      where: { id: suggestionId },
      data,
    });

    return NextResponse.json({
      id: updated.id,
      fieldChoices: parseFieldChoices(updated.fieldChoices),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Vorschlag konnte nicht gespeichert werden." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id, suggestionId } = await context.params;
    const body = (await request.json()) as { action?: string };
    const suggestion = await prisma.extractionSuggestion.findFirst({
      where: { id: suggestionId, jobId: id },
    });
    if (!suggestion) {
      return NextResponse.json(
        { error: "Vorschlag nicht gefunden." },
        { status: 404 },
      );
    }
    if (suggestion.status !== "pending") {
      return NextResponse.json(
        { error: "Vorschlag ist bereits bearbeitet." },
        { status: 400 },
      );
    }

    if (body.action === "skip") {
      await prisma.extractionSuggestion.update({
        where: { id: suggestionId },
        data: { status: "skipped" },
      });
      await maybeCompleteJob(id);
      return NextResponse.json({ ok: true, status: "skipped" });
    }

    if (body.action !== "apply") {
      return NextResponse.json({ error: "Unbekannte Aktion." }, { status: 400 });
    }

    const choices = parseFieldChoices(suggestion.fieldChoices);
    const existing = parseExistingSnapshot(suggestion.existingSnapshot);
    const suggestionFields: Record<FieldKey, string> = {
      hebrew: suggestion.hebrew,
      transliteration: suggestion.transliteration,
      german: suggestion.german,
      exampleSentence: suggestion.exampleSentence,
      notes: suggestion.notes,
    };
    const existingFields = existing
      ? {
          hebrew: existing.hebrew,
          transliteration: existing.transliteration,
          german: existing.german,
          exampleSentence: existing.exampleSentence,
          notes: existing.notes,
        }
      : null;
    const merged = mergeFields(suggestionFields, existingFields, choices);

    if (!merged.hebrew || !merged.transliteration || !merged.german) {
      return NextResponse.json(
        { error: "Hebräisch, Umschreibung und Deutsch sind erforderlich." },
        { status: 400 },
      );
    }

    let vocableId: string;
    if (suggestion.existingVocableId) {
      const updated = await prisma.vocable.update({
        where: { id: suggestion.existingVocableId },
        data: {
          ...merged,
          learnedOn: suggestion.learnedOn,
        },
      });
      vocableId = updated.id;
    } else {
      const created = await prisma.vocable.create({
        data: {
          ...merged,
          learnedOn: suggestion.learnedOn,
        },
      });
      vocableId = created.id;
    }

    await prisma.extractionSuggestion.update({
      where: { id: suggestionId },
      data: {
        status: "imported",
        resolvedVocableId: vocableId,
      },
    });
    await maybeCompleteJob(id);

    return NextResponse.json({ ok: true, status: "imported", vocableId });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Übernehmen fehlgeschlagen." },
      { status: 500 },
    );
  }
}

async function maybeCompleteJob(jobId: string) {
  const pending = await prisma.extractionSuggestion.count({
    where: { jobId, status: "pending" },
  });
  if (pending === 0) {
    await prisma.extractionJob.update({
      where: { id: jobId },
      data: { status: "done" },
    });
  }
}
