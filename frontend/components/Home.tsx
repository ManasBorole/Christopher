"use client";

import { useEffect, useMemo, useState } from "react";
import type { CourseCard } from "@vta/shared";

import { listCourses, createCourse, deleteCourse, cachedCourses } from "../lib/api";
import { findLanguage } from "../lib/languages";
import { timeAgo } from "./ui";
import LanguagePicker from "./LanguagePicker";
import DeleteLanguageModal from "./DeleteLanguageModal";
import Mascot from "./Mascot";

// Every language the learner studies, as a luggage tag. Adding one opens the
// picker in a sheet.
export default function Home({ onOpenCourse }: { onOpenCourse: (id: string) => void }) {
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
      {empty ? (
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
            <button type="button" onClick={() => setAdding(true)} className="btn-quiet" disabled={courses === null}>
              Add a language
            </button>
          </div>

          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-busy={courses === null}>
            {courses === null
              ? [0, 1, 2].map((i) => (
                  <li key={i} className="tag h-[124px] animate-pulse" aria-hidden />
                ))
              : courses.map((c) => <Tag key={c.id} c={c} onOpen={() => onOpenCourse(c.id)} onDelete={() => setPendingDelete(c)} />)}
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

function Tag({ c, onOpen, onDelete }: { c: CourseCard; onOpen: () => void; onDelete: () => void }) {
  const l = findLanguage(c.language);
  const words = `${c.vocabCount} ${c.vocabCount === 1 ? "word" : "words"}`;
  const talks = `${c.sessionCount} ${c.sessionCount === 1 ? "conversation" : "conversations"}`;
  return (
    <li className="tag">
      {/* full-tag open target sits under the delete button */}
      <button type="button" onClick={onOpen} aria-label={`Open ${c.language}`} className="tag-open absolute inset-0 z-0" />
      <div className="pointer-events-none relative z-10 pr-8">
        <p lang={l?.code} dir={l?.rtl ? "rtl" : undefined} className="font-display text-[28px] font-extrabold leading-tight">
          {l?.native ?? c.language}
        </p>
        {l && l.native !== c.language && <p className="text-sm text-muted">{c.language}</p>}
        <p className="mt-3 text-sm text-muted">
          {words}, {talks}
        </p>
        <p className="text-sm text-muted">Spoke {timeAgo(c.updatedAt)}</p>
      </div>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Remove ${c.language}`}
        className="absolute right-3 top-3 z-20 grid h-9 w-9 place-items-center rounded-full text-muted transition-colors hover:bg-card-2 hover:text-ink"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </li>
  );
}
