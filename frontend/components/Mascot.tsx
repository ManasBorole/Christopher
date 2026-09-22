"use client";

import { useEffect, useState } from "react";

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

// Christopher, framed like a photo on a postcard. Pose changes cross-fade;
// `talking` adds a speech bob while the tutor's audio is actually playing.
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

  useEffect(() => {
    setLayers((ls) => {
      const top = ls[ls.length - 1];
      return top.pose === pose ? ls : [top, { pose, id: top.id + 1 }];
    });
  }, [pose]);

  // Drop the outgoing layer once the incoming one has faded in.
  useEffect(() => {
    if (layers.length < 2) return;
    const t = setTimeout(() => setLayers((ls) => ls.slice(-1)), 450);
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
    <div className={`mascot ${talking ? "is-talking" : ""} ${className}`}>
      {layers.map((l, i) => {
        const cls = `mascot-layer ${layers.length > 1 && i === layers.length - 1 ? "is-entering" : ""}`;
        const clip = VIDEO[l.pose];
        return clip ? (
          <video key={l.id} className={cls} src={clip} poster={still(l.pose)} autoPlay loop muted playsInline aria-hidden />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={l.id}
            className={cls}
            src={still(l.pose)}
            alt=""
            draggable={false}
            decoding="async"
            fetchPriority={priority && i === 0 ? "high" : "auto"}
          />
        );
      })}
    </div>
  );
}
