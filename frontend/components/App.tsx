"use client";

import AuthBar from "./AuthBar";
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
      <nav className="sticky top-0 z-30 mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <button onClick={onHome} className="flex items-center gap-2">
          <span
            className="grid h-8 w-8 place-items-center rounded-lg text-sm font-bold"
            style={{ background: "linear-gradient(140deg,var(--c1),var(--c3))", color: "#04120c" }}
          >
            C
          </span>
          <span className="font-display text-lg font-semibold">Christopher</span>
        </button>
        {hasClerk && <AuthBar />}
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
