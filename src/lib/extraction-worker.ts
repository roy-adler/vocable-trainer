import { prisma } from "@/lib/prisma";
import { toDateKey } from "@/lib/dates";
import { extractVocablesFromMessagesText } from "@/lib/ollama";
import { ensureExtractPromptFile } from "@/lib/prompt";
import { defaultFieldChoices } from "@/lib/extraction-merge";

const globalWorker = globalThis as unknown as {
  extractionWorkerRunning?: boolean;
};

async function recoverStuckJobs() {
  await prisma.extractionJob.updateMany({
    where: { status: "running" },
    data: { status: "queued", error: "" },
  });
}

async function processOneJob(jobId: string) {
  const job = await prisma.extractionJob.findUnique({ where: { id: jobId } });
  if (!job || job.status !== "running") return;

  try {
    ensureExtractPromptFile();
    const candidates = await extractVocablesFromMessagesText(job.inputText);
    if (candidates.length === 0) {
      await prisma.extractionJob.update({
        where: { id: jobId },
        data: {
          status: "failed",
          error: "Keine Vokabeln erkannt.",
          readyAt: new Date(),
        },
      });
      return;
    }

    const existingRows = await prisma.vocable.findMany();
    const byHebrew = new Map(
      existingRows.map((v) => [v.hebrew.trim(), v] as const),
    );

    await prisma.$transaction(async (tx) => {
      await tx.extractionSuggestion.deleteMany({ where: { jobId } });
      for (let i = 0; i < candidates.length; i++) {
        const c = candidates[i];
        const match = byHebrew.get(c.hebrew.trim());
        const snapshot = match
          ? JSON.stringify({
              id: match.id,
              hebrew: match.hebrew,
              transliteration: match.transliteration,
              german: match.german,
              exampleSentence: match.exampleSentence,
              notes: match.notes,
              learnedOn: toDateKey(match.learnedOn, "UTC"),
            })
          : "";
        await tx.extractionSuggestion.create({
          data: {
            jobId,
            sortIndex: i,
            hebrew: c.hebrew,
            transliteration: c.transliteration,
            german: c.german,
            exampleSentence: c.exampleSentence,
            notes: c.notes,
            learnedOn: job.learnedOn,
            existingVocableId: match?.id ?? null,
            existingSnapshot: snapshot,
            status: "pending",
            fieldChoices: JSON.stringify(defaultFieldChoices(Boolean(match))),
          },
        });
      }
      await tx.extractionJob.update({
        where: { id: jobId },
        data: {
          status: "ready",
          error: "",
          readyAt: new Date(),
        },
      });
    });
  } catch (error) {
    console.error("extraction job failed", jobId, error);
    await prisma.extractionJob.update({
      where: { id: jobId },
      data: {
        status: "failed",
        error:
          error instanceof Error ? error.message : "Extraktion fehlgeschlagen.",
        readyAt: new Date(),
      },
    });
  }
}

export async function kickExtractionWorker() {
  if (globalWorker.extractionWorkerRunning) return;
  globalWorker.extractionWorkerRunning = true;
  try {
    for (;;) {
      const next = await prisma.extractionJob.findFirst({
        where: { status: "queued" },
        orderBy: { createdAt: "asc" },
      });
      if (!next) break;
      await prisma.extractionJob.update({
        where: { id: next.id },
        data: { status: "running", error: "" },
      });
      await processOneJob(next.id);
    }
  } finally {
    globalWorker.extractionWorkerRunning = false;
  }
}

export async function recoverAndKickExtractionWorker() {
  await recoverStuckJobs();
  void kickExtractionWorker();
}
