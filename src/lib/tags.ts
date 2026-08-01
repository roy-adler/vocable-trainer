import { prisma } from "@/lib/prisma";

export async function resolveTagIds(
  tagIds: string[],
  newTags: string[],
): Promise<string[]> {
  const ids = new Set(tagIds);
  for (const name of newTags) {
    const normalized = name.trim();
    if (!normalized) continue;
    const existing = await prisma.tag.findFirst({
      where: { name: { equals: normalized } },
    });
    if (existing) {
      ids.add(existing.id);
    } else {
      const created = await prisma.tag.create({ data: { name: normalized } });
      ids.add(created.id);
    }
  }
  return [...ids];
}
