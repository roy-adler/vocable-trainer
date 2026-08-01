import fs from "fs";
import path from "path";
import { getDataDir } from "./prompt";

export type AppSettings = {
  ollamaModel: string;
};

export function getSettingsPath(): string {
  return path.join(getDataDir(), "settings.json");
}

function envSeedModel(): string {
  return process.env.OLLAMA_MODEL?.trim() || "llama3.1";
}

function readRawFile(): Record<string, unknown> {
  const p = getSettingsPath();
  if (!fs.existsSync(p)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(p, "utf8")) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

function writeRaw(data: Record<string, unknown>): void {
  const p = getSettingsPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n", "utf8");
}

export function readAppSettings(): AppSettings {
  const raw = readRawFile();
  const fromFile =
    typeof raw.ollamaModel === "string" ? raw.ollamaModel.trim() : "";
  if (fromFile) {
    return { ollamaModel: fromFile };
  }
  const seeded = envSeedModel();
  writeRaw({ ...raw, ollamaModel: seeded });
  return { ollamaModel: seeded };
}

export function writeOllamaModel(model: string): AppSettings {
  const trimmed = model.trim();
  if (!trimmed) {
    throw new Error("Modellname fehlt.");
  }
  const raw = readRawFile();
  writeRaw({ ...raw, ollamaModel: trimmed });
  return { ollamaModel: trimmed };
}

export function resolveOllamaModel(override?: string | null): string {
  const o = typeof override === "string" ? override.trim() : "";
  if (o) return o;
  return readAppSettings().ollamaModel;
}
