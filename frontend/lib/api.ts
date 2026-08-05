import type { PronounceResult, Summary, CourseCard, CourseDetail, StoredTurn } from "@vta/shared";
import { ownerHeaders } from "./auth";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8787";

async function jsonHeaders() {
  return { "Content-Type": "application/json", ...(await ownerHeaders()) };
}

// ---- Pronunciation (stateless) ----
export async function scorePronunciation(
  pcm: Blob,
  reference: string,
  language: string
): Promise<PronounceResult> {
  const fd = new FormData();
  fd.append("audio", pcm, "turn.pcm");
  fd.append("reference", reference);
  fd.append("language", language);
  const r = await fetch(`${BACKEND}/pronounce`, { method: "POST", headers: await ownerHeaders(), body: fd });
  if (!r.ok) throw new Error(`/pronounce ${r.status}`);
  return r.json();
}

// ---- Courses ----
export async function listCourses(): Promise<CourseCard[]> {
  const r = await fetch(`${BACKEND}/courses`, { headers: await ownerHeaders() });
  if (!r.ok) return [];
  return r.json();
}

export async function createCourse(language: string): Promise<{ id: string; language: string }> {
  const r = await fetch(`${BACKEND}/courses`, {
    method: "POST",
    headers: await jsonHeaders(),
    body: JSON.stringify({ language }),
  });
  if (!r.ok) throw new Error(`/courses ${r.status}`);
  return r.json();
}

export async function deleteCourse(id: string): Promise<boolean> {
  const r = await fetch(`${BACKEND}/courses/${id}`, { method: "DELETE", headers: await ownerHeaders() });
  return r.ok;
}

export async function getCourse(id: string): Promise<CourseDetail | null> {
  const r = await fetch(`${BACKEND}/courses/${id}`, { headers: await ownerHeaders() });
  if (!r.ok) return null;
  return r.json();
}

export async function patchCourse(id: string, data: Record<string, unknown>) {
  await fetch(`${BACKEND}/courses/${id}`, {
    method: "PATCH",
    headers: await jsonHeaders(),
    body: JSON.stringify(data),
  });
}

export async function startSession(courseId: string): Promise<string> {
  const r = await fetch(`${BACKEND}/courses/${courseId}/sessions`, {
    method: "POST",
    headers: await jsonHeaders(),
  });
  const { id } = await r.json();
  return id;
}

// ---- Sessions (one conversation) ----
export async function getSession(
  id: string
): Promise<{ id: string; language: string; turns: StoredTurn[]; summary: Summary | null } | null> {
  const r = await fetch(`${BACKEND}/sessions/${id}`, { headers: await ownerHeaders() });
  if (!r.ok) return null;
  return r.json();
}

export async function addTurn(id: string, role: "user" | "agent", text: string, at: number) {
  await fetch(`${BACKEND}/sessions/${id}/turns`, {
    method: "POST",
    headers: await jsonHeaders(),
    body: JSON.stringify({ role, text, at }),
  });
}

export async function endSession(id: string): Promise<Summary> {
  const r = await fetch(`${BACKEND}/sessions/${id}/end`, { method: "POST", headers: await ownerHeaders() });
  if (!r.ok) throw new Error(`/end ${r.status}`);
  return r.json();
}

// ---- Free-trial usage + feedback ----
export type Usage = {
  sessionsUsed: number;
  secondsUsed: number;
  sessionsLimit: number;
  secondsPerSession: number;
  blocked: boolean;
};

export async function getUsage(): Promise<Usage> {
  const r = await fetch(`${BACKEND}/usage`, { headers: await ownerHeaders() });
  if (!r.ok) return { sessionsUsed: 0, secondsUsed: 0, sessionsLimit: 1, secondsPerSession: 60, blocked: false };
  return r.json();
}

// Consume one free session (called once the conversation goes live).
export async function consumeUsage() {
  await fetch(`${BACKEND}/usage/consume`, { method: "POST", headers: await ownerHeaders() }).catch(() => {});
}

export async function reportSpent(seconds: number) {
  await fetch(`${BACKEND}/usage/spent`, {
    method: "POST",
    headers: await jsonHeaders(),
    body: JSON.stringify({ seconds }),
  }).catch(() => {});
}

export async function submitFeedback(email: string, message: string) {
  const r = await fetch(`${BACKEND}/feedback`, {
    method: "POST",
    headers: await jsonHeaders(),
    body: JSON.stringify({ email, message }),
  });
  if (!r.ok) throw new Error(`/feedback ${r.status}`);
}
