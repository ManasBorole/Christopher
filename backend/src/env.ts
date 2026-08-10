import "dotenv/config"; // load backend/.env before reading any var

// Fail fast on missing config instead of dying deep in a request.
function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}
function opt(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

export const env = {
  port: Number(opt("PORT", "8787")),
  // Comma-separated allowlist so prod + localhost (+ any preview URLs) all work.
  frontendOrigins: opt("FRONTEND_ORIGIN", "http://localhost:3000")
    .split(",")
    .map((o) => o.trim().replace(/\/$/, "")) // tolerate spaces + trailing slash
    .filter(Boolean),
  openaiKey: req("OPENAI_API_KEY"),
  // Full realtime model, not the -mini: the mini mis-hears target-language audio and
  // loses the conversational thread (re-greeting every turn), which is exactly what
  // made the tutor feel like a broken bot. The full model understands speech and holds
  // context far better. Set OPENAI_REALTIME_MODEL=gpt-realtime-mini to trade quality
  // for cost. (The old gpt-4o-mini-realtime-preview is a dead Beta model - /calls 404s it.)
  realtimeModel: opt("OPENAI_REALTIME_MODEL", "gpt-realtime"),
  realtimeVoice: opt("OPENAI_REALTIME_VOICE", "alloy"),
  summaryModel: opt("OPENAI_SUMMARY_MODEL", "gpt-4o-mini"),
  // Cheaper audio judge for pronunciation. (gpt-4o-*-audio-preview was retired;
  // gpt-audio-mini is the current cheap audio-in model. It does NOT support
  // response_format:json_object - pronounce.ts asks for JSON in the prompt instead.)
  pronunciationModel: opt("OPENAI_PRONUNCIATION_MODEL", "gpt-audio-mini"),
};

// Free-trial gate. Modular: swap these / the checks in gate.ts for paid plans
// later without touching the routes.
//
// Keep these SMALL (the real trial limits). To give specific accounts unlimited
// access, list their owner ids in UNLIMITED_OWNERS instead of inflating these --
// inflating them unrestricts every visitor.
export const FREE = {
  sessionsPerOwner: Number(opt("FREE_SESSIONS", "1")),
  secondsPerSession: Number(opt("FREE_SECONDS", "60")),
  // Owner ids that bypass the gate, e.g. "clerk:user_abc123,guest:<uuid>".
  unlimitedOwners: opt("UNLIMITED_OWNERS", "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
};
