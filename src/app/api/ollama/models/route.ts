import { NextResponse } from "next/server";
import { listOllamaModels } from "@/lib/ollama";
import { readAppSettings } from "@/lib/settings";

export async function GET() {
  try {
    const models = await listOllamaModels();
    const { ollamaModel } = readAppSettings();
    return NextResponse.json({ models, defaultModel: ollamaModel });
  } catch (error) {
    console.error(error);
    const message =
      error instanceof Error
        ? error.message
        : "Modelle konnten nicht geladen werden.";
    const status = message.includes("OLLAMA_BASE_URL") ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
