import { z } from "zod";

// ---- Session / learner state (mirrored to Neon) ----

export const CEFR = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type Cefr = (typeof CEFR)[number];

export const TurnSchema = z.object({
  role: z.enum(["user", "agent"]),
  text: z.string(),
  at: z.number(), // epoch ms, stamped by the sender
});
export type Turn = z.infer<typeof TurnSchema>;

// ---- Courses (per-language study) and Sessions (conversations) ----

// Card shown on the home screen.
export type CourseCard = {
  id: string;
  language: string;
  userName: string;
  level: string;
  vocabCount: number;
  sessionCount: number;
  updatedAt: string;
};

export type SessionMeta = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  turnCount: number;
  hasSummary: boolean;
  summary: Summary | null;
};

// Full course dashboard payload.
export type CourseDetail = {
  id: string;
  language: string;
  userName: string;
  nativeLanguage: string;
  level: string;
  vocabulary: string[];
  // term -> English meaning, derived from session summaries. Not every learned
  // word has one (the pronunciation scorer records words without a translation),
  // so this is a partial map keyed by term.
  meanings: Record<string, string>;
  pronunciationNotes: string[];
  createdAt: string;
  sessions: SessionMeta[];
};

export type StoredTurn = { role: "user" | "agent"; text: string; at: number };

// ---- POST /session (ephemeral realtime token) ----

export const EphemeralTokenSchema = z.object({
  token: z.string(),
  model: z.string(),
  expiresAt: z.number(),
});
export type EphemeralToken = z.infer<typeof EphemeralTokenSchema>;

// ---- Profile updates (tutor-driven, structured memory) ----

export const ProfileSchema = z.object({
  userName: z.string().optional(),
  nativeLanguage: z.string().optional(),
  targetLanguage: z.string().optional(),
  currentLevel: z.enum(CEFR).optional(),
});
export type Profile = z.infer<typeof ProfileSchema>;

// ---- POST /sessions/:id/summary ----

export const VocabItemSchema = z.object({
  term: z.string(), // the word/phrase in the target language
  translation: z.string(), // its English meaning
});
export type VocabItem = z.infer<typeof VocabItemSchema>;

export const SummarySchema = z.object({
  language: z.string(), // the target language this lesson covered
  vocabulary: z.array(VocabItemSchema),
  mistakes: z.array(z.string()),
  grammarTips: z.array(z.string()),
  nextLesson: z.string(),
});
export type Summary = z.infer<typeof SummarySchema>;

// ---- POST /pronounce ----

export const PronounceResultSchema = z.object({
  accuracy: z.number(), // 0..100
  fluency: z.number(),
  completeness: z.number(),
  pronunciation: z.number(), // overall
  words: z.array(
    z.object({
      word: z.string(),
      accuracy: z.number(),
      errorType: z.string(), // None | Mispronunciation | Omission | Insertion
    })
  ),
  coaching: z.string(), // natural-language feedback derived from the scores
});
export type PronounceResult = z.infer<typeof PronounceResultSchema>;
