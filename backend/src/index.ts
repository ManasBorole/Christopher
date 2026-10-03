import express from "express";
import cors from "cors";
import { env } from "./env.js";
import { sessionRouter } from "./routes/session.js";
import { pronounceRouter } from "./routes/pronounce.js";
import { coursesRouter } from "./routes/courses.js";
import { sessionsRouter } from "./routes/sessions.js";
import { usageRouter } from "./routes/usage.js";
import { translateRouter } from "./routes/translate.js";
import { onError } from "./http.js";
import { prisma } from "./db.js";

const app = express();

// Allow the configured origins always; in dev also allow any localhost port, since
// Next picks 3001/3002/... when 3000 is taken and a hard-coded single origin would
// silently CORS-block every request. Production keeps the strict allowlist.
const allowlist = new Set(env.frontendOrigins);
const isDev = process.env.NODE_ENV !== "production";
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // curl / same-origin / server-to-server
      if (allowlist.has(origin)) return cb(null, true);
      if (isDev && /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) return cb(null, true);
      cb(null, false); // not allowed -> no ACAO header -> browser blocks
    },
  })
);
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));
// Opened by the site as soon as it loads, so a sleeping server and database are
// awake by the time the learner signs in or presses Start. Never fails loudly.
app.get("/warm", async (_req, res) => {
  const db = await prisma.$queryRaw`SELECT 1`.then(() => true, () => false);
  res.json({ ok: true, db });
});
app.use(sessionRouter);
app.use(pronounceRouter);
app.use(coursesRouter);
app.use(sessionsRouter);
app.use(usageRouter);
app.use(translateRouter);
app.use(onError); // must be last: converts thrown errors to 500 JSON

const server = app.listen(env.port, () => {
  console.log(`backend on http://localhost:${env.port} (${Math.round(process.uptime() * 1000)} ms after start)`);
  // Open the database connection now instead of on the first learner request
  // (TLS + a sleeping Neon compute cost ~2.5 s there).
  prisma.$connect().catch((e) => console.error("db connect failed", e));
});
// Outlive the host's proxy idle timeout so it never reuses a socket we just closed (a 502).
server.keepAliveTimeout = 120_000;
server.headersTimeout = 121_000;
