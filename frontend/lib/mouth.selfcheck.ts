// Runnable check for the voice level -> mouth frame logic.
// Run: npx tsx frontend/lib/mouth.selfcheck.ts
import assert from "node:assert";
import { nextMouth, smoothLevel, type Mouth } from "./mouth";

const walk = (levels: number[], reduced = false, from: Mouth = "closed") => {
  let m = from;
  return levels.map((l) => (m = nextMouth(m, l, reduced)));
};

// Silence, mid, loud.
assert.equal(nextMouth("closed", 0), "closed");
assert.equal(nextMouth("closed", 0.3), "half");
assert.equal(nextMouth("closed", 0.8), "open");
// Hysteresis: hovering around an edge holds the frame instead of flickering.
assert.deepEqual(walk([0.8, 0.45, 0.52, 0.4, 0.48]), ["open", "open", "open", "open", "open"]);
assert.deepEqual(walk([0.3, 0.12, 0.15, 0.1]), ["half", "half", "half", "half"]);
assert.deepEqual(walk([0.12, 0.14, 0.12]), ["closed", "closed", "closed"]);
// ...but a clear drop still closes.
assert.deepEqual(walk([0.8, 0.3, 0.05]), ["open", "half", "closed"]);
// Reduced motion: never the half frame.
assert.deepEqual(walk([0.3, 0.6, 0.12, 0.05, 0.2], true), ["open", "open", "open", "closed", "closed"]);

// Smoothing: a noise-floor signal reads as silence; a syllable opens fast,
// a pause closes slower but within a word gap (~250 ms).
let l = 0;
for (let i = 0; i < 30; i++) l = smoothLevel(l, 0.008, 16);
assert.equal(l, 0);
for (let i = 0; i < 3; i++) l = smoothLevel(l, 0.2, 16);
assert.ok(l > 0.5, `attack too slow: ${l}`);
const peak = l;
l = smoothLevel(l, 0, 16);
assert.ok(l > peak * 0.8, "release should be slower than attack");
for (let i = 0; i < 15; i++) l = smoothLevel(l, 0, 16);
assert.equal(nextMouth("half", l), "closed");
// A long frame gap (tab in the background) does not jump past the target.
assert.ok(smoothLevel(0, 0.2, 5000) <= 1);

console.log("mouth self-check OK");
