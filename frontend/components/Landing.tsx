"use client";

import { useEffect, useState } from "react";
import { useReveal } from "../hooks/useReveal";
import { MicIcon } from "./ui";

/* The marketing entry: what Christopher is, before the app. Persuade surface,
   built on the committed world (aurora + glass + gradient). CTAs hand control
   back to the parent (onStart) which opens the sign-in / guest overlay. */
export default function Landing({ onStart }: { onStart: () => void }) {
  useReveal([]);
  return (
    <main className="relative">
      <LandingNav onStart={onStart} />
      <Hero onStart={onStart} />
      <HowItWorks />
      <Pronunciation />
      <Capabilities />
      <FinalCta onStart={onStart} />
      <Footer />
      <style>{keyframes}</style>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Nav                                                                 */
/* ------------------------------------------------------------------ */
function LandingNav({ onStart }: { onStart: () => void }) {
  return (
    <nav className="sticky top-0 z-30 animate-fadein">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <a href="#top" className="flex items-center gap-2">
          <BrandMark />
          <span className="font-display text-lg font-semibold">Christopher</span>
        </a>
        <div className="hidden items-center gap-8 text-sm text-[var(--muted)] sm:flex">
          <a href="#how" className="transition hover:text-[var(--fg)]">How it works</a>
          <a href="#pronunciation" className="transition hover:text-[var(--fg)]">Pronunciation</a>
          <a href="#features" className="transition hover:text-[var(--fg)]">Features</a>
        </div>
        <button onClick={onStart} className="btn-primary px-5 py-2.5 text-sm">
          Start free
        </button>
      </div>
    </nav>
  );
}

function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <span
      className="grid place-items-center rounded-lg text-sm font-bold"
      style={{ width: size, height: size, background: "linear-gradient(140deg,var(--c1),var(--c3))", color: "#04120c" }}
    >
      C
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */
function Hero({ onStart }: { onStart: () => void }) {
  return (
    <section id="top" className="mx-auto grid max-w-6xl items-center gap-12 px-6 pt-10 pb-20 lg:grid-cols-[1.05fr_.95fr] lg:pt-16 lg:pb-28">
      <div>
        <p className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs text-[var(--muted)] animate-fadeup">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </span>
          Real-time voice AI tutor
        </p>
        <h1 className="mt-5 font-display text-5xl font-semibold leading-[1.02] tracking-[-0.03em] sm:text-6xl lg:text-[4.4rem] animate-fadeup" style={{ animationDelay: ".06s" }}>
          Learn a language
          <br />
          by actually <span className="gradient-text">speaking&nbsp;it.</span>
        </h1>
        <p className="mt-6 max-w-md text-lg leading-relaxed text-[var(--muted)] animate-fadeup" style={{ animationDelay: ".12s" }}>
          Christopher is a tutor you talk to out loud - like a real teacher. Natural
          conversation, honest pronunciation coaching, and a memory that greets you back
          by name. No flashcards, no quizzes.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4 animate-fadeup" style={{ animationDelay: ".18s" }}>
          <button onClick={onStart} className="btn-primary inline-flex items-center gap-2.5 text-base">
            <span className="grid place-items-center" style={{ width: 20, height: 20 }}>
              <MiniMic />
            </span>
            Start speaking free
          </button>
          <a href="#how" className="btn-ghost inline-flex items-center gap-2 text-base">
            See how it works
          </a>
        </div>
        <p className="mt-5 text-sm text-[var(--muted)] animate-fadeup" style={{ animationDelay: ".24s" }}>
          Open the mic and say hello. That&apos;s the whole first lesson.
        </p>
      </div>

      <div className="animate-fadeup" style={{ animationDelay: ".16s" }}>
        <ConversationDemo />
      </div>
    </section>
  );
}

/* The authored motion moment: a live tutor exchange that plays itself,
   waveform reacting while the tutor "speaks". */
const SCRIPT: { role: "agent" | "user"; text: string; note?: string }[] = [
  { role: "agent", text: "Hello! Which language would you like to learn today?" },
  { role: "user", text: "Spanish" },
  { role: "agent", text: "Perfect. Repeat after me - “Me llamo Ana.”" },
  { role: "user", text: "Me llamo Ana" },
  { role: "agent", text: "Beautiful. The “ll” softens to a “y” - you nailed it.", note: "96%" },
];

function ConversationDemo() {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const gaps = SCRIPT.map((l) => 900 + l.text.length * 34);
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      i = i >= SCRIPT.length ? 0 : i + 1;
      setShown(i);
      timer = setTimeout(tick, i === 0 ? 700 : i >= SCRIPT.length ? 2600 : gaps[i - 1]);
    };
    timer = setTimeout(tick, 700);
    return () => clearTimeout(timer);
  }, []);

  const agentTalking = shown > 0 && SCRIPT[shown - 1]?.role === "agent";

  return (
    <div className="glass relative overflow-hidden rounded-[32px] p-5 sm:p-6" style={{ boxShadow: "0 50px 120px -40px rgba(0,0,0,.85)" }}>
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full opacity-40 blur-3xl"
        style={{ background: "linear-gradient(140deg,var(--c1),var(--c3))" }}
      />
      {/* live header */}
      <div className="mb-5 flex items-center gap-3">
        <div className="relative grid h-11 w-11 place-items-center rounded-2xl" style={{ background: "linear-gradient(140deg,var(--c1),var(--c3))", color: "#04120c" }}>
          <MicIcon />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold">Christopher</p>
          <p className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {agentTalking ? "speaking…" : "listening…"}
          </p>
        </div>
        <div className="ml-auto flex h-8 items-end gap-[3px]" aria-hidden>
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <span
              key={i}
              className="w-[3px] rounded-full"
              style={{
                background: "linear-gradient(var(--c1),var(--c2))",
                height: 8,
                animation: agentTalking ? `wave 1s ${i * 0.09}s ease-in-out infinite` : "none",
                opacity: agentTalking ? 1 : 0.3,
              }}
            />
          ))}
        </div>
      </div>

      {/* transcript */}
      <div className="flex min-h-[288px] flex-col justify-end gap-2.5">
        {SCRIPT.slice(0, shown).map((l, i) => (
          <DemoBubble key={i} role={l.role} text={l.text} note={l.note} />
        ))}
      </div>
    </div>
  );
}

