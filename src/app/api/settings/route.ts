import { NextRequest, NextResponse } from "next/server";
import { readAppSettings, writeOllamaModel } from "@/lib/settings";

export async function GET() {
  try {
    return NextResponse.json(readAppSettings());
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Einstellungen konnten nicht geladen werden." },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as { ollamaModel?: unknown };
    if (typeof body.ollamaModel !== "string") {
      return NextResponse.json(
        { error: "Modellname fehlt." },
        { status: 400 },
      );
    }
    const settings = writeOllamaModel(body.ollamaModel);
    return NextResponse.json(settings);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Speichern fehlgeschlagen.";
    const status = message.includes("Modellname fehlt") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
