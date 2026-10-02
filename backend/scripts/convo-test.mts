// End-to-end voice test for the live conversation. Dev only, never run by the app.
//
// Speaks a scripted learner (TTS) into a Realtime session built with exactly
// the backend's config and instructions, records every server event, and
// reports per turn: what the learner said vs what transcription wrote (WER),
// what Christopher said and in which language, whether corrections were in
// English quoting the right words, which lines would get a translation, and
// any loops. Costs money: it stops before the spend passes --max-usd.
//
//   npx tsx backend/scripts/convo-test.mts --dry-run           (no network, free)
//   npx tsx backend/scripts/convo-test.mts --max-usd 0.30      (real run)
// Options: --max-usd N (default 0.30)  --out file.json  --pin <iso code>
//          (--pin locks transcription to one language, to compare with the
//          default unpinned + prompted transcription)
import { createHash } from "node:crypto";
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import dotenv from "dotenv";
import { looksEnglish } from "../../frontend/lib/transcript.ts";

const args = parseArgs({
  options: {
    "dry-run": { type: "boolean", default: false },
    "max-usd": { type: "string", default: "0.30" },
    out: { type: "string" },
    pin: { type: "string" },
  },
}).values;
const DRY = args["dry-run"]!;
const MAX_USD = Number(args["max-usd"]);
if (!(MAX_USD > 0)) throw new Error("--max-usd must be a positive number");

dotenv.config({ path: new URL("../.env", import.meta.url) });
if (DRY) process.env.OPENAI_API_KEY ||= "dry-run";
// Same modules the backend uses, so model, voice, prompt and session match.
const { env } = await import("../src/env.ts");
const { TUTOR_SYSTEM_PROMPT, courseContext } = await import("../src/prompts/tutor.ts");
const { realtimeSession, transcriptionPrompt } = await import("../src/realtime.ts");

// ---- The learner's script (Spanish, a brand-new course) ----------------------
type Kind = "correct" | "name" | "name-fix" | "near-miss" | "grammar" | "english-question";
type Turn = { say: string; kind: Kind; right?: string; name?: string };
const LANGUAGE = "Spanish";
const SCRIPT: Turn[] = [
  { say: "Hola, me llamo Jerry.", kind: "name", name: "Jerry" },
  { say: "No, sorry, my name is Tom, not Jerry.", kind: "name-fix", name: "Tom" },
  { say: "Estoy muy bien, gracias. ¿Y tú?", kind: "correct" },
  { say: "Grasias por la ayooda.", kind: "near-miss" }, // sounds like "gracias por la ayuda": accept it
  { say: "Yo es estudiante de español.", kind: "grammar", right: "soy" },
  { say: "How do I say I like coffee in Spanish?", kind: "english-question", right: "me gusta el café" },
  { say: "Me gusta el café con leche.", kind: "correct" },
  { say: "Ayer yo como una pizza grande.", kind: "grammar", right: "comí" },
  { say: "Vivo en Londres con mi familia.", kind: "correct" },
  { say: "Me gusta mucho leer libros.", kind: "correct" },
];

// ---- Prices, USD per 1M tokens (developers.openai.com/api/docs/pricing, Oct 2026) ----
const REALTIME: Record<string, { textIn: number; cachedIn: number; textOut: number; audioIn: number; audioOut: number }> = {
  "gpt-realtime": { textIn: 4, cachedIn: 0.4, textOut: 16, audioIn: 32, audioOut: 64 },
  "gpt-realtime-2": { textIn: 4, cachedIn: 0.4, textOut: 24, audioIn: 32, audioOut: 64 },
  "gpt-realtime-mini": { textIn: 0.6, cachedIn: 0.06, textOut: 2.4, audioIn: 10, audioOut: 20 },
};
const TRANSCRIBE = { textIn: 2.5, audioIn: 6, textOut: 10, perMinute: 0.006 }; // gpt-4o-transcribe
const TTS_MODEL = "gpt-4o-mini-tts";
const TTS_PER_MINUTE = 0.015; // gpt-4o-mini-tts, by audio length (no usage is returned)
const price = REALTIME[env.realtimeModel];
if (!price) throw new Error(`No price for ${env.realtimeModel}; add it to REALTIME before spending money`);

