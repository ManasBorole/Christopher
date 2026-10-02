"use client";

import { useState } from "react";

// The starting answers, the stage each maps to, and how Christopher then talks.
const choices = (language: string) => [
  { stage: 1, answer: "None", hint: "Christopher speaks mostly English" },
  { stage: 2, answer: "A few words", hint: `Christopher mixes English and ${language}` },
  { stage: 3, answer: "I can chat a little", hint: `Christopher speaks mostly ${language}` },
  { stage: 4, answer: "I am fluent", hint: `Christopher speaks only ${language}` },
];

// Asked once per language: how much the learner already knows, so Christopher
// starts at the right stage. One tap answers; skipping leaves the stage unknown.
export default function LevelQuestion({
  language,
  titleId,
  busy,
  onAnswer,
  onBack,
}: {
  language: string;
  titleId: string;
  busy?: boolean;
  onAnswer: (stage: number | null) => void;
  onBack?: () => void;
}) {
  const [chosen, setChosen] = useState<number | null>(null);

  function answer(stage: number | null) {
    if (busy) return;
    setChosen(stage);
    onAnswer(stage);
  }

  return (
    <div
      className="flex flex-col gap-4"
      onKeyDown={(e) => {
        if (e.key === "Escape" && onBack && !busy) {
          e.preventDefault();
          onBack();
        }
      }}
    >
      <div>
        <h2 id={titleId} className="font-display text-2xl font-extrabold tracking-[-0.02em] text-balance">
          How much {language} do you know?
        </h2>
        <p className="mt-1 text-muted">So Christopher starts at your level. You can change it in any conversation.</p>
      </div>

      <div role="group" aria-labelledby={titleId} className="grid gap-2.5">
        {choices(language).map((c, i) => (
          <button
            key={c.stage}
            type="button"
            autoFocus={i === 0}
            disabled={busy}
            aria-pressed={chosen === c.stage}
            onClick={() => answer(c.stage)}
            className="flex flex-col items-start rounded-xl bg-paper px-4 py-3 text-left shadow-[inset_0_0_0_1.5px_var(--line)] transition-shadow enabled:hover:shadow-[inset_0_0_0_1.5px_var(--ink)] disabled:cursor-not-allowed aria-pressed:shadow-[inset_0_0_0_2px_var(--tutor)] [&:disabled:not([aria-pressed=true])]:opacity-55"
          >
            <span className="font-display text-lg font-bold">{c.answer}</span>
            <span className="text-sm text-muted">{c.hint}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {onBack && (
          <button type="button" onClick={onBack} disabled={busy} className="btn-quiet">
            Back
          </button>
        )}
        <button type="button" onClick={() => answer(null)} disabled={busy} className="text-sm font-semibold text-muted underline-offset-4 hover:text-ink hover:underline">
          Not sure? Skip
        </button>
      </div>
    </div>
  );
}
