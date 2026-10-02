import type { PronounceResult, Summary, CourseCard, CourseDetail, StoredTurn } from "@vta/shared";
import { ownerHeaders, ownerKey } from "./auth";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8787";

// ---- Network ----
// The API host sleeps when idle and its first answer after a nap can take ~45 s.
// Every call gets a timeout, reads retry until the server is up, and while any
// call has taken over 3 s the UI shows a calm "waking up" note (WakingNotice).
const SLOW_MS = 3000;
const GIVE_UP_MS = 90_000;
let slowCalls = 0;
const slowListeners = new Set<() => void>();
function setSlow(d: number) {
  slowCalls += d;
  slowListeners.forEach((f) => f());
}
export function subscribeWaking(f: () => void) {
  slowListeners.add(f);
  return () => void slowListeners.delete(f);
}
export const isWaking = () => slowCalls > 0;

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// fetch with a timeout and retries. Reads (GET) retry on any failure; writes only
// retry when the host's gateway answered 502/503/504, which means our server
// never saw the request, so nothing is ever created twice. `slowIsNormal` is for
// calls that are meant to take a while (a summary), so they never show the note.
async function call(path: string, init: RequestInit & { json?: unknown; slowIsNormal?: boolean } = {}): Promise<Response> {
  const { json, slowIsNormal, ...rest } = init;
  const read = !rest.method || rest.method === "GET";
  const started = Date.now();
  let flagged = false;
  const slow = setTimeout(() => {
    if (slowIsNormal) return;
    flagged = true;
    setSlow(1);
  }, SLOW_MS);
  try {
    for (let attempt = 0; ; attempt++) {
      const late = () => Date.now() - started > GIVE_UP_MS;
      try {
        const r = await fetch(`${BACKEND}${path}`, {
          ...rest,
          headers: {
            ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
            ...(await ownerHeaders()),
            ...(rest.headers as Record<string, string> | undefined),
          },
          body: json !== undefined ? JSON.stringify(json) : rest.body,
          // A read is cheap to repeat, so give up on one attempt sooner.
          signal: AbortSignal.timeout(read ? 20_000 : 60_000),
        });
        if (![502, 503, 504].includes(r.status) || late()) return r;
      } catch (e) {
        if (!read || late()) throw e;
      }
      await delay(Math.min(1000 * 2 ** attempt, 5000));
    }
  } finally {
    clearTimeout(slow);
    if (flagged) setSlow(-1);
  }
}

// ---- Local cache (stale-while-revalidate) ----
// The last good answer per screen, kept in this browser so a revisit or a reload
// paints at once while a fresh copy loads. Stored with the account it belongs to,
// so a different account on the same browser never sees it.
function readCache<T>(key: string): T | null {
  try {
    const v = JSON.parse(localStorage.getItem(`vta_cache:${key}`) ?? "null");
    return v && v.owner === ownerKey() ? (v.data as T) : null;
  } catch {
    return null;
  }
}
function writeCache(key: string, data: unknown, owner = ownerKey()) {
  try {
    localStorage.setItem(`vta_cache:${key}`, JSON.stringify({ owner, data }));
  } catch {
    /* storage full or blocked: the cache is only a speed-up */
  }
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
  const r = await call("/pronounce", { method: "POST", body: fd, slowIsNormal: true });
  if (!r.ok) throw new Error(`/pronounce ${r.status}`);
  return r.json();
}

// ---- Courses ----
// Last loaded language cards for this account, or null if none yet. Synchronous,
// so the home screen renders them on the first frame.
export function cachedCourses(): CourseCard[] | null {
  return readCache<CourseCard[]>("courses");
}

let coursesInflight: Promise<CourseCard[]> | null = null;

// Fresh cards. On failure, falls back to the cached ones; throws only when there
// is nothing to show, so the home can offer a retry instead of a false empty state.
export function listCourses(): Promise<CourseCard[]> {
  coursesInflight ??= (async () => {
    const owner = ownerKey();
    try {
      const r = await call("/courses");
      if (!r.ok) throw new Error(`/courses ${r.status}`);
      const data = (await r.json()) as CourseCard[];
      writeCache("courses", data, owner);
      return data;
    } catch (e) {
      const stale = cachedCourses();
      if (stale) return stale;
      throw e;
    } finally {
      coursesInflight = null;
    }
  })();
  return coursesInflight;
}

