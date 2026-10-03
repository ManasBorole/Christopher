"use client";

import { useEffect, useRef } from "react";
import { useSession } from "../store/useSession";
import type { Phase } from "./sessionPhase";

// Small paper-and-ink sounds, synthesised with Web Audio (no audio files):
// a swish when the postcard turns over, a soft stamp when the learner sets the
// language mix, a two-note chime the first time Christopher is listening in a
// conversation. Plus a very short buzz on phones that support it. Only the app
// uses these; the landing never imports this file.

const KEY = "chr-sounds";
const VOLUME = 0.12; // master level. Calibration knob: these sit well under speech.

let ctx: AudioContext | null = null;
let out: GainNode | null = null;
let on: boolean | null = null;

export function soundsOn(): boolean {
  if (on === null) {
    try {
      on = localStorage.getItem(KEY) !== "off";
    } catch {
      on = true;
    }
  }
  return on;
}

export function setSoundsOn(v: boolean) {
  on = v;
  try {
    if (v) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, "off");
  } catch {
    /* not saved, still applies for this visit */
  }
}

// Create (or wake) the one shared AudioContext. Call from a user gesture so
// browsers let it make sound.
export function unlockSounds() {
  if (!soundsOn() || typeof window === "undefined" || !window.AudioContext) return;
  if (!ctx) {
    ctx = new AudioContext();
    out = ctx.createGain();
    out.gain.value = VOLUME;
    out.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});
}

// The context, if sound may play right now: switched on, unlocked by a
// gesture earlier, and Christopher not talking.
function ready(): AudioContext | null {
  if (!soundsOn() || !ctx || ctx.state !== "running") return null;
  if (useSession.getState().agentSpeaking) return null;
  return ctx;
}

function buzz(ms: number) {
  if (!soundsOn()) return;
  try {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    navigator.vibrate?.(ms);
  } catch {
    /* no haptics here */
  }
}

function noise(c: AudioContext, seconds: number) {
  const b = c.createBuffer(1, Math.ceil(c.sampleRate * seconds), c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = c.createBufferSource();
  s.buffer = b;
  return s;
}

// A gain that rises over `attack` seconds to `peak`, then fades out by `end`.
function envelope(c: AudioContext, t: number, peak: number, attack: number, end: number) {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + end);
  g.connect(out!);
  return g;
}

// Paper sliding over paper: band-passed noise sweeping upward, soft edges.
export function swish() {
  const c = ready();
  if (!c) return;
  const t = c.currentTime + 0.02;
  const n = noise(c, 0.45);
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.Q.value = 0.8;
  f.frequency.setValueAtTime(700, t);
  f.frequency.exponentialRampToValueAtTime(2600, t + 0.35);
  n.connect(f).connect(envelope(c, t, 0.5, 0.12, 0.42));
  n.start(t);
  n.stop(t + 0.45);
}

// A rubber stamp landing: a low muted knock with a little paper in it.
// `delay` lines it up with the postmark's squash in StageControl.
export function stamp(delay = 0) {
  buzz(10);
  const c = ready();
  if (!c) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(55, t + 0.12);
  o.connect(envelope(c, t, 0.9, 0.005, 0.16));
  o.start(t);
  o.stop(t + 0.18);
  const n = noise(c, 0.06);
  const f = c.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = 900;
  n.connect(f).connect(envelope(c, t, 0.35, 0.003, 0.05));
  n.start(t);
  n.stop(t + 0.06);
}

// Two soft bell notes, a fourth apart: "your turn".
export function chime() {
  const c = ready();
  if (!c) return;
  buzz(8);
  const t = c.currentTime + 0.02;
  [784, 1047].forEach((hz, i) => {
    const at = t + i * 0.13;
    const o = c.createOscillator();
    o.frequency.value = hz;
    o.connect(envelope(c, at, 0.35, 0.012, 0.9));
    o.start(at);
    o.stop(at + 0.95);
  });
}

// The conversation screen's sounds. Any tap or key on it unlocks audio; the
// chime plays once per conversation, the first time Christopher settles into
// listening after hearing the learner (held briefly so a gap between his
// sentences never sets it off); the swish plays as the postcard appears.
export function useSessionSounds(phase: Phase, postcard: boolean) {
  const chimed = useRef(false);
  useEffect(() => {
    document.addEventListener("pointerdown", unlockSounds);
    document.addEventListener("keydown", unlockSounds);
    return () => {
      document.removeEventListener("pointerdown", unlockSounds);
      document.removeEventListener("keydown", unlockSounds);
    };
  }, []);
  useEffect(() => {
    if (phase !== "listening" || chimed.current) return;
    const t = setTimeout(() => {
      chimed.current = true;
      chime();
    }, 600);
    return () => clearTimeout(t);
  }, [phase]);
  useEffect(() => {
    if (postcard) swish();
  }, [postcard]);
}
