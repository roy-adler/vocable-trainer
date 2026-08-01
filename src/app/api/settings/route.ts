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
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Ungültiges JSON." }, { status: 400 });
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Modellname fehlt." },
        { status: 400 },
      );
    }
    const { ollamaModel } = body as { ollamaModel?: unknown };
    if (typeof ollamaModel !== "string") {
      return NextResponse.json(
        { error: "Modellname fehlt." },
        { status: 400 },
      );
    }
    const settings = writeOllamaModel(ollamaModel);
    return NextResponse.json(settings);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Modellname fehlt")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json(
      { error: "Speichern fehlgeschlagen." },
      { status: 500 },
    );
  }
}