function realtimeCost(u: any): number {
  const i = u?.input_token_details ?? {};
  const o = u?.output_token_details ?? {};
  const cached = i.cached_tokens_details ?? {};
  const cText = cached.text_tokens ?? 0;
  const cAudio = cached.audio_tokens ?? 0;
  return (
    (((i.text_tokens ?? 0) - cText) * price.textIn +
      (cText + cAudio) * price.cachedIn +
      ((i.audio_tokens ?? 0) - cAudio) * price.audioIn +
      (o.text_tokens ?? 0) * price.textOut +
      (o.audio_tokens ?? 0) * price.audioOut) /
    1e6
  );
}
function transcribeCost(u: any): number {
  if (!u) return 0;
  if (u.type === "duration") return ((u.seconds ?? 0) / 60) * TRANSCRIBE.perMinute;
  const d = u.input_token_details ?? {};
  return ((d.text_tokens ?? 0) * TRANSCRIBE.textIn + (d.audio_tokens ?? 0) * TRANSCRIBE.audioIn + (u.output_tokens ?? 0) * TRANSCRIBE.textOut) / 1e6;
}

let spent = 0;
const spend = (usd: number, what: string) => {
  spent += usd;
  console.log(`  $${usd.toFixed(4)} ${what}  (total $${spent.toFixed(4)} of $${MAX_USD.toFixed(2)})`);
};

// ---- Session: exactly what POST /session sends for a new Spanish course ------
const course = { language: LANGUAGE, userName: "", nativeLanguage: "", level: "A1", vocabulary: [], pronunciationNotes: [] };
const session: any = realtimeSession({
  model: env.realtimeModel,
  voice: env.realtimeVoice,
  instructions: TUTOR_SYSTEM_PROMPT + courseContext(course, false),
  transcription: transcriptionPrompt(course),
});
if (args.pin) session.audio.input.transcription.language = args.pin;
delete session.model; // over WebSocket the model goes in the URL

// ---- TTS (cached on disk, so a re-run does not pay for the same audio) -------
const RATE = 24000; // pcm16 mono, the Realtime default input format
const cacheDir = join(tmpdir(), "christopher-convo-tts");
mkdirSync(cacheDir, { recursive: true });
async function speech(text: string): Promise<Buffer> {
  const file = join(cacheDir, createHash("sha1").update(TTS_MODEL + text).digest("hex") + ".pcm");
  if (existsSync(file)) return readFileSync(file);
  if (DRY) return Buffer.alloc(Math.round(RATE * 2 * (0.4 + text.length / 14))); // silence of a plausible length
  const r = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.openaiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: TTS_MODEL,
      voice: "coral",
      input: text,
      response_format: "pcm",
      instructions: `A beginner learning ${LANGUAGE}, with an English accent, speaking at a natural, slightly careful pace.`,
    }),
  });
  if (!r.ok) throw new Error(`tts ${r.status} ${await r.text()}`);
  const pcm = Buffer.from(await r.arrayBuffer());
  writeFileSync(file, pcm);
  spend((pcm.length / (RATE * 2) / 60) * TTS_PER_MINUTE, `tts "${text}"`);
  return pcm;
}

// ---- Connection (real WebSocket, or a scripted fake for --dry-run) -----------
type Conn = { send: (e: object) => void; close: () => void };
const events: any[] = []; // every server event, audio payloads stripped
const waiters: ((e: any) => void)[] = [];
function onServerEvent(e: any) {
  if (typeof e.delta === "string" && /audio\.delta$/.test(e.type)) e.delta = `<${e.delta.length} b64 chars>`;
  events.push({ t: Date.now(), ...e });
  if (e.type === "error") console.warn("  server error:", e.error?.message ?? e);
  for (const w of waiters.slice()) w(e);
}
function next(match: (e: any) => boolean, ms: number): Promise<any | null> {
  return new Promise((resolve) => {
    const w = (e: any) => match(e) && done(e);
    const timer = setTimeout(() => done(null), ms);
    function done(e: any) {
      clearTimeout(timer);
      waiters.splice(waiters.indexOf(w), 1);
      resolve(e);
    }
    waiters.push(w);
  });
}

async function connect(): Promise<Conn> {
  if (DRY) return fakeConn();
  const ws = new WebSocket(`wss://api.openai.com/v1/realtime?model=${encodeURIComponent(env.realtimeModel)}`, [
    "realtime",
    `openai-insecure-api-key.${env.openaiKey}`,
  ]);
  await new Promise<void>((ok, fail) => {
    ws.onopen = () => ok();
    ws.onerror = () => fail(new Error("websocket failed to open"));
  });
  ws.onmessage = (m) => onServerEvent(JSON.parse(String(m.data)));
  const conn = { send: (e: object) => ws.send(JSON.stringify(e)), close: () => ws.close() };
  conn.send({ type: "session.update", session });
  if (!(await next((e) => e.type === "session.updated" || e.type === "error", 10_000))?.type?.includes("updated"))
    throw new Error("session.update was not accepted; see the events above");
  return conn;
}

