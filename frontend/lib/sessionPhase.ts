import type { EngineStatus } from "./engine/ConversationEngine";

// What the conversation screen should show right now, derived only from
// events the engine already reports. No audio levels, no extra engine hooks.
export type Phase =
  | "mic-ask" // haven't asked for the microphone yet
  | "mic-blocked" // browser denied the microphone
  | "mic-missing" // no microphone on this device
  | "ready" // mic already allowed, not started
  | "connecting"
  | "speaking" // tutor audio is playing
  | "thinking" // learner finished a turn, tutor hasn't answered yet
  | "listening"
  | "handed-back" // learner just cut the tutor off
  | "dropped" // connection lost mid-conversation
  | "failed" // couldn't connect at all
  | "saving"; // ending, summary being written

export type PhaseInput = {
  status: EngineStatus;
  agentSpeaking: boolean;
  lastTurn: "user" | "agent" | null;
  lastError: string | null;
  ending: boolean;
  handedBack: boolean;
  mic: PermissionState | "unknown";
};

export function sessionPhase(i: PhaseInput): Phase {
  if (i.ending) return "saving";
  if (i.status === "connecting") return "connecting";
  if (i.status === "live") {
    if (i.agentSpeaking) return "speaking";
    if (i.handedBack) return "handed-back";
    if (i.lastTurn === "user") return "thinking";
    return "listening";
  }
  if (i.lastError) {
    if (/permission denied/i.test(i.lastError)) return "mic-blocked";
    if (/no microphone/i.test(i.lastError)) return "mic-missing";
    if (/connection (disconnected|failed)/i.test(i.lastError)) return "dropped";
    return "failed";
  }
  if (i.mic === "denied") return "mic-blocked";
  if (i.mic === "granted") return "ready";
  return "mic-ask";
}
