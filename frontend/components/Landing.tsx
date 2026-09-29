"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useScrollScene } from "../hooks/useScrollScene";
import Mascot, { type MascotPose } from "./Mascot";
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
      <Greetings />
      <Meet />
      <AfterTalk />
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
  useScrollScene(cardRef, flip, { mode: "reveal", span: 0.7, rest: 0 });

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
/* Greetings: fly through hellos in their own scripts                  */
/* ------------------------------------------------------------------ */
const HELLOS: [string, string, string, boolean?][] = [
  ["Hola", "Spanish", "es"], ["こんにちは", "Japanese", "ja"], ["नमस्ते", "Hindi", "hi"], ["مرحبا", "Arabic", "ar", true],
  ["Bonjour", "French", "fr"], ["안녕하세요", "Korean", "ko"], ["Привет", "Russian", "ru"], ["שלום", "Hebrew", "he", true],
  ["Olá", "Portuguese", "pt"], ["Γειά σου", "Greek", "el"], ["नमस्कार", "Marathi", "mr"], ["Merhaba", "Turkish", "tr"],
  ["Xin chào", "Vietnamese", "vi"], ["سلام", "Persian", "fa", true], ["Habari", "Swahili", "sw"], ["வணக்கம்", "Tamil", "ta"],
  ["হ্যালো", "Bengali", "bn"], ["สวัสดี", "Thai", "th"], ["Ciao", "Italian", "it"], ["Hallo", "German", "de"],
  ["你好", "Chinese", "zh"], ["Cześć", "Polish", "pl"], ["ہیلو", "Urdu", "ur", true], ["Sawubona", "Zulu", "zu"],
];
const DEPTH = 3200;
// Deterministic spread on a golden-angle ring, receding into the page.
const SPOTS = HELLOS.map((_, i) => {
  const a = i * 2.39996;
  const r = 180 + (i % 3) * 110;
  return { x: Math.cos(a) * r * 1.5, y: Math.sin(a) * r * 0.75, z: -(i / HELLOS.length) * DEPTH, rot: ((i * 53) % 30) - 15 };
});