// Plausible server behaviour for --dry-run: transcribes the script exactly and
// replies with canned lines, with usage numbers in the right range.
function fakeConn(): Conn {
  let n = 0;
  let audioMs = 0;
  const emit = (e: any) => setTimeout(() => onServerEvent(e), 1);
  const replies = [
    "¡Hola, Jerry! Encantado. ¿Cómo estás?",
    "Sorry about that, Tom! ¿Cómo estás hoy?",
    "¡Muy bien! Yo también estoy bien. ¿Te gusta el café?",
    "¡Perfecto! De nada. ¿Qué haces?",
    "Almost! You said 'yo es', but it is 'yo soy'. ¿Qué estudias?",
    "You say 'me gusta el café'. Try it!",
    "¡Qué rico! A mí también me gusta.",
    "Close! You said 'como', but for yesterday it is 'comí'. ¿Te gustó la pizza?",
    "¡Londres es una ciudad bonita! ¿Te gusta vivir allí?",
    "¡Qué bien! ¿Qué libros te gustan?",
  ];
  return {
    close() {},
    send(e: any) {
      if (e.type === "input_audio_buffer.append") audioMs += (Buffer.from(e.audio, "base64").length / (RATE * 2)) * 1000;
      if (e.type !== "input_audio_buffer.commit") return;
      const turn = SCRIPT[n];
      const reply = replies[n] ?? "¡Muy bien!";
      const u = `item_u${n}`;
      const a = `item_a${n}`;
      const r = `resp_${n}`;
      emit({ type: "input_audio_buffer.committed", item_id: u, previous_item_id: n ? `item_a${n - 1}` : null });
      if (turn.kind === "name" || turn.kind === "name-fix") {
        emit({ type: "response.function_call_arguments.done", name: "update_profile", call_id: `call_${n}`, arguments: JSON.stringify({ userName: turn.name }) });
        emit({ type: "response.done", response: { id: `${r}_tool`, status: "completed", output: [{ type: "function_call" }], usage: usage(n, 0) } });
      }
      emit({ type: "response.output_audio_transcript.done", response_id: r, item_id: a, transcript: reply });
      emit({ type: "conversation.item.input_audio_transcription.completed", item_id: u, transcript: turn.say, usage: { type: "tokens", input_tokens: 40, output_tokens: 12, input_token_details: { audio_tokens: Math.round(audioMs / 100), text_tokens: 40 } } });
      emit({ type: "response.done", response: { id: r, status: "completed", output: [{ type: "message", id: a }], usage: usage(n, reply.length) } });
      audioMs = 0;
      n++;
    },
  };
  function usage(turn: number, replyChars: number) {
    const text = 3200 + turn * 60;
    return {
      input_token_details: { text_tokens: text, audio_tokens: 40 + turn * 70, cached_tokens_details: { text_tokens: turn ? 3000 : 0, audio_tokens: turn ? turn * 60 : 0 } },
      output_token_details: { text_tokens: Math.ceil(replyChars / 3), audio_tokens: replyChars * 2 },
    };
  }
}

// Wait for a reply that speaks; a tool-only response is answered like the app does.
async function reply(conn: Conn, profile: string[]) {
  for (;;) {
    const e = await next((x) => x.type === "response.done" || x.type === "response.function_call_arguments.done", 45_000);
    if (!e) return console.log("  no reply within 45s");
    if (e.type === "response.function_call_arguments.done") {
      profile.push(e.arguments);
      let name = "";
      try {
        name = String(JSON.parse(e.arguments).userName ?? "").trim();
      } catch {
        /* malformed: acknowledge without a name, as the app does */
      }
      const output = name ? { ok: true, note: `Saved. The learner's name is ${name}. Use only ${name} from now on.` } : { ok: true };
      conn.send({ type: "conversation.item.create", item: { type: "function_call_output", call_id: e.call_id, output: JSON.stringify(output) } });
      conn.send({ type: "response.create" });
      continue;
    }
    spend(realtimeCost(e.response?.usage), `reply (${e.response?.status})`);
    if (spent > MAX_USD || (e.response?.output ?? []).some((o: any) => o.type === "message")) return;
  }
}

