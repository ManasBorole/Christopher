// Records a single user turn as raw 16kHz / 16-bit / mono PCM - the format
// Azure Pronunciation Assessment reads.
//
// Taps an EXISTING MediaStream (the engine's live mic) so we don't open a
// second getUserMedia, and - critically - never stops that stream's tracks,
// which the WebRTC conversation is still using.
//
// ponytail: uses the deprecated ScriptProcessorNode (simplest, works everywhere).
// Swap to an AudioWorklet if you hit the main-thread glitching it can cause.

export class TurnRecorder {
  private ctx?: AudioContext;
  private node?: ScriptProcessorNode;
  private src?: MediaStreamAudioSourceNode;
  private sink?: GainNode;
  private chunks: Float32Array[] = [];
  private inRate = 48000;

  constructor(private stream: MediaStream) {}

  start() {
    this.ctx = new AudioContext();
    this.inRate = this.ctx.sampleRate;
    this.src = this.ctx.createMediaStreamSource(this.stream);
    this.node = this.ctx.createScriptProcessor(4096, 1, 1);
    // Chrome only runs onaudioprocess if the node reaches destination - but a
    // direct connection would play the mic through the speakers (feedback).
    // Route through a muted gain so it processes silently.
    this.sink = this.ctx.createGain();
    this.sink.gain.value = 0;
    this.chunks = [];
    this.node.onaudioprocess = (e) => {
      this.chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    };
    this.src.connect(this.node);
    this.node.connect(this.sink);
    this.sink.connect(this.ctx.destination);
  }

  // Returns a Blob of raw little-endian Int16 PCM at 16kHz.
  // Does NOT stop the shared mic tracks - only tears down this tap.
  stop(): Blob {
    this.src?.disconnect();
    this.node?.disconnect();
    this.sink?.disconnect();
    void this.ctx?.close();

    const flat = concat(this.chunks);
    const pcm16 = floatToPcm16(downsample(flat, this.inRate, 16000));
    this.chunks = [];
    // `as ArrayBuffer`: TS 5.7 widens typed-array buffers to ArrayBufferLike;
    // this one is a plain ArrayBuffer (allocated by `new Int16Array(len)`).
    return new Blob([pcm16.buffer as ArrayBuffer], { type: "application/octet-stream" });
  }
}

export function concat(chunks: Float32Array[]): Float32Array {
  const len = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Float32Array(len);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

export function downsample(input: Float32Array, inRate: number, outRate: number): Float32Array {
  if (outRate >= inRate) return input;
  const ratio = inRate / outRate;
  const outLen = Math.floor(input.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    // average the source window -> cheap anti-alias
    const start = Math.floor(i * ratio);
    const end = Math.floor((i + 1) * ratio);
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    out[i] = sum / (end - start || 1);
  }
  return out;
}

export function floatToPcm16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}
