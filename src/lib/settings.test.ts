import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getSettingsPath,
  readAppSettings,
  resolveOllamaModel,
  writeOllamaModel,
} from "./settings";

describe("settings", () => {
  let dir: string;
  const prevData = process.env.DATA_DIR;
  const prevModel = process.env.OLLAMA_MODEL;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "settings-"));
    process.env.DATA_DIR = dir;
    delete process.env.OLLAMA_MODEL;
  });

  afterEach(() => {
    if (prevData === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = prevData;
    if (prevModel === undefined) delete process.env.OLLAMA_MODEL;
    else process.env.OLLAMA_MODEL = prevModel;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("seeds from env when file missing", () => {
    process.env.OLLAMA_MODEL = "gemma:2b";
    const s = readAppSettings();
    expect(s.ollamaModel).toBe("gemma:2b");
    expect(fs.existsSync(getSettingsPath())).toBe(true);
  });

  it("defaults to llama3.1 when env unset", () => {
    expect(readAppSettings().ollamaModel).toBe("llama3.1");
  });

  it("writeOllamaModel merges without wiping unknown keys", () => {
    fs.writeFileSync(
      getSettingsPath(),
      JSON.stringify({ ollamaModel: "a", extra: 1 }),
      "utf8",
    );
    writeOllamaModel("b");
    const raw = JSON.parse(fs.readFileSync(getSettingsPath(), "utf8"));
    expect(raw.ollamaModel).toBe("b");
    expect(raw.extra).toBe(1);
  });

  it("writeOllamaModel rejects empty", () => {
    expect(() => writeOllamaModel("  ")).toThrow(/Modellname fehlt/);
  });

  it("resolveOllamaModel prefers override", () => {
    writeOllamaModel("saved");
    expect(resolveOllamaModel("override")).toBe("override");
    expect(resolveOllamaModel("")).toBe("saved");
    expect(resolveOllamaModel(null)).toBe("saved");
  });
});
