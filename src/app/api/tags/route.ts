import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const tags = await prisma.tag.findMany({
      orderBy: { name: "asc" },
    });
    return NextResponse.json(tags);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Tags konnten nicht geladen werden." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json(
        { errors: { name: "Tag-Name ist erforderlich." } },
        { status: 400 },
      );
    }

    const existing = await prisma.tag.findFirst({
      where: { name: { equals: name } },
    });
    if (existing) {
      return NextResponse.json(existing);
    }

    const tag = await prisma.tag.create({ data: { name } });
    return NextResponse.json(tag, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Tag konnte nicht gespeichert werden." },
      { status: 500 },
    );
  }
}
