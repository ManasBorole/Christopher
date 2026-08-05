import { Router } from "express";
import { env } from "../env.js";
import { prisma } from "../db.js";
import { ah } from "../http.js";
import { owner, type OwnedRequest } from "../owner.js";
import { SummarySchema, type Summary } from "@vta/shared";

export const sessionsRouter = Router();
sessionsRouter.use(owner);

// Load a session with its course owner, or null if not owned by the caller.
async function ownedSession(sessionId: string, ownerId?: string) {
  const s = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { course: true, turns: { orderBy: { at: "asc" } } },
  });
  if (!s || s.course.ownerId !== ownerId) return null;
  return s;
}

// Read a single conversation (its transcript + summary).
sessionsRouter.get(
  "/sessions/:id",
  ah(async (req: OwnedRequest, res) => {
    const s = await ownedSession(req.params.id, req.ownerId);
    if (!s) return res.status(404).json({ error: "not found" });
    res.json({
      id: s.id,
      language: s.course.language,
      turns: s.turns.map((t) => ({ role: t.role, text: t.text, at: Number(t.at) })),
      summary: (s.summary as Summary | null) ?? null,
    });
  })
);

// Append a conversation turn.
sessionsRouter.post(
  "/sessions/:id/turns",
  ah(async (req: OwnedRequest, res) => {
    const s = await ownedSession(req.params.id, req.ownerId);
    if (!s) return res.status(404).json({ error: "not found" });
    const { role, text, at } = req.body ?? {};
    await prisma.turn.create({
      data: { sessionId: s.id, role, text, at: BigInt(at ?? 0) },
    });
    res.json({ ok: true });
  })
);

// End a conversation: generate + save a summary for THIS session only.
sessionsRouter.post(
  "/sessions/:id/end",
  ah(async (req: OwnedRequest, res) => {
    const s = await ownedSession(req.params.id, req.ownerId);
    if (!s) return res.status(404).json({ error: "not found" });

    const lang = s.course.language || "the target language";
    const transcript = s.turns
      .map((t) => `${t.role}: ${t.text}`)
      .join("\n")
      .slice(0, 12000);

    const sys =
      `You are a language tutor writing a short end-of-lesson summary for a lesson in ${lang}. ` +
      `Only include material from THIS lesson's transcript - do not invent or carry over other languages. ` +
      `Return JSON with keys: language (e.g. "${lang}"), ` +
      `vocabulary (array of {term, translation}: term = the ${lang} word/phrase practiced, ` +
      `translation = its plain English meaning - ALWAYS include the English translation), ` +
      `mistakes (string[] of recurring pronunciation/grammar mistakes, in English), ` +
      `grammarTips (string[] of 1-3 concise tips, in English), ` +
      `nextLesson (one English sentence on what to practice next). ` +
      `Only list vocabulary actually used. Empty arrays are fine. Be encouraging and specific.`;
    const user =
      `Language: ${lang}. Level: ${s.course.level}.\n` +
      `Words tracked in this course: ${s.course.vocabulary.join(", ") || "none"}.\n\n` +
      `Transcript:\n${transcript || "(no transcript captured)"}`;

    let summary: Summary = {
      language: lang,
      vocabulary: [],
      mistakes: [],
      grammarTips: [],
      nextLesson: "",
    };
    try {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.openaiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: env.summaryModel,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: sys },
            { role: "user", content: user },
          ],
        }),
      });
      if (r.ok) {
        const data = (await r.json()) as { choices: { message: { content: string } }[] };
        const parsed = SummarySchema.safeParse(JSON.parse(data.choices[0].message.content));
        if (parsed.success) summary = parsed.data;
      }
    } catch {
      /* best-effort: keep the empty summary */
    }

    // Persist the words this lesson surfaced back onto the course, so "Learned
    // words" reflects everything taught - not only phrases that happened to go
    // through the pronunciation scorer (that path is the only other writer).
    const learned = summary.vocabulary.map((v) => v.term.trim()).filter(Boolean);
    const vocabulary = learned.length
      ? Array.from(new Set([...s.course.vocabulary, ...learned]))
      : s.course.vocabulary;

    await prisma.$transaction([
      prisma.session.update({
        where: { id: s.id },
        data: { endedAt: new Date(), summary },
      }),
      prisma.course.update({
        where: { id: s.course.id },
        data: { vocabulary },
      }),
    ]);
    res.json(summary);
  })
);
