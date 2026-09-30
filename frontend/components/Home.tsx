"use client";

import { useEffect, useMemo, useState } from "react";
import type { CourseCard } from "@vta/shared";

import { listCourses, createCourse, deleteCourse, cachedCourses } from "../lib/api";
import { findLanguage } from "../lib/languages";
import { greeting } from "../lib/greetings";
import { lastChat } from "../lib/lastChat";
import LanguagePicker from "./LanguagePicker";
import DeleteLanguageModal from "./DeleteLanguageModal";
import Mascot from "./Mascot";

// Every language the learner studies, as a luggage tag. Adding one opens the
// picker in a sheet.
export default function Home({
  onOpenCourse,
  onContinue,
  continuing,
}: {
  onOpenCourse: (id: string) => void;
  onContinue: (c: CourseCard) => void;
  continuing: string | null;
}) {
  // Seed from the cache so a revisit (backing out of a course) paints the tags
  // immediately instead of flashing placeholders; still revalidate on mount.
  const [courses, setCourses] = useState<CourseCard[] | null>(() => cachedCourses());
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [addError, setAddError] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<CourseCard | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let alive = true;
    // Always reach a terminal state: a rejected load (backend down, network) must
    // drop to an actionable empty state, never hang on placeholders.
    listCourses()
      .then((c) => alive && setCourses(c))
      .catch(() => alive && setCourses([]));
    return () => {
      alive = false;
    };
  }, []);

  const existing = useMemo(() => new Set((courses ?? []).map((c) => c.language.toLowerCase())), [courses]);

  async function pick(name: string) {
    if (busy) return;
    setBusy(true);
    setAddError(false);
    try {
      const c = await createCourse(name);
      onOpenCourse(c.id);
    } catch {
      setAddError(true);
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    const id = pendingDelete.id;
    const ok = await deleteCourse(id);
    if (ok) setCourses((cs) => (cs ?? []).filter((c) => c.id !== id));
    setDeleting(false);
    setPendingDelete(null);
  }

  const empty = courses !== null && courses.length === 0;

  return (
    <section className="mx-auto max-w-5xl px-4 pb-20 pt-8 sm:px-6 sm:pt-12">
      {courses === null ? (
        <ul className="grid gap-x-6 gap-y-4 pt-[88px] sm:grid-cols-2 lg:grid-cols-3" aria-busy aria-label="Loading your languages">
          {[0, 1, 2].map((i) => (
            <li key={i} className="tag-slot" aria-hidden>
              <div className="tag-hang">
                <div className="tag animate-pulse" />
              </div>
            </li>
          ))}
        </ul>
      ) : empty ? (
        <div className="flex flex-col items-start gap-8 sm:flex-row sm:items-center">
          <Mascot pose="empty" className="w-40 shrink-0 sm:w-52" priority />
          <div>
            <h1 className="font-display text-[clamp(2rem,5vw,3.2rem)] font-extrabold leading-[1.05] tracking-[-0.025em] text-balance">
              Which language do you want to speak?
            </h1>
            <p className="mt-3 max-w-[44ch] text-lg text-muted">
              Pick one and Christopher starts the first conversation. You can add more later.
            </p>
            <button type="button" onClick={() => setAdding(true)} className="btn mt-6">
              Choose a language
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-[clamp(2rem,5vw,3.2rem)] font-extrabold leading-[1.05] tracking-[-0.025em]">
                Your languages
              </h1>
              <p className="mt-2 text-muted">Each one keeps its own words and conversations.</p>
            </div>
            <button type="button" onClick={() => setAdding(true)} className="btn-quiet">
              Add a language
            </button>
          </div>

          <ul className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c, i) => (
              <Tag
                key={c.id}
                c={c}
                index={i}
                busy={continuing === c.id}
                onOpen={() => onOpenCourse(c.id)}
                onContinue={() => onContinue(c)}
                onDelete={() => setPendingDelete(c)}
              />
            ))}
          </ul>
        </>
      )}

      {adding && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-title"
          className="sheet-backdrop"
          onMouseDown={(e) => e.target === e.currentTarget && !busy && setAdding(false)}
        >
          <div className="sheet">
            <h2 id="add-title" className="mb-4 font-display text-2xl font-extrabold tracking-[-0.02em]">
              Add a language
            </h2>
            <LanguagePicker existing={existing} busy={busy} onPick={pick} onCancel={() => !busy && setAdding(false)} />
            {busy && (
              <p role="status" className="mt-3 text-sm text-muted">
                Setting it up…
              </p>
            )}
            {addError && (
              <p role="alert" className="mt-3 text-sm text-alert-ink">
                Couldn&apos;t add that language. Check your connection and pick it again.
              </p>
            )}
          </div>
        </div>
      )}

      {pendingDelete && (
        <DeleteLanguageModal
          language={pendingDelete.language}
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => !deleting && setPendingDelete(null)}
        />
      )}
    </section>
  );
}

