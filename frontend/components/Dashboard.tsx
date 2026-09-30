"use client";

import { useEffect, useState } from "react";
import type { CourseDetail, SessionMeta } from "@vta/shared";
import { getCourse, startSession } from "../lib/api";
import { findLanguage } from "../lib/languages";
import { timeAgo, SummaryCard } from "./ui";
import Mascot from "./Mascot";

const PREVIEW_WORDS = 24;

export default function Dashboard({
  courseId,
  onBack,
  onStartSession,
}: {
  courseId: string;
  onBack: () => void;
  onStartSession: (sessionId: string, language: string, userName: string) => void;
}) {
  // undefined = loading, null = failed to load
  const [c, setC] = useState<CourseDetail | null | undefined>(undefined);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState(false);
  const [wordsOpen, setWordsOpen] = useState(false);

  function load() {
    setC(undefined);
    getCourse(courseId)
      .then(setC)
      .catch(() => setC(null));
  }
  useEffect(load, [courseId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function begin() {
    if (!c || starting) return;
    setStarting(true);
    setStartError(false);
    try {
      const sid = await startSession(courseId);
      onStartSession(sid, c.language, c.userName);
    } catch {
      setStartError(true);
    } finally {
      setStarting(false);
    }
  }

  const back = (
    <button type="button" onClick={onBack} className="mb-8 text-[15px] font-semibold text-muted hover:text-ink">
      <span aria-hidden>‹ </span>Your languages
    </button>
  );

  if (c === undefined) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6" aria-busy>
        {back}
        <div className="h-12 w-48 animate-pulse rounded-xl bg-card-2" />
        <div className="mt-4 h-5 w-72 animate-pulse rounded-lg bg-card-2" />
      </div>
    );
  }

  if (c === null) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        {back}
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
          <Mascot pose="reconnecting" className="w-36 shrink-0" />
          <div>
            <h1 className="font-display text-3xl font-extrabold tracking-[-0.02em]">This language didn&apos;t load</h1>
            <p className="mt-2 max-w-[44ch] text-muted">Christopher couldn&apos;t reach your progress. Check your connection, then try again.</p>
            <button type="button" onClick={load} className="btn mt-5">
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const l = findLanguage(c.language);
  const completed = c.sessions.filter((s) => s.endedAt).length;
  const last = c.sessions[0] ? `last spoke ${timeAgo(c.sessions[0].startedAt)}` : "no conversations yet";
  const words = c.vocabulary;

  return (
    <div className="mx-auto max-w-4xl px-4 pb-20 pt-10 sm:px-6">
      {back}

      <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 lang={l?.code} dir={l?.rtl ? "rtl" : undefined} className="font-display text-[clamp(2.75rem,8vw,4.5rem)] font-extrabold leading-none tracking-[-0.03em]">
            {l?.native ?? c.language}
          </h1>
          <p className="mt-3 text-muted">
            {l && l.native !== c.language ? `${c.language}. ` : ""}
            {words.length} {words.length === 1 ? "word" : "words"}, {completed} {completed === 1 ? "conversation" : "conversations"}, {last}.
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <button type="button" onClick={begin} disabled={starting} className="btn text-[17px]">
            {starting ? "Opening…" : `Start talking in ${c.language}`}
          </button>
          <p className="text-sm text-muted">Christopher remembers where you left off.</p>
          {startError && (
            <p role="alert" className="text-sm text-alert-ink">
              Couldn&apos;t start a conversation. Check your connection and try again.
            </p>
          )}
        </div>
      </header>

      <section aria-labelledby="words-h" className="mt-14">
        <h2 id="words-h" className="font-display text-2xl font-extrabold tracking-[-0.02em]">
          Words you&apos;ve used
        </h2>
        {words.length === 0 ? (
          <p className="mt-2 text-muted">None yet. They collect here as you talk.</p>
        ) : (
          <>
            <ul lang={l?.code} className="mt-4 flex flex-wrap gap-2">
              {words.slice(0, PREVIEW_WORDS).map((w) => (
                <li key={w} className="rounded-[4px] border-[1.5px] border-dashed border-tutor bg-card px-2.5 py-1 text-[15px]">
                  {w}
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => setWordsOpen(true)} className="btn-quiet mt-4 text-[15px]">
              {words.length > PREVIEW_WORDS ? `See all ${words.length} words with meanings` : "See meanings"}
            </button>
          </>
        )}
      </section>

      <section aria-labelledby="hist-h" className="mt-14">
        <h2 id="hist-h" className="font-display text-2xl font-extrabold tracking-[-0.02em]">
          Your postcards
        </h2>
        {c.sessions.length === 0 ? (
          <p className="mt-2 text-muted">After each conversation, a postcard with what you practised lands here.</p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {c.sessions.map((s) => (
              <SessionRow key={s.id} s={s} />
            ))}
          </ul>
        )}
      </section>

      {wordsOpen && (
        <WordsDialog language={c.language} code={l?.code} words={words} meanings={c.meanings} notes={c.pronunciationNotes} onClose={() => setWordsOpen(false)} />
      )}
    </div>
  );
}

function WordsDialog({
  language,
  code,
  words,
  meanings,
  notes,
  onClose,
}: {
  language: string;
  code?: string;
  words: string[];
  meanings: Record<string, string>;
  notes: string[];
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="words-title"
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      className="sheet-backdrop"
    >
      <div className="sheet">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 id="words-title" className="font-display text-2xl font-extrabold tracking-[-0.02em]">
            Your {language} words
          </h2>
          <button type="button" autoFocus onClick={onClose} className="btn-quiet px-4 py-2 text-sm">
            Close
          </button>
        </div>
        <ul className="grid gap-1.5">
          {words.map((w) => (
            <li key={w} className="flex items-baseline justify-between gap-4 border-b border-line py-2 last:border-0">
              <span lang={code} className="font-semibold">
                {w}
              </span>
              {meanings[w] && <span className="text-right text-muted">{meanings[w]}</span>}
            </li>
          ))}
        </ul>
        {notes.length > 0 && (
          <div className="mt-6">
            <h3 className="font-display text-lg font-bold">To practise again</h3>
            <ul className="mt-2 grid gap-1.5 text-[15px] text-muted">
              {notes.slice(0, 20).map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function SessionRow({ s }: { s: SessionMeta }) {
  const [open, setOpen] = useState(false);
  const date = new Date(s.startedAt).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const turns = `${s.turnCount} ${s.turnCount === 1 ? "turn" : "turns"}`;
  return (
    <li className="rounded-2xl bg-card shadow-[0_1px_0_rgb(var(--shadow)/0.05),0_10px_20px_-16px_rgb(var(--shadow)/0.5)]">
      <button
        type="button"
        onClick={() => s.summary && setOpen((o) => !o)}
        aria-expanded={s.summary ? open : undefined}
        disabled={!s.summary}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left disabled:cursor-default"
      >
        <span>
          <span className="block font-semibold">{date}</span>
          <span className="text-sm text-muted">{s.summary ? `${turns}. Postcard saved.` : `${turns}. No postcard for this one.`}</span>
        </span>
        {s.summary && (
          <span className="text-sm font-semibold text-tutor">{open ? "Hide" : "Read"}</span>
        )}
      </button>
      {open && s.summary && (
        <div className="px-3 pb-3">
          <SummaryCard summary={s.summary} />
        </div>
      )}
    </li>
  );
}