function Greetings() {
  const sectionRef = useRef<HTMLElement>(null);
  const items = useRef<(HTMLDivElement | null)[]>([]);
  const copyRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLParagraphElement>(null);

  const draw = useCallback((p: number) => {
    const cam = p * (DEPTH + 500);
    const narrow = innerWidth < 700 ? 0.45 : 1;
    SPOTS.forEach((s, i) => {
      const el = items.current[i];
      if (!el) return;
      const z = s.z + cam; // > 0: already passed the viewer
      const vis = z > 520 ? 0 : Math.min(1, Math.max(0, (z + DEPTH) / 900));
      const blur = z < -1400 ? Math.min(6, (-z - 1400) / 300) : 0;
      el.style.opacity = vis.toFixed(3);
      el.style.filter = blur ? `blur(${blur.toFixed(1)}px)` : "none";
      el.style.transform = `translate(-50%,-50%) translate3d(${s.x * narrow}px,${s.y}px,${z}px) rotate(${s.rot + p * 20}deg)`;
      el.style.zIndex = String(Math.round(4000 + z));
    });
    if (copyRef.current) copyRef.current.style.opacity = String(Math.max(0, 1 - p * 3.2));
    if (endRef.current) endRef.current.style.opacity = String(Math.min(1, Math.max(0, (p - 0.78) * 5)));
  }, []);
  useScrollScene(sectionRef, draw, { rest: 0.45 });

  return (
    <section ref={sectionRef} aria-labelledby="hello-h" className="relative h-[280vh] motion-reduce:h-auto">
      <div className="sticky top-16 h-[calc(100svh-4rem)] min-h-[520px] overflow-hidden motion-reduce:relative motion-reduce:top-0 motion-reduce:h-[640px]">
        <div ref={copyRef} className="pointer-events-none absolute inset-x-4 top-[8%] z-[5000] text-center">
          <h2 id="hello-h" className="font-display text-[clamp(2rem,4.6vw,3.5rem)] font-extrabold tracking-[-0.025em]">
            One tutor. Every hello.
          </h2>
          <p className="mt-2 text-muted">180+ languages, each in its own script and its own direction.</p>
        </div>
        <div className="absolute inset-0 [perspective:800px]" aria-hidden>
          {HELLOS.map(([word, name, code, rtl], i) => (
            <div
              key={code}
              ref={(el) => {
                items.current[i] = el;
              }}
              className={`sticker absolute left-1/2 top-[55%] whitespace-nowrap px-4 py-2.5 will-change-transform ${
                i % 4 === 0 ? "hello-tutor" : i % 4 === 2 ? "hello-learner" : ""
              }`}
            >
              <b lang={code} dir={rtl ? "rtl" : undefined} className="block font-display text-[30px] font-bold leading-tight">
                {word}
              </b>
              <span className="text-[13px] opacity-80">{name}</span>
            </div>
          ))}
        </div>
        <p ref={endRef} className="absolute inset-x-4 bottom-[7%] z-[5000] text-center font-hand text-[26px] text-muted opacity-0">
          …and yours, when you&apos;re ready.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Meet Christopher: his body language is the conversation state       */
/* ------------------------------------------------------------------ */
const MOMENTS: { key: string; label: string; pose: MascotPose; talking?: boolean; line: string; note: string }[] = [
  { key: "listen", label: "Listening", pose: "listen", line: "Listening. Take your time.", note: "Leans in with his paws together. He never rushes you." },
  { key: "think", label: "Thinking", pose: "think", line: "Thinking about what you said", note: "Paw to his head for a moment before he answers." },
  { key: "speak", label: "Speaking", pose: "speak", talking: true, line: "Christopher is speaking", note: "Talks with his paws while his voice is playing." },
  { key: "goahead", label: "You cut in", pose: "goahead", line: "You cut in, so he stopped", note: "Stops mid-word and hands the turn back to you." },
];

function Meet() {
  const ref = useRef<HTMLElement>(null);
  const [pose, setPose] = useState<MascotPose>("idle");
  const [active, setActive] = useState<string | null>(null);

  // Wave once when he first comes into view.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let t: ReturnType<typeof setTimeout>;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      setPose("wave");
      t = setTimeout(() => setPose((p) => (p === "wave" ? "idle" : p)), 1800);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => {
      io.disconnect();
      clearTimeout(t);
    };
  }, []);

  const m = MOMENTS.find((x) => x.key === active);

  return (
    <section ref={ref} aria-labelledby="meet-h" className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-24 sm:px-6 md:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)] lg:gap-16 lg:py-32">
      <div className="mx-auto w-full max-w-[380px]">
        <Mascot pose={pose} talking={!!m?.talking} />
        <p aria-live="polite" className="mt-5 min-h-[1.5em] text-center font-display text-xl font-bold">
          {m ? m.line : "Hi, I'm Christopher."}
        </p>
      </div>
      <div>
        <h2 id="meet-h" className="font-display text-[clamp(2rem,4.2vw,3.1rem)] font-extrabold leading-[1.05] tracking-[-0.025em] text-balance">
          Meet Christopher. You&apos;ll always know whose turn it is.
        </h2>
        <p className="mt-4 max-w-[48ch] text-lg text-muted">
          A patient fox with a satchel full of phrases. His body language follows the conversation, so you can tell at
          a glance whether he&apos;s listening, thinking, or talking.
        </p>
        <div role="group" aria-label="See how Christopher reacts" className="mt-7 flex flex-wrap gap-2">
          {MOMENTS.map((x) => (
            <button
              key={x.key}
              type="button"
              aria-pressed={active === x.key}
              onClick={() => {
                setActive(x.key);
                setPose(x.pose);
              }}
              className="rounded-full border-[1.5px] border-line bg-card px-4 py-2 text-[15px] font-semibold aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-paper"
            >
              {x.label}
            </button>
          ))}
        </div>
        <p className="mt-4 min-h-[3em] max-w-[46ch] text-[15px] text-muted">{m ? m.note : "Press a moment to see how he reacts."}</p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* After each conversation: a postcard, not a grade                    */
/* ------------------------------------------------------------------ */
function AfterTalk() {
  return (
    <section aria-labelledby="after-h" className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-28 sm:px-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)] lg:gap-16">
      <div className="md:order-2">
        <h2 id="after-h" className="font-display text-[clamp(2rem,4.2vw,3.1rem)] font-extrabold leading-[1.05] tracking-[-0.025em] text-balance">
          After every conversation, a postcard.
        </h2>
        <p className="mt-4 max-w-[46ch] text-lg text-muted">
          The words you actually used, the one thing worth trying next time, and nothing that feels like a test score.
          Christopher remembers it for your next chat.
        </p>
      </div>
      <div className="relative mx-auto w-full max-w-[520px] md:order-1">
        <article className="sticker relative z-10 -rotate-2 p-5 sm:p-6">
          <p className="font-hand text-xl text-muted">Greetings from</p>
          <h3 className="font-display text-3xl font-extrabold tracking-[-0.02em] text-tutor">Spanish, day 3</h3>
          <p className="mt-4 text-sm font-semibold text-muted">Words you used</p>
          <ul className="mt-2 flex flex-wrap gap-2" lang="es">
            {["cenar", "pedí", "sopa", "buena", "la cuenta"].map((w) => (
              <li key={w} className="rounded-[4px] border-[1.5px] border-dashed border-tutor px-2.5 py-1 text-[15px]">
                {w}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm font-semibold text-muted">Next time</p>
          <p className="mt-1">Ordering in a café, in the past tense.</p>
        </article>
        <Mascot pose="postcard" className="absolute -bottom-10 -right-2 z-20 w-28 rotate-3 sm:-right-8 sm:w-36" />
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
