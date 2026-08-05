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
  // Cost-optimized defaults. gpt-realtime-mini is ~5-10x cheaper than gpt-realtime
  // while keeping conversational quality fine for a language tutor. (The old
  // gpt-4o-mini-realtime-preview is a deprecated Beta model - GA /calls 404s it.)
  realtimeModel: opt("OPENAI_REALTIME_MODEL", "gpt-realtime-mini"),
  realtimeVoice: opt("OPENAI_REALTIME_VOICE", "alloy"),
  summaryModel: opt("OPENAI_SUMMARY_MODEL", "gpt-4o-mini"),
  // Cheaper audio judge for pronunciation.
  pronunciationModel: opt("OPENAI_PRONUNCIATION_MODEL", "gpt-4o-mini-audio-preview"),
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
