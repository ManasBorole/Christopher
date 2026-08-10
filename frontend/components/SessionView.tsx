"use client";

import { useEffect, useRef, useState } from "react";
import { RealtimeEngine } from "../lib/engine/RealtimeEngine";
import type { ConversationEngine } from "../lib/engine/ConversationEngine";
import { useSession } from "../store/useSession";
import { addTurn as persistTurn, patchCourse, endSession, getUsage, reportSpent, consumeUsage } from "../lib/api";
import { isMeaningfulTranscript } from "../lib/transcript";
import { MicIcon, Dots, Bubble } from "./ui";
import TrialModal from "./TrialModal";

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
  const consumedRef = useRef(false);
  const [partial, setPartial] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [ending, setEnding] = useState(false);
  const [showTrial, setShowTrial] = useState(false);
  const [limit, setLimit] = useState(60);
  const [blocked, setBlocked] = useState(false);

  // fresh conversation + check remaining free allowance
  useEffect(() => {
    useSession.getState().begin(courseId, sessionId, language, userName);
    endedRef.current = false;
    getUsage().then((u) => {
      setLimit(u.secondsPerSession);
      if (u.blocked) setBlocked(true);
    });
  }, [courseId, sessionId, language, userName]);

  // timer + hard 60s cutoff
  useEffect(() => {
    if (!s.startedAt) return;
    const t = setInterval(() => {
      const e = Math.floor((Date.now() - s.startedAt!) / 1000);
      setElapsed(e);
      if (e >= limit && !endedRef.current) end(); // free time up -> stop hard
    }, 500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.startedAt, limit]);

  async function connect() {
    if (blocked) return setShowTrial(true);
    const engine = new RealtimeEngine();
    engineRef.current = engine;
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
          if (st === "live") {
            s.start(Date.now());
            if (!consumedRef.current) {
              consumedRef.current = true; // consume the free session exactly once
              void consumeUsage();
            }
          }
          if (st === "idle" || st === "error") s.clearTimer();
        },
        onSpeaking: (b) => s.setSpeaking(b),
        onTranscript: (role, text, done) => {
          if (role === "agent" && !done) return setPartial((p) => p + text);
          const finalText = (role === "agent" ? text || partial : text).trim();
          if (role === "agent") setPartial("");
          // Drop empty / punctuation-only artefacts (noise mis-transcribed as speech)
          // so they never become a chat message or get persisted.
          if (!isMeaningfulTranscript(finalText)) return;
          s.addTurn({ role, text: finalText, at: Date.now() });
          void persistTurn(sessionId, role, finalText, Date.now()).catch(() => {});
        },
        onProfile: (p) => {
          s.applyProfile(p);
          void patchCourse(courseId, p).catch(() => {});
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

  // End the session: stop audio, record usage, save summary, show trial modal.
  async function end() {
    if (endedRef.current) return;
    endedRef.current = true;
    const spent = s.startedAt ? Math.min(limit, Math.floor((Date.now() - s.startedAt) / 1000)) : 0;
    engineRef.current?.disconnect();
    engineRef.current = null;
    s.clearTimer();
    void reportSpent(spent);
    if (s.turns.length > 0) {
      setEnding(true);
      try {
        await endSession(sessionId);
      } catch {
        /* best effort */
      } finally {
        setEnding(false);
      }
    }
    setBlocked(true);
    setShowTrial(true);
  }

  const live = s.status === "live" || s.status === "connecting";
  const remaining = Math.max(0, limit - elapsed);
  const status =
    s.status === "error"
      ? s.error || "Connection error - check backend + keys."
      : ending
        ? "Saving your lesson summary..."
        : s.agentSpeaking
          ? "Tutor speaking..."
          : live
            ? "Listening..."
            : "Tap to start talking";

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 px-6 py-10">
      <div className="flex w-full items-center justify-between">
        <button onClick={onExit} className="btn-ghost px-4 py-1.5 text-sm">
          &larr; Dashboard
        </button>
        <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
          <span className="glass rounded-full px-3 py-1">{language}</span>
          {live && (
            <span
              className="glass rounded-full px-3 py-1 tabular-nums"
              style={{ color: remaining <= 10 ? "#fb7185" : undefined, borderColor: remaining <= 10 ? "rgba(251,113,133,.4)" : undefined }}
            >
              {fmt(remaining)} left
            </span>
          )}
        </div>
      </div>

      {/* free-trial notice before starting */}
      {!live && !showTrial && (
        <div className="glass mt-2 rounded-full px-4 py-2 text-xs text-[var(--muted)]">
          <span className="text-emerald-300">Free trial:</span> {limit} seconds with your tutor.
        </div>
      )}

      <button
        onClick={live ? end : connect}
        aria-label={live ? "End session" : "Start speaking"}
        className="relative mt-2 grid h-44 w-44 place-items-center rounded-full transition-transform duration-300 hover:scale-[1.03] active:scale-95"
      >
        {live && (
          <>
            <span className="pulsering absolute inset-0 rounded-full" style={{ background: "rgba(52,211,153,.25)" }} />
            <span className="pulsering absolute inset-0 rounded-full" style={{ background: "rgba(34,211,238,.2)", animationDelay: "1s" }} />
          </>
        )}
        <span
          className="grid h-full w-full place-items-center rounded-full text-lg font-semibold"
          style={{
            background: live ? "linear-gradient(140deg,#fb7185,#ef4444)" : "linear-gradient(140deg,var(--c1),var(--c2))",
            color: "#050810",
            boxShadow: live
              ? "0 20px 60px -12px rgba(239,68,68,.6), inset 0 2px 0 rgba(255,255,255,.4)"
              : "0 20px 60px -12px rgba(52,211,153,.6), inset 0 2px 0 rgba(255,255,255,.45)",
          }}
        >
          {s.status === "connecting" ? <Dots /> : live ? "End" : <MicIcon />}
        </span>
      </button>
      <p className="h-5 text-sm text-[var(--muted)]" aria-live="polite">
        {status}
      </p>

      {s.feedback && (
        <div className="glass w-full max-w-lg rounded-2xl p-4 animate-fadeup" style={{ borderColor: "rgba(52,211,153,.2)" }}>
          <div className="mb-1 flex items-center justify-between text-xs text-emerald-300/80">
            <span>Pronunciation &middot; "{s.feedback.phrase}"</span>
            <span className="tabular-nums">{s.feedback.accuracy}/100</span>
          </div>
          <p className="text-sm">{s.feedback.coaching}</p>
        </div>
      )}

      {(s.turns.length > 0 || partial) && (
        <div className="w-full max-w-lg space-y-2">
          {s.turns.map((t, i) => (
            <Bubble key={i} role={t.role} text={t.text} />
          ))}
          {partial && <Bubble role="agent" text={partial} faint />}
        </div>
      )}

      {showTrial && <TrialModal onClose={onExit} />}
    </div>
  );
}

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const r = sec % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
