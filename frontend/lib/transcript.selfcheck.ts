// Runnable check for the transcript noise filter (garbage in chat => broken UX).
// Run: npx tsx frontend/lib/transcript.selfcheck.ts
import assert from "node:assert";
import { isMeaningfulTranscript } from "./transcript";

// real speech survives - including short words in non-Latin scripts
for (const t of ["Hi", "hola", "네", "감사합니다", "  yes  ", "I'm ok"]) {
  assert.equal(isMeaningfulTranscript(t), true, `keep: ${JSON.stringify(t)}`);
}

// noise artefacts are dropped
for (const t of ["", "   ", ".", "…", "!?", "-", "***", "\n"]) {
  assert.equal(isMeaningfulTranscript(t), false, `drop: ${JSON.stringify(t)}`);
}

console.log("transcript self-check OK");
