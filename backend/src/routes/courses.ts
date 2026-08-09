import { Router } from "express";
import { prisma } from "../db.js";
import { env } from "../env.js";
import { ah } from "../http.js";
import { owner, type OwnedRequest } from "../owner.js";
import type { CourseCard, CourseDetail, Summary } from "@vta/shared";

export const coursesRouter = Router();
coursesRouter.use(owner);

// Learned words = the course's own vocab cache UNION every word any session
// summary recorded. Deriving from summaries makes it retroactive and immune to
// the vocab cache drifting (the pronunciation scorer is the only other writer).
function learnedWords(base: string[], sessions: { summary: unknown }[]): string[] {
  const fromSummaries = sessions.flatMap((s) => {
    const sum = s.summary as Summary | null;
    return sum?.vocabulary?.map((v) => v.term) ?? [];
  });
  return Array.from(new Set([...base, ...fromSummaries].map((w) => w.trim()).filter(Boolean)));
}

// Translate target-language terms to concise English via one batched LLM call.
// Best-effort: returns {} on any failure so a hiccup never blocks the dashboard.
async function translateTerms(terms: string[], language: string): Promise<Record<string, string>> {
  if (!terms.length) return {};
  const sys =
    `You translate ${language} words and phrases into natural English. ` +
    `Return JSON {"translations": {"<term>": "<English meaning>"}} covering EVERY term given. ` +
    `Use the natural meaning of a phrase (not word-by-word); for an ambiguous word use its most common meaning. ` +
    `Keep each meaning short (1-4 words), no trailing punctuation.`;
  const user = `Translate these ${language} terms:\n${terms.map((t) => `- ${t}`).join("\n")}`;
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
    if (!r.ok) return {};
    const data = (await r.json()) as { choices: { message: { content: string } }[] };
    const parsed = JSON.parse(data.choices[0].message.content) as { translations?: Record<string, unknown> };
    const map = (parsed.translations ?? parsed) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const term of terms) {
      const v = map[term];
      if (typeof v === "string" && v.trim()) out[term] = v.trim();
    }
    return out;
  } catch {
    return {};
  }
}

type CourseForMeanings = {
  id: string;
  language: string;
  vocabulary: string[];
  meanings: unknown;
  sessions: { summary: unknown }[];
};

// Full term -> English meaning map for a course's learned words. Sources, in order:
//   1. the cached Course.meanings column (already translated, free)
//   2. session summaries (translations the tutor recorded at lesson end, free)
//   3. an LLM translation for anything still missing (e.g. pronunciation-scorer words,
//      which are stored with no translation)
// Newly resolved terms are written back to Course.meanings so any word is translated
// at most once. ponytail: translation happens on dashboard read; a word added
// mid-session shows its meaning on the next open, not instantly. Move to a write-time
// hook if that lag matters.
async function ensureMeanings(c: CourseForMeanings): Promise<Record<string, string>> {
  const meanings: Record<string, string> =
    c.meanings && typeof c.meanings === "object" ? { ...(c.meanings as Record<string, string>) } : {};
  const before = Object.keys(meanings).length;

  for (const s of c.sessions) {
    for (const v of (s.summary as Summary | null)?.vocabulary ?? []) {
      const term = v.term?.trim();
      const translation = v.translation?.trim();
      if (term && translation && !meanings[term]) meanings[term] = translation;
    }
  }

  const missing = learnedWords(c.vocabulary, c.sessions).filter((t) => !meanings[t]);
  if (missing.length) Object.assign(meanings, await translateTerms(missing, c.language));

  if (Object.keys(meanings).length !== before) {
    await prisma.course.update({ where: { id: c.id }, data: { meanings } });
  }
  return meanings;
}

// Home screen: one card per language the owner is studying.
coursesRouter.get(
  "/courses",
  ah(async (req: OwnedRequest, res) => {
    const rows = await prisma.course.findMany({
      where: { ownerId: req.ownerId },
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { sessions: true } }, sessions: { select: { summary: true } } },
    });
    const cards: CourseCard[] = rows.map((c) => ({
      id: c.id,
      language: c.language,
      userName: c.userName,
      level: c.level,
      vocabCount: learnedWords(c.vocabulary, c.sessions).length,
      sessionCount: c._count.sessions,
      updatedAt: c.updatedAt.toISOString(),
    }));
    res.json(cards);
  })
);

