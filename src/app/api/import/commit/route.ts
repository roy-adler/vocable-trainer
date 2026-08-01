import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeVocable, vocableInclude } from "@/lib/serialize";
import { validateVocableInput } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { items?: unknown[] };
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { error: "Keine Einträge zum Übernehmen ausgewählt." },
        { status: 400 },
      );
    }

    const created = [];
    for (const item of body.items) {
      const validated = validateVocableInput(item);
      if (!validated.ok) {
        return NextResponse.json(
          { error: "Mindestens ein Eintrag ist ungültig.", errors: validated.errors },
          { status: 400 },
        );
      }
      const { tagIds, newTags, ...fields } = validated.data;
      void tagIds;
      void newTags;
      const vocable = await prisma.vocable.create({
        data: fields,
        include: vocableInclude,
      });
      created.push(serializeVocable(vocable));
    }

    return NextResponse.json({ count: created.length, vocables: created }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Import fehlgeschlagen." },
      { status: 500 },
    );
  }
}
