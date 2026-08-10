import type { ConversationEngine, ConversationEvents } from "./ConversationEngine";
import { ownerHeaders } from "../auth";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8787";
const OPENAI_RT = "https://api.openai.com/v1/realtime/calls";

// Friendlier mic errors - the most common first-run failure is a denied prompt.
// echoCancellation is essential: without it the tutor's own voice from the
// speakers feeds back into the mic, the server hears it as the learner, and the
// conversation loops on itself.
async function getMic(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch (e) {
    const name = (e as DOMException)?.name;
    if (name === "NotAllowedError") throw new Error("Microphone permission denied");
    if (name === "NotFoundError") throw new Error("No microphone found");
    throw e;
  }
}

// v1 engine: browser <-> OpenAI Realtime over WebRTC.
// The API key never reaches here - we fetch a short-lived ephemeral token from
// our backend and use it as the Bearer for the SDP handshake only.
//
// Turn-taking is SERVER-DRIVEN (session turn_detection.create_response=true): the
// server VAD decides when the learner has stopped and auto-generates the tutor's
// reply, and it maintains the conversation. The client only kicks off the opening
// greeting and relays the update_profile tool. Pronunciation is judged by the
// audio-native model itself, spoken as natural coaching - no separate capture/score.
export class RealtimeEngine implements ConversationEngine {
  private pc?: RTCPeerConnection;
  private dc?: RTCDataChannel;
  private mic?: MediaStream;
  private audioEl?: HTMLAudioElement;
  private ev: ConversationEvents = {};
  private greeted = false; // the tutor's opening line is requested exactly once

  async connect(events: ConversationEvents, sessionId?: string): Promise<void> {
    this.ev = events;
    this.ev.onStatus?.("connecting");
    try {
      // Start the mic prompt and the token fetch in PARALLEL - they don't depend
      // on each other, so this shaves the "listens after a few seconds" delay.
      const micPromise = getMic();

      const r = await fetch(`${BACKEND}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await ownerHeaders()) },
        body: JSON.stringify({ sessionId }),
      });
      // 402 = free-trial exhausted. Stop the mic we just requested and surface it.
      if (r.status === 402) {
        (await micPromise).getTracks().forEach((t) => t.stop());
        throw new Error("limit_reached");
      }
      if (!r.ok) throw new Error(`/session ${r.status}`);
      const { token } = (await r.json()) as { token: string };

      const pc = new RTCPeerConnection();
      this.pc = pc;
      this.audioEl = new Audio();
      this.audioEl.autoplay = true;
      pc.ontrack = (e) => {
        this.audioEl!.srcObject = e.streams[0];
      };
      // Only report "live" once the transport is actually CONNECTED. Emitting it
      // right after the SDP answer lit up "Listening…" while ICE/DTLS was still
      // negotiating, so the learner's first utterance went nowhere. Gating on
      // `connected` means the mic is really flowing - and it's where we greet.
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          this.ev.onStatus?.("live");
          this.maybeGreet();
        } else if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
          this.ev.onStatus?.("error", `connection ${pc.connectionState}`);
        }
      };

      this.mic = await micPromise;
      this.mic.getTracks().forEach((t) => pc.addTrack(t, this.mic!));

      this.dc = pc.createDataChannel("oai-events");
      this.dc.onmessage = (m) => this.onEvent(JSON.parse(m.data));
      // The channel and the transport can finish in either order; greet when both are ready.
      this.dc.onopen = () => this.maybeGreet();

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      // GA: model is bound to the ephemeral key from /client_secrets, NOT passed
      // as a query param. Sending ?model= here (or a Beta model) 404s /calls.
      const sdpRes = await fetch(OPENAI_RT, {
        method: "POST",
        body: offer.sdp,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/sdp" },
      });
      if (!sdpRes.ok) throw new Error(`realtime sdp ${sdpRes.status}`);
      await pc.setRemoteDescription({ type: "answer", sdp: await sdpRes.text() });
    } catch (e) {
      this.ev.onStatus?.("error", String(e));
      this.disconnect();
    }
  }

  // Map the Realtime event stream to our engine callbacks.
  // ponytail: only the events the app needs are handled; add cases as needed.
  private onEvent(e: any) {
    switch (e.type) {
      // agent transcript - GA renamed audio_transcript -> output_audio_transcript
      case "response.output_audio_transcript.delta":
      case "response.audio_transcript.delta":
        this.ev.onTranscript?.("agent", e.delta ?? "", false);
        break;
      case "response.output_audio_transcript.done":
      case "response.audio_transcript.done":
        this.ev.onTranscript?.("agent", e.transcript ?? "", true);
        break;
      case "conversation.item.input_audio_transcription.completed":
        this.ev.onTranscript?.("user", e.transcript ?? "", true);
        break;

      // speaking indicator - output_audio_buffer.* fire on WebRTC; keep the
      // delta/done variants (old + GA) as fallback.
      case "output_audio_buffer.started":
      case "response.output_audio.delta":
      case "response.audio.delta":
        this.ev.onSpeaking?.(true);
        break;
      case "output_audio_buffer.stopped":
      case "response.output_audio.done":
      case "response.audio.done":
        this.ev.onSpeaking?.(false);
        break;

      case "response.function_call_arguments.done":
        if (e.name === "update_profile") this.updateProfile(e.call_id, e.arguments);
        break;
    }
  }

  // Tutor speaks first. Fire exactly once, and only when BOTH the transport is
  // connected and the data channel is open (they can finish in either order).
  // After this, the server VAD drives every reply, so we never trigger one again.
  private maybeGreet() {
    if (this.greeted) return;
    if (this.pc?.connectionState !== "connected" || this.dc?.readyState !== "open") return;
    this.greeted = true;
    this.dc.send(JSON.stringify({ type: "response.create" }));
  }

  // Tutor learned the learner's name/languages/level - bubble up + ack so the
  // model can continue its turn (a tool call pauses the response until we reply).
  private updateProfile(callId: string, argsJson: string) {
    try {
      this.ev.onProfile?.(JSON.parse(argsJson ?? "{}"));
    } catch {
      /* ignore malformed args */
    }
    if (this.dc?.readyState !== "open") return;
    this.dc.send(
      JSON.stringify({
        type: "conversation.item.create",
        item: { type: "function_call_output", call_id: callId, output: JSON.stringify({ ok: true }) },
      })
    );
    this.dc.send(JSON.stringify({ type: "response.create" }));
  }

  interrupt() {
    if (this.dc?.readyState === "open") {
      this.dc.send(JSON.stringify({ type: "response.cancel" }));
    }
    this.ev.onSpeaking?.(false);
  }

  disconnect() {
    this.dc?.close();
    this.mic?.getTracks().forEach((t) => t.stop());
    this.pc?.close();
    if (this.audioEl) this.audioEl.srcObject = null;
    this.pc = this.dc = this.mic = this.audioEl = undefined;
    this.greeted = false;
    this.ev.onStatus?.("idle");
  }
}