// ---- Run -----------------------------------------------------------------------
type Result = {
  turn: number;
  kind: Kind;
  said: string;
  heard: string;
  wer: number;
  christopher: string[];
  languages: string[];
  translated: string[];
  profile: string[];
  checks: string[];
  usd: number;
};
const results: Result[] = [];
const MS = (ms: number) => Buffer.alloc(Math.round((RATE * 2 * ms) / 1000));

console.log(`${DRY ? "DRY RUN (no network). " : ""}${env.realtimeModel}, voice ${env.realtimeVoice}, ${LANGUAGE}, cap $${MAX_USD.toFixed(2)}`);
console.log(`transcription: ${JSON.stringify(session.audio.input.transcription)}`);

// Pre-make every utterance first (cheap, cached), so the cap check sees it.
const audio: Buffer[] = [];
for (const t of SCRIPT) audio.push(await speech(t.say));

const conn = await connect();
let biggestTurn = 0.02;
for (const [i, t] of SCRIPT.entries()) {
  // Stop BEFORE a turn could take the spend past the cap.
  if (spent + biggestTurn * 1.5 > MAX_USD) {
    console.log(`\nStopping before turn ${i + 1}: $${spent.toFixed(4)} spent, next turn could cost ~$${(biggestTurn * 1.5).toFixed(4)}.`);
    break;
  }
  console.log(`\nTurn ${i + 1} [${t.kind}] learner: ${t.say}`);
  const before = spent;
  const from = events.length;

  // Speak: a little silence, the utterance, then enough silence for server VAD
  // to end the turn and reply on its own (as in the app).
  const pcm = Buffer.concat([MS(300), audio[i], MS(1200)]);
  for (let off = 0; off < pcm.length; off += 9600) {
    conn.send({ type: "input_audio_buffer.append", audio: pcm.subarray(off, off + 9600).toString("base64") });
  }
  if (DRY) conn.send({ type: "input_audio_buffer.commit" }); // the fake has no VAD

  const profile: string[] = [];
  await reply(conn, profile);
  // If VAD split the utterance, a second reply follows: let it finish too.
  while (spent <= MAX_USD && (await next((x) => x.type === "response.created", DRY ? 20 : 1500))) await reply(conn, profile);

  // The learner's transcription can land after the reply; one per committed segment.
  const ids = events.slice(from).filter((x) => x.type === "input_audio_buffer.committed").map((x) => x.item_id);
  const parts: string[] = [];
  for (const id of ids) {
    const isMine = (x: any) => /input_audio_transcription\.(completed|failed)$/.test(x.type) && x.item_id === id;
    const tr = events.slice(from).find(isMine) ?? (await next(isMine, 8000));
    if (tr?.usage) spend(transcribeCost(tr.usage), "transcription");
    if (tr?.transcript) parts.push(tr.transcript);
  }

  const mine = events.slice(from);
  const christopher = mine.filter((x) => /output_audio_transcript\.done$/.test(x.type)).map((x) => x.transcript as string);
  const heard = parts.join(" ");
  results.push({
    turn: i + 1,
    kind: t.kind,
    said: t.say,
    heard,
    wer: wer(t.say, heard),
    christopher,
    languages: christopher.map(lineLanguage),
    translated: christopher.filter((l) => !looksEnglish(l)),
    profile,
    checks: check(t, christopher, profile, i),
    usd: spent - before,
  });
  biggestTurn = Math.max(biggestTurn, spent - before);
  const r = results.at(-1)!;
  console.log(`  heard (WER ${(r.wer * 100).toFixed(0)}%): ${heard}`);
  for (const [k, l] of christopher.entries()) console.log(`  Christopher [${r.languages[k]}]: ${l}${looksEnglish(l) ? "" : "  -> translated"}`);
  for (const c of r.checks) console.log(`  ${c}`);
  if (spent > MAX_USD) {
    console.log(`\nCap passed mid-turn ($${spent.toFixed(4)}); stopping.`);
    break;
  }
}
conn.close();