function Tag({
  c,
  index,
  busy,
  onOpen,
  onContinue,
  onDelete,
}: {
  c: CourseCard;
  index: number;
  busy: boolean;
  onOpen: () => void;
  onContinue: () => void;
  onDelete: () => void;
}) {
  const l = findLanguage(c.language);
  const hello = greeting(l?.code);
  const started = c.sessionCount > 0;
  const shown = Math.min(c.vocabCount, 5);
  return (
    <li className="tag-slot" style={{ ["--i" as string]: index }}>
      <div className="tag-hang">
        <div className="tag">
          {/* full-tag open target sits under the delete button */}
          <button type="button" onClick={onOpen} aria-label={`Open ${c.language}`} className="tag-open absolute inset-0 z-[1]" />
          <div className="pointer-events-none relative z-[2] flex flex-1 flex-col">
            <p lang={l?.code} dir={l?.rtl ? "rtl" : undefined} className="pr-20 font-display text-[34px] font-extrabold leading-[1.05] tracking-[-0.02em]">
              {l?.native ?? c.language}
            </p>
            {l && l.native !== c.language && <p className="mt-1 text-sm text-muted">{c.language}</p>}
            {hello && (
              <p lang={l?.code} dir={l?.rtl ? "rtl" : undefined} className="mt-3 font-hand text-[22px] leading-none text-tutor">
                {hello}
              </p>
            )}

            <div className="mt-auto pt-5">
              {c.vocabCount > 0 ? (
                <div className="flex items-center gap-2.5">
                  <span className="flex gap-1.5" aria-hidden>
                    {Array.from({ length: shown }, (_, k) => (
                      <span key={k} className="word-stamp" />
                    ))}
                  </span>
                  <span className="text-sm text-muted">
                    {c.vocabCount} {c.vocabCount === 1 ? "word" : "words"} collected
                  </span>
                </div>
              ) : (
                <p className="text-sm text-muted">{started ? "No words collected yet." : `Not started yet. Say ${hello ?? "hello"}.`}</p>
              )}
              <button
                type="button"
                onClick={onContinue}
                disabled={busy}
                className="btn pointer-events-auto mt-4 px-4 py-2.5 text-[15px]"
              >
                {busy ? "Opening…" : started ? `Continue in ${c.language}` : `Start in ${c.language}`}
              </button>
            </div>
          </div>

          {started && (
            <p className="postmark pointer-events-none z-[2]">
              Last chat
              <br />
              {lastChat(c.updatedAt)}
            </p>
          )}

          <button
            type="button"
            onClick={onDelete}
            aria-label={`Remove ${c.language}`}
            className="absolute bottom-4 right-3 z-[3] grid h-9 w-9 place-items-center rounded-full text-muted transition-colors hover:bg-card-2 hover:text-ink"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      </div>
    </li>
  );
}
