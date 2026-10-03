import { Router } from "express";
import { env } from "../env.js";
import { ah } from "../http.js";
import { owner, type OwnedRequest } from "../owner.js";

// English under each target-language line Christopher says (shown, never spoken).
// One finished line per call; the client skips lines that are already English.
export const translateRouter = Router();

const MAX_CHARS = 400;
const PER_MINUTE = 30; // a 60s conversation has far fewer tutor lines
const CACHE_MAX = 2000;

const cache = new Map<string, string>();
const recent = new Map<string, number[]>(); // ownerId -> request times (ms)

// Sliding one-minute window per owner. ponytail: in-memory, per process;
// move to Redis if the backend ever runs as more than one instance.
export function allow(ownerId: string, now = Date.now()): boolean {
  const times = (recent.get(ownerId) ?? []).filter((t) => now - t < 60_000);
  const ok = times.length < PER_MINUTE;
  if (ok) times.push(now);
  recent.set(ownerId, times);
  return ok;
}

export async function translateLine(text: string, language: string): Promise<string> {
  const key = `${language}\u0000${text}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.openaiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: env.summaryModel,
      temperature: 0,
      max_tokens: 200,
      messages: [
        {
          role: "system",
          content:
            `Translate a line a tutor said in a ${language || "language"} lesson into natural, plain English. ` +
            `Keep any parts that are already English. Reply with the translation only, no quotes or notes.`,
        },
        { role: "user", content: text },
      ],
    }),
  });
  if (!r.ok) throw new Error(`translate ${r.status}`);
  const data = (await r.json()) as { choices: { message: { content: string } }[] };
  const out = (data.choices[0]?.message?.content ?? "").trim();
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!); // drop the oldest
  cache.set(key, out);
  return out;
}

translateRouter.post(
  "/translate",
  owner,
  ah(async (req: OwnedRequest, res) => {
    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    const language = typeof req.body?.language === "string" ? req.body.language.slice(0, 60) : "";
    if (!text || text.length > MAX_CHARS) return res.status(400).json({ error: "bad_text" });
    if (!allow(req.ownerId!)) return res.status(429).json({ error: "slow_down" });
    res.json({ translation: await translateLine(text, language) });
  })
);
