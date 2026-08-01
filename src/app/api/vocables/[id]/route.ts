import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateVocableInput } from "@/lib/validation";

const vocableInclude = {
  tags: { include: { tag: true } },
} as const;

function serializeVocable(
  vocable: {
    id: string;
    hebrew: string;
    transliteration: string;
    german: string;
    exampleSentence: string;
    notes: string;
    createdAt: Date;
    updatedAt: Date;
    tags: { tag: { id: string; name: string } }[];
  } | null,
) {
  if (!vocable) return null;
  return {
    id: vocable.id,
    hebrew: vocable.hebrew,
    transliteration: vocable.transliteration,
    german: vocable.german,
    exampleSentence: vocable.exampleSentence,
    notes: vocable.notes,
    createdAt: vocable.createdAt,
    updatedAt: vocable.updatedAt,
    tags: vocable.tags.map((t) => t.tag),
  };
}

async function resolveTagIds(tagIds: string[], newTags: string[]): Promise<string[]> {
  const ids = new Set(tagIds);
  for (const name of newTags) {
    const normalized = name.trim();
    if (!normalized) continue;
    const existing = await prisma.tag.findFirst({
      where: { name: { equals: normalized } },
    });
    if (existing) {
      ids.add(existing.id);
    } else {
      const created = await prisma.tag.create({ data: { name: normalized } });
      ids.add(created.id);
    }
  }
  return [...ids];
}

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const vocable = await prisma.vocable.findUnique({
      where: { id },
      include: vocableInclude,
    });
    if (!vocable) {
      return NextResponse.json({ error: "Eintrag nicht gefunden." }, { status: 404 });
    }
    return NextResponse.json(serializeVocable(vocable));
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Eintrag konnte nicht geladen werden." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const existing = await prisma.vocable.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Eintrag nicht gefunden." }, { status: 404 });
    }

    const body = await request.json();
    const validated = validateVocableInput(body);
    if (!validated.ok) {
      return NextResponse.json({ errors: validated.errors }, { status: 400 });
    }

    const { tagIds, newTags, ...fields } = validated.data;
    const resolvedTagIds = await resolveTagIds(tagIds, newTags);

    const vocable = await prisma.$transaction(async (tx) => {
      await tx.vocableTag.deleteMany({ where: { vocableId: id } });
      return tx.vocable.update({
        where: { id },
        data: {
          ...fields,
          tags: {
            create: resolvedTagIds.map((tagId) => ({ tagId })),
          },
        },
        include: vocableInclude,
      });
    });

    return NextResponse.json(serializeVocable(vocable));
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Eintrag konnte nicht aktualisiert werden." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const existing = await prisma.vocable.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Eintrag nicht gefunden." }, { status: 404 });
    }
    await prisma.vocable.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Eintrag konnte nicht gelöscht werden." },
      { status: 500 },
    );
  }
}
