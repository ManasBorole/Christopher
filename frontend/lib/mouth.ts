// Christopher's mouth from the loudness of his voice. Pure, so it can be checked
// without audio: the engine smooths the level, the mascot picks a mouth frame.

export type Mouth = "open" | "half" | "closed";

// Below this RMS the line is treated as silence (codec hiss, breath).
const GATE = 0.012;
// Speech RMS rarely passes ~0.25, so this maps a normal voice to roughly 0..1.
const GAIN = 4;
const ATTACK_MS = 25; // mouth opens almost at once on a syllable
const RELEASE_MS = 110; // and eases shut, closing in pauses between words

// One step of an attack/release follower: raw RMS in, smoothed 0..1 level out.
export function smoothLevel(prev: number, rms: number, dtMs: number): number {
  const target = rms < GATE ? 0 : Math.min(1, (rms - GATE) * GAIN);
  const tau = target > prev ? ATTACK_MS : RELEASE_MS;
  return prev + (target - prev) * (1 - Math.exp(-Math.min(dtMs, 100) / tau));
}

// Thresholds with hysteresis: a frame is entered at a higher level than it is
// left at, so a level hovering on one edge does not make the mouth flicker.
const OPEN_IN = 0.5;
const OPEN_OUT = 0.36;
const HALF_IN = 0.16;
const HALF_OUT = 0.08;

// reduced = reduced motion: only open or closed, no half frame.
export function nextMouth(prev: Mouth, level: number, reduced = false): Mouth {
  if (reduced) return level > (prev === "closed" ? HALF_IN * 1.5 : HALF_OUT) ? "open" : "closed";
  if (level >= OPEN_IN) return "open";
  if (prev === "open" && level > OPEN_OUT) return "open";
  if (level >= HALF_IN) return "half";
  if (prev !== "closed" && level > HALF_OUT) return "half";
  return "closed";
}
