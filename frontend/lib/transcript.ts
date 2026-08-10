// Guards against garbage transcripts reaching the chat.
//
// The speech-to-text model still emits the occasional artefact on silence or
// background noise: an empty string, a lone "." / "…", or stray punctuation.
// A learner turn is only "real" if it carries at least one letter (any script,
// so 네 / 감사 / hola all pass) - short legitimate speech is preserved, noise is not.
export function isMeaningfulTranscript(text: string): boolean {
  return /\p{L}/u.test(text ?? "");
}
