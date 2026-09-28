"use client";

import { useEffect, useRef, useState } from "react";
import PATCHES from "../lib/mascotPatches.json";

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
type Mouth = "open" | "half" | "closed";

// Speech-like mouth rhythm: short syllables with a pause every few, never a
// metronome. Without real audio levels this is the closest honest stand-in.
function useMouth(talking: boolean): Mouth {
  const [mouth, setMouth] = useState<Mouth>("closed");
  useEffect(() => {
    if (!talking) {
      setMouth("closed");
      return;
    }
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setMouth("open");
      return;
    }
    let t: ReturnType<typeof setTimeout>;
    let left = 0; // syllables until the next breath
    const next = () => {
      if (left <= 0) {
        left = 4 + Math.floor(Math.random() * 6);
        setMouth("closed");
        t = setTimeout(next, 240 + Math.random() * 300);
        return;
      }
      left--;
      const r = Math.random();
      setMouth(r < 0.45 ? "open" : r < 0.82 ? "half" : "closed");
      t = setTimeout(next, 95 + Math.random() * 85);
    };
    next();
    return () => clearTimeout(t);
  }, [talking]);
  return mouth;
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
// `talking` moves his mouth and adds a speech bob while the tutor's audio plays.
export default function Mascot({
  pose,
  talking = false,
  priority = false,
  className = "",
}: {
  pose: MascotPose;
  talking?: boolean;
  priority?: boolean;
  className?: string;
}) {
  const [layers, setLayers] = useState<Layer[]>([{ pose, id: 0 }]);
  const mouth = useMouth(talking && pose === "speak");
  const settleRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  useTilt(frameRef);

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

  // Warm the cache so the first switch to any pose doesn't flash empty.
  useEffect(() => {
    const t = setTimeout(() => {
      (Object.keys(FILE) as MascotPose[]).forEach((p) => {
        new Image().src = still(p);
      });
    }, 1200);
    return () => clearTimeout(t);
  }, []);

  return (
    <div ref={frameRef} className={`mascot ${talking ? "is-talking" : ""} ${className}`}>
      <div className="mascot-tilt">
      {/* settle > sway > breathe/talk > pose layers: each motion on its own element so they stack */}
      <div ref={settleRef} className="mascot-settle">
      <div className="mascot-sway">
        <div className="mascot-body">
      {layers.map((l, i) => {
        const cls = `mascot-layer ${layers.length > 1 ? (i === layers.length - 1 ? "is-entering" : "is-leaving") : ""}`;
        const clip = VIDEO[l.pose];
        return clip ? (
          <video key={l.id} className={cls} src={clip} poster={still(l.pose)} autoPlay loop muted playsInline aria-hidden />
        ) : (
          <div key={l.id} className={cls}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={still(l.pose)}
              alt=""
              draggable={false}
              decoding="async"
              fetchPriority={priority && i === 0 ? "high" : "auto"}
              className="mascot-still"
            />
            {l.pose === "speak" &&
              (["half", "closed"] as const).map((m) => {
                const box = PATCHES["speak-open"][`speak-${m}`];
                return (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={m}
                    src={`/mascot/patch/speak-${m}.webp`}
                    alt=""
                    draggable={false}
                    className={`mascot-mouth ${mouth === m ? "is-on" : ""}`}
                    style={{ left: `${box.left}%`, top: `${box.top}%`, width: `${box.width}%`, height: `${box.height}%` }}
                  />
                );
              })}
          </div>
        );
      })}
        </div>
      </div>
      </div>
      </div>
      <div className="mascot-sheen" aria-hidden />
    </div>
  );
}
