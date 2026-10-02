// Guards against garbage transcripts reaching the chat.
//
// The speech-to-text model still emits the occasional artefact on silence or
// background noise: an empty string, a lone "." / "…", or stray punctuation.
// A learner turn is only "real" if it carries at least one letter or digit (any
// script, so 네 / 감사 / hola / 3 all pass) - short legitimate speech is
// preserved, noise is not.
export function isMeaningfulTranscript(text: string): boolean {
  return /[\p{L}\p{N}]/u.test(text ?? "");
}

// One canonical form for display and storage: composed Unicode (Hangul,
// Devanagari and accents arrive decomposed now and then) and single spaces.
export function tidyTranscript(text: string): string {
  return (text ?? "").normalize("NFC").replace(/\s+/g, " ").trim();
}

// Common English words that are rare as whole words in other Latin-script
// languages ("no", "me", "a", "to", "was", "do" are left out on purpose).
const EN = new Set(
  ("the you your you're are were and that that's this what what's how it it's its with can could would let's " +
    "say said try again good great nice well done now means mean words like sounds sound they does did not yes " +
    "here there right just very i'm i've our think know want ask tell close almost perfect exactly excellent " +
    "awesome correct which when where why who next one about thank thanks okay hello hi hey sorry call learn " +
    "practice we saying so use one thing instead spanish french german japanese korean english").split(" ")
);

// Quoted words: "...", “...”, «...», 「...」 and '...' (not the apostrophe in it's).
const QUOTED = /"[^"]*"|“[^”]*”|«[^»]*»|「[^」]*」|(?<![\p{L}\p{N}])'[^']*'(?![\p{L}\p{N}])/gu;

function wordsOf(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s,.;:!?¡¿"“”()…-]+/u)
    .filter((w) => /[\p{L}\p{N}]/u.test(w));
}

// Cheap check for "this line is already English" so it needs no translation.
// A line counts as English when at least a third of its words are common
// English words; lines in another script, or mostly the target language, fail.
// Quoted target-language words do not count against it ("You say 'me gusta
// el café'" is English), unless the line is nothing but a quote.
// ponytail: word-list heuristic; misses rare all-uncommon English lines, which
// then just get an identical translation that the chat hides.
export function looksEnglish(text: string): boolean {
  const all = tidyTranscript(text).replace(/[’‘]/g, "'");
  const outside = wordsOf(all.replace(QUOTED, " "));
  const words = outside.length ? outside : wordsOf(all);
  if (!words.length) return true;
  const hits = words.filter((w) => EN.has(w)).length;
  return hits / words.length >= 1 / 3;
}
