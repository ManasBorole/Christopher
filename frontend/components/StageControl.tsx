"use client";

import { useRef, useState } from "react";
import { stageLabel } from "../lib/stage";
import { findLanguage } from "../lib/languages";

export type Stage = 1 | 2 | 3 | 4;
const STOPS: Stage[] = [1, 2, 3, 4];

// How much English Christopher speaks: an airmail stripe from English to the
// course language with four stamps, and a postmark on the current one. Tap a
// stamp, drag the postmark, or use the arrow keys. Unknown (null) sits between
// "English and X" and "Mostly X", so the first arrow lands on one of those.
export default function StageControl({
  stage,
  language,
  onChange,
}: {
  stage: Stage | null;
  language: string;
  onChange: (stage: Stage) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<number | null>(null); // 0..1 while the postmark is held
  const [stamps, setStamps] = useState(0); // learner changes, to replay the stamp
  const label = stage === null ? "Finding your level" : stageLabel(stage, language);
  const lang = findLanguage(language);
  const code = (lang?.code ?? language.slice(0, 2)).toUpperCase();

  function choose(n: Stage) {
    setStamps((k) => k + 1);
    if (n !== stage) onChange(n);
  }
  function at(clientX: number) {
    const r = trackRef.current!.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width));
  }
  const nearest = (f: number) => (Math.round(f * 3) + 1) as Stage;

  function onKeyDown(e: React.KeyboardEvent) {
    const up = e.key === "ArrowRight" || e.key === "ArrowUp";
    const down = e.key === "ArrowLeft" || e.key === "ArrowDown";
    let n: number | null = null;
    if (up) n = stage === null ? 3 : stage + 1;
    else if (down) n = stage === null ? 2 : stage - 1;
    else if (e.key === "Home") n = 1;
    else if (e.key === "End") n = 4;
    else return;
    e.preventDefault();
    if (n >= 1 && n <= 4 && n !== stage) choose(n as Stage);
  }

  const shown = drag ?? (stage === null ? null : (stage - 1) / 3);
  return (
    <div className="stage-control mt-5 w-full max-w-[340px]">
      <style href="stage-control" precedence="default">{CSS}</style>
      <p aria-live="polite" className="min-h-[1.6em] text-[19px] leading-snug">
        <span key={label} className={`stage-ink font-hand ${stage === null ? "text-muted" : ""}`}>
          {label}
        </span>
      </p>
      <div dir="ltr" className="flex items-center gap-2.5">
        <span aria-hidden className="w-6 text-[12px] font-bold tracking-[0.08em] text-muted">
          EN
        </span>
        <div
          role="slider"
          tabIndex={0}
          aria-label="How much English Christopher speaks"
          aria-valuemin={1}
          aria-valuemax={4}
          aria-valuenow={stage ?? undefined}
          aria-valuetext={label}
          onKeyDown={onKeyDown}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            setDrag(at(e.clientX));
          }}
          onPointerMove={(e) => drag !== null && setDrag(at(e.clientX))}
          onPointerUp={(e) => {
            if (drag === null) return;
            setDrag(null);
            choose(nearest(at(e.clientX)));
          }}
          onPointerCancel={() => setDrag(null)}
          className="relative h-11 flex-1 cursor-pointer touch-pan-y rounded-full px-3"
        >
          <div ref={trackRef} className="relative h-full">
            <span aria-hidden className="stage-stripe absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full" />
            {STOPS.map((n) => (
              <span
                key={n}
                aria-hidden
                style={{ left: `${((n - 1) / 3) * 100}%` }}
                className="stage-stamp absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
              />
            ))}
            <span
              aria-hidden
              style={{ left: `${(shown ?? 0) * 100}%` }}
              className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 ${
                drag === null ? "transition-[left,opacity] duration-300 ease-out" : ""
              } ${shown === null ? "opacity-0" : ""}`}
            >
              <span key={stamps} className={`stage-postmark block ${stamps ? "is-stamped" : ""}`} />
            </span>
          </div>
        </div>
        <span aria-hidden title={lang?.native} className="w-6 text-right text-[12px] font-bold tracking-[0.08em] text-muted">
          {code}
        </span>
      </div>
    </div>
  );
}

const CSS = `
.stage-stripe {
  background: var(--card) repeating-linear-gradient(135deg, var(--stamp) 0 6px, transparent 6px 10px, var(--correct) 10px 16px, transparent 16px 20px);
  box-shadow: 0 0 0 1px var(--line);
}
/* a small stamp with a perforated edge: holes punched in the padding ring only */
.stage-stamp {
  --r: 1.75px;
  width: 21px;
  height: 26px;
  padding: calc(2 * var(--r));
  background: var(--card);
  mask: radial-gradient(var(--r), #0000 98%, #000) round calc(-1.5 * var(--r)) calc(-1.5 * var(--r)) / calc(3 * var(--r)) calc(3 * var(--r)),
    linear-gradient(#000 0 0) content-box;
}
.stage-stamp::after {
  content: "";
  display: block;
  height: 100%;
  border-radius: 1px;
  background: color-mix(in srgb, var(--correct) 16%, var(--card));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--correct) 35%, var(--card));
}
.stage-postmark {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 2px solid var(--stamp);
  box-shadow: inset 0 0 0 2.5px var(--card), inset 0 0 0 3.5px var(--stamp);
  background: color-mix(in srgb, var(--stamp) 10%, transparent);
  opacity: 0.9;
  transform: rotate(-12deg);
}
.stage-postmark.is-stamped {
  animation: stage-thump 0.32s cubic-bezier(0.3, 1.6, 0.5, 1);
}
@keyframes stage-thump {
  0% { transform: rotate(-12deg) scale(1.35); opacity: 0.4; }
  60% { transform: rotate(-12deg) scale(0.92); }
  100% { transform: rotate(-12deg) scale(1); }
}
.stage-ink {
  display: inline-block;
  animation: stage-ink 0.45s ease-out;
}
@keyframes stage-ink {
  from { opacity: 0; filter: blur(1.5px); }
}
`;
