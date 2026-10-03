// Runnable check for the conversation screen's state mapping.
// Run: npx tsx frontend/lib/sessionPhase.selfcheck.ts
import assert from "node:assert";
import { sessionPhase, cannotHear, trialStep, HEAR_WAIT_MS, type PhaseInput } from "./sessionPhase";

const base: PhaseInput = { status: "idle", agentSpeaking: false, lastTurn: null, lastError: null, ending: false, handedBack: false, mic: "unknown" };
const p = (o: Partial<PhaseInput>) => sessionPhase({ ...base, ...o });

// before starting: depends on what the browser already knows about the mic
assert.equal(p({}), "mic-ask");
assert.equal(p({ mic: "prompt" }), "mic-ask");
assert.equal(p({ mic: "granted" }), "ready");
assert.equal(p({ mic: "denied" }), "mic-blocked");

// live turn-taking
assert.equal(p({ status: "connecting" }), "connecting");
assert.equal(p({ status: "live" }), "listening");
assert.equal(p({ status: "live", lastTurn: "user" }), "thinking");
assert.equal(p({ status: "live", lastTurn: "user", agentSpeaking: true }), "speaking");
assert.equal(p({ status: "live", lastTurn: "agent", handedBack: true }), "handed-back");
assert.equal(p({ status: "live", agentSpeaking: true, handedBack: true }), "speaking");

// nothing reaching Christopher: only while he is waiting on the learner
assert.equal(p({ status: "live", unheard: true }), "unheard");
// the learner speaks first: until he hears them, the screen invites them to start
assert.equal(p({ status: "live", heard: false }), "invite");
assert.equal(p({ status: "live", heard: true }), "listening");
assert.equal(p({ status: "live", heard: false, unheard: true }), "unheard");
assert.equal(p({ status: "live", heard: false, agentSpeaking: true }), "speaking");
assert.equal(p({ status: "live", unheard: true, agentSpeaking: true }), "speaking");
assert.equal(p({ status: "live", unheard: true, lastTurn: "user" }), "thinking");
assert.equal(cannotHear({ heard: false, quietMs: HEAR_WAIT_MS - 1 }), false);
assert.equal(cannotHear({ heard: false, quietMs: HEAR_WAIT_MS }), true);
assert.equal(cannotHear({ heard: true, quietMs: 60_000 }), false);

// free trial: connecting never uses it; the first time he hears the learner does, once
assert.deepEqual(trialStep("live", false), { consume: false, startClock: false });
assert.deepEqual(trialStep("heard", false), { consume: true, startClock: true });
assert.deepEqual(trialStep("heard", true), { consume: false, startClock: false });
assert.deepEqual(trialStep("live", true), { consume: false, startClock: true }); // reconnect keeps the clock going

// errors, using the engine's real messages
assert.equal(p({ lastError: "Error: Microphone permission denied" }), "mic-blocked");
assert.equal(p({ lastError: "Error: No microphone found" }), "mic-missing");
assert.equal(p({ status: "error", lastError: "connection disconnected" }), "dropped");
assert.equal(p({ lastError: "Error: /session 500" }), "failed");
assert.equal(p({ lastError: "Error: /session 500", mic: "granted" }), "failed");

// ending wins over everything
assert.equal(p({ status: "live", agentSpeaking: true, ending: true }), "saving");

console.log("sessionPhase self-check OK");