// Add / open a language. Idempotent per (owner, language).
coursesRouter.post(
  "/courses",
  ah(async (req: OwnedRequest, res) => {
    const language = String(req.body?.language ?? "").trim();
    if (!language) return res.status(400).json({ error: "language required" });
    const norm = language[0].toUpperCase() + language.slice(1).toLowerCase();
    const c = await prisma.course.upsert({
      where: { ownerId_language: { ownerId: req.ownerId!, language: norm } },
      update: {},
      create: { ownerId: req.ownerId!, language: norm },
    });
    res.json({ id: c.id, language: c.language });
  })
);

// Permanently delete a language and all its progress. Sessions + turns cascade
// (schema onDelete: Cascade), so this wipes every trace for the owner.
coursesRouter.delete(
  "/courses/:id",
  ah(async (req: OwnedRequest, res) => {
    const c = await prisma.course.findFirst({
      where: { id: req.params.id, ownerId: req.ownerId },
      select: { id: true },
    });
    if (!c) return res.status(404).json({ error: "not found" });
    await prisma.course.delete({ where: { id: c.id } });
    res.json({ ok: true });
  })
);

// Course dashboard: profile, learned words, session history + summaries.
coursesRouter.get(
  "/courses/:id",
  ah(async (req: OwnedRequest, res) => {
    const c = await prisma.course.findFirst({
      where: { id: req.params.id, ownerId: req.ownerId },
      include: {
        sessions: {
          orderBy: { startedAt: "desc" },
          include: { _count: { select: { turns: true } } },
        },
      },
    });
    if (!c) return res.status(404).json({ error: "not found" });
    const detail: CourseDetail = {
      id: c.id,
      language: c.language,
      userName: c.userName,
      nativeLanguage: c.nativeLanguage,
      level: c.level,
      vocabulary: learnedWords(c.vocabulary, c.sessions),
      meanings: await ensureMeanings(c),
      pronunciationNotes: c.pronunciationNotes,
      createdAt: c.createdAt.toISOString(),
      sessions: c.sessions.map((s) => ({
        id: s.id,
        startedAt: s.startedAt.toISOString(),
        endedAt: s.endedAt?.toISOString() ?? null,
        turnCount: s._count.turns,
        hasSummary: !!s.summary,
        summary: (s.summary as Summary | null) ?? null,
      })),
    };
    res.json(detail);
  })
);

// Update accumulating course memory. Vocab/notes are ADDED (merged, deduped),
// not replaced, so concurrent live updates never clobber each other.
coursesRouter.patch(
  "/courses/:id",
  ah(async (req: OwnedRequest, res) => {
    const c = await prisma.course.findFirst({
      where: { id: req.params.id, ownerId: req.ownerId },
    });
    if (!c) return res.status(404).json({ error: "not found" });
    const b = req.body ?? {};
    const vocabulary = mergeUnique(c.vocabulary, b.addVocabulary);
    const pronunciationNotes = mergeUnique(c.pronunciationNotes, b.addNotes);
    await prisma.course.update({
      where: { id: c.id },
      data: {
        userName: b.userName ?? undefined,
        nativeLanguage: b.nativeLanguage ?? undefined,
        level: b.currentLevel ?? b.level ?? undefined,
        vocabulary,
        pronunciationNotes,
      },
    });
    res.json({ ok: true });
  })
);

function mergeUnique(existing: string[], add?: unknown): string[] {
  if (!Array.isArray(add) || add.length === 0) return existing;
  return Array.from(new Set([...existing, ...add.map(String)]));
}

// Start a brand-new conversation under this course.
coursesRouter.post(
  "/courses/:id/sessions",
  ah(async (req: OwnedRequest, res) => {
    const c = await prisma.course.findFirst({
      where: { id: req.params.id, ownerId: req.ownerId },
      select: { id: true },
    });
    if (!c) return res.status(404).json({ error: "not found" });
    const s = await prisma.session.create({ data: { courseId: c.id } });
    res.json({ id: s.id });
  })
);
