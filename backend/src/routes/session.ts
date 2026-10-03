import { Router } from "express";
import { env } from "../env.js";
import { prisma } from "../db.js";
import type { Course } from "@prisma/client";
import { owner, type OwnedRequest } from "../owner.js";
import { checkConnect, recordConnect } from "../gate.js";
import { TUTOR_SYSTEM_PROMPT, courseContext } from "../prompts/tutor.js";
import { realtimeSession, transcriptionPrompt } from "../realtime.js";

export const sessionRouter = Router();

sessionRouter.post("/session", owner, async (req: OwnedRequest, res) => {
  try {
    // Free-trial gate: refuse once the trial is used. Otherwise the trial is used
    // when Christopher first hears the learner (POST /usage/consume on the first
    // speech_started), so failed connects and dead mics never burn it - up to
    // FREE_UNHEARD_CONNECTS unheard connections; past that a connection pays up front.
    // Both are independent reads; run them together so the learner waits on one round trip, not two.
    const [rule, ctx] = await Promise.all([checkConnect(req.ownerId!), loadCourse(req.body?.sessionId, req.ownerId)]);
    if (rule === "refuse") return res.status(402).json({ error: "limit_reached" });
    const instructions = TUTOR_SYSTEM_PROMPT + ctx.suffix;
    const session = realtimeSession({
      model: env.realtimeModel,
      voice: env.realtimeVoice,
      instructions,
      transcription: ctx.course ? transcriptionPrompt(ctx.course) : "",
    });

    const r = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ session }),
    });

    if (!r.ok) {
      const detail = await r.text();
      return res.status(502).json({ error: "openai_session_failed", detail });
    }
    const data = (await r.json()) as { value: string; expires_at: number };
    await recordConnect(req.ownerId!, rule); // only a token actually handed out counts
    res.json({ token: data.value, model: env.realtimeModel, expiresAt: data.expires_at * 1000 });
  } catch (e) {
    res.status(500).json({ error: "session_error", detail: String(e) });
  }
});

// Load the course behind this session and build the tutor's memory context.
// Each session is a FRESH conversation; continuity comes from this memory, not
// from replaying the old transcript.
async function loadCourse(
  sessionId?: string,
  ownerId?: string
): Promise<{ suffix: string; course?: Course }> {
  if (!sessionId) return { suffix: "" };
  const s = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { course: true },
  });
  if (!s || s.course.ownerId !== ownerId) return { suffix: "" };
  const c = s.course;

  // Returning = they have actually talked in this course before. The name is
  // shared across courses, so it alone says nothing about this course.
  // Recent postcards give the mistakes to warm up with.
  const [priorTalks, recent] = await Promise.all([
    prisma.session.count({ where: { courseId: c.id, id: { not: s.id }, turns: { some: {} } } }),
    prisma.session.findMany({
      where: { courseId: c.id, endedAt: { not: null } },
      orderBy: { startedAt: "desc" },
      take: 3,
      select: { summary: true },
    }),
  ]);
  const mistakes = recent.flatMap((r) => (r.summary as { mistakes?: string[] } | null)?.mistakes ?? []);
  return { suffix: courseContext(c, priorTalks > 0 || c.vocabulary.length > 0, mistakes), course: c };
}
