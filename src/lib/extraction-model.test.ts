import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { modelForNewJob, modelForRetry } from "./extraction-model";
import { writeOllamaModel } from "./settings";

describe("extraction-model", () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "em-"));
    process.env.DATA_DIR = dir;
    delete process.env.OLLAMA_MODEL;
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    delete process.env.DATA_DIR;
  });

  it("create uses request override", () => {
    writeOllamaModel("saved");
    expect(modelForNewJob("override")).toBe("override");
  });

  it("retry uses current settings", () => {
    writeOllamaModel("new-default");
    expect(modelForRetry()).toBe("new-default");
  });
});
