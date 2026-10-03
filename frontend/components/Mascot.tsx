"use client";

import { useEffect, useRef, useState } from "react";
import PATCHES from "../lib/mascotPatches.json";
import { nextMouth, type Mouth } from "../lib/mouth";

export type MascotPose =
  | "idle"
  | "wave"
  | "listen"
  | "think"
  | "speak"
  | "goahead"
  | "mic-ask"
  | "mic-blocked"
  | "reconnecting"
  | "postcard"
  | "empty";

// Pose -> file in public/mascot. The three speak-* frames were generated
// separately and don't line up, so talking uses one open-mouth frame plus
// motion rather than frame swaps.
const FILE: Record<MascotPose, string> = {
  idle: "idle",
  wave: "wave",
  listen: "listen",
  think: "think",
  speak: "speak-open",
  goahead: "goahead",
  "mic-ask": "mic-ask",
  "mic-blocked": "mic-blocked",
  reconnecting: "reconnecting",
  postcard: "postcard",
  empty: "empty",
};
const still = (p: MascotPose) => `/mascot/${FILE[p]}.webp`;

// Short looping clips per pose (image-to-video). Add an entry, e.g.
// idle: "/mascot/video/idle.webm", to switch that pose from still to clip.
const VIDEO: Partial<Record<MascotPose, string>> = {};

type Layer = { pose: MascotPose; id: number };

// The mouth follows the loudness of his voice: each animation frame reads the
// level and, only when the frame changes, sets data-mouth on the frame element
// (CSS shows the matching patch). No React render per frame. Reduced motion
// gets just open and closed, held a little longer so it stays gentle.
function useMouth(
  frame: React.RefObject<HTMLDivElement | null>,
  talking: boolean,
  level: React.RefObject<(() => number) | undefined>
) {
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    if (!talking || !level.current) {
      el.dataset.mouth = talking ? "open" : "closed";
      return;
    }
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const hold = reduced ? 180 : 60; // ms a frame stays before it may change
    let mouth: Mouth = "closed";
    let since = 0;
    let raf = 0;
    el.dataset.mouth = mouth;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const next = nextMouth(mouth, level.current?.() ?? 0, reduced);
      if (next === mouth || now - since < hold) return;
      mouth = next;
      since = now;
      el.dataset.mouth = mouth;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      el.dataset.mouth = "closed";
    };
  }, [frame, talking, level]);
}
const FADE_MS = 560;

// Tilts the frame's contents a few degrees toward the pointer, like a photo
// catching the light. Mouse devices only; skipped for reduced motion and while
// the mascot is off screen.
function useTilt(frame: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let visible = false;
    let raf = 0;
    let px = 0;
    let py = 0;
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
    });
    io.observe(el);
    const apply = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      // -1..1 from the frame's centre, damped beyond one frame-width away
      const x = Math.max(-1, Math.min(1, (px - (r.left + r.width / 2)) / r.width));
      const y = Math.max(-1, Math.min(1, (py - (r.top + r.height / 2)) / r.height));
      el.style.setProperty("--tilt-x", `${(-y * 4).toFixed(2)}deg`);
      el.style.setProperty("--tilt-y", `${(x * 5).toFixed(2)}deg`);
      el.style.setProperty("--light-x", `${(50 + x * 30).toFixed(1)}%`);
      el.style.setProperty("--light-y", `${(35 + y * 25).toFixed(1)}%`);
    };
    const onMove = (e: PointerEvent) => {
      px = e.clientX;
      py = e.clientY;
      if (visible && !raf) raf = requestAnimationFrame(apply);
    };
    addEventListener("pointermove", onMove, { passive: true });
    return () => {
      removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [frame]);
}

