"use client";

import { useEffect, useState } from "react";
import Splash from "../components/Splash";
import Landing from "../components/Landing";
import AuthOverlay from "../components/AuthOverlay";
import App, { type AppScreen } from "../components/App";

// One history entry per logical screen. Landing is always the base, so the
// browser Back button from the app home returns to the marketing page instead
// of exiting the tab. Splash + auth are transient overlays, never history.
type Nav = { nav: "landing" } | { nav: "app"; screen: AppScreen };

// Write our screen INTO the existing history state rather than replacing it.
// Next's App Router tags its entries (__NA + its tree); an entry without the tag
// makes it hard-reload the page on Back, which dropped learners back on the
// app home instead of the landing.
function writeHistory(kind: "push" | "replace", nav: Nav) {
  const state = { ...(history.state ?? {}), nav: nav.nav, screen: nav.nav === "app" ? nav.screen : undefined };
  if (kind === "push") history.pushState(state, "");
  else history.replaceState(state, "");
}

function readHistory(state: unknown): Nav {
  const s = state as { nav?: string; screen?: AppScreen } | null;
  return s?.nav === "app" && s.screen ? { nav: "app", screen: s.screen } : { nav: "landing" };
}

export default function Page() {
  const [booting, setBooting] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);
  const [pendingLang, setPendingLang] = useState<string | null>(null);
  const [current, setCurrent] = useState<Nav>({ nav: "landing" });

  // Brand cold-open, then seed history: landing (base) [+ app home for returning
  // visitors this session]. Back button walks this stack, never off the tab.
  //
  // For a returning visitor we mount the app home RIGHT AWAY (not after the timer)
  // so its data fetch runs *during* the brand splash instead of only starting once
  // the splash clears - and the splash itself is shorter. The splash renders as an
  // overlay on top, so the grid is usually populated by the time it lifts.
  useEffect(() => {
    const entered = sessionStorage.getItem("vta_entered");
    writeHistory("replace", { nav: "landing" });
    if (entered) {
      const home: Nav = { nav: "app", screen: { v: "home" } };
      writeHistory("push", home);
      setCurrent(home);
    }
    const t = setTimeout(() => setBooting(false), entered ? 900 : 1900);

    const onPop = (e: PopStateEvent) => {
      setAuthOpen(false);
      setCurrent(readHistory(e.state));
    };
    window.addEventListener("popstate", onPop);
    return () => {
      clearTimeout(t);
      window.removeEventListener("popstate", onPop);
    };
  }, []);

  function push(next: Nav) {
    writeHistory("push", next);
    setCurrent(next);
  }
  const back = () => history.back();

  function enterApp() {
    sessionStorage.setItem("vta_entered", "1");
    setAuthOpen(false);
    push({ nav: "app", screen: { v: "home" } });
  }

  // Fresh visitor: show the brand splash alone until it clears, then the landing
  // page. Returning visitor: the app home is already mounted and fetching, so the
  // splash sits on top as an overlay instead of blocking that work.
  if (booting && current.nav === "landing") return <Splash />;

  return (
    <>
      {current.nav === "landing" ? (
        <Landing
          onStart={(lang) => {
            setPendingLang(lang);
            setAuthOpen(true);
          }}
          onSignIn={() => {
            setPendingLang(null);
            setAuthOpen(true);
          }}
        />
      ) : (
        <div style={{ animation: "app-in .5s ease both" }}>
          <App
            screen={current.screen}
            onHome={() => push({ nav: "app", screen: { v: "home" } })}
            onOpenCourse={(courseId) => push({ nav: "app", screen: { v: "dashboard", courseId } })}
            onStartSession={(sessionId, language, userName) =>
              push({ nav: "app", screen: { v: "session", courseId: (current.screen as { courseId: string }).courseId, sessionId, language, userName } })
            }
            onBack={back}
            autoStart={pendingLang}
            onAutoStarted={(courseId, sessionId, language, userName) => {
              setPendingLang(null);
              push({ nav: "app", screen: { v: "session", courseId, sessionId, language, userName } });
            }}
            onAutoStartFailed={() => setPendingLang(null)}
          />
          <style>{`@keyframes app-in{from{opacity:0}}`}</style>
        </div>
      )}

      {authOpen && <AuthOverlay onEnter={enterApp} onClose={() => setAuthOpen(false)} />}
      {booting && <Splash />}
    </>
  );
}
