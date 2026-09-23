"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { allLanguages, searchLanguages, type Language } from "../lib/languages";

// Searchable, keyboard-accessible language selector. Users can only pick a real
// language from the list -- arbitrary text never becomes a selection. Languages
// already in `existing` (lowercased English names) stay visible but can't be
// picked twice. No flags: languages aren't countries.
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

  const results = useMemo(() => searchLanguages(langs, query).slice(0, 80), [langs, query]);

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
    <div className="flex flex-col gap-3">
      <label htmlFor="lang-search" className="text-sm text-muted">
        Search in English or type it the way you&apos;d write it
      </label>
      <input
        id="lang-search"
        autoFocus
        role="combobox"
        aria-expanded={results.length > 0}
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
        placeholder="Try “marathi”, “日本”, or “arab”"
        autoComplete="off"
        className="w-full rounded-xl border-[1.5px] border-line bg-paper px-4 py-3 text-base text-ink placeholder:text-muted"
      />

      <ul
        ref={listRef}
        id={listboxId}
        role="listbox"
        aria-label="Languages"
        className="max-h-[min(22rem,50vh)] overflow-y-auto overscroll-contain rounded-xl bg-paper p-1"
      >
        {results.length === 0 ? (
          <li className="px-3 py-3 text-sm text-muted">
            Nothing called “{query.trim()}” yet. Try its English name, like “Japanese”.
          </li>
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
                className={`flex cursor-pointer items-baseline gap-3 rounded-lg px-3 py-2.5 ${
                  i === active ? "bg-card shadow-[inset_0_0_0_1.5px_var(--ink)]" : ""
                } ${owned ? "opacity-50" : ""}`}
              >
                <span lang={l.code} dir={l.rtl ? "rtl" : "ltr"} className="font-display text-lg font-bold">
                  {l.native}
                </span>
                {l.native !== l.name && <span className="text-sm text-muted">{l.name}</span>}
                {owned && <span className="ml-auto text-xs font-semibold text-muted">Already learning</span>}
              </li>
            );
          })
        )}
      </ul>

      {dupe && (
        <p role="status" className="text-sm text-alert-ink">
          You&apos;re already learning {dupe}. Open it from your languages instead.
        </p>
      )}

      <button type="button" onClick={onCancel} className="btn-quiet self-start">
        Cancel
      </button>
    </div>
  );
}
