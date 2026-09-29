"use client";

import { useEffect, type RefObject } from "react";

// Calls `draw(progress)` on scroll (rAF-throttled) with 0..1 progress for `ref`.
//   mode "pin": progress through a tall section whose child is sticky.
//   mode "top": progress over the first `span` viewports of page scroll.
// With prefers-reduced-motion, draw runs once with `rest` and never again.
export function useScrollScene(
  ref: RefObject<HTMLElement | null>,
  draw: (p: number) => void,
  { mode = "pin", span = 0.7, rest = 1 }: { mode?: "pin" | "top"; span?: number; rest?: number } = {}
) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      draw(rest);
      return;
    }
    const clamp = (v: number) => Math.min(1, Math.max(0, v));
    const measure = () => {
      const vh = innerHeight;
      if (mode === "top") return clamp(scrollY / (vh * span));
      const r = el.getBoundingClientRect();
      return clamp(-r.top / Math.max(1, r.height - vh));
    };
    let raf = 0;
    const tick = () => {
      raf = 0;
      draw(measure());
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    tick();
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onScroll);
    };
    // draw is expected to be stable (defined outside render or memoised)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, mode, span, rest]);
}
