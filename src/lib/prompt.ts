import fs from "fs";
import path from "path";

const DEFAULT_RELATIVE = path.join("prompts", "extract-vocables.md");

export function getDataDir(): string {
  return process.env.DATA_DIR?.trim() || "/data";
}

export function getPromptPaths() {
  const dataPrompt = path.join(getDataDir(), "prompts", "extract-vocables.md");
  const bundledPrompt = path.join(process.cwd(), DEFAULT_RELATIVE);
  return { dataPrompt, bundledPrompt };
}

/** Ensure /data/prompts/extract-vocables.md exists (copy from bundled default). */
export function ensureExtractPromptFile(): string {
  const { dataPrompt, bundledPrompt } = getPromptPaths();
  const dir = path.dirname(dataPrompt);
  fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(dataPrompt)) {
    const source = fs.existsSync(bundledPrompt)
      ? bundledPrompt
      : path.join(__dirname, "..", "..", DEFAULT_RELATIVE);
    if (fs.existsSync(source)) {
      fs.copyFileSync(source, dataPrompt);
    } else {
      fs.writeFileSync(
        dataPrompt,
        "Extrahiere Vokabeln als JSON-Array mit hebrew, transliteration, german.\n\n{{messages}}\n",
        "utf8",
      );
    }
  }
  return dataPrompt;
}

export function loadExtractPromptTemplate(): string {
  const promptPath = ensureExtractPromptFile();
  return fs.readFileSync(promptPath, "utf8");
}

export function renderExtractPrompt(messagesText: string): string {
  const template = loadExtractPromptTemplate();
  if (!template.includes("{{messages}}")) {
    return `${template.trim()}\n\n${messagesText}`;
  }
  return template.split("{{messages}}").join(messagesText);
}
