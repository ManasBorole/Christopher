"use client";

import type { Summary } from "@vta/shared";
import { findLanguage } from "../lib/languages";

// A session summary as a postcard: the words used as stamps, what to watch,
// and one thing to try next time. No scores.
export function SummaryCard({ summary: sum }: { summary: Summary }) {
  const l = sum.language ? findLanguage(sum.language) : undefined;
  return (
    <article className="sticker w-full p-5 sm:p-6">
      <p className="font-hand text-xl text-muted">Greetings from</p>
      <h2 className="font-display text-2xl font-extrabold tracking-[-0.02em] text-tutor">{sum.language || "your conversation"}</h2>

      {sum.vocabulary.length > 0 && (
        <section className="mt-4">
          <h3 className="text-sm font-semibold text-muted">Words you used</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {sum.vocabulary.map((v, i) => (
              <li key={i} className="rounded-[4px] border-[1.5px] border-dashed border-tutor px-2.5 py-1 text-[15px]">
                <span lang={l?.code} className="font-semibold">
                  {v.term}
                </span>
                {v.translation && <span className="text-muted"> {v.translation}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
      <SumList title="Worth another try" items={sum.mistakes} />
      <SumList title="Grammar notes" items={sum.grammarTips} />
      {sum.nextLesson && (
        <section className="mt-4">
          <h3 className="text-sm font-semibold text-muted">Next time</h3>
          <p className="mt-1">{sum.nextLesson}</p>
        </section>
      )}
    </article>
  );
}

function SumList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <section className="mt-4">
      <h3 className="text-sm font-semibold text-muted">{title}</h3>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-[15px]">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </section>
  );
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
