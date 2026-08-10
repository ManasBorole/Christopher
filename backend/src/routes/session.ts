import { Router } from "express";
import { env } from "../env.js";
import { prisma } from "../db.js";
import { owner, type OwnedRequest } from "../owner.js";
import { isBlocked } from "../gate.js";
import { TUTOR_SYSTEM_PROMPT } from "../prompts/tutor.js";

export const sessionRouter = Router();

// language name -> ISO-639-1 code, so transcription is locked to the language
// being learned (prevents Whisper-style hallucinations in random languages).
const LANG_CODE: Record<string, string> = {
  spanish: "es", french: "fr", german: "de", italian: "it", portuguese: "pt",
  english: "en", japanese: "ja", hindi: "hi", mandarin: "zh", chinese: "zh",
  korean: "ko", arabic: "ar", russian: "ru", dutch: "nl", turkish: "tr",
  mongolian: "mn", polish: "pl", swedish: "sv", greek: "el", hebrew: "he",
};

sessionRouter.post("/session", owner, async (req: OwnedRequest, res) => {
  try {
    // Free-trial gate: block if out of sessions. Consumption happens once the
    // call goes live (POST /usage/consume) so failed connects don't burn it.
    if (await isBlocked(req.ownerId!)) return res.status(402).json({ error: "limit_reached" });

    const sessionId: string | undefined = req.body?.sessionId;
    const ctx = await loadCourse(sessionId, req.ownerId);
    const instructions = TUTOR_SYSTEM_PROMPT + ctx.suffix;
    const langCode = ctx.language ? LANG_CODE[ctx.language.toLowerCase()] : undefined;

    const r = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        session: {
          type: "realtime",
          model: env.realtimeModel,
          instructions,
          output_modalities: ["audio"],
          audio: {
            input: {
              // gpt-4o-transcribe (not the -mini): the mini model mis-detects the
              // language of short target-language clips (e.g. Japanese transcribed
              // as Chinese), which feeds the tutor garbage and makes it re-ask /
              // re-greet. The full model is far more accurate. Lock to the learned
              // language when known so it can't drift to a neighbouring script.
              transcription: {
                model: "gpt-4o-transcribe",
                ...(langCode ? { language: langCode } : {}),
              },
              // Server VAD drives turn-taking: it detects when the learner stops and
              // AUTO-replies (create_response:true). Letting the server own the turn
              // is what makes the conversation feel natural - the old client-driven
              // model (create_response:false) spawned a fresh reply per mis-heard blip,
              // which is why the tutor re-greeted and looped. interrupt_response keeps
              // barge-in. threshold 0.6 ignores ambient noise; silence 550ms lets a
              // learner finish; prefix_padding keeps word onsets so short words survive.
              turn_detection: {
                type: "server_vad",
                threshold: 0.6,
                prefix_padding_ms: 300,
                silence_duration_ms: 550,
                create_response: true,
                interrupt_response: true,
              },
            },
            output: { voice: env.realtimeVoice },
          },
          tool_choice: "auto",
          tools: [
            {
              type: "function",
              name: "update_profile",
              description:
                "Call this as soon as you learn the learner's name, their native language, or their level changes. Send only the fields you learned.",
              parameters: {
                type: "object",
                properties: {
                  userName: { type: "string" },
                  nativeLanguage: { type: "string" },
                  currentLevel: { type: "string", enum: ["A1", "A2", "B1", "B2", "C1", "C2"] },
                },
              },
            },
          ],
        },
      }),
    });

    if (!r.ok) {
      const detail = await r.text();
      return res.status(502).json({ error: "openai_session_failed", detail });
    }
    const data = (await r.json()) as { value: string; expires_at: number };
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
): Promise<{ suffix: string; language: string }> {
  if (!sessionId) return { suffix: "", language: "" };
  const s = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { course: true },
  });
  if (!s || s.course.ownerId !== ownerId) return { suffix: "", language: "" };
  const c = s.course;

  const returning = !!c.userName || c.vocabulary.length > 0;
  let suffix = `\n\nThe learner is studying ${c.language}. Teach ${c.language}; do not switch to a different language or ask which language to learn.`;
  if (returning) {
    suffix +=
      `\nThis is a NEW session continuing an ongoing course. In your VERY FIRST message only,` +
      ` greet warmly` +
      (c.userName ? ` by name (${c.userName})` : "") +
      ` and pick up where you left off. Do not recap the whole history.` +
      `\nCRITICAL: greet exactly once, in that first message. You have the whole conversation in` +
      ` context - after the first message never greet, re-introduce yourself, or restart the` +
      ` lesson. Just continue the dialogue like a human teacher mid-conversation.` +
      `\n- Native language: ${c.nativeLanguage || "unknown"}` +
      `\n- Level: ${c.level}` +
      `\n- Words already practiced: ${c.vocabulary.slice(0, 40).join(", ") || "none yet"}` +
      `\n- Past pronunciation notes: ${c.pronunciationNotes.slice(0, 10).join("; ") || "none"}`;
  } else {
    suffix += `\nThis is the learner's first session in ${c.language}. Greet them, ask their name, and start from the basics.`;
  }
  return { suffix, language: c.language };
}
