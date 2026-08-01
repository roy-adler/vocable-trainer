const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const samples = [
  {
    hebrew: "שלום",
    transliteration: "shalom",
    german: "Hallo / Frieden",
    exampleSentence: "שלום, מה שלומך?",
    notes: "Häufige Begrüßung und Abschied.",
    tags: ["Begrüßung"],
  },
  {
    hebrew: "תודה",
    transliteration: "toda",
    german: "Danke",
    exampleSentence: "תודה רבה!",
    notes: "Höflicher Dank; תודה רבה = vielen Dank.",
    tags: ["Begrüßung"],
  },
  {
    hebrew: "בוקר טוב",
    transliteration: "boker tov",
    german: "Guten Morgen",
    exampleSentence: "בוקר טוב, איך אתה?",
    notes: "Morgengruß.",
    tags: ["Begrüßung"],
  },
  {
    hebrew: "מים",
    transliteration: "majim",
    german: "Wasser",
    exampleSentence: "אני רוצה מים.",
    notes: "Grundwort; Pluralform als Singular verwendet.",
    tags: ["Essen & Trinken"],
  },
  {
    hebrew: "לחם",
    transliteration: "lechem",
    german: "Brot",
    exampleSentence: "יש לך לחם?",
    notes: "Alltagswort.",
    tags: ["Essen & Trinken"],
  },
  {
    hebrew: "לכתוב",
    transliteration: "lichtov",
    german: "schreiben",
    exampleSentence: "אני אוהב לכתוב.",
    notes: "Infinitiv.",
    tags: ["Verben"],
  },
  {
    hebrew: "לקרוא",
    transliteration: "likro",
    german: "lesen",
    exampleSentence: "היא אוהבת לקרוא ספרים.",
    notes: "Infinitiv.",
    tags: ["Verben"],
  },
  {
    hebrew: "ספר",
    transliteration: "sefer",
    german: "Buch",
    exampleSentence: "זה ספר טוב.",
    notes: "Auch: Rolle / Schriftrolle in älteren Texten.",
    tags: ["Alltag"],
  },
];

async function ensureTag(name) {
  const existing = await prisma.tag.findFirst({ where: { name } });
  if (existing) return existing;
  return prisma.tag.create({ data: { name } });
}

async function main() {
  for (const sample of samples) {
    const tags = [];
    for (const name of sample.tags) {
      tags.push(await ensureTag(name));
    }

    const existing = await prisma.vocable.findFirst({
      where: {
        hebrew: sample.hebrew,
        german: sample.german,
      },
    });
    if (existing) {
      console.log("skip (exists):", sample.hebrew);
      continue;
    }

    await prisma.vocable.create({
      data: {
        hebrew: sample.hebrew,
        transliteration: sample.transliteration,
        german: sample.german,
        exampleSentence: sample.exampleSentence,
        notes: sample.notes,
        tags: {
          create: tags.map((t) => ({ tagId: t.id })),
        },
      },
    });
    console.log("added:", sample.hebrew, "·", sample.german);
  }

  const count = await prisma.vocable.count();
  console.log("total vocables:", count);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
