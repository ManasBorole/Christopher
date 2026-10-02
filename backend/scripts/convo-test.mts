// End-to-end voice test for the live conversation. Dev only, never run by the app.
//
// Speaks scripted learners (TTS) into Realtime sessions built with exactly the
// backend's config and instructions, records every server event, and reports
// per turn: what the learner said vs what transcription wrote (WER), what
// Christopher said and in which language (sentence by sentence), corrections,
// stage moves (update_profile), curiosity about what the learner already
// knows, re-asked questions and loops. Costs money: one --max-usd cap covers
// every script, and it stops before the spend could pass it.
//
//   npx tsx backend/scripts/convo-test.mts --dry-run           (no network, free)
//   npx tsx backend/scripts/convo-test.mts                     (real run, s1,s2,s3, cap $0.45)
//   npx tsx backend/scripts/convo-test.mts --replay log.json   (re-check a saved run, free)
// Options: --scripts s1,s2,s3,classic  --max-usd N  --out file.json
//          --pin <iso code> (lock transcription to one language, to compare
//          with the default unpinned + prompted transcription)
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
    "max-usd": { type: "string", default: "0.45" },
    scripts: { type: "string", default: "s1,s2,s3" },
    out: { type: "string" },
    pin: { type: "string" },
    replay: { type: "string" },
  },
}).values;
const DRY = args["dry-run"]!;
const MAX_USD = Number(args["max-usd"]);
if (!(MAX_USD > 0)) throw new Error("--max-usd must be a positive number");

dotenv.config({ path: new URL("../.env", import.meta.url) });
if (DRY || args.replay) process.env.OPENAI_API_KEY ||= "dry-run";
// Same modules the backend uses, so model, voice, prompt and session match.
const { env } = await import("../src/env.ts");
const { TUTOR_SYSTEM_PROMPT, courseContext } = await import("../src/prompts/tutor.ts");
const { realtimeSession, transcriptionPrompt } = await import("../src/realtime.ts");

// ---- Scripts -------------------------------------------------------------------
// What a good tutor does after each learner line. `fake` is an ideal reply,
// used by --dry-run (and documents the intent); `fakeProfile` its tool call.
type Expect = {
  greet?: "english" | "target"; // first reply: greets in this language and says his name
  lang?: "english" | "target" | "some-target"; // most sentences English / all target (bar one correction) / at least one target
  correct?: boolean; // the learner was right: no correction words
  error?: { wrong: string; right: string; in: "english" | "target" | "either" };
  englishQ?: string; // answered in English, quoting this
  curious?: boolean; // reacts to what they already know with a question
  teaches?: RegExp; // teaches something new
  notTeach?: RegExp; // must not teach or ask this (they know it)
  answered?: RegExp[]; // later questions matching these re-ask what was said
  name?: string; // update_profile saved it and he uses it
  oldName?: string; // never used again after this turn
  stage?: [number, number]; // effective stage (saved or last update_profile) within this range
};
type Turn = { say: string; expect: Expect; fake: string; fakeProfile?: Record<string, unknown> };
type Script = { id: string; title: string; language: string; stage: number | null; returning: boolean; voice: string; turns: Turn[] };

const BEGINNER = "A beginner with an English accent, speaking at a natural, slightly careful pace.";
const NO_HELLO = /how (do you|to|would you) say ['"“]?(hello|hi)\b|say ['"“]?hola\b|c[oó]mo (se dice|dir[ií]as) ['"“]?hello/i;
const BASICS = /how (do you|to|would you) say|repeat after me|let'?s (start|learn) (with )?(the )?basics|means ['"“]?hello|c[oó]mo se dice/i;
const CURIOUS = /already know|where did you learn|how do you know|who taught|learned it|ya sabes|d[oó]nde (lo )?aprendiste|qui[eé]n te (lo )?ense[nñ]/i;

