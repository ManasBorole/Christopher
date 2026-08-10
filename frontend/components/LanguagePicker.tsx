"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { allLanguages, type Language } from "../lib/languages";
import { LangFlag } from "./ui";

// Searchable, keyboard-accessible language selector. Users can only pick a real
// language from the list -- arbitrary text never becomes a selection. Languages
// already in `existing` (lowercased names) are shown as disabled with a note so
// duplicate cards can't be created.
export default function LanguagePicker({
  existing,
  busy,
  onPick,
  onCancel,
}: {
  existing: Set<string>;
  busy?: boolean;
  onPick: (name: string) => void;
  onCancel: () => void;
}) {
  const langs = useMemo(() => allLanguages(), []);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [dupe, setDupe] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q ? langs.filter((l) => l.name.toLowerCase().includes(q)) : langs;
    // Prefix matches first, then the rest -- feels like real autocomplete.
    if (!q) return base.slice(0, 60);
    const starts = base.filter((l) => l.name.toLowerCase().startsWith(q));
    const rest = base.filter((l) => !l.name.toLowerCase().startsWith(q));
    return [...starts, ...rest].slice(0, 60);
  }, [langs, query]);

  useEffect(() => setActive(0), [query]);

  // Keep the active option scrolled into view during keyboard nav.
  useEffect(() => {
    const el = listRef.current?.children[active] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function choose(l: Language) {
    if (existing.has(l.name.toLowerCase())) {
      setDupe(l.name);
      return;
    }
    onPick(l.name);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const l = results[active];
      if (l) choose(l);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  }

  const listboxId = "lang-listbox";

  return (
    <div className="flex flex-col gap-2">
      <input
        autoFocus
        role="combobox"
        aria-expanded="true"
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={results[active] ? `lang-opt-${results[active].code}` : undefined}
        value={query}
        disabled={busy}
        onChange={(e) => {
          setQuery(e.target.value);
          setDupe(null);
        }}
        onKeyDown={onKeyDown}
        placeholder="Search a language…"
        className="w-full rounded-xl border border-[var(--line)] bg-white/[0.04] px-3 py-2 text-sm outline-none focus:border-emerald-400/50"
      />

      <ul
        ref={listRef}
        id={listboxId}
        role="listbox"
        aria-label="Languages"
        className="max-h-48 overflow-y-auto rounded-xl border border-[var(--line)] bg-black/20"
      >
        {results.length === 0 ? (
          <li className="px-3 py-2 text-sm text-[var(--muted)]">No languages match.</li>
        ) : (
          results.map((l, i) => {
            const owned = existing.has(l.name.toLowerCase());
            return (
              <li
                key={l.code}
                id={`lang-opt-${l.code}`}
                role="option"
                aria-selected={i === active}
                aria-disabled={owned}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault(); // keep input focus
                  choose(l);
                }}
                className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm transition ${
                  i === active ? "bg-emerald-400/15" : ""
                } ${owned ? "opacity-45" : ""}`}
              >
                <LangFlag language={l.name} className="w-6 rounded-sm" />
                <span>{l.name}</span>
                {owned && <span className="ml-auto text-xs text-[var(--muted)]">Added</span>}
              </li>
            );
          })
        )}
      </ul>

      {dupe && (
        <p role="status" className="text-xs text-amber-300/90">
          You&apos;re already learning {dupe}.
        </p>
      )}

      <button onClick={onCancel} className="btn-ghost py-1.5 text-sm">
        Cancel
      </button>
    </div>
  );
}
