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
  | "unheard" // live, but no learner speech has reached Christopher yet
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
  unheard?: boolean; // from cannotHear()
};

// How long the line can stay quiet (no learner speech detected, no mic sound,
// Christopher not talking) before we say he cannot hear them.
export const HEAR_WAIT_MS = 7000;
// Mic RMS that counts as "sound". Room noise after noise suppression sits well
// below it; quiet speech (about -46 dBFS) sits above. Calibration knob.
export const MIC_FLOOR = 0.005;

// Nothing has reached Christopher on this connection, for long enough to say so.
export function cannotHear(i: { heard: boolean; quietMs: number }): boolean {
  return !i.heard && i.quietMs >= HEAR_WAIT_MS;
}

// Free-trial rule: the trial is used (and its clock runs) only once Christopher
// has actually heard the learner, never just because the line connected.
// `heardBefore` = heard at least once earlier in this conversation.
export function trialStep(event: "live" | "heard", heardBefore: boolean): { consume: boolean; startClock: boolean } {
  if (event === "live") return { consume: false, startClock: heardBefore };
  return heardBefore ? { consume: false, startClock: false } : { consume: true, startClock: true };
}

export function sessionPhase(i: PhaseInput): Phase {
  if (i.ending) return "saving";
  if (i.status === "connecting") return "connecting";
  if (i.status === "live") {
    if (i.agentSpeaking) return "speaking";
    if (i.handedBack) return "handed-back";
    if (i.lastTurn === "user") return "thinking";
    return i.unheard ? "unheard" : "listening";
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
