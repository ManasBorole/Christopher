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

export default function Page() {
  const [booting, setBooting] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);
  const [current, setCurrent] = useState<Nav>({ nav: "landing" });

  // Brand cold-open, then seed history: landing (base) [+ app home for returning
  // visitors this session]. Back button walks this stack, never off the tab.
  useEffect(() => {
    const entered = sessionStorage.getItem("vta_entered");
    const t = setTimeout(() => {
      history.replaceState({ nav: "landing" } satisfies Nav, "");
      if (entered) {
        const home: Nav = { nav: "app", screen: { v: "home" } };
        history.pushState(home, "");
        setCurrent(home);
      }
      setBooting(false);
    }, 1900);

    const onPop = (e: PopStateEvent) => {
      setAuthOpen(false);
      setCurrent((e.state as Nav) ?? { nav: "landing" });
    };
    window.addEventListener("popstate", onPop);
    return () => {
      clearTimeout(t);
      window.removeEventListener("popstate", onPop);
    };
  }, []);

  function push(next: Nav) {
    history.pushState(next, "");
    setCurrent(next);
  }
  const back = () => history.back();

  function enterApp() {
    sessionStorage.setItem("vta_entered", "1");
    setAuthOpen(false);
    push({ nav: "app", screen: { v: "home" } });
  }

  if (booting) return <Splash />;

  return (
    <>
      {current.nav === "landing" ? (
        <Landing onStart={() => setAuthOpen(true)} />
      ) : (
        <div style={{ animation: "reveal .9s cubic-bezier(.2,.8,.2,1) both" }}>
          <App
            screen={current.screen}
            onHome={() => push({ nav: "app", screen: { v: "home" } })}
            onOpenCourse={(courseId) => push({ nav: "app", screen: { v: "dashboard", courseId } })}
            onStartSession={(sessionId, language, userName) =>
              push({ nav: "app", screen: { v: "session", courseId: (current.screen as { courseId: string }).courseId, sessionId, language, userName } })
            }
            onBack={back}
          />
          <style>{`@keyframes reveal{from{opacity:0;transform:translateY(22px) scale(.985)}to{opacity:1;transform:none}}`}</style>
        </div>
      )}

      {authOpen && <AuthOverlay onEnter={enterApp} />}
    </>
  );
}