// ---- Report ----------------------------------------------------------------------
const loops = findLoops(results);
const avgWer = results.reduce((a, r) => a + r.wer, 0) / Math.max(1, results.length);
console.log(`\n==== Report ====`);
console.log(`turns run: ${results.length}/${SCRIPT.length}, mean WER ${(avgWer * 100).toFixed(1)}%, spent $${spent.toFixed(4)}`);
const fails = results.flatMap((r) => r.checks.filter((c) => c.startsWith("FAIL")).map((c) => `turn ${r.turn}: ${c}`));
console.log(fails.length ? fails.join("\n") : "all checks passed");
console.log(loops.length ? `loops:\n${loops.join("\n")}` : "no loops or repeated corrections");
const out = args.out ?? join(tmpdir(), `convo-test-${Date.now()}.json`);
writeFileSync(out, JSON.stringify({ model: env.realtimeModel, session, spent, results, loops, events }, null, 2));
console.log(`full log (every server event): ${out}`);

// ---- Analysis helpers -------------------------------------------------------------
function words(s: string): string[] {
  const t = s.normalize("NFC").toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, " ").trim();
  // Scripts written without spaces (Japanese, Chinese, Thai): compare characters.
  return /\s/.test(t) || t.length < 4 ? t.split(/\s+/).filter(Boolean) : [...t];
}
// Word error rate: edits needed to turn what was heard into what was said.
function wer(said: string, heard: string): number {
  const a = words(said);
  const b = words(heard);
  if (!a.length) return b.length ? 1 : 0;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length] / a.length;
}
function lineLanguage(line: string): string {
  const parts = line.split(/(?<=[.!?。！？])\s*/u).filter((p) => /\p{L}/u.test(p));
  const en = parts.filter(looksEnglish).length;
  return en === parts.length ? "English" : en === 0 ? LANGUAGE : "mixed";
}
function has(line: string, w: string) {
  return line.normalize("NFC").toLowerCase().includes(w.normalize("NFC").toLowerCase());
}
function check(t: Turn, lines: string[], profile: string[], i: number): string[] {
  const all = lines.join(" ");
  const out: string[] = [];
  const ok = (cond: boolean, what: string) => out.push(`${cond ? "ok  " : "FAIL"} ${what}`);
  if (!lines.length) return ["FAIL no reply"];
  if (t.kind === "grammar") {
    ok(lines.some((l) => looksEnglish(l) || lineLanguage(l) === "mixed"), "correction is in English");
    ok(has(all, t.right!), `correction quotes the right form "${t.right}"`);
  }
  if (t.kind === "english-question") {
    ok(lines.some((l) => lineLanguage(l) !== LANGUAGE), "answers the English question in English");
    ok(has(all, t.right!), `quotes "${t.right}"`);
  }
  if (t.kind === "correct" || t.kind === "near-miss") {
    ok(lines.some((l) => lineLanguage(l) !== "English"), `carries on in ${LANGUAGE}`);
    ok(!/\b(you said|try again|say it again|repeat)\b/i.test(all), "no correction of an understandable line");
  }
  if (t.kind === "name" || t.kind === "name-fix") {
    ok(profile.some((p) => has(p, t.name!)), `update_profile saved ${t.name}`);
    ok(has(all, t.name!), `uses the name ${t.name}`);
  }
  if (i > 1) ok(!SCRIPT.slice(0, i).some((s) => s.kind === "name-fix") || !has(all, "jerry"), "never uses the old name again");
  if (i > 0) ok(!/\b(i am christopher|christopher here|my name is christopher)\b/i.test(all), "no second greeting");
  return out;
}
function findLoops(rs: Result[]): string[] {
  const out: string[] = [];
  const bag = (s: string) => new Set(words(s));
  const lines = rs.flatMap((r) => r.christopher.map((l) => ({ turn: r.turn, l })));
  for (let a = 0; a < lines.length; a++)
    for (let b = a + 1; b < lines.length; b++) {
      const x = bag(lines[a].l);
      const y = bag(lines[b].l);
      const shared = [...x].filter((w) => y.has(w)).length;
      if (x.size > 3 && shared / new Set([...x, ...y]).size >= 0.6)
        out.push(`turns ${lines[a].turn} and ${lines[b].turn} say nearly the same thing`);
    }
  for (const r of rs.filter((r) => r.kind === "grammar")) {
    const right = SCRIPT[r.turn - 1].right!;
    const again = rs.filter((o) => o.turn > r.turn && o.christopher.some((l) => /you said/i.test(l) && has(l, right)));
    if (again.length) out.push(`"${right}" corrected again in turn ${again.map((o) => o.turn).join(", ")}`);
  }
  return out;
}
