"use client";

import { useCallback, useRef, useState } from "react";
import { useScrollScene } from "../hooks/useScrollScene";
import Mascot from "./Mascot";
import ThemeToggle from "./ThemeToggle";
import Wordmark from "./Wordmark";

// English names, matching what the picker stores (Intl.DisplayNames "en").
const STARTERS = [
  "Spanish", "French", "Japanese", "German", "Korean", "Hindi", "Italian",
  "Portuguese", "Chinese", "Arabic", "Marathi", "Russian", "Turkish", "Dutch",
];

/* The way in for a nervous first-timer. One action, and it names the language.
   onStart(language) hands off to the parent, which opens the guest / sign-in
   sheet and then drops the learner straight into a conversation. */
export default function Landing({
  onStart,
  onSignIn,
}: {
  onStart: (language: string) => void;
  onSignIn: () => void;
}) {
  const [lang, setLang] = useState("Spanish");
  const start = () => onStart(lang);

  return (
    <main className="relative overflow-x-clip">
      <LandingNav onSignIn={onSignIn} />
      <Hero lang={lang} setLang={setLang} onStart={start} />
      <Close lang={lang} onStart={start} />
      <Footer />
    </main>
  );
}

function LandingNav({ onSignIn }: { onSignIn: () => void }) {
  return (
    <nav className="sticky top-0 z-30 bg-[color-mix(in_srgb,var(--paper)_90%,transparent)] pt-1.5">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Wordmark />
        <div className="flex items-center gap-3">
          <span className="hidden sm:block">
            <ThemeToggle />
          </span>
          <button type="button" onClick={onSignIn} className="text-[15px] font-semibold text-ink underline decoration-line decoration-2 underline-offset-4 hover:decoration-ink">
            Sign in
          </button>
        </div>
      </div>
    </nav>
  );
}

function StartButton({ lang, onStart }: { lang: string; onStart: () => void }) {
  return (
    <button type="button" onClick={onStart} className="btn text-[17px]">
      Start talking in {lang}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Hero: the postcard turns over as you scroll                         */
/* ------------------------------------------------------------------ */
function Hero({ lang, setLang, onStart }: { lang: string; setLang: (l: string) => void; onStart: () => void }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const flip = useCallback((p: number) => {
    const el = cardRef.current;
    if (!el) return;
    const t = Math.min(1, Math.max(0, (p - 0.08) / 0.8));
    const f = 1 - Math.pow(1 - t, 3); // ease out
    const lift = Math.sin(f * Math.PI);
    el.style.transform = `translateZ(${lift * 80}px) rotateX(${6 - f * 6 + lift * 5}deg) rotateY(${f * 180}deg) rotateZ(${-2.5 + f * 4.5}deg)`;
    el.style.setProperty("--sheen", (lift * 0.9).toFixed(2));
  }, []);
  useScrollScene(cardRef, flip, { mode: "top", span: 0.85, rest: 0 });

  return (
    <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-24 pt-8 sm:px-6 lg:grid-cols-[1fr_1.08fr] lg:gap-14 lg:pb-36 lg:pt-14">
      <div>
        <h1 className="font-display text-[clamp(2.5rem,6.2vw,4.75rem)] font-extrabold leading-[1] tracking-[-0.035em] text-balance">
          Say it out loud. Christopher will wait for you.
        </h1>
        <p className="mt-5 max-w-[38ch] text-lg leading-relaxed text-muted sm:text-[19px]">
          A tutor you talk to in your new language. He listens to the whole sentence, answers like a person, and
          quietly repeats the right way when you slip.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-3">
          <StartButton lang={lang} onStart={onStart} />
          <label className="flex items-center gap-2 text-[15px] text-muted">
            or pick
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              aria-label="Language to practise"
              className="rounded-[10px] border-[1.5px] border-line bg-card px-2.5 py-2 text-ink"
            >
              {STARTERS.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </label>
        </div>
        <p className="mt-4 text-[15px] text-muted">No account needed for your first conversation. 180+ languages inside.</p>
      </div>

      <div className="pc-scene">
        <div ref={cardRef} className="pc">
          <div className="pc-face pc-front">
            <div className="pc-photo">
              <Mascot pose="wave" priority />
            </div>
            <div className="pc-greeting">
              <span className="font-hand text-2xl text-muted">Greetings from</span>
              <span className="pc-big">
                your first <span>real conversation</span>
              </span>
            </div>
          </div>
          <div className="pc-face pc-back" aria-label="A sample exchange in Spanish">
            <div className="pc-msg">
              <p className="pc-line pc-t">
                <span className="pc-who">Christopher</span>
                <span lang="es">¿Qué pediste para cenar?</span>
              </p>
              <p className="pc-line pc-l">
                <span className="pc-who">You</span>
                <span lang="es">Yo pedí… una sopa?</span>
              </p>
              <p className="pc-line pc-t">
                <span className="pc-who">Christopher</span>
                <span lang="es">
                  Ah, <span className="fix">pedí una sopa</span>. ¿Estaba buena?
                </span>
              </p>
              <p className="font-hand text-[17px] leading-tight text-correct">
                “pedí” already means “I ordered”, so the “yo” can go.
              </p>
            </div>
            <div className="pc-addr" aria-hidden>
              <div className="pc-stamp">
                <span lang="es">¡Hola!</span>
              </div>
              <div className="grid gap-2.5">
                <b className="font-hand text-xl font-normal">To: you, in Madrid</b>
                <i />
                <i />
                <i />
              </div>
            </div>
            <div className="pc-postmark" aria-hidden>
              UNDERSTOOD
              <br />
              FIRST TRY
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Close                                                               */
/* ------------------------------------------------------------------ */
function Close({ lang, onStart }: { lang: string; onStart: () => void }) {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-8 px-4 pb-24 sm:px-6 md:grid-cols-[auto_1fr] md:gap-12">
      <Mascot pose="idle" className="w-40 sm:w-48" />
      <div>
        <h2 className="font-display text-[clamp(2rem,4.2vw,3.1rem)] font-extrabold leading-[1.05] tracking-[-0.025em] text-balance">
          Your first conversation takes about a minute.
        </h2>
        <p className="mt-3 max-w-[46ch] text-lg text-muted">
          Say hello, answer one question, hear it said back the right way. That&apos;s the whole first lesson.
        </p>
        <div className="mt-6">
          <StartButton lang={lang} onStart={onStart} />
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="mx-auto max-w-6xl px-4 pb-10 sm:px-6">
      <div className="flex flex-col justify-between gap-4 border-t-[1.5px] border-line pt-7 text-sm text-muted sm:flex-row sm:items-center">
        <Wordmark size={28} />
        <p>A voice tutor for 180+ languages.</p>
        <span className="sm:hidden">
          <ThemeToggle />
        </span>
      </div>
    </footer>
  );
}
