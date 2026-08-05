// Runnable check for the learner-facing coaching thresholds.
// Run: npx tsx backend/src/pronounce.selfcheck.ts
import assert from "node:assert";
import { coach } from "./coach.js";
import { pcmToWav } from "./wav.js";

// WAV header layout - a wrong byte here makes OpenAI reject the audio.
const pcm = Buffer.alloc(100);
const wav = pcmToWav(pcm, 16000);
assert.equal(wav.length, 144, "header(44) + pcm(100)");
assert.equal(wav.toString("ascii", 0, 4), "RIFF", "RIFF magic");
assert.equal(wav.toString("ascii", 8, 12), "WAVE", "WAVE magic");
assert.equal(wav.readUInt32LE(24), 16000, "sample rate");
assert.equal(wav.readUInt16LE(22), 1, "mono");
assert.equal(wav.readUInt16LE(34), 16, "16-bit");
assert.equal(wav.readUInt32LE(40), 100, "data size = pcm length");

const bad = [{ word: "llamo", errorType: "Mispronunciation" }];
const good = [{ word: "hola", errorType: "None" }];

// high score -> pure praise, no correction
assert.match(coach(92, bad), /Excellent/i, "high score praises");

// mid score with a bad word -> names the word to retry
assert.match(coach(72, bad), /llamo/, "mid score names the bad word");
assert.match(coach(72, good), /Good|keep going/i, "mid score, no bad word");

// low score -> practice prompt, still encouraging (no raw number leaked)
const low = coach(40, bad);
assert.match(low, /llamo/, "low score names the bad word");
assert.doesNotMatch(low, /\d/, "coaching never leaks a numeric score");

console.log("pronounce self-check OK (wav + coaching)");
