// How much target language Christopher speaks: 1 mostly English .. 4 all
// target language, null = not known yet. Mirrors the stage ladder in
// backend/src/prompts/tutor.ts.

export type Stage = 1 | 2 | 3 | 4;

// The starting-level answers ("How much {Language} do you know?").
export const STAGE_CHOICES: readonly { stage: Stage; label: string }[] = [
  { stage: 1, label: "None" },
  { stage: 2, label: "A few words" },
  { stage: 3, label: "I can chat a little" },
  { stage: 4, label: "I am fluent" },
];

// The stage in plain words for the conversation screen.
export function stageLabel(stage: number | null, language: string): string {
  if (stage === 1) return "Mostly English";
  if (stage === 2) return `English and ${language}`;
  if (stage === 3) return `Mostly ${language}`;
  if (stage === 4) return `All ${language}`;
  return "Finding your level";
}

const NAMES = ["", "New: mostly English", "Building: a mix", "Conversational: the target language", "Fluent: only the target language"];

// The system note the live model gets when the learner changes the stage.
export function stageNote(stage: Stage, from: number | null): string {
  const asked = from == null || from === stage ? "asked to stay at" : stage < from ? "asked for more English: switch to" : "asked for more of the language they are learning: switch to";
  return `The learner ${asked} stage ${stage} (${NAMES[stage]}). Speak at that stage from your next reply on. Do not mention this note.`;
}
