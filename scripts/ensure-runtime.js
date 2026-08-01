const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const dataDir = process.env.DATA_DIR || "/data";
const marker = path.join(dataDir, ".learnedOn-backfilled");
const promptSrcCandidates = [
  path.join(process.cwd(), "prompts", "extract-vocables.md"),
  "/app/prompts/extract-vocables.md",
];
const promptDestDir = path.join(dataDir, "prompts");
const promptDest = path.join(promptDestDir, "extract-vocables.md");

function ensurePrompt() {
  fs.mkdirSync(promptDestDir, { recursive: true });
  if (fs.existsSync(promptDest)) return;
  for (const src of promptSrcCandidates) {
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, promptDest);
      console.log("Copied default extract prompt to", promptDest);
      return;
    }
  }
  fs.writeFileSync(
    promptDest,
    "Extrahiere Vokabeln als JSON-Array mit hebrew, transliteration, german.\n\n{{messages}}\n",
    "utf8",
  );
  console.log("Wrote fallback extract prompt to", promptDest);
}

async function backfillLearnedOn() {
  if (fs.existsSync(marker)) return;
  const prisma = new PrismaClient();
  try {
    await prisma.$executeRawUnsafe(`UPDATE Vocable SET learnedOn = createdAt`);
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(marker, new Date().toISOString(), "utf8");
    console.log("Backfilled learnedOn from createdAt");
  } catch (err) {
    console.warn("learnedOn backfill skipped:", err.message || err);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  ensurePrompt();
  await backfillLearnedOn();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
