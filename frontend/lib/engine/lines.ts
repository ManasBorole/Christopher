import { tidyTranscript } from "../transcript";

// Turns the Realtime event stream into chat lines, one per conversation item.
//
// Why per item: the learner's transcription finishes AFTER Christopher has
// started answering, and his transcript runs ahead of his voice. Appending
// lines as text finished put replies above the words they answered and showed
// whole sentences he never got to say. Here each line takes its slot when the
// item is created (conversation order), fills in as text streams, and is only
// final once it is settled: the learner's transcription is done, or
// Christopher's audio has finished playing or was cut off.
export type ChatLine = {
  id: string; // Realtime item id
  role: "user" | "agent";
  text: string;
  done: boolean;
  after?: string | null; // previous item id, for ordering
};

type Item = { role: "user" | "agent"; text: string; resp?: string; truncMs?: number; final?: boolean };
type Resp = { started?: boolean; stopped?: boolean; done?: boolean; status?: string; audioMs?: number };

// Each output audio token is 50 ms of speech.
const MS_PER_AUDIO_TOKEN = 50;

export class LineTracker {
  private items = new Map<string, Item>();
  private resps = new Map<string, Resp>();
  constructor(private emit: (l: ChatLine) => void) {}

  handle(e: any) {
    switch (e.type) {
      // Reserve the line's slot as soon as the item exists (the learner's at
      // commit, Christopher's when his reply starts).
      case "conversation.item.added":
      case "conversation.item.created": {
        const it = e.item;
        const role = it?.role === "user" ? "user" : it?.role === "assistant" ? "agent" : null;
        if (it?.type !== "message" || !role || this.items.has(it.id)) return;
        // Typed items (e.g. a test's input_text) arrive with their text.
        const text = tidyTranscript((it.content ?? []).map((c: any) => c.text ?? "").join(" "));
        this.items.set(it.id, { role, text });
        this.emit({ id: it.id, role, text, done: false, after: e.previous_item_id ?? null });
        return;
      }

      case "conversation.item.input_audio_transcription.delta":
        return this.grow(e.item_id, "user", e.delta);
      case "conversation.item.input_audio_transcription.completed":
        return this.finish(e.item_id, "user", e.transcript ?? "");
      case "conversation.item.input_audio_transcription.failed":
        return this.finish(e.item_id, "user", "");

      // GA renamed audio_transcript -> output_audio_transcript; accept both.
      case "response.output_audio_transcript.delta":
      case "response.audio_transcript.delta":
        this.item(e.item_id, "agent").resp = e.response_id;
        return this.grow(e.item_id, "agent", e.delta);
      case "response.output_audio_transcript.done":
      case "response.audio_transcript.done": {
        const it = this.item(e.item_id, "agent");
        it.resp = e.response_id;
        if (typeof e.transcript === "string") it.text = e.transcript;
        return this.settle(e.response_id);
      }

      case "output_audio_buffer.started":
        this.resp(e.response_id).started = true;
        return;
      case "output_audio_buffer.stopped":
        this.resp(e.response_id).stopped = true;
        return this.settle(e.response_id);
      // Cleared without a truncation (the audio had already played out):
      // give the truncation a moment to arrive first, then settle as stopped.
      case "output_audio_buffer.cleared":
        setTimeout(() => {
          this.resp(e.response_id).stopped = true;
          this.settle(e.response_id);
        }, 800);
        return;
      // Barge-in or Let me talk: the server dropped the unplayed audio.
      case "conversation.item.truncated": {
        const it = this.items.get(e.item_id);
        if (!it) return;
        it.truncMs = e.audio_end_ms ?? 0;
        return it.resp && this.settle(it.resp);
      }
      case "response.done": {
        const r = this.resp(e.response?.id);
        r.done = true;
        r.status = e.response?.status;
        const tokens = e.response?.usage?.output_token_details?.audio_tokens;
        if (tokens) r.audioMs = tokens * MS_PER_AUDIO_TOKEN;
        return this.settle(e.response?.id);
      }
    }
  }

  // Connection closing: whatever is on screen becomes final.
  flush() {
    for (const [id, it] of this.items) if (!it.final) this.finish(id, it.role, it.text);
  }

  private item(id: string, role: Item["role"]): Item {
    let it = this.items.get(id);
    if (!it) {
      it = { role, text: "" };
      this.items.set(id, it);
      this.emit({ id, role, text: "", done: false });
    }
    return it;
  }

  private resp(id: string): Resp {
    let r = this.resps.get(id);
    if (!r) this.resps.set(id, (r = {}));
    return r;
  }

  private grow(id: string, role: Item["role"], delta?: string) {
    const it = this.item(id, role);
    if (it.final || !delta) return;
    it.text += delta;
    this.emit({ id, role, text: tidyTranscript(it.text), done: false });
  }

  private finish(id: string, role: Item["role"], text: string) {
    const it = this.item(id, role);
    if (it.final) return;
    it.final = true;
    it.text = text;
    this.emit({ id, role, text: tidyTranscript(text), done: true });
  }

  // Christopher's lines become final once his reply is done AND its audio has
  // stopped, was cut off, or never started (cancelled before he spoke).
  private settle(respId?: string) {
    const r = respId ? this.resps.get(respId) : undefined;
    if (!r?.done) return;
    for (const [id, it] of this.items) {
      if (it.final || it.resp !== respId) continue;
      if (it.truncMs != null) this.finish(id, "agent", r.audioMs ? spokenPart(it.text, it.truncMs / r.audioMs) : it.text);
      else if (r.stopped) this.finish(id, "agent", it.text);
      else if (!r.started && r.status !== "completed") this.finish(id, "agent", ""); // never heard
    }
  }
}

// The part of a reply that was actually heard when it was cut off at `played`
// (0..1 of its audio). ponytail: assumes even speech pace across the line;
// good to a word or two, exact would need word timings the API does not send.
export function spokenPart(text: string, played: number): string {
  if (played >= 0.95) return text;
  if (played <= 0) return "";
  const n = Math.round(text.length * played);
  let cut = text.slice(0, n);
  const space = cut.lastIndexOf(" ");
  if (space > n / 2) cut = cut.slice(0, space); // end on a whole word where words have spaces
  cut = cut.replace(/[\s,.;:!?、。，]+$/u, "");
  return cut ? `${cut}…` : "";
}
