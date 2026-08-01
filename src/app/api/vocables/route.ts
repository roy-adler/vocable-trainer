import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateVocableInput } from "@/lib/validation";

const vocableInclude = {
  tags: { include: { tag: true } },
} as const;

function serializeVocable(
  vocable: Awaited<ReturnType<typeof prisma.vocable.findFirst>> & {
    tags: { tag: { id: string; name: string } }[];
  },
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

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    const tagId = request.nextUrl.searchParams.get("tag")?.trim() ?? "";

    const vocables = await prisma.vocable.findMany({
      where: {
        AND: [
          tagId
            ? { tags: { some: { tagId } } }
            : {},
          q
            ? {
                OR: [
                  { hebrew: { contains: q } },
                  { transliteration: { contains: q } },
                  { german: { contains: q } },
                ],
              }
            : {},
        ],
      },
      include: vocableInclude,
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(vocables.map((v) => serializeVocable(v)));
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Einträge konnten nicht geladen werden." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = validateVocableInput(body);
    if (!validated.ok) {
      return NextResponse.json({ errors: validated.errors }, { status: 400 });
    }

    const { tagIds, newTags, ...fields } = validated.data;
    const resolvedTagIds = await resolveTagIds(tagIds, newTags);

    const vocable = await prisma.vocable.create({
      data: {
        ...fields,
        tags: {
          create: resolvedTagIds.map((tagId) => ({ tagId })),
        },
      },
      include: vocableInclude,
    });

    return NextResponse.json(serializeVocable(vocable), { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Eintrag konnte nicht gespeichert werden." },
      { status: 500 },
    );
  }
}
