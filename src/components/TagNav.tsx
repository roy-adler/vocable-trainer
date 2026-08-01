"use client";

import type { Tag } from "@/lib/types";

type Props = {
  tags: Tag[];
  selectedTagId: string | null;
  onSelect: (tagId: string | null) => void;
  onCreateTag: (name: string) => Promise<void>;
  variant: "chips" | "sidebar";
};

export function TagNav({
  tags,
  selectedTagId,
  onSelect,
  onCreateTag,
  variant,
}: Props) {
  async function handleNewTag() {
    const name = window.prompt("Neuer Tag-Name:");
    if (!name?.trim()) return;
    await onCreateTag(name.trim());
  }

  if (variant === "sidebar") {
    return (
      <aside className="tag-sidebar">
        <div className="tag-sidebar-title">Tags</div>
        <button
          type="button"
          className={`tag-item ${selectedTagId === null ? "active" : ""}`}
          onClick={() => onSelect(null)}
        >
          Alle
        </button>
        {tags.map((tag) => (
          <button
            key={tag.id}
            type="button"
            className={`tag-item ${selectedTagId === tag.id ? "active" : ""}`}
            onClick={() => onSelect(tag.id)}
          >
            {tag.name}
          </button>
        ))}
        <button type="button" className="tag-item muted" onClick={handleNewTag}>
          + neuer Tag
        </button>
      </aside>
    );
  }

  return (
    <div className="tag-chips" role="list">
      <button
        type="button"
        className={`chip ${selectedTagId === null ? "active" : ""}`}
        onClick={() => onSelect(null)}
      >
        Alle
      </button>
      {tags.map((tag) => (
        <button
          key={tag.id}
          type="button"
          className={`chip ${selectedTagId === tag.id ? "active" : ""}`}
          onClick={() => onSelect(tag.id)}
        >
          {tag.name}
        </button>
      ))}
      <button type="button" className="chip muted" onClick={handleNewTag}>
        + Tag
      </button>
    </div>
  );
}