// `stage` = the answer to "How much {Language} do you know?" (1-4), if asked.
export async function createCourse(
  language: string,
  stage?: number
): Promise<{ id: string; language: string; stage: number | null }> {
  const r = await call("/courses", { method: "POST", json: { language, stage } });
  if (!r.ok) throw new Error(`/courses ${r.status}`);
  return r.json();
}

export async function deleteCourse(id: string): Promise<boolean> {
  const r = await call(`/courses/${id}`, { method: "DELETE" }).catch(() => null);
  if (!r?.ok) return false;
  const cards = cachedCourses();
  if (cards) writeCache("courses", cards.filter((c) => c.id !== id));
  try {
    localStorage.removeItem(`vta_cache:course:${id}`);
  } catch {}
  return true;
}

export function cachedCourse(id: string): CourseDetail | null {
  return readCache<CourseDetail>(`course:${id}`);
}

const courseInflight = new Map<string, Promise<CourseDetail | null>>();

// Fresh course page. De-duped, so a hover prefetch and the page share one request.
export function getCourse(id: string): Promise<CourseDetail | null> {
  let p = courseInflight.get(id);
  if (!p) {
    const owner = ownerKey();
    p = (async () => {
      try {
        const r = await call(`/courses/${id}`);
        if (!r.ok) return null;
        const data = (await r.json()) as CourseDetail;
        writeCache(`course:${id}`, data, owner);
        return data;
      } finally {
        courseInflight.delete(id);
      }
    })();
    courseInflight.set(id, p);
  }
  return p;
}

export async function patchCourse(id: string, data: Record<string, unknown>) {
  await call(`/courses/${id}`, { method: "PATCH", json: data });
}

export async function startSession(courseId: string): Promise<string> {
  const r = await call(`/courses/${courseId}/sessions`, { method: "POST" });
  if (!r.ok) throw new Error(`/sessions ${r.status}`);
  const { id } = await r.json();
  return id;
}

// ---- Sessions (one conversation) ----
export async function getSession(
  id: string
): Promise<{ id: string; language: string; turns: StoredTurn[]; summary: Summary | null } | null> {
  const r = await call(`/sessions/${id}`);
  if (!r.ok) return null;
  return r.json();
}

export async function addTurn(id: string, role: "user" | "agent", text: string, at: number) {
  await call(`/sessions/${id}/turns`, { method: "POST", json: { role, text, at } });
}

// English for one finished line Christopher said in the target language.
// Cached per text, so a repeated line costs nothing; "" when unavailable.
const translations = new Map<string, Promise<string>>();
export function translateLine(text: string, language: string): Promise<string> {
  const key = `${language}\u0000${text}`;
  let p = translations.get(key);
  if (!p) {
    p = (async () => {
      // Background work: never raise the "waking up" note for it.
      const r = await call("/translate", { method: "POST", json: { text, language }, slowIsNormal: true });
      if (!r.ok) throw new Error(`/translate ${r.status}`);
      return ((await r.json()) as { translation: string }).translation ?? "";
    })().catch(() => {
      translations.delete(key); // a failure may be retried later
      return "";
    });
    translations.set(key, p);
  }
  return p;
}

export async function endSession(id: string): Promise<Summary> {
  const r = await call(`/sessions/${id}/end`, { method: "POST", slowIsNormal: true });
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

const DEFAULT_USAGE: Usage = { sessionsUsed: 0, secondsUsed: 0, sessionsLimit: 1, secondsPerSession: 60, blocked: false };

export async function getUsage(): Promise<Usage> {
  const r = await call("/usage").catch(() => null);
  return r?.ok ? r.json() : DEFAULT_USAGE;
}

// Consume one free session (called the first time Christopher hears the learner).
export async function consumeUsage() {
  await call("/usage/consume", { method: "POST" }).catch(() => {});
}

export async function reportSpent(seconds: number) {
  await call("/usage/spent", { method: "POST", json: { seconds } }).catch(() => {});
}

export async function submitFeedback(email: string, message: string) {
  const r = await call("/feedback", { method: "POST", json: { email, message } });
  if (!r.ok) throw new Error(`/feedback ${r.status}`);
}
