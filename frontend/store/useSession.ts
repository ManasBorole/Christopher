import { create } from "zustand";
import type { EngineStatus } from "../lib/engine/ConversationEngine";
import type { Profile, Summary } from "@vta/shared";

export type Turn = { role: "user" | "agent"; text: string; at: number };
export type Feedback = { coaching: string; accuracy: number; phrase: string };

// State for a single live conversation. A fresh session resets this.
type State = {
  courseId: string | null;
  sessionId: string | null;
  language: string;
  userName: string;

  status: EngineStatus;
  error: string | null;
  agentSpeaking: boolean;
  startedAt: number | null;

  turns: Turn[];
  vocabulary: string[]; // words practiced THIS session
  feedback: Feedback | null;
  summary: Summary | null;

  begin: (courseId: string, sessionId: string, language: string, userName: string) => void;
  setStatus: (s: EngineStatus, error?: string | null) => void;
  setSpeaking: (b: boolean) => void;
  applyProfile: (p: Profile) => void;
  addTurn: (t: Turn) => void;
  addVocab: (w: string) => void;
  setFeedback: (f: Feedback) => void;
  setSummary: (s: Summary) => void;
  start: (nowMs: number) => void;
  clearTimer: () => void;
};

export const useSession = create<State>((set) => ({
  courseId: null,
  sessionId: null,
  language: "",
  userName: "",
  status: "idle",
  error: null,
  agentSpeaking: false,
  startedAt: null,
  turns: [],
  vocabulary: [],
  feedback: null,
  summary: null,

  // Enter a brand-new conversation (clears the previous transcript).
  begin: (courseId, sessionId, language, userName) =>
    set({
      courseId,
      sessionId,
      language,
      userName,
      status: "idle",
      error: null,
      agentSpeaking: false,
      startedAt: null,
      turns: [],
      vocabulary: [],
      feedback: null,
      summary: null,
    }),

  setStatus: (status, error = null) => set({ status, error: status === "error" ? error : null }),
  setSpeaking: (agentSpeaking) => set({ agentSpeaking }),
  applyProfile: (p) =>
    set((s) => ({ userName: p.userName ?? s.userName })),
  addTurn: (t) => set((s) => ({ turns: [...s.turns, t] })),
  addVocab: (w) => set((s) => (s.vocabulary.includes(w) ? s : { vocabulary: [...s.vocabulary, w] })),
  setFeedback: (feedback) => set({ feedback }),
  setSummary: (summary) => set({ summary }),
  start: (nowMs) => set({ startedAt: nowMs }),
  clearTimer: () => set({ startedAt: null }),
}));