function DemoBubble({ role, text, note }: { role: "agent" | "user"; text: string; note?: string }) {
  const mine = role === "user";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`} style={{ animation: "popIn .5s cubic-bezier(.2,.8,.2,1) both" }}>
      <div
        className="max-w-[86%] rounded-2xl px-4 py-2.5 text-sm leading-snug"
        style={
          mine
            ? { background: "linear-gradient(120deg,var(--c1),var(--c2))", color: "#05140d" }
            : { background: "var(--glass-strong)", border: "1px solid var(--line)" }
        }
      >
        {text}
        {note && (
          <span className="ml-2 rounded-full bg-emerald-400/15 px-2 py-0.5 text-xs font-semibold text-emerald-300">
            {note}
          </span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* How it works                                                        */
/* ------------------------------------------------------------------ */
const STEPS = [
  { n: "1", title: "Say hello", body: "Tap the mic and start talking. Christopher answers in your language and asks what you want to learn." },
  { n: "2", title: "Pick a language, out loud", body: "Just say it - “Spanish.” No menus, no level tests. The lesson starts in the same breath." },
  { n: "3", title: "Speak & get coached", body: "Repeat each phrase. Christopher scores your real pronunciation and tells you exactly what to adjust." },
];

function HowItWorks() {
  return (
    <section id="how" className="mx-auto max-w-6xl px-6 py-20 lg:py-28">
      <SectionHead
        title={<>Three spoken steps to your <span className="gradient-text">first sentence.</span></>}
        sub="No onboarding wizard. The conversation is the product."
      />
      <div className="relative mt-14 grid gap-10 sm:grid-cols-3">
        {/* connecting line */}
        <div className="pointer-events-none absolute left-0 right-0 top-6 hidden h-px sm:block" style={{ background: "linear-gradient(90deg,transparent,var(--line) 12%,var(--line) 88%,transparent)" }} />
        {STEPS.map((s, i) => (
          <div key={s.n} className="reveal relative" style={{ transitionDelay: `${i * 90}ms` }}>
            <div className="relative z-10 grid h-12 w-12 place-items-center rounded-2xl glass font-display text-lg font-semibold">
              <span className="gradient-text">{s.n}</span>
            </div>
            <h3 className="mt-5 font-display text-xl font-semibold">{s.title}</h3>
            <p className="mt-2 text-[var(--muted)]">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Pronunciation - the showpiece                                       */
/* ------------------------------------------------------------------ */
function Pronunciation() {
  return (
    <section id="pronunciation" className="mx-auto max-w-6xl px-6 py-20 lg:py-28">
      <div className="grid items-center gap-14 lg:grid-cols-2">
        <div className="reveal">
          <h2 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            Real pronunciation scoring.{" "}
            <span className="gradient-text">Not vibes.</span>
          </h2>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-[var(--muted)]">
            When you repeat a phrase, Christopher listens to that exact clip and scores it -
            accuracy, fluency, the sounds you missed. Then it turns the numbers into coaching
            a teacher would actually say.
          </p>
          <ul className="mt-7 space-y-3">
            {[
              "Per-word and per-sound accuracy, not a single vague grade",
              "Feedback framed to encourage - never a raw number",
              "Scored from your real voice, out-of-band from the live call",
            ].map((t) => (
              <li key={t} className="flex items-start gap-3 text-[var(--fg)]">
                <CheckIcon />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>

        <ScoreCard />
      </div>
    </section>
  );
}

function ScoreCard() {
  return (
    <div className="reveal glass rounded-[28px] p-7" style={{ transitionDelay: "120ms", boxShadow: "0 40px 100px -40px rgba(0,0,0,.8)" }}>
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">You said</p>
      <p className="mt-2 font-display text-3xl font-semibold">
        &ldquo;Me llamo Ana&rdquo;
      </p>

      {/* per-word chips */}
      <div className="mt-5 flex flex-wrap gap-2">
        {[
          { w: "Me", ok: true },
          { w: "lla·mo", ok: true },
          { w: "A·na", ok: true },
        ].map((c) => (
          <span key={c.w} className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] px-3 py-1.5 text-sm" style={{ border: "1px solid var(--line)" }}>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {c.w}
          </span>
        ))}
      </div>

      {/* accuracy meter */}
      <div className="mt-7">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-sm text-[var(--muted)]">Accuracy</span>
          <span className="font-display text-2xl font-semibold text-emerald-300">96%</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
          <div className="meterfill h-full rounded-full" style={{ ["--v" as string]: "0.96", transformOrigin: "left", background: "linear-gradient(90deg,var(--c1),var(--c2))" }} />
        </div>
      </div>

      {/* coaching line */}
      <div className="mt-6 rounded-2xl p-4" style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.22)" }}>
        <p className="text-sm leading-relaxed">
          <span className="font-semibold text-emerald-300">Christopher:</span>{" "}
          The &ldquo;ll&rdquo; in <em>llamo</em> softens to a &ldquo;y&rdquo; sound - you got it just right. Try
          it a touch slower next time and it&apos;s perfect.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Capabilities strip                                                  */
/* ------------------------------------------------------------------ */
const CAPS = [
  { icon: <ChatIcon />, title: "Conversation, not drills", body: "Learn by talking about your day, your work, your plans - the way you actually use a language." },
  { icon: <MemoryIcon />, title: "It remembers you", body: "Your name, your level, the words you've practiced, the mistakes you keep making - restored every visit." },
  { icon: <TrendIcon />, title: "Adapts as you improve", body: "Christopher raises the difficulty on its own. No levels to pick, no gates to unlock." },
  { icon: <GlobeIcon />, title: "A course per language", body: "Each language keeps its own progress, vocabulary, and history. Switch whenever you like." },
];

function Capabilities() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-6 py-20 lg:py-28">
      <SectionHead
        title={<>Everything a good tutor does - <span className="gradient-text">between lessons, too.</span></>}
        sub="The parts that make it feel like a relationship, not an app."
      />
      <div className="mt-14 grid gap-x-10 gap-y-12 sm:grid-cols-2">
        {CAPS.map((c, i) => (
          <div key={c.title} className="reveal flex gap-5" style={{ transitionDelay: `${i * 80}ms` }}>
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl glass text-emerald-300">
              {c.icon}
            </div>
            <div>
              <h3 className="font-display text-xl font-semibold">{c.title}</h3>
              <p className="mt-1.5 text-[var(--muted)]">{c.body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Final CTA                                                           */
/* ------------------------------------------------------------------ */
function FinalCta({ onStart }: { onStart: () => void }) {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-24">
      <div className="reveal relative overflow-hidden rounded-[36px] glass px-8 py-16 text-center sm:py-20">
        <div className="pointer-events-none absolute inset-0 opacity-60" style={{ background: "radial-gradient(60% 120% at 50% 0%, rgba(52,211,153,0.18), transparent 70%)" }} />
        <div className="relative">
          <div className="mx-auto mb-7 grid h-16 w-16 place-items-center rounded-[22px] text-[#04120c]" style={{ background: "linear-gradient(140deg,var(--c1),var(--c2),var(--c3))", boxShadow: "0 20px 60px -15px rgba(52,211,153,.6)" }}>
            <MicIcon />
          </div>
          <h2 className="mx-auto max-w-2xl font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            Say hello to your <span className="gradient-text">tutor.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-md text-lg text-[var(--muted)]">
            Your first conversation is free. Open the mic and start speaking.
          </p>
          <button onClick={onStart} className="btn-primary mt-8 inline-flex items-center gap-2.5 text-base">
            <span className="grid place-items-center" style={{ width: 20, height: 20 }}>
              <MiniMic />
            </span>
            Start speaking free
          </button>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="mx-auto max-w-6xl px-6 pb-10">
      <div className="flex flex-col items-center justify-between gap-4 border-t pt-8 text-sm text-[var(--muted)] sm:flex-row" style={{ borderColor: "var(--line)" }}>
        <div className="flex items-center gap-2">
          <BrandMark size={24} />
          <span className="font-display font-semibold text-[var(--fg)]">Christopher</span>
        </div>
        <p>Speak. Learn. Fluently.</p>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */
function SectionHead({ title, sub }: { title: React.ReactNode; sub: string }) {
  return (
    <div className="reveal max-w-2xl">
      <h2 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h2>
      <p className="mt-4 text-lg text-[var(--muted)]">{sub}</p>
    </div>
  );
}

/* ---- authored icons (consistent 1.6 stroke) ---- */
const S = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
function ChatIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" {...S} aria-hidden><path d="M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.3A8 8 0 1 1 21 12Z" /><path d="M8.5 11.5h7M8.5 14.5h4" /></svg>;
}
function MemoryIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" {...S} aria-hidden><path d="M12 3a6 6 0 0 0-6 6c0 2.2 1.2 3.6 2.2 4.7.8.9 1.3 1.5 1.3 2.8v.5h5v-.5c0-1.3.5-1.9 1.3-2.8C16.8 12.6 18 11.2 18 9a6 6 0 0 0-6-6Z" /><path d="M9.5 20.5h5M10.5 22.5h3" /></svg>;
}
function TrendIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" {...S} aria-hidden><path d="M4 15.5 9 10l3.5 3.5L20 6" /><path d="M20 10.5V6h-4.5" /></svg>;
}
function GlobeIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" {...S} aria-hidden><circle cx="12" cy="12" r="9" /><path d="M3.5 12h17M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" /></svg>;
}
function CheckIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" className="mt-0.5 shrink-0 text-emerald-400" {...S} aria-hidden><path d="m5 12.5 4.5 4.5L19 7" /></svg>;
}
function MiniMic() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="22" /></svg>;
}

const keyframes = `
@keyframes wave { 0%,100%{height:8px} 50%{height:26px} }
@keyframes popIn { from{opacity:0;transform:translateY(10px) scale(.97)} to{opacity:1;transform:none} }
.reveal .meterfill{ transform:scaleX(0); }
.reveal.in .meterfill{ transform:scaleX(var(--v)); transition:transform 1.3s cubic-bezier(.2,.8,.2,1) .25s; }
`;
