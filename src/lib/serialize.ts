import { toDateKey } from "./dates";

type VocableRecord = {
  id: string;
  hebrew: string;
  transliteration: string;
  german: string;
  exampleSentence: string;
  notes: string;
  learnedOn: Date;
  createdAt: Date;
  updatedAt: Date;
  tags: { tag: { id: string; name: string } }[];
};

export function serializeVocable(vocable: VocableRecord | null) {
  if (!vocable) return null;
  return {
    id: vocable.id,
    hebrew: vocable.hebrew,
    transliteration: vocable.transliteration,
    german: vocable.german,
    exampleSentence: vocable.exampleSentence,
    notes: vocable.notes,
    learnedOn: toDateKey(vocable.learnedOn, "UTC"),
    createdAt: vocable.createdAt.toISOString(),
    updatedAt: vocable.updatedAt.toISOString(),
    tags: vocable.tags.map((t) => t.tag),
  };
}

export const vocableInclude = {
  tags: { include: { tag: true } },
} as const;
