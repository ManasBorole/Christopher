// Runnable check for the transcript noise filter (garbage in chat => broken UX).
// Run: npx tsx frontend/lib/transcript.selfcheck.ts
import assert from "node:assert";
import { isMeaningfulTranscript, looksEnglish, tidyTranscript } from "./transcript";

// real speech survives - including short words in non-Latin scripts and numbers
for (const t of ["Hi", "hola", "네", "감사합니다", "  yes  ", "I'm ok", "मराठी", "3"]) {
  assert.equal(isMeaningfulTranscript(t), true, `keep: ${JSON.stringify(t)}`);
}

// noise artefacts are dropped
for (const t of ["", "   ", ".", "…", "!?", "-", "***", "\n"]) {
  assert.equal(isMeaningfulTranscript(t), false, `drop: ${JSON.stringify(t)}`);
}

// one canonical form: composed Hangul, single spaces
assert.equal(tidyTranscript(" 안녕 \n 하세요 ".normalize("NFD")), "안녕 하세요");

// English lines need no translation; target-language lines do
for (const t of [
  "Close! You said 'estoy cansado', but it is 'estoy cansada'.",
  "Great!",
  "You said すし, and the right word is すし with a long u.",
  "That's right, it means 'how are you'.",
  'We say "Me gusta el café" in Spanish. So now try saying: "Me gusta el café."',
  "Nice! Just one thing: you said 'yo es', but with yo it is 'yo soy'.",
]) assert.equal(looksEnglish(t), true, `english: ${t}`);
for (const t of [
  "¡Muy bien! ¿Y qué te gusta comer?",
  "No me gusta el café.",
  "元気ですか？",
  "Was machst du heute?",
  "Dat is goed.",
  "आप कैसे हैं?",
  "Comment tu t'appelles ?",
  '"Me gusta el café."',
  "Casi, dijiste \"Ayer yo como una pizza grande\", pero en pasado sería \"Ayer comí una pizza grande\".",
]) assert.equal(looksEnglish(t), false, `target: ${t}`);

console.log("transcript self-check OK");