// Christopher, framed like a photo on a postcard. Pose changes dissolve;
// `talking` adds a speech bob while the tutor's audio plays; `level` (his voice
// loudness, 0..1) moves his mouth with it. Without a level the mouth stays open.
export default function Mascot({
  pose,
  talking = false,
  level,
  priority = false,
  className = "",
}: {
  pose: MascotPose;
  talking?: boolean;
  level?: () => number;
  priority?: boolean;
  className?: string;
}) {
  const [layers, setLayers] = useState<Layer[]>([{ pose, id: 0 }]);
  const settleRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const levelRef = useRef(level);
  levelRef.current = level;
  useTilt(frameRef);
  useMouth(frameRef, talking && pose === "speak", levelRef);

  // Decode the next pose before fading to it, so the swap never shows a
  // half-loaded image; a newer pose request wins over a slower older one.
  useEffect(() => {
    let alive = true;
    const img = new Image();
    img.src = still(pose);
    img
      .decode()
      .catch(() => {})
      .then(() => {
        if (!alive) return;
        setLayers((ls) => {
          const top = ls[ls.length - 1];
          return top.pose === pose ? ls : [top, { pose, id: top.id + 1 }];
        });
      });
    return () => {
      alive = false;
    };
  }, [pose]);

  // Drop the outgoing layer once the dissolve has finished. While it runs, the
  // body dips and recovers a touch, like shifting weight into the new pose.
  useEffect(() => {
    if (layers.length < 2) return;
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
      settleRef.current?.animate(
        [
          { transform: "none" },
          { transform: "translateY(3px) scaleY(0.988)", offset: 0.35 },
          { transform: "translateY(-1.5px) scaleY(1.004)", offset: 0.7 },
          { transform: "none" },
        ],
        { duration: 620, easing: "ease-in-out" }
      );
    }
    const t = setTimeout(() => setLayers((ls) => ls.slice(-1)), FADE_MS + 40);
    return () => clearTimeout(t);
  }, [layers]);

  // Warm the cache so the first switch to any pose, or the first word, doesn't flash empty.
  useEffect(() => {
    const t = setTimeout(() => {
      (Object.keys(FILE) as MascotPose[]).forEach((p) => {
        new Image().src = still(p);
      });
      ["half", "closed"].forEach((m) => {
        new Image().src = `/mascot/patch/speak-${m}.webp`;
      });
    }, 1200);
    return () => clearTimeout(t);
  }, []);

  return (
    <div ref={frameRef} className={`mascot ${talking ? "is-talking" : ""} ${className}`}>
      {/* tilt > settle > sway > breathe/talk > pose layers: one motion per element so they stack */}
      <div className="mascot-tilt">
        <div ref={settleRef} className="mascot-settle">
          <div className="mascot-sway">
            <div className="mascot-body">
              {layers.map((l, i) => (
                <PoseLayer
                  key={l.id}
                  pose={l.pose}
                  state={layers.length > 1 ? (i === layers.length - 1 ? "is-entering" : "is-leaving") : ""}
                  priority={priority && i === 0}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="mascot-sheen" aria-hidden />
    </div>
  );
}

// One pose: its looping clip if there is one, otherwise the still, plus the
// mouth patches when it's the speaking pose.
function PoseLayer({ pose, state, priority }: { pose: MascotPose; state: string; priority: boolean }) {
  const cls = `mascot-layer ${state}`;
  const clip = VIDEO[pose];
  if (clip) {
    return <video className={cls} src={clip} poster={still(pose)} autoPlay loop muted playsInline aria-hidden />;
  }
  return (
    <div className={cls}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={still(pose)}
        alt=""
        draggable={false}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        className="mascot-still"
      />
      {pose === "speak" &&
        (["half", "closed"] as const).map((m) => {
          const box = PATCHES["speak-open"][`speak-${m}`];
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={m}
              src={`/mascot/patch/speak-${m}.webp`}
              alt=""
              draggable={false}
              className={`mascot-mouth mascot-mouth-${m}`}
              style={{ left: `${box.left}%`, top: `${box.top}%`, width: `${box.width}%`, height: `${box.height}%` }}
            />
          );
        })}
    </div>
  );
}
