import { create } from "zustand";
import type { EngineStatus } from "../lib/engine/ConversationEngine";
import type { ChatLine } from "../lib/engine/lines";
import type { Profile, Summary } from "@vta/shared";

// One chat line. `id` is the Realtime item id; `pending` while it is still
// being transcribed or spoken; `translation` = English under a target-language line;
// `edited` = the learner corrected what speech-to-text heard.
export type Turn = { id: string; role: "user" | "agent"; text: string; at: number; pending?: boolean; translation?: string; edited?: boolean };
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
  putLine: (l: ChatLine) => void;
  patchTurn: (id: string, patch: Partial<Turn>) => void;
  editTurn: (id: string, text: string) => Turn | null;
  removeTurn: (id: string) => void;
  addVocab: (w: string) => void;
  setFeedback: (f: Feedback) => void;
  setSummary: (s: Summary) => void;
  start: (nowMs: number) => void;
  clearTimer: () => void;
};

export const useSession = create<State>((set, get) => ({
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
    set((s) => ({ userName: p.userName?.trim() || s.userName })),
  // Insert a new line in conversation order (after its previous item when that
  // is on screen, else at the end), or update the one already there.
  putLine: (l) =>
    set((s) => {
      const i = s.turns.findIndex((t) => t.id === l.id);
      if (i >= 0) {
        const turns = s.turns.slice();
        // A late update never undoes the learner's own correction.
        turns[i] = turns[i].edited ? turns[i] : { ...turns[i], text: l.text, pending: !l.done };
        return { turns };
      }
      const t: Turn = { id: l.id, role: l.role, text: l.text, at: Date.now(), pending: !l.done };
      const after = l.after ? s.turns.findIndex((x) => x.id === l.after) : -1;
      if (after < 0) return { turns: [...s.turns, t] };
      return { turns: [...s.turns.slice(0, after + 1), t, ...s.turns.slice(after + 1)] };
    }),
  patchTurn: (id, patch) => set((s) => ({ turns: s.turns.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
  // The learner corrects one of their own finished lines. Returns the line as
  // it was, or null when nothing changed (not theirs, still pending, empty, same).
  editTurn: (id, text) => {
    const t = get().turns.find((x) => x.id === id);
    const fixed = text.replace(/\s+/g, " ").trim();
    if (!t || t.role !== "user" || t.pending || !fixed || fixed === t.text) return null;
    set((s) => ({ turns: s.turns.map((x) => (x.id === id ? { ...x, text: fixed, edited: true } : x)) }));
    return t;
  },
  removeTurn: (id) => set((s) => ({ turns: s.turns.filter((t) => t.id !== id) })),
  addVocab: (w) => set((s) => (s.vocabulary.includes(w) ? s : { vocabulary: [...s.vocabulary, w] })),
  setFeedback: (feedback) => set({ feedback }),
  setSummary: (summary) => set({ summary }),
  start: (nowMs) => set({ startedAt: nowMs }),
  clearTimer: () => set({ startedAt: null }),
}));
