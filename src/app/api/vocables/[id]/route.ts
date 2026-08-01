import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeVocable, vocableInclude } from "@/lib/serialize";
import { resolveTagIds } from "@/lib/tags";
import { validateVocableInput } from "@/lib/validation";

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