const SCRIPTS: Script[] = [
  {
    id: "s1",
    title: "Beginner who already knows hola",
    language: "Spanish",
    stage: null,
    returning: false,
    voice: BEGINNER,
    turns: [
      {
        say: "Hola!",
        expect: { greet: "english", lang: "english", curious: true, notTeach: NO_HELLO, answered: [/hello|\bhola\b/i], stage: [1, 2] },
        fake: "Hi, I am Christopher! Oh, you already know hola! Where did you learn that?",
        fakeProfile: { stage: 1 },
      },
      {
        say: "I learned it from a friend.",
        expect: { lang: "english", teaches: /buenos d[ií]as|buenas (tardes|noches)|me llamo|c[oó]mo est[aá]s|mucho gusto|adi[oó]s/i, notTeach: NO_HELLO, stage: [1, 2] },
        fake: "Nice! Then let's learn good morning: 'buenos días'. Want to try it?",
      },
      {
        say: "Buenos días!",
        expect: { correct: true, notTeach: NO_HELLO, answered: [/good morning|buenos d[ií]as/i], stage: [1, 2] },
        fake: "Perfect, that sounded great! Now let's say your name: 'me llamo' and then your name.",
      },
      {
        say: "Sorry, what does that mean?",
        expect: { lang: "english", stage: [1, 2] },
        fake: "'Me llamo' means 'my name is'. So you could say 'me llamo Sam'. What is your name?",
      },
      {
        say: "Me llamo Sam.",
        expect: { correct: true, name: "Sam", answered: [/c[oó]mo te llamas|your name|tu nombre/i], stage: [1, 2] },
        fake: "Great job, Sam! Now try asking me: '¿cómo estás?' It means 'how are you?'",
        fakeProfile: { userName: "Sam" },
      },
      {
        say: "Buenos días, Christopher. ¿Cómo estás?",
        expect: { correct: true, answered: [/buenos d[ií]as/i], stage: [1, 2] },
        fake: "Lovely! Estoy muy bien, gracias. That means 'I am very well, thanks'.",
      },
    ],
  },
  {
    id: "s2",
    title: "Conversational learner (I can chat a little)",
    language: "Spanish",
    stage: 3,
    returning: false,
    voice: "An intermediate learner with a light English accent, speaking fairly fluently.",
    turns: [
      {
        say: "Hola, ¿qué tal? Hoy estoy un poco cansado porque trabajé mucho.",
        expect: { greet: "target", lang: "target", correct: true, notTeach: BASICS, answered: [/c[oó]mo est[aá]s|qu[eé] tal|how are you/i], stage: [3, 4] },
        fake: "¡Hola! Soy Christopher. Vaya, ¿en qué trabajas?",
      },
      {
        say: "Soy enfermero. Me gusta cocinar, y ayer cociné una paella para mis amigos.",
        expect: { lang: "target", correct: true, answered: [/en qu[eé] trabajas|te gusta cocinar/i], stage: [3, 4] },
        fake: "¡Qué rico! ¿Y les gustó la paella a tus amigos?",
      },
      {
        say: "Sí, les gustó mucho. Mis amigos es muy simpáticos.",
        expect: { lang: "target", error: { wrong: "es", right: "son", in: "english" }, stage: [3, 4] },
        fake: "Quick one: with amigos it is 'son', not 'es'. ¡Qué bien! ¿Viven cerca de ti?",
      },
      {
        say: "Sí, vivimos cerca. Los sábados jugamos al fútbol juntos.",
        expect: { lang: "target", correct: true, answered: [/viven cerca/i], stage: [3, 4] },
        fake: "¡Qué divertido! ¿Ganáis muchas veces?",
      },
      {
        say: "A veces. ¿Y tú, qué haces los fines de semana?",
        expect: { lang: "target", correct: true, stage: [3, 4] },
        fake: "Me encanta leer y pasear por el parque. ¿Qué libro me recomiendas?",
      },
    ],
  },
  {
    id: "s3",
    title: "Fluent speaker, no saved stage",
    language: "Spanish",
    stage: null,
    returning: false,
    voice: "A fluent Spanish speaker from Madrid, natural native pace and accent.",
    turns: [
      {
        say: "¡Buenas! Llevo años viviendo en Madrid y hablo bastante bien, pero quiero practicar conversación sobre cine.",
        expect: { greet: "target", lang: "target", correct: true, notTeach: BASICS, stage: [3, 4] },
        fake: "¡Buenas! Soy Christopher. ¡Genial! ¿Qué tipo de cine te gusta más?",
        fakeProfile: { stage: 4 },
      },
      {
        say: "Últimamente he visto muchas películas de Almodóvar; me encanta cómo retrata a las mujeres.",
        expect: { lang: "target", correct: true, notTeach: BASICS, stage: [3, 4] },
        fake: "Sus personajes femeninos son inolvidables. ¿Cuál es tu favorita?",
      },
      {
        say: "Todo sobre mi madre, sin duda. Si tendría más tiempo, iría al cine cada semana.",
        expect: { lang: "target", error: { wrong: "tendría", right: "tuviera", in: "either" }, notTeach: BASICS, stage: [3, 4] },
        fake: "Un detalle: se dice 'si tuviera', no 'si tendría'. ¡A mí también me encanta esa película! ¿Y qué directores te gustan además?",
      },
      {
        say: "Claro, tienes razón. Me gustan Buñuel y Amenábar. ¿Y a ti qué director te gusta más?",
        expect: { lang: "target", correct: true, notTeach: BASICS, stage: [3, 4] },
        fake: "Me fascina Buñuel, sobre todo su etapa en México. ¿Has visto Los olvidados?",
      },
      {
        say: "Sí, es durísima. Bueno, tengo que irme. ¡Hasta luego!",
        expect: { lang: "target", correct: true, notTeach: BASICS, stage: [3, 4] },
        fake: "¡Hasta luego! Ha sido un placer charlar contigo.",
      },
    ],
  },
  {
    id: "classic",
    title: "Ten mixed Spanish turns (the first verification run)",
    language: "Spanish",
    stage: null,
    returning: false,
    voice: `A beginner learning Spanish, with an English accent, speaking at a natural, slightly careful pace.`,
    turns: [
      { say: "Hola, me llamo Jerry.", expect: { greet: "english", name: "Jerry", answered: [/hello|\bhola\b/i, /c[oó]mo te llamas|your name|tu nombre/i] }, fake: "Hi Jerry, I am Christopher! Oh, you already know some Spanish. Where did you learn it?", fakeProfile: { userName: "Jerry" } },
      { say: "No, sorry, my name is Tom, not Jerry.", expect: { name: "Tom", oldName: "Jerry" }, fake: "Sorry about that, Tom! ¿Cómo estás hoy?", fakeProfile: { userName: "Tom" } },
      { say: "Estoy muy bien, gracias. ¿Y tú?", expect: { correct: true, lang: "some-target", answered: [/c[oó]mo est[aá]s|how are you|i['’]?m (fine|good|well)|estoy bien/i] }, fake: "¡Muy bien! Yo también estoy bien, gracias. ¿Qué te gusta hacer?" },
      { say: "Grasias por la ayooda.", expect: { correct: true, lang: "some-target" }, fake: "¡De nada, Tom! ¿Qué haces hoy?" },
      { say: "Yo es estudiante de español.", expect: { error: { wrong: "yo es", right: "soy", in: "english" } }, fake: "Nice! Just one thing: you said 'yo es', but with yo it is 'yo soy'. ¿Qué estudias?" },
      { say: "How do I say I like coffee in Spanish?", expect: { englishQ: "me gusta el café" }, fake: "You say 'me gusta el café'. Now you: what do you like to drink?" },
      { say: "Me gusta el café con leche.", expect: { correct: true, lang: "some-target", answered: [/te gusta el caf[eé]|like coffee/i] }, fake: "¡Qué rico! A mí también me gusta. ¿Dónde vives?" },
      { say: "Ayer yo como una pizza grande.", expect: { error: { wrong: "como", right: "comí", in: "english" } }, fake: "Good! For yesterday, use 'comí', not 'como'. Ayer comí una pizza. ¿Te gustó?" },
      { say: "Vivo en Londres con mi familia.", expect: { correct: true, lang: "some-target", answered: [/d[oó]nde vives|where do you live/i] }, fake: "¡Londres es una ciudad bonita! ¿Qué te gusta hacer allí?" },
      { say: "Me gusta mucho leer libros.", expect: { correct: true, lang: "some-target", answered: [/¿\s*te gusta leer|do you like (to read|reading)/i] }, fake: "¡Qué bien! ¿Qué libros te gustan?" },
    ],
  },
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

// Exactly what POST /session sends for this script's course.
function sessionFor(sc: Script) {
  const course = { language: sc.language, userName: "", nativeLanguage: "", level: "A1", vocabulary: [], pronunciationNotes: [], stage: sc.stage };
  const session: any = realtimeSession({
    model: env.realtimeModel,
    voice: env.realtimeVoice,
    instructions: TUTOR_SYSTEM_PROMPT + courseContext(course, sc.returning),
    transcription: transcriptionPrompt(course),
  });
  if (args.pin) session.audio.input.transcription.language = args.pin;
  delete session.model; // over WebSocket the model goes in the URL
  return session;
}

type Result = {
  script: string;
  turn: number;
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

// ---- Replay: re-run today's checks on a saved run's lines, no network --------
if (args.replay) {
  const log = JSON.parse(readFileSync(args.replay, "utf8"));
  const saved: any[] = log.results.map((r: any) => ({ script: "classic", ...r })); // first runs had one script
  const rs: Result[] = [];
  for (const sc of SCRIPTS) {
    const mine = saved.filter((r) => r.script === sc.id);
    if (!mine.length) continue;
    console.log(`\n### ${sc.id}: ${sc.title}`);
    // Indexed by turn; turns missing from the log count as silent.
    const lines: string[][] = sc.turns.map(() => []);
    const profiles: string[][] = sc.turns.map(() => []);
    for (const r of mine) {
      lines[r.turn - 1] = r.christopher;
      profiles[r.turn - 1] = r.profile ?? [];
      const res = finish(sc, r.turn - 1, { said: r.said, heard: r.heard, christopher: r.christopher, profile: r.profile ?? [], usd: r.usd ?? 0 }, lines, profiles);
      rs.push(res);
      printTurn(res);
    }
  }
  report(rs, log.spent ?? 0);
  process.exit(0);
}

// ---- TTS (cached on disk, so a re-run does not pay for the same audio) -------
const RATE = 24000; // pcm16 mono, the Realtime default input format
const cacheDir = join(tmpdir(), "christopher-convo-tts");
mkdirSync(cacheDir, { recursive: true });
async function speech(text: string, voice: string): Promise<Buffer> {
  // The first run's clips were keyed by text alone; keep finding them.
  const key = voice === SCRIPTS[3].voice ? TTS_MODEL + text : TTS_MODEL + voice + text;
  const file = join(cacheDir, createHash("sha1").update(key).digest("hex") + ".pcm");
  if (existsSync(file)) return readFileSync(file);
  if (DRY) return Buffer.alloc(Math.round(RATE * 2 * (0.4 + text.length / 14))); // silence of a plausible length
  const r = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.openaiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: TTS_MODEL, voice: "coral", input: text, response_format: "pcm", instructions: voice }),
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

async function connect(sc: Script, session: any): Promise<Conn> {
  if (DRY) return fakeConn(sc);
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
// replies with the script's ideal lines, with usage numbers in the right range.
function fakeConn(sc: Script): Conn {
  let n = 0;
  let audioMs = 0;
  const emit = (e: any) => setTimeout(() => onServerEvent(e), 1);
  return {
    close() {},
    send(e: any) {
      if (e.type === "input_audio_buffer.append") audioMs += (Buffer.from(e.audio, "base64").length / (RATE * 2)) * 1000;
      if (e.type !== "input_audio_buffer.commit") return;
      const turn = sc.turns[n];
      const u = `${sc.id}_u${n}`;
      const a = `${sc.id}_a${n}`;
      const r = `${sc.id}_r${n}`;
      emit({ type: "input_audio_buffer.committed", item_id: u, previous_item_id: n ? `${sc.id}_a${n - 1}` : null });
      if (turn.fakeProfile) {
        emit({ type: "response.function_call_arguments.done", name: "update_profile", call_id: `call_${r}`, arguments: JSON.stringify(turn.fakeProfile) });
        emit({ type: "response.done", response: { id: `${r}_tool`, status: "completed", output: [{ type: "function_call" }], usage: usage(n, 0) } });
      }
      emit({ type: "response.output_audio_transcript.done", response_id: r, item_id: a, transcript: turn.fake });
      emit({ type: "conversation.item.input_audio_transcription.completed", item_id: u, transcript: turn.say, usage: { type: "tokens", input_tokens: 40, output_tokens: 12, input_token_details: { audio_tokens: Math.round(audioMs / 100), text_tokens: 40 } } });
      emit({ type: "response.done", response: { id: r, status: "completed", output: [{ type: "message", id: a }], usage: usage(n, turn.fake.length) } });
      audioMs = 0;
      n++;
    },
  };
  function usage(turn: number, replyChars: number) {
    const text = 3600 + turn * 60;
    return {
      input_token_details: { text_tokens: text, audio_tokens: 40 + turn * 70, cached_tokens_details: { text_tokens: turn ? 3400 : 0, audio_tokens: turn ? turn * 60 : 0 } },
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
const chosen = args.scripts!.split(",").map((id) => {
  const sc = SCRIPTS.find((s) => s.id === id.trim());
  if (!sc) throw new Error(`Unknown script ${id}; have ${SCRIPTS.map((s) => s.id).join(", ")}`);
  return sc;
});
const results: Result[] = [];
const MS = (ms: number) => Buffer.alloc(Math.round((RATE * 2 * ms) / 1000));
console.log(`${DRY ? "DRY RUN (no network). " : ""}${env.realtimeModel}, voice ${env.realtimeVoice}, scripts ${chosen.map((s) => s.id).join(", ")}, cap $${MAX_USD.toFixed(2)} for all of them`);

// Pre-make every utterance first (cheap, cached), so the cap check sees it.
const audio = new Map<string, Buffer>();
for (const sc of chosen) for (const t of sc.turns) audio.set(sc.id + t.say, await speech(t.say, sc.voice));

let biggestTurn = 0.02;
let stopped = false;
for (const sc of chosen) {
  if (stopped) break;
  const session = sessionFor(sc);
  console.log(`\n### ${sc.id}: ${sc.title} (saved stage ${sc.stage ?? "none"})`);
  console.log(`transcription: ${JSON.stringify(session.audio.input.transcription)}`);
  const conn = await connect(sc, session);
  const lines: string[][] = [];
  const profiles: string[][] = [];
  for (const [i, t] of sc.turns.entries()) {
    // Stop BEFORE a turn could take the spend past the cap.
    if (spent + biggestTurn * 1.5 > MAX_USD) {
      console.log(`\nStopping before ${sc.id} turn ${i + 1}: $${spent.toFixed(4)} spent, next turn could cost ~$${(biggestTurn * 1.5).toFixed(4)}.`);
      stopped = true;
      break;
    }
    console.log(`\nTurn ${i + 1} learner: ${t.say}`);
    const before = spent;
    const from = events.length;

    // Speak: a little silence, the utterance, then enough silence for server VAD
    // to end the turn and reply on its own (as in the app).
    const pcm = Buffer.concat([MS(300), audio.get(sc.id + t.say)!, MS(1200)]);
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
    const christopher = events
      .slice(from)
      .filter((x) => /output_audio_transcript\.done$/.test(x.type))
      .map((x) => x.transcript as string);
    lines.push(christopher);
    profiles.push(profile);
    const r = finish(sc, i, { said: t.say, heard: parts.join(" "), christopher, profile, usd: spent - before }, lines, profiles);
    results.push(r);
    biggestTurn = Math.max(biggestTurn, r.usd);
    printTurn(r, false);
    if (spent > MAX_USD) {
      console.log(`\nCap passed mid-turn ($${spent.toFixed(4)}); stopping.`);
      stopped = true;
      break;
    }
  }
  conn.close();
}

// ---- Report ----------------------------------------------------------------------
const loops = report(results, spent);
const out = args.out ?? join(tmpdir(), `convo-test-${Date.now()}.json`);
writeFileSync(out, JSON.stringify({ model: env.realtimeModel, scripts: chosen.map((s) => s.id), spent, results, loops, events }, null, 2));
console.log(`full log (every server event): ${out}`);

// ---- Analysis ----------------------------------------------------------------------
function finish(
  sc: Script,
  i: number,
  r: { said: string; heard: string; christopher: string[]; profile: string[]; usd: number },
  lines: string[][],
  profiles: string[][]
): Result {
  return {
    script: sc.id,
    turn: i + 1,
    ...r,
    wer: wer(r.said, r.heard),
    languages: r.christopher.map((l) => lineLanguage(l, sc.language)),
    translated: r.christopher.filter((l) => !looksEnglish(l)),
    checks: check(sc, i, lines, profiles),
  };
}
function printTurn(r: Result, header = true) {
  if (header) console.log(`\nTurn ${r.turn} learner: ${r.said}`);
  console.log(`  heard (WER ${(r.wer * 100).toFixed(0)}%): ${r.heard}`);
  for (const [k, l] of r.christopher.entries()) console.log(`  Christopher [${r.languages[k]}]: ${l}${looksEnglish(l) ? "" : "  -> translated"}`);
  for (const p of r.profile) console.log(`  update_profile ${p}`);
  for (const c of r.checks) console.log(`  ${c}`);
}
function report(rs: Result[], usd: number): string[] {
  const loops = SCRIPTS.flatMap((sc) => findLoops(sc, rs.filter((r) => r.script === sc.id)));
  const avgWer = rs.reduce((a, r) => a + r.wer, 0) / Math.max(1, rs.length);
  console.log(`\n==== Report ====`);
  console.log(`turns run: ${rs.length}, mean WER ${(avgWer * 100).toFixed(1)}%, spent $${usd.toFixed(4)}`);
  const fails = rs.flatMap((r) => r.checks.filter((c) => c.startsWith("FAIL")).map((c) => `${r.script} turn ${r.turn}: ${c}`));
  console.log(fails.length ? `${fails.length} failed checks:\n${fails.join("\n")}` : "all checks passed");
  console.log(loops.length ? `loops:\n${loops.join("\n")}` : "no loops or repeated corrections");
  return loops;
}

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
function sentences(line: string): string[] {
  return line.split(/(?<=[.!?。！？])\s+/u).filter((p) => /\p{L}/u.test(p));
}
// English, the target language, or mixed, sentence by sentence. Quoted
// target-language words inside an English sentence keep it English.
function lineLanguage(line: string, language: string): string {
  const parts = sentences(line);
  const en = parts.filter(looksEnglish).length;
  return en === parts.length ? "English" : en === 0 ? language : "mixed";
}
function has(line: string, w: string) {
  return line.normalize("NFC").toLowerCase().includes(w.normalize("NFC").toLowerCase());
}
// Words a tutor uses when marking something as wrong, in English or Spanish.
function marksError(s: string): boolean {
  return /(?<!\p{L})(almost|casi|close|not quite|you said|dijiste|diríamos|dirías mejor|we would say|we'd say|should be|instead|try again|careful|cuidado|mejor di|se dice|un detalle|it'?s ["'“‘]|is ["'“‘]|not ["'“‘]|no ["'“‘])(?!\p{L})/iu.test(s);
}
function stagesIn(profile: string[]): number[] {
  return profile.flatMap((p) => {
    try {
      const s = Number(JSON.parse(p).stage);
      return s >= 1 && s <= 4 ? [s] : [];
    } catch {
      return [];
    }
  });
}
function check(sc: Script, i: number, lines: string[][], profiles: string[][]): string[] {
  const t = sc.turns[i].expect;
  const now = lines[i];
  const all = now.join(" ");
  const said = now.flatMap(sentences);
  const en = said.filter(looksEnglish);
  const out: string[] = [];
  const ok = (cond: boolean, what: string) => out.push(`${cond ? "ok  " : "FAIL"} ${what}`);
  if (!now.length) return ["FAIL no reply"];

  if (t.greet) {
    const first = said[0] ?? "";
    const englishHello = /^\W*(hi|hey|hello|welcome|nice)\b/i.test(first);
    ok(t.greet === "english" ? looksEnglish(first) || englishHello : !looksEnglish(first) && !englishHello, `first reply greets in ${t.greet === "english" ? "English" : sc.language}`);
    ok(has(all, "christopher"), "first reply says his name");
  }
  if (t.lang === "english") ok(en.length * 2 >= said.length, `mostly English (${en.length}/${said.length} sentences)`);
  if (t.lang === "some-target") ok(en.length < said.length, `carries on in ${sc.language}`);
  if (t.lang === "target") {
    const allowed = t.error && t.error.in !== "target" ? 1 : 0; // one quick English correction line
    ok(en.length <= allowed, `${sc.language} only${allowed ? ", bar one quick correction" : ""} (${en.length} English of ${said.length}${en.length ? `: "${en.join(" ")}"` : ""})`);
  }
  if (t.correct) {
    const marked = said.find(marksError);
    ok(!marked, `no correction of a correct line${marked ? `: "${marked}"` : ""}`);
  }
  if (t.error) {
    const { wrong, right } = t.error;
    const corr = said.filter((s) => marksError(s) || has(s, right));
    ok(corr.length > 0 && has(all, right), `corrects the real error ('${wrong}' -> '${right}')`);
    if (t.error.in === "english") ok(corr.some(looksEnglish), "the correction is in English");
    if (t.error.in === "target") ok(corr.length > 0 && !corr.some(looksEnglish), `the correction is in ${sc.language}`);
    ok(has(all, wrong) && has(all, right), "quotes the learner's words and the right words");
  }
  if (t.englishQ) {
    ok(en.length > 0, "answers the English question in English");
    ok(has(all, t.englishQ), `quotes "${t.englishQ}"`);
  }
  if (t.curious) ok(said.some((s) => /[?？]/.test(s) && CURIOUS.test(s)), "notices what they already know and asks about it");
  if (t.teaches) ok(t.teaches.test(all), `teaches something new (${t.teaches.source.slice(0, 40)}…)`);
  if (t.notTeach) {
    const bad = said.find((s) => t.notTeach!.test(s));
    ok(!bad, `skips what they already know${bad ? `: "${bad}"` : ""}`);
  }
  if (t.name) {
    ok(profiles[i].some((p) => has(p, t.name!)), `update_profile saved ${t.name}`);
    ok(has(all, t.name), `uses the name ${t.name}`);
  }
  const old = sc.turns.slice(0, i).map((x) => x.expect.oldName).filter(Boolean) as string[];
  if (old.length) ok(!old.some((n) => has(all, n)), "never uses the old name again");
  if (t.stage) {
    const moves = profiles.slice(0, i + 1).flatMap(stagesIn);
    const stage = moves.at(-1) ?? sc.stage;
    const [lo, hi] = t.stage;
    ok(stage != null && stage >= lo && stage <= hi, `stage ${stage ?? "not set"} is within ${lo}-${hi}${moves.length ? ` (moves: ${moves.join(" -> ")})` : ""}`);
  }
  // Questions about something the learner has already said (this turn or before).
  const answered = sc.turns.slice(0, i + 1).flatMap((x) => x.expect.answered ?? []);
  const reask = said.find((s) => /[?？]/.test(s) && answered.some((re) => re.test(s)));
  ok(!reask, `does not re-ask what the learner already answered${reask ? `: "${reask}"` : ""}`);
  if (i > 0) ok(!/\b(i am christopher|christopher here|my name is christopher|soy christopher)\b/i.test(all), "no second greeting");
  return out;
}
function findLoops(sc: Script, rs: Result[]): string[] {
  const out: string[] = [];
  const bag = (s: string) => new Set(words(s));
  const lines = rs.flatMap((r) => r.christopher.map((l) => ({ turn: r.turn, l })));
  for (let a = 0; a < lines.length; a++)
    for (let b = a + 1; b < lines.length; b++) {
      const x = bag(lines[a].l);
      const y = bag(lines[b].l);
      const shared = [...x].filter((w) => y.has(w)).length;
      if (x.size > 3 && shared / new Set([...x, ...y]).size >= 0.6)
        out.push(`${sc.id}: turns ${lines[a].turn} and ${lines[b].turn} say nearly the same thing`);
    }
  for (const r of rs) {
    const right = sc.turns[r.turn - 1].expect.error?.right;
    if (!right) continue;
    const again = rs.filter((o) => o.turn > r.turn && o.christopher.some((l) => marksError(l) && has(l, right)));
    if (again.length) out.push(`${sc.id}: "${right}" corrected again in turn ${again.map((o) => o.turn).join(", ")}`);
  }
  return out;
}
