import type * as THREE from "three";
import { clamp } from "./math";

/* The copy panels ("beats") and the page timeline. q is page scroll 0..1; the
   story p runs over the first QP of the page, the ending over the last QE. */
export const QP = 0.4545, QE = 0.436;

export type Beat = {
  el: HTMLElement;
  r: number[]; // in-start, in-end, out-start, out-end (page q)
  on: boolean;
  m: string | null; // current mask, to skip identical writes
  ex: number; // left edge, so the dust front lines up with the text
  ndc: [number, number, number, number] | null; // panel as an NDC rect, for the flock to steer around
  // text dust for this panel (set once the dust layer has measured it)
  pts?: THREE.Points;
  glow?: THREE.Points;
  dl?: number;
  dw?: number;
  span: number;
};

export function readBeats(stage: HTMLElement): Beat[] {
  return [...stage.querySelectorAll<HTMLElement>(".beat")].map((el) => ({
    el,
    r: (el.dataset.r ?? "").split(",").map(Number).map((v) => (v < 0 || v > 2 ? v : v * QP)),
    on: false,
    m: null,
    ex: 0,
    ndc: null,
    span: 1,
  }));
}

function setMask(b: Beat, m: string) {
  if (b.m === m) return;
  b.m = m;
  b.el.style.maskImage = m || "none";
  b.el.style.webkitMaskImage = m || "none";
}

// text leaves as dust blown by the wind (and gathers back on the way in); the DOM stays the source of truth
export function updateHTML(beats: Beat[], q: number, reveal: number, RM: boolean) {
  for (const b of beats) {
    const [i0, i1, o0, o1] = b.r;
    const on = (i0 < 0 || q > i0) && q < o1;
    b.el.classList.toggle("on", on);
    b.on = on;
    if (!on) continue;
    if (RM) {
      setMask(b, "");
      continue;
    }
    const a = i0 < 0 ? reveal : clamp((q - i0) / (i1 - i0)), x = clamp((q - o0) / (o1 - o0));
    let m = "";
    if (b.dw === undefined || b.dl === undefined) m = a < 1 ? "linear-gradient(transparent,transparent)" : "";
    else if (a < 1) {
      const X = b.dl - b.span - 8 + a * (b.dw + b.span + 16) - b.ex;
      m = `linear-gradient(90deg,#000 ${(X - 4).toFixed(1)}px,transparent ${(X + 4).toFixed(1)}px)`;
    } else if (x > 0) {
      const X = b.dl - 8 + x * (b.dw + b.span + 16) - b.ex;
      m = `linear-gradient(90deg,transparent ${(X - 4).toFixed(1)}px,#000 ${(X + 4).toFixed(1)}px)`;
    }
    setMask(b, m);
  }
}

// copy panels as NDC rectangles (cached; beats never move, only their inner lines do)
export function measureBeats(beats: Beat[]) {
  const m = 22;
  for (const b of beats) {
    const r = { left: 1e9, right: -1e9, top: 1e9, bottom: -1e9 };
    for (const ch of b.el.children) {
      const q = ch.getBoundingClientRect();
      if (!q.width) continue;
      r.left = Math.min(r.left, q.left);
      r.right = Math.max(r.right, q.right);
      r.top = Math.min(r.top, q.top);
      r.bottom = Math.max(r.bottom, q.bottom);
    }
    if (r.left > r.right) continue;
    b.ndc = [
      ((r.left - m) / innerWidth) * 2 - 1,
      ((r.right + m) / innerWidth) * 2 - 1,
      1 - ((r.bottom + m) / innerHeight) * 2,
      1 - ((r.top - m) / innerHeight) * 2,
    ];
  }
}
