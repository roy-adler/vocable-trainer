import { NextRequest, NextResponse } from "next/server";
import {
  generateExampleSentence,
  mapExampleSentenceError,
  parseExampleSentenceRequest,
} from "@/lib/example-sentence";
import { ensureExampleSentencePromptFile } from "@/lib/prompt";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = parseExampleSentenceRequest(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    ensureExampleSentencePromptFile();
    const exampleSentence = await generateExampleSentence(parsed.data);
    return NextResponse.json({ exampleSentence });
  } catch (error) {
    console.error(error);
    const mapped = mapExampleSentenceError(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
