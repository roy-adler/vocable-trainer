export type Tag = {
  id: string;
  name: string;
};

export type Vocable = {
  id: string;
  hebrew: string;
  transliteration: string;
  german: string;
  exampleSentence: string;
  notes: string;
  learnedOn: string;
  createdAt: string;
  updatedAt: string;
  tags: Tag[];
};
