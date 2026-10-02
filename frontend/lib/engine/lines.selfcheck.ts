// Runnable check: chat lines follow conversation order and show what was said.
// Run: npx tsx frontend/lib/engine/lines.selfcheck.ts
import assert from "node:assert";
import { LineTracker, spokenPart, type ChatLine } from "./lines";
import { useSession } from "../../store/useSession";

const seen: ChatLine[] = [];
const store = useSession.getState();
store.begin("c", "s", "Spanish", "");
const t = new LineTracker((l) => {
  seen.push(l);
  if (l.done && !l.text) store.removeTurn(l.id);
  else store.putLine(l);
});
const turns = () => useSession.getState().turns.map((x) => `${x.role}:${x.text}${x.pending ? "?" : ""}`);
const added = (id: string, role: string, prev: string | null) =>
  t.handle({ type: "conversation.item.added", previous_item_id: prev, item: { id, type: "message", role, content: [] } });
const say = (resp: string, id: string, text: string) => {
  for (const w of text.split(/(?= )/)) t.handle({ type: "response.output_audio_transcript.delta", response_id: resp, item_id: id, delta: w });
  t.handle({ type: "response.output_audio_transcript.done", response_id: resp, item_id: id, transcript: text });
};

// 1. The learner's transcription lands AFTER Christopher starts answering:
//    his reply must still sit below what it answers.
added("u1", "user", null);
added("a1", "assistant", "u1");
t.handle({ type: "output_audio_buffer.started", response_id: "r1" });
say("r1", "a1", "¡Hola, Tom! ¿Cómo estás?");
t.handle({ type: "conversation.item.input_audio_transcription.delta", item_id: "u1", delta: "Hola, soy" });
t.handle({ type: "conversation.item.input_audio_transcription.completed", item_id: "u1", transcript: " Hola,  soy Tom " });
t.handle({ type: "response.done", response: { id: "r1", status: "completed", usage: { output_token_details: { audio_tokens: 60 } } } });
assert.deepEqual(turns(), ["user:Hola, soy Tom", "agent:¡Hola, Tom! ¿Cómo estás??"], "ordered, reply still playing");
t.handle({ type: "output_audio_buffer.stopped", response_id: "r1" });
assert.deepEqual(turns(), ["user:Hola, soy Tom", "agent:¡Hola, Tom! ¿Cómo estás?"], "final once the audio stopped");

// 2. Let me talk halfway: only the part he actually said stays.
added("u2", "user", "a1");
added("a2", "assistant", "u2");
t.handle({ type: "output_audio_buffer.started", response_id: "r2" });
say("r2", "a2", "Muy bien. Ahora dime, ¿qué te gusta comer?");
t.handle({ type: "response.done", response: { id: "r2", status: "cancelled", usage: { output_token_details: { audio_tokens: 100 } } } });
t.handle({ type: "conversation.item.truncated", item_id: "a2", audio_end_ms: 2500 });
t.handle({ type: "conversation.item.input_audio_transcription.completed", item_id: "u2", transcript: "Bien" });
assert.deepEqual(turns().slice(2), ["user:Bien", "agent:Muy bien. Ahora…"], "truncated to what was heard");

// 3. A reply cancelled before any audio played never shows; noise never shows.
added("u3", "user", "a2");
added("a3", "assistant", "u3");
say("r3", "a3", "Never heard");
t.handle({ type: "response.done", response: { id: "r3", status: "cancelled" } });
t.handle({ type: "conversation.item.input_audio_transcription.failed", item_id: "u3" });
assert.equal(turns().length, 4, "unheard reply and failed transcription dropped");

// 4. Each line is final exactly once.
const finals = seen.filter((l) => l.done).map((l) => l.id);
assert.equal(new Set(finals).size, finals.length, "one final per item");

assert.equal(spokenPart("abc def", 1), "abc def");
assert.equal(spokenPart("abc def", 0), "");
assert.equal(spokenPart("元気ですか今日は", 0.5), "元気です…", "no spaces: cut by characters");

console.log("lines self-check OK");
