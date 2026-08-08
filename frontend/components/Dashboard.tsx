"use client";

import { useEffect, useState } from "react";
import type { CourseDetail, SessionMeta } from "@vta/shared";
import { getCourse, startSession } from "../lib/api";
import { langFlag, timeAgo, SummaryCard } from "./ui";

export default function Dashboard({
  courseId,
  onBack,
  onStartSession,
}: {
  courseId: string;
  onBack: () => void;
  onStartSession: (sessionId: string, language: string, userName: string) => void;
}) {
  const [c, setC] = useState<CourseDetail | null>(null);
  const [starting, setStarting] = useState(false);
  const [wordsOpen, setWordsOpen] = useState(false);

  useEffect(() => {
    getCourse(courseId).then(setC);
  }, [courseId]);

  async function begin() {
    if (!c || starting) return;
    setStarting(true);
    try {
      const sid = await startSession(courseId);
      onStartSession(sid, c.language, c.userName);
    } finally {
      setStarting(false);
    }
  }

  if (!c) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-14">
        <div className="glass h-40 animate-pulse rounded-3xl" />
      </div>
    );
  }

  const completed = c.sessions.filter((s) => s.endedAt).length;

  return (
    <div className="mx-auto max-w-4xl px-6 py-12 animate-fadeup">
      <button onClick={onBack} className="btn-ghost mb-8 px-4 py-1.5 text-sm">
        &larr; All languages
      </button>

      {/* header */}
      <div className="mb-8 flex items-center gap-5">
        <div className="text-6xl">{langFlag(c.language)}</div>
        <div>
          <h1 className="font-display text-4xl font-semibold tracking-tight">{c.language}</h1>
          {c.userName && <p className="mt-1 text-sm text-[var(--muted)]">{c.userName}</p>}
        </div>
      </div>

      {/* continue CTA */}
      <div className="glass mb-8 flex flex-col items-start gap-4 rounded-3xl p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold">Continue learning</h2>
          <p className="text-sm text-[var(--muted)]">Starts a fresh conversation - your tutor remembers your progress.</p>
        </div>
        <button onClick={begin} disabled={starting} className="btn-primary shrink-0 disabled:opacity-50">
          {starting ? "Starting..." : "Start a session"}
        </button>
      </div>

      {/* progress stats */}
      <div className="mb-8 grid grid-cols-3 gap-4">
        <Stat label="Sessions" value={completed} />
        <Stat label="Words learned" value={c.vocabulary.length} />
        <Stat label="Last active" value={c.sessions[0] ? timeAgo(c.sessions[0].startedAt) : "-"} small />
      </div>

      {/* learned words - opened in a dialog, not shown inline */}
      <Panel title="Learned words">
        <div className="flex items-center justify-between">
          <p className="text-sm text-[var(--muted)]">
            {c.vocabulary.length === 0
              ? "No words yet - start a session to begin."
              : `${c.vocabulary.length} words${c.pronunciationNotes.length ? ` · ${c.pronunciationNotes.length} notes` : ""}`}
          </p>
          {c.vocabulary.length > 0 && (
            <button onClick={() => setWordsOpen(true)} className="btn-ghost px-4 py-1.5 text-sm">
              View words
            </button>
          )}
        </div>
      </Panel>

      {/* session summaries */}
      <Panel title="Session history">
        {c.sessions.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No sessions yet.</p>
        ) : (
          <div className="space-y-3">
            {c.sessions.map((s) => (
              <SessionRow key={s.id} s={s} />
            ))}
          </div>
        )}
      </Panel>

      {wordsOpen && (
        <WordsDialog
          language={c.language}
          words={c.vocabulary}
          meanings={c.meanings}
          notes={c.pronunciationNotes}
          onClose={() => setWordsOpen(false)}
        />
      )}
    </div>
  );
}

function WordsDialog({
  language,
  words,
  meanings,
  notes,
  onClose,
}: {
  language: string;
  words: string[];
  meanings: Record<string, string>;
  notes: string[];
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 grid place-items-center p-4"
      style={{ background: "rgba(4,5,10,.6)", backdropFilter: "blur(14px)", animation: "fadeIn .3s both" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass max-h-[80vh] w-full max-w-md overflow-y-auto rounded-[28px] p-7 animate-scalein"
        style={{ boxShadow: "0 40px 120px -30px rgba(0,0,0,.8)" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">{language} words</h2>
          <button onClick={onClose} className="text-[var(--muted)] hover:text-[var(--fg)]" aria-label="Close">
            ✕
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {words.map((w) => (
            <span key={w} className="glass rounded-full px-3 py-1 text-sm">
              {w}
              {meanings[w] && <span className="text-[var(--muted)]"> — {meanings[w]}</span>}
            </span>
          ))}
        </div>
        {notes.length > 0 && (
          <div className="mt-5">
            <h3 className="mb-1 text-xs uppercase tracking-wider text-[var(--muted)]">Notes to revise</h3>
            <ul className="list-inside list-disc space-y-0.5 text-sm text-[var(--muted)]">
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
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-white/[0.02]">
      <button
        onClick={() => s.summary && setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div>
          <p className="text-sm font-medium">{date}</p>
          <p className="text-xs text-[var(--muted)]">
            {s.turnCount} turns {s.hasSummary ? "· summary saved" : "· no summary"}
          </p>
        </div>
        {s.summary && <span className="text-[var(--muted)]">{open ? "−" : "+"}</span>}
      </button>
      {open && s.summary && (
        <div className="border-t border-[var(--line)] p-4">
          <SummaryCard summary={s.summary} />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, small }: { label: string; value: string | number; small?: boolean }) {
  return (
    <div className="glass rounded-2xl p-4 text-center">
      <div className={`font-display font-bold ${small ? "text-lg" : "text-3xl"} gradient-text`}>{value}</div>
      <div className="mt-1 text-xs text-[var(--muted)]">{label}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="glass mb-6 rounded-3xl p-6">
      <h3 className="mb-4 font-display text-lg font-semibold">{title}</h3>
      {children}
    </section>
  );
}
