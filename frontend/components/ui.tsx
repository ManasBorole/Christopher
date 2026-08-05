"use client";

import type { Summary } from "@vta/shared";

export function MicIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  );
}

export function Dots() {
  return (
    <span className="flex gap-1">
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-2 w-2 rounded-full bg-[#05140d]" style={{ animation: `float .9s ${i * 0.15}s ease-in-out infinite` }} />
      ))}
    </span>
  );
}

export function Bubble({ role, text, faint }: { role: "user" | "agent"; text: string; faint?: boolean }) {
  const mine = role === "user";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"} animate-fadeup`}>
      <div
        className={`max-w-[82%] rounded-2xl px-4 py-2 text-sm ${faint ? "opacity-60" : ""}`}
        style={
          mine
            ? { background: "linear-gradient(120deg,var(--c1),var(--c2))", color: "#05140d" }
            : { background: "var(--glass-strong)", border: "1px solid var(--line)" }
        }
      >
        {text}
      </div>
    </div>
  );
}

export function SummaryCard({ summary: sum }: { summary: Summary }) {
  return (
    <section className="glass w-full space-y-3 rounded-3xl p-6 animate-fadeup">
      <h2 className="font-display text-lg font-semibold">
        Lesson summary{sum.language ? ` · ${sum.language}` : ""}
      </h2>
      {sum.vocabulary.length > 0 && (
        <div>
          <h3 className="mb-1 text-xs uppercase tracking-wider text-[var(--muted)]">Vocabulary</h3>
          <ul className="space-y-0.5 text-sm">
            {sum.vocabulary.map((v, i) => (
              <li key={i}>
                <span className="font-medium">{v.term}</span>
                <span className="text-[var(--muted)]"> - {v.translation}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <SumList title="Watch out for" items={sum.mistakes} />
      <SumList title="Grammar tips" items={sum.grammarTips} />
      {sum.nextLesson && (
        <div>
          <h3 className="mb-1 text-xs uppercase tracking-wider text-[var(--muted)]">Next lesson</h3>
          <p className="text-sm">{sum.nextLesson}</p>
        </div>
      )}
    </section>
  );
}

function SumList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <h3 className="mb-1 text-xs uppercase tracking-wider text-[var(--muted)]">{title}</h3>
      <ul className="list-inside list-disc space-y-0.5 text-sm">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}

// Flag emoji for a language name (falls back to a book).
export function langFlag(language: string): string {
  const m: Record<string, string> = {
    spanish: "🇪🇸", french: "🇫🇷", german: "🇩🇪", italian: "🇮🇹", portuguese: "🇧🇷",
    english: "🇬🇧", japanese: "🇯🇵", hindi: "🇮🇳", mandarin: "🇨🇳", chinese: "🇨🇳",
    korean: "🇰🇷", arabic: "🇸🇦", russian: "🇷🇺", dutch: "🇳🇱", turkish: "🇹🇷",
    mongolian: "🇲🇳", polish: "🇵🇱", swedish: "🇸🇪", greek: "🇬🇷", hebrew: "🇮🇱",
  };
  return m[language.toLowerCase()] ?? "📘";
}

// "3h ago" style relative time.
export function timeAgo(iso: string): string {
  const d = Date.now() - new Date(iso).getTime();
  const min = Math.floor(d / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
}
