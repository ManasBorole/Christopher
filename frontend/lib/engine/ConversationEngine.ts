// The swappable seam. v1 = RealtimeEngine (WebRTC->OpenAI).
// v2 = CustomPipelineEngine (WS->Express: Deepgram STT + LLM + TTS).
// Everything above this interface (UI, store) is engine-agnostic.

import type { PronounceResult, Profile } from "@vta/shared";
import type { ChatLine } from "./lines";

export type EngineStatus = "idle" | "connecting" | "live" | "error";

export interface ConversationEvents {
  onStatus?: (status: EngineStatus, detail?: string) => void;
  // One chat line per conversation item, re-sent as its text streams in.
  // Lines arrive in conversation order; done = settled, safe to save.
  onLine?: (line: ChatLine) => void;
  // Agent started/stopped speaking (drives the live indicator).
  onSpeaking?: (speaking: boolean) => void;
  // A "repeat after me" turn was scored (Azure). Bubbles up for UI + vocab.
  onPronunciation?: (result: PronounceResult, phrase: string, language: string) => void;
  // The tutor learned/changed the learner's profile (name, languages, level).
  // Includes `stage` (1-4) when he moves the learner up or down.
  onProfile?: (profile: Profile) => void;
  // The server detected the learner speaking (Christopher actually heard them).
  onHeard?: () => void;
}

export interface ConversationEngine {
  // sessionId lets the backend load prior memory into the tutor's instructions.
  connect(events: ConversationEvents, sessionId?: string): Promise<void>;
  interrupt(): void; // barge-in: stop the agent talking
  // The conversation stage changed (1 mostly English .. 4 all target language).
  // "learner" = they nudged it, so tell the live model; "model" = he moved it himself.
  setStage(stage: 1 | 2 | 3 | 4, reason: "learner" | "model"): void;
  // The learner corrected a line speech-to-text misheard: tell the live model
  // quietly, without asking for a reply.
  noteCorrection(original: string, corrected: string): void;
  disconnect(): void;
  // Current microphone loudness (RMS, 0..1), so the UI can tell silence from a dead mic.
  inputLevel?(): number;
  // Christopher's voice loudness (smoothed, 0..1), read each animation frame to move his mouth.
  outputLevel?(): number;
}
