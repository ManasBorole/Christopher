"use client";

import { useEffect, useMemo, useState } from "react";
import type { CourseCard } from "@vta/shared";
import { listCourses, createCourse, deleteCourse, cachedCourses } from "../lib/api";
import { langFlag, timeAgo } from "./ui";
import { useReveal } from "../hooks/useReveal";
import LanguagePicker from "./LanguagePicker";
import DeleteLanguageModal from "./DeleteLanguageModal";

export default function Home({ onOpenCourse }: { onOpenCourse: (id: string) => void }) {
  // Seed from the cache so a revisit (backing out of a course) paints the grid
  // immediately instead of flashing skeletons; still revalidate on mount.
  const [courses, setCourses] = useState<CourseCard[] | null>(() => cachedCourses());
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<CourseCard | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let alive = true;
    // Always reach a terminal state: a rejected load (backend down, network) must
    // drop the skeleton to an actionable empty grid, never hang on skeletons.
    listCourses()
      .then((c) => alive && setCourses(c))
      .catch(() => alive && setCourses([]));
    return () => {
      alive = false;
    };
  }, []);
  useReveal([courses]);

  const existing = useMemo(
    () => new Set((courses ?? []).map((c) => c.language.toLowerCase())),
    [courses]
  );

  async function pick(name: string) {
    if (busy) return;
    setBusy(true);
    try {
      const c = await createCourse(name);
      onOpenCourse(c.id);
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
    <section className="mx-auto max-w-5xl px-6 py-14">
      <div className="mb-10 text-center">
        <p className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs text-[var(--muted)] animate-fadeup">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Your languages
        </p>
        <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl animate-fadeup" style={{ animationDelay: ".05s" }}>
          {empty ? (
            <>
              What would you like to <span className="gradient-text">speak?</span>
            </>
          ) : (
            <>
              Pick up where you <span className="gradient-text">left off.</span>
            </>
          )}
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-[var(--muted)] animate-fadeup" style={{ animationDelay: ".12s" }}>
          {empty
            ? "Add a language to start learning through natural conversation."
            : "Each language keeps its own progress, words, and lesson history."}
        </p>
      </div>

      {courses === null ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="glass h-40 animate-pulse rounded-3xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c, i) => (
            <div
              key={c.id}
              className="reveal group relative overflow-hidden rounded-3xl p-6 glass transition-transform duration-300 hover:-translate-y-1"
              style={{ transitionDelay: `${i * 60}ms` }}
            >
              <div
                className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-40 blur-2xl transition group-hover:opacity-70"
                style={{ background: "linear-gradient(140deg,var(--c1),var(--c3))" }}
              />

              {/* full-card open target (sits under the content + delete button) */}
              <button
                onClick={() => onOpenCourse(c.id)}
                aria-label={`Open ${c.language}`}
                className="absolute inset-0 z-0 rounded-3xl"
              />

              {/* delete */}
              <button
                onClick={() => setPendingDelete(c)}
                aria-label={`Delete ${c.language}`}
                className="absolute right-3 top-3 z-20 grid h-8 w-8 place-items-center rounded-full text-[var(--muted)] opacity-0 transition hover:bg-white/10 hover:text-[var(--fg)] focus-visible:opacity-100 group-hover:opacity-100 active:scale-90"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>

              <div className="pointer-events-none relative z-10">
                <div className="mb-4 text-4xl">{langFlag(c.language)}</div>
                <h3 className="font-display text-xl font-semibold">{c.language}</h3>
                {c.userName && <p className="mt-1 text-xs text-[var(--muted)]">{c.userName}</p>}
                <div className="mt-4 flex items-center gap-4 text-xs text-[var(--muted)]">
                  <span>{c.vocabCount} words</span>
                  <span>{c.sessionCount} sessions</span>
                  <span className="ml-auto">{timeAgo(c.updatedAt)}</span>
                </div>
              </div>
            </div>
          ))}

          {/* add language card */}
          <div className="reveal glass flex flex-col justify-center rounded-3xl border-dashed p-6" style={{ borderColor: "var(--line)" }}>
            {adding ? (
              <LanguagePicker
                existing={existing}
                busy={busy}
                onPick={pick}
                onCancel={() => setAdding(false)}
              />
            ) : (
              <button onClick={() => setAdding(true)} className="flex flex-col items-center gap-2 py-4 text-[var(--muted)] transition hover:text-[var(--fg)]">
                <span className="grid h-12 w-12 place-items-center rounded-2xl border border-[var(--line)] text-2xl">+</span>
                <span className="text-sm font-medium">Add a language</span>
              </button>
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
