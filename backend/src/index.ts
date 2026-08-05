import express from "express";
import cors from "cors";
import { env } from "./env.js";
import { sessionRouter } from "./routes/session.js";
import { pronounceRouter } from "./routes/pronounce.js";
import { coursesRouter } from "./routes/courses.js";
import { sessionsRouter } from "./routes/sessions.js";
import { usageRouter } from "./routes/usage.js";
import { onError } from "./http.js";

const app = express();
app.use(cors({ origin: env.frontendOrigins }));
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use(sessionRouter);
app.use(pronounceRouter);
app.use(coursesRouter);
app.use(sessionsRouter);
app.use(usageRouter);
app.use(onError); // must be last: converts thrown errors to 500 JSON

app.listen(env.port, () => {
  console.log(`backend on http://localhost:${env.port}`);
});
