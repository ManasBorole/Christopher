// Runnable check for the audio money-path (silent corruption => Azure garbage).
// Run: npx tsx frontend/lib/recorder.selfcheck.ts
import assert from "node:assert";
import { concat, downsample, floatToPcm16 } from "./recorder";

// concat
const c = concat([new Float32Array([1, 2]), new Float32Array([3])]);
assert.deepEqual([...c], [1, 2, 3], "concat");

// downsample 48k -> 16k averages each window of 3 samples
const d = downsample(new Float32Array([1, 1, 1, -1, -1, -1]), 48000, 16000);
assert.deepEqual([...d], [1, -1], "downsample 3:1");
// no upsampling: outRate >= inRate returns input untouched
const same = new Float32Array([0.5, 0.5]);
assert.equal(downsample(same, 16000, 16000), same, "no upsample");

// floatToPcm16 clamps and scales to full int16 range
const p = floatToPcm16(new Float32Array([0, 1, -1, 2, -2]));
assert.deepEqual([...p], [0, 32767, -32768, 32767, -32768], "pcm16 clamp/scale");

console.log("recorder self-check OK");
