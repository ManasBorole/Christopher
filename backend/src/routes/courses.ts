import { Router } from "express";
import { prisma } from "../db.js";
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

// term -> English meaning, harvested from the session summaries (the only place a
// translation is recorded). First non-empty translation for a term wins.
function wordMeanings(sessions: { summary: unknown }[]): Record<string, string> {
  const m: Record<string, string> = {};
  for (const s of sessions) {
    const sum = s.summary as Summary | null;
    for (const v of sum?.vocabulary ?? []) {
      const term = v.term?.trim();
      const translation = v.translation?.trim();
      if (term && translation && !m[term]) m[term] = translation;
    }
  }
  return m;
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
      meanings: wordMeanings(c.sessions),
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
