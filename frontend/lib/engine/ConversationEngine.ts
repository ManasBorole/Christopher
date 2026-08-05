// The swappable seam. v1 = RealtimeEngine (WebRTC->OpenAI).
// v2 = CustomPipelineEngine (WS->Express: Deepgram STT + LLM + TTS).
// Everything above this interface (UI, store) is engine-agnostic.

import type { PronounceResult, Profile } from "@vta/shared";

export type EngineStatus = "idle" | "connecting" | "live" | "error";

export interface ConversationEvents {
  onStatus?: (status: EngineStatus, detail?: string) => void;
  // Streaming transcript. role = who's speaking; done = final for this turn.
  onTranscript?: (role: "user" | "agent", text: string, done: boolean) => void;
  // Agent started/stopped speaking (drives the live indicator).
  onSpeaking?: (speaking: boolean) => void;
  // A "repeat after me" turn was scored (Azure). Bubbles up for UI + vocab.
  onPronunciation?: (result: PronounceResult, phrase: string, language: string) => void;
  // The tutor learned/changed the learner's profile (name, languages, level).
  onProfile?: (profile: Profile) => void;
}

export interface ConversationEngine {
  // sessionId lets the backend load prior memory into the tutor's instructions.
  connect(events: ConversationEvents, sessionId?: string): Promise<void>;
  interrupt(): void; // barge-in: stop the agent talking
  disconnect(): void;
}
