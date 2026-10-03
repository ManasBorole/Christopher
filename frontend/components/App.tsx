"use client";

import { useEffect, useRef, useState } from "react";
import type { CourseCard } from "@vta/shared";
import { createCourse, listCourses, patchCourse, startSession } from "../lib/api";
import Mascot from "./Mascot";
import LevelQuestion from "./LevelQuestion";
import AuthBar from "./AuthBar";
import ThemeToggle from "./ThemeToggle";
import SoundToggle from "./SoundToggle";
import Wordmark from "./Wordmark";
import Home from "./Home";
import Dashboard from "./Dashboard";
import SessionView from "./SessionView";
import { WakingNotice } from "./ui";

const hasClerk = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

// The in-app screen. Routing + browser history live in app/page.tsx (the single
// owner), so this component is a pure shell: render the current screen, call up.
export type AppScreen =
  | { v: "home" }
  | { v: "dashboard"; courseId: string }
  | { v: "session"; courseId: string; sessionId: string; language: string; userName: string };

export default function App({
  screen,
  onHome,
  onOpenCourse,
  onStartSession,
  onBack,
  autoStart,
  onAutoStarted,
  onAutoStartFailed,
}: {
  screen: AppScreen;
  onHome: () => void;
  onOpenCourse: (courseId: string) => void;
  onStartSession: (sessionId: string, language: string, userName: string) => void;
  onBack: () => void;
  // Language picked on the landing: open (or create) its course and go straight
  // into a conversation instead of stopping at the course list.
  autoStart?: string | null;
  onAutoStarted?: (courseId: string, sessionId: string, language: string, userName: string) => void;
  onAutoStartFailed?: () => void;
}) {
  const started = useRef<string | null>(null);
  const [continuing, setContinuing] = useState<string | null>(null);
  // Quick start for a language with no known level: ask first. `found` is the
  // learner's existing course for it, if any.
  const [asking, setAsking] = useState<{ found?: CourseCard } | null>(null);

  // "Continue in X" on a tag: straight into a new conversation for that course.
  // If starting fails, open the course page so the learner can retry from there.
  async function continueCourse(c: CourseCard) {
    if (continuing) return;
    setContinuing(c.id);
    try {
      const sid = await startSession(c.id);
      onAutoStarted?.(c.id, sid, c.language, c.userName);
    } catch {
      onOpenCourse(c.id);
    } finally {
      setContinuing(null);
    }
  }
  useEffect(() => {
    if (!autoStart || started.current === autoStart) return; // once per pick, even under StrictMode
    started.current = autoStart;
    setAsking(null);
    (async () => {
      try {
        const cards = await listCourses();
        const found = cards.find((c) => c.language.toLowerCase() === autoStart.toLowerCase());
        if (found && found.stage != null) {
          const sid = await startSession(found.id);
          onAutoStarted?.(found.id, sid, autoStart, found.userName);
        } else {
          setAsking({ found });
        }
      } catch {
        onAutoStartFailed?.();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  // Save the answer on the course (creating it if new), then start talking.
  // A skipped question leaves the stage unknown.
  async function answerLevel(stage: number | null) {
    if (!autoStart || !asking) return;
    const { found } = asking;
    setAsking(null);
    try {
      let id = found?.id;
      if (!id) id = (await createCourse(autoStart, stage ?? undefined)).id;
      else if (stage) await patchCourse(id, { stage }).catch(() => {}); // the level can still be set in the conversation
      const sid = await startSession(id);
      onAutoStarted?.(id, sid, autoStart, found?.userName ?? "");
    } catch {
      onAutoStartFailed?.();
    }
  }

  return (
    <main className="relative min-h-screen">
      <nav className="sticky top-0 z-30 bg-[color-mix(in_srgb,var(--paper)_90%,transparent)] pt-1.5">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <button type="button" onClick={onHome} aria-label="Christopher, your languages">
            <Wordmark />
          </button>
          <div className="flex items-center gap-3">
            <span className="hidden sm:block">
              <ThemeToggle />
            </span>
            <SoundToggle />
            {hasClerk && <AuthBar />}
          </div>
        </div>
      </nav>

      <WakingNotice />

      {screen.v === "home" && autoStart && asking && (
        <section className="mx-auto flex max-w-md flex-col items-center gap-6 px-4 py-10 sm:py-14">
          <Mascot pose="wave" className="w-36 sm:w-44" priority />
          <div className="w-full rounded-3xl bg-card p-5 shadow-[0_20px_44px_-24px_rgb(var(--shadow)/0.55)] sm:p-7">
            <LevelQuestion language={autoStart} titleId="level-title" onAnswer={answerLevel} />
          </div>
        </section>
      )}
      {screen.v === "home" && autoStart && !asking && (
        <section aria-live="polite" className="mx-auto flex max-w-md flex-col items-center gap-6 px-4 py-16 text-center">
          <Mascot pose="wave" className="w-48" priority />
          <p className="font-display text-2xl font-bold">Getting your {autoStart} conversation ready…</p>
        </section>
      )}
      {screen.v === "home" && !autoStart && <Home onOpenCourse={onOpenCourse} onContinue={continueCourse} continuing={continuing} />}

      {screen.v === "dashboard" && (
        <Dashboard courseId={screen.courseId} onBack={onBack} onStartSession={onStartSession} />
      )}

      {screen.v === "session" && (
        <SessionView
          courseId={screen.courseId}
          sessionId={screen.sessionId}
          language={screen.language}
          userName={screen.userName}
          onExit={onBack}
        />
      )}
    </main>
  );
}
