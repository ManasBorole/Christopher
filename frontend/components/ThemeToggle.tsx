"use client";

import { useEffect, useState } from "react";

type Choice = "light" | "dark" | "system";
const KEY = "chr-theme";
const LABELS: Record<Choice, string> = { light: "Light", dark: "Dark", system: "Auto" };

// Light / Dark / Auto. "Auto" clears the override so prefers-color-scheme decides.
// The saved value is applied before paint by the boot script in app/layout.tsx.
export default function ThemeToggle() {
  const [choice, setChoice] = useState<Choice>("system");

  useEffect(() => {
    try {
      const t = localStorage.getItem(KEY);
      if (t === "light" || t === "dark") setChoice(t);
    } catch {
      /* storage blocked: stay on Auto */
    }
  }, []);

  function pick(c: Choice) {
    setChoice(c);
    const root = document.documentElement;
    if (c === "system") delete root.dataset.theme;
    else root.dataset.theme = c;
    try {
      if (c === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, c);
    } catch {
      /* not persisted, still applied for this visit */
    }
  }

  return (
    <div role="group" aria-label="Colour theme" className="flex gap-0.5 rounded-full p-[3px] shadow-[inset_0_0_0_1.5px_var(--line)]">
      {(Object.keys(LABELS) as Choice[]).map((c) => (
        <button
          key={c}
          type="button"
          aria-pressed={choice === c}
          onClick={() => pick(c)}
          className="rounded-full px-3 py-1 text-sm font-semibold text-muted transition-colors aria-pressed:bg-ink aria-pressed:text-paper"
        >
          {LABELS[c]}
        </button>
      ))}
    </div>
  );
}
