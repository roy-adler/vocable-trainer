import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeVocable, vocableInclude } from "@/lib/serialize";
import { resolveTagIds } from "@/lib/tags";
import { validateVocableInput } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    const tagId = request.nextUrl.searchParams.get("tag")?.trim() ?? "";

    const vocables = await prisma.vocable.findMany({
      where: {
        AND: [
          tagId ? { tags: { some: { tagId } } } : {},
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
          create: resolvedTagIds.map((id) => ({ tagId: id })),
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
