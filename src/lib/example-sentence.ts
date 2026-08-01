import { ollamaChatPlain } from "./ollama";
import { renderExampleSentencePrompt } from "./prompt";

export async function generateExampleSentence(
  fields: { hebrew: string; transliteration: string; german: string },
  options?: { model?: string; fetchImpl?: typeof fetch },
): Promise<string> {
  const prompt = renderExampleSentencePrompt(fields);
  return ollamaChatPlain(prompt, options);
}
