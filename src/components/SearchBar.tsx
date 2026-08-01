"use client";

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export function SearchBar({ value, onChange }: Props) {
  return (
    <label className="search-bar">
      <span className="sr-only">Suche</span>
      <input
        type="search"
        placeholder="Suche…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
      />
    </label>
  );
}
