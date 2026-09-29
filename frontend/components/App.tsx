"use client";

import AuthBar from "./AuthBar";
import ThemeToggle from "./ThemeToggle";
import Wordmark from "./Wordmark";
import Home from "./Home";
import Dashboard from "./Dashboard";
import SessionView from "./SessionView";

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
}: {
  screen: AppScreen;
  onHome: () => void;
  onOpenCourse: (courseId: string) => void;
  onStartSession: (sessionId: string, language: string, userName: string) => void;
  onBack: () => void;
}) {
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
            {hasClerk && <AuthBar />}
          </div>
        </div>
      </nav>

      {screen.v === "home" && <Home onOpenCourse={onOpenCourse} />}

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
