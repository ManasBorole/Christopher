"use client";

import { useEffect, useId, useRef, useState } from "react";
import { RealtimeEngine } from "../lib/engine/RealtimeEngine";
import type { ConversationEngine } from "../lib/engine/ConversationEngine";
import { useSession } from "../store/useSession";
import { addTurn as persistTurn, editTurn, patchCourse, markGoal, cachedCourse, getCourse, endSession, getUsage, reportSpent, consumeUsage, translateLine } from "../lib/api";
import { isMeaningfulTranscript, looksEnglish } from "../lib/transcript";
import { sessionPhase, cannotHear, trialStep, MIC_FLOOR, type Phase } from "../lib/sessionPhase";
import Mascot, { type MascotPose } from "./Mascot";
import { SummaryCard } from "./ui";
import TrialModal from "./TrialModal";
import StageControl, { type Stage } from "./StageControl";
import { useSessionSounds } from "../lib/sfx";

export default function SessionView({
  courseId,
  sessionId,
  language,
  userName,
  onExit,
}: {
  courseId: string;
  sessionId: string;
  language: string;
  userName: string;
  onExit: () => void;
}) {
  const s = useSession();
  const engineRef = useRef<ConversationEngine | null>(null);
  const endedRef = useRef(false);
  // Set the first time Christopher hears the learner: that, not connecting,
  // is what uses the free session and starts its clock.
  const consumedRef = useRef(false);
  // Seconds used on earlier connections of this conversation, so a reconnect
  // continues the free-time clock instead of restarting it.
  const priorRef = useRef(0);
  const [elapsed, setElapsed] = useState(0);
  const [ending, setEnding] = useState(false);
  const [showTrial, setShowTrial] = useState(false);
  const [limit, setLimit] = useState(60);
  const [blocked, setBlocked] = useState(false);
  // The engine reports "error" then "idle" as it tears down, which wipes the
  // store's error. Keep the last one here so the learner sees what went wrong.
  const [lastError, setLastError] = useState<string | null>(null);
  const [mic, setMic] = useState<PermissionState | "unknown">("unknown");
  const [handedBack, setHandedBack] = useState(false);
  // Has any learner speech reached Christopher on this connection, and how long
  // has the line been silent (no mic sound, nothing heard, Christopher not talking)?
  const [heard, setHeard] = useState(false);
  const [quietMs, setQuietMs] = useState(0);
  const quietFromRef = useRef(0);
  // How much English Christopher speaks (1-4), null until a level is known.
  const [stage, setStage] = useState<Stage | null>(() => (cachedCourse(courseId)?.stage ?? null) as Stage | null);
  const stageMovedRef = useRef(false);

  // Know up front whether the mic is already allowed or blocked, so the first
  // screen can say so. Browsers without the Permissions API stay "unknown".
  useEffect(() => {
    let status: PermissionStatus | undefined;
    const sync = () => status && setMic(status.state);
    navigator.permissions
      ?.query({ name: "microphone" as PermissionName })
      .then((p) => {
        status = p;
        sync();
        p.addEventListener("change", sync);
      })
      .catch(() => {});
    return () => status?.removeEventListener("change", sync);
  }, []);

  // fresh conversation + check remaining free allowance
  useEffect(() => {
    useSession.getState().begin(courseId, sessionId, language, userName);
    endedRef.current = false;
    getUsage().then((u) => {
      setLimit(u.secondsPerSession);
      if (u.blocked) setBlocked(true);
    });
  }, [courseId, sessionId, language, userName]);

  // The saved level, unless the learner or Christopher has moved it meanwhile.
  useEffect(() => {
    stageMovedRef.current = false;
    getCourse(courseId)
      .then((c) => {
        if (c && !stageMovedRef.current) {
          setStage((c.stage ?? null) as Stage | null);
          if (c.stage) engineRef.current?.setStage(c.stage as Stage, "saved");
        }
      })
      .catch(() => {});
  }, [courseId]);

  // Learner nudge: show it, tell the live conversation, save it for next time.
  function nudgeStage(n: Stage) {
    stageMovedRef.current = true;
    setStage(n);
    engineRef.current?.setStage(n, "learner");
    void patchCourse(courseId, { stage: n }).catch(() => {});
  }

  // timer + hard 60s cutoff
  useEffect(() => {
    if (!s.startedAt) return;
    const t = setInterval(() => {
      const e = priorRef.current + Math.floor((Date.now() - s.startedAt!) / 1000);
      setElapsed(e);
      if (e >= limit && !endedRef.current) end(); // free time up -> stop hard
    }, 500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.startedAt, limit]);

  // Watch the mic while live so a muted or wrong microphone shows up as
  // "cannot hear you" instead of an endless "Listening".
  useEffect(() => {
    if (s.status !== "live") return;
    const t = setInterval(() => {
      const now = Date.now();
      const sound = (engineRef.current?.inputLevel?.() ?? 0) > MIC_FLOOR;
      if (sound || useSession.getState().agentSpeaking) quietFromRef.current = now;
      setQuietMs(now - quietFromRef.current);
    }, 250);
    return () => clearInterval(t);
  }, [s.status]);

  async function connect() {
    if (blocked) return setShowTrial(true);
    setLastError(null);
    engineRef.current?.disconnect(); // a dropped connection is still open; close it first
    const engine = new RealtimeEngine();
    engineRef.current = engine;
    if (stage) engine.setStage(stage, "saved");
    await engine.connect(
      {
        onStatus: (st, detail) => {
          if (detail === "limit_reached") {
            setBlocked(true);
            setShowTrial(true);
            s.setStatus("idle");
            return;
          }
          s.setStatus(st, detail);
          if (st === "error") setLastError(detail ?? "unknown");
          if (st === "live") {
            setHeard(false);
            quietFromRef.current = Date.now();
            setQuietMs(0);
            if (trialStep("live", consumedRef.current).startClock) s.start(Date.now());
          }
          if (st === "idle" || st === "error") {
            const started = useSession.getState().startedAt;
            if (started) priorRef.current += Math.floor((Date.now() - started) / 1000);
            s.clearTimer();
          }
        },
        onHeard: () => {
          setHeard(true);
          const step = trialStep("heard", consumedRef.current);
          if (step.consume) {
            consumedRef.current = true; // consume the free session exactly once
            void consumeUsage();
          }
          if (step.startClock) s.start(Date.now());
        },
        onSpeaking: (b) => s.setSpeaking(b),
        onLine: (l) => {
          const before = useSession.getState().turns.find((t) => t.id === l.id);
          // Drop empty / punctuation-only artefacts (noise mis-transcribed as
          // speech, or a reply cut off before a word was heard).
          if (l.done && !isMeaningfulTranscript(l.text)) return s.removeTurn(l.id);
          s.putLine(l);
          if (!l.done || (before && !before.pending)) return;
          // Saved once, stamped with when the line took its place, so the
          // stored transcript keeps conversation order.
          // The same `at` as on screen, so a later correction finds this record.
          const at = useSession.getState().turns.find((t) => t.id === l.id)?.at ?? Date.now();
          void persistTurn(sessionId, l.role, l.text, at).catch(() => {});
          // English under what he said in the target language (shown, not spoken).
          if (l.role === "agent" && !looksEnglish(l.text)) {
            void translateLine(l.text, language).then((en) => {
              if (en && plain(en) !== plain(l.text)) s.patchTurn(l.id, { translation: en });
            });
          }
        },
        onProfile: (p) => {
          s.applyProfile(p);
          // Christopher moved the level himself; the patch below saves it.
          if ([1, 2, 3, 4].includes(p.stage as number)) {
            stageMovedRef.current = true;
            setStage(p.stage as Stage);
          }
          const { goalMet, ...profile } = p;
          if (goalMet) void markGoal(sessionId).catch(() => {});
          if (Object.keys(profile).length) void patchCourse(courseId, profile).catch(() => {});
        },
        onPronunciation: (result, phrase) => {
          s.setFeedback({ coaching: result.coaching, accuracy: Math.round(result.accuracy), phrase });
          const words = phrase
            .split(/\s+/)
            .map((w) => w.replace(/[^\p{L}\p{M}'-]/gu, ""))
            .filter(Boolean);
          words.forEach((w) => s.addVocab(w));
          void patchCourse(courseId, {
            addVocabulary: words,
            addNotes: result.accuracy < 70 ? [`${phrase}: ${result.coaching}`] : [],
          }).catch(() => {});
        },
      },
      sessionId
    );
  }

  // "Did I hear you right?": the learner fixes one of their own misheard lines.
  // Show it, save it over the stored turn, and quietly tell Christopher.
  function fixLine(id: string, text: string) {
    const was = s.editTurn(id, text);
    if (!was) return;
    const now = useSession.getState().turns.find((t) => t.id === id)!.text;
    engineRef.current?.noteCorrection(was.text, now);
    void editTurn(sessionId, was.at, now).catch(() => {});
  }

  // Learner cuts in: stop the tutor's reply and show Christopher handing the
  // turn back until the learner's words arrive (or a few seconds pass).
  function letMeTalk() {
    engineRef.current?.interrupt();
    setHandedBack(true);
  }
  useEffect(() => {
    if (!handedBack) return;
    const t = setTimeout(() => setHandedBack(false), 4000);
    return () => clearTimeout(t);
  }, [handedBack, s.turns.length]);
  useEffect(() => setHandedBack(false), [s.turns.length]);

  // Leaving without pressing End (Back, the course link, closing the tab) must
  // still hang up: an open line keeps the mic live and Christopher answering.
  useEffect(() => {
    const hangUp = () => {
      engineRef.current?.disconnect();
      engineRef.current = null;
    };
    window.addEventListener("pagehide", hangUp);
    return () => {
      window.removeEventListener("pagehide", hangUp);
      hangUp();
      useSession.getState().clearTimer();
    };
  }, []);

  // End the session: stop audio, record usage, save summary, show trial modal.
  async function end() {
    if (endedRef.current) return;
    endedRef.current = true;
    const current = s.startedAt ? Math.floor((Date.now() - s.startedAt) / 1000) : 0;
    const spent = Math.min(limit, priorRef.current + current);
    engineRef.current?.disconnect();
    engineRef.current = null;
    s.clearTimer();
    // Christopher never heard them: nothing was used, so just go back.
    if (!consumedRef.current) return onExit();
    void reportSpent(spent);
    if (s.turns.some((t) => !t.pending)) {
      setEnding(true);
      try {
        s.setSummary(await endSession(sessionId));
      } catch {
        /* best effort */
      } finally {
        setEnding(false);
      }
    }
    setBlocked(true);
    // With a postcard to show, the trial notice waits until they've read it.
    if (!useSession.getState().summary) setShowTrial(true);
  }

  const live = s.status === "live" || s.status === "connecting";
  const remaining = Math.max(0, limit - elapsed);
  // A reply still being spoken does not end the learner's turn yet.
  const lastTurn = s.turns.filter((t) => !(t.role === "agent" && t.pending)).at(-1)?.role ?? null;
  const phase = sessionPhase({
    status: s.status,
    agentSpeaking: s.agentSpeaking,
    lastTurn,
    lastError,
    ending,
    handedBack,
    mic,
    heard,
    unheard: cannotHear({ heard, quietMs }),
  });
  const ui = PHASES[phase];
  const showStage = STAGE_PHASES.has(phase);
  useSessionSounds(phase, !!s.summary && !ending);

  if (s.summary && !ending) {
    return (
      <div className="mx-auto grid max-w-4xl items-start gap-8 px-4 pb-24 pt-8 sm:px-6 md:grid-cols-[minmax(0,260px)_minmax(0,1fr)] md:gap-12">
        <div className="flex flex-col items-center text-center md:items-start md:text-left">
          <Mascot pose="postcard" priority className="w-[min(56vw,260px)] md:w-full" />
          <p className="mt-5 font-display text-2xl font-extrabold tracking-[-0.02em]">Here&apos;s your postcard.</p>
          <p className="mt-1 text-[15px] text-muted">Christopher keeps it for your next conversation.</p>
        </div>
        <div>
          <SummaryCard summary={s.summary} />
          <button type="button" onClick={() => setShowTrial(true)} className="btn mt-6">
            Done
          </button>
        </div>
        {showTrial && <TrialModal onClose={onExit} />}
      </div>
    );
  }
  const help = typeof ui.help === "function" ? ui.help(limit) : ui.help;

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 pb-24 pt-4 sm:px-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:gap-x-14 lg:gap-y-6 lg:pb-6">
      <header className="flex items-center justify-between gap-4 lg:col-span-2">
        <button type="button" onClick={onExit} className="text-[15px] font-semibold text-muted hover:text-ink">
          <span aria-hidden>‹ </span>
          {language}
        </button>
        {live && (
          <p className="text-[15px] tabular-nums text-muted" aria-live="off">
            {remaining <= 10 ? `Wrapping up in ${fmt(remaining)}` : `${fmt(remaining)} left`}
          </p>
        )}
      </header>

      {/* The card takes whatever height the words and buttons below it leave,
          so the main control is always on screen without scrolling. 11rem is
          the top bar and back link above it; 25rem on phones is that plus the
          words and buttons below (31rem with the language mix slider). On wide
          screens the column stays put while a long transcript scrolls, so End
          conversation never leaves view. */}
      <section
        aria-label="Christopher"
        className="flex flex-col items-center text-center lg:sticky lg:top-24 lg:h-[calc(100svh-11rem)] lg:items-start lg:self-start lg:text-left"
      >
        <div className="lg:min-h-48 lg:w-full lg:max-h-[480px] lg:flex-1 lg:[container-type:size]">
          <Mascot
            pose={ui.pose}
            talking={phase === "speaking"}
            level={() => engineRef.current?.outputLevel?.() ?? 0}
            priority
            className={`${
              showStage ? "w-[max(10rem,min(64vw,300px,calc((100svh-31rem)*1145/1374)))]" : "w-[max(10rem,min(64vw,300px,calc((100svh-25rem)*1145/1374)))]"
            } lg:w-[min(100cqw,100cqh*1145/1374)]`}
          />
        </div>
        <p aria-live="polite" className="mt-6 min-h-[1.3em] font-display text-2xl font-extrabold tracking-[-0.02em]">
          {ui.line}
        </p>
        {help && <div className="mt-2 max-w-[42ch] text-[15px] text-muted">{help}</div>}

        <div className="mt-6 flex min-h-13 flex-wrap items-center justify-center gap-3 lg:justify-start">
          {(phase === "mic-ask" || phase === "ready") && (
            <button type="button" onClick={connect} className="btn text-[17px]">
              <MicGlyph />
              {phase === "mic-ask" ? "Allow microphone and start" : `Start talking in ${language}`}
            </button>
          )}
          {(phase === "mic-blocked" || phase === "mic-missing" || phase === "failed" || phase === "dropped" || phase === "unheard") && (
            <button type="button" onClick={connect} className="btn">
              {phase === "dropped" ? "Reconnect" : "Try again"}
            </button>
          )}
          {phase === "speaking" && (
            <button type="button" onClick={letMeTalk} className="btn">
              Let me talk
            </button>
          )}
          {(phase === "invite" || phase === "listening" || phase === "thinking" || phase === "speaking" || phase === "handed-back" || phase === "dropped" || phase === "unheard") && (
            <button type="button" onClick={end} className="btn-quiet">
              End conversation
            </button>
          )}
        </div>
        {showStage && <StageControl stage={stage} language={language} onChange={nudgeStage} />}
      </section>

      <section aria-label="Conversation" className="min-w-0">
        {s.feedback && (
          <div className="mb-4 rounded-2xl p-4 shadow-[inset_0_0_0_1.5px_var(--correct)]">
            <p className="text-sm font-semibold text-correct">Try it like this</p>
            <p className="mt-1 font-display text-lg font-bold">{s.feedback.phrase}</p>
            <p className="mt-1 text-[15px]">{s.feedback.coaching}</p>
          </div>
        )}
        <div role="log" aria-live="polite" aria-label="Transcript" className="grid gap-2.5">
          {s.turns.length === 0 ? (
            <p className="rounded-2xl bg-card-2 px-5 py-4 text-[15px] text-muted">
              Your conversation appears here as you talk, so you can read back anything you missed. If Christopher mishears you, tap your line to fix it.
            </p>
          ) : (
            <>
              {s.turns.map((t) => (
                <Line
                  key={t.id}
                  role={t.role}
                  text={t.text}
                  pending={t.pending}
                  translation={t.translation}
                  edited={t.edited}
                  onEdit={t.role === "user" ? (text) => fixLine(t.id, text) : undefined}
                />
              ))}
            </>
          )}
        </div>
      </section>

      {showTrial && <TrialModal onClose={onExit} />}
    </div>
  );
}

// Where the language mix can be changed: before starting and while talking,
// not while something is wrong or the postcard is being written.
const STAGE_PHASES = new Set<Phase>(["mic-ask", "ready", "connecting", "invite", "listening", "thinking", "speaking", "handed-back"]);

// Pose, headline and help for each state of the conversation screen.
const PHASES: Record<Phase, { pose: MascotPose; line: string; help?: React.ReactNode | ((limit: number) => React.ReactNode) }> = {
  "mic-ask": {
    pose: "mic-ask",
    line: "Can I hear you?",
    help: "Your browser will ask for the microphone. Christopher only listens while this conversation is open.",
  },
  ready: {
    pose: "idle",
    line: "Ready when you are.",
    help: (limit) => `Your free conversation lasts ${limit} seconds. Say hello and Christopher takes it from there.`,
  },
  "mic-blocked": {
    pose: "mic-blocked",
    line: "Christopher can't hear you yet",
    help: (
      <ol className="mt-1 list-decimal space-y-1 pl-5 text-left">
        <li>Click the lock or settings icon next to the web address.</li>
        <li>Set Microphone to Allow.</li>
        <li>Come back here and press Try again.</li>
      </ol>
    ),
  },
  "mic-missing": {
    pose: "mic-blocked",
    line: "No microphone found",
    help: "Plug in a headset or microphone, or open Christopher on your phone, then try again.",
  },
  connecting: { pose: "reconnecting", line: "Getting Christopher on the line…" },
  invite: {
    pose: "listen",
    line: "Say hello to start.",
    help: "Christopher is on the line. Say it out loud and he answers.",
  },
  listening: { pose: "listen", line: "Listening. Take your time." },
  unheard: {
    pose: "mic-blocked",
    line: "Christopher cannot hear you yet",
    help: "Say hello. If nothing happens, check that the right microphone is selected and not muted, then press Try again.",
  },
  thinking: { pose: "think", line: "Thinking about what you said" },
  speaking: { pose: "speak", line: "Christopher is speaking" },
  "handed-back": { pose: "goahead", line: "Go ahead, he's listening" },
  dropped: {
    pose: "reconnecting",
    line: "The connection dropped",
    help: "What you've said so far is saved. Reconnect to keep going.",
  },
  failed: {
    pose: "reconnecting",
    line: "Christopher couldn't connect",
    help: "This is usually the network. Check your connection and try again.",
  },
  saving: { pose: "postcard", line: "Writing your postcard…" },
};

function Line({
  role,
  text,
  pending,
  translation,
  edited,
  onEdit,
}: {
  role: "user" | "agent";
  text: string;
  pending?: boolean;
  translation?: string;
  edited?: boolean;
  onEdit?: (text: string) => void; // the learner's own lines: fix what was misheard
}) {
  const mine = role === "user";
  const [draft, setDraft] = useState<string | null>(null); // null = not editing
  const lineRef = useRef<HTMLButtonElement>(null);
  const fieldId = useId();
  // A slot with no words yet: the learner was heard and is being written down.
  if (!text && !(pending && mine)) return null;
  const bubble = `max-w-[88%] rounded-2xl px-4 py-2.5 text-[16px] leading-snug ${
    mine ? "justify-self-end bg-[color-mix(in_srgb,var(--learner)_36%,var(--card))]" : "bg-card"
  }`;

  const close = (save: boolean) => {
    if (save && draft !== null) onEdit?.(draft);
    setDraft(null);
    requestAnimationFrame(() => lineRef.current?.focus());
  };
  if (draft !== null) {
    return (
      <form
        className={`${bubble} w-full`}
        onSubmit={(e) => {
          e.preventDefault();
          close(true);
        }}
      >
        <label className="sr-only" htmlFor={fieldId}>
          What you said
        </label>
        <textarea
          id={fieldId}
          dir="auto"
          autoFocus
          rows={2}
          maxLength={500}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              close(true);
            } else if (e.key === "Escape") {
              e.preventDefault();
              close(false);
            }
          }}
          className="block w-full resize-none rounded-xl border-[1.5px] border-line bg-paper px-3 py-2 text-ink"
        />
        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={() => close(false)} className="btn-quiet px-4 py-2 text-[15px]">
            Cancel
          </button>
          <button type="submit" disabled={!draft.trim()} className="btn px-4 py-2 text-[15px]">
            Save
          </button>
        </div>
      </form>
    );
  }

  const words = (
    <>
      <span className="sr-only">{mine ? "You: " : "Christopher: "}</span>
      {text || "…"}
      {edited && <span className="ml-1.5 text-[13px] text-muted">(edited)</span>}
      {translation && (
        <span dir="ltr" lang="en" className="mt-1 block text-[14px] text-muted">
          <span className="sr-only">In English: </span>({translation})
        </span>
      )}
    </>
  );
  // Speech-to-text sometimes mishears a name or a word: a tap opens the line to fix it.
  if (onEdit && !pending) {
    return (
      <button
        ref={lineRef}
        type="button"
        dir="auto"
        onClick={() => setDraft(text)}
        title="Misheard? Tap to fix it"
        className={`${bubble} cursor-text text-start transition-shadow hover:shadow-[inset_0_0_0_1.5px_var(--learner)]`}
      >
        {words}
        <span className="sr-only"> Misheard? Press to fix it.</span>
      </button>
    );
  }
  return (
    <p dir="auto" className={`${bubble} ${pending ? "text-muted" : ""}`}>
      {words}
    </p>
  );
}

function MicGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <path d="M12 19v3" />
    </svg>
  );
}

// Compare lines loosely, so an "English" translation of an English line is hidden.
function plain(t: string) {
  return t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const r = sec % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
