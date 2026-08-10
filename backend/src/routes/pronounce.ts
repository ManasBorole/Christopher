import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { env } from "../env.js";
import { coach } from "../coach.js";
import { pcmToWav } from "../wav.js";
import type { PronounceResult } from "@vta/shared";

export const pronounceRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Shape we ask the audio model to return. Lenient: the audio models return a
// looser shape than a json-mode text model (e.g. words as bare strings), so
// coerce accuracy and drop malformed `words` to [] rather than 502 the whole call.
const JudgeSchema = z.object({
  accuracy: z.coerce.number().min(0).max(100),
  coaching: z.string().default(""),
  words: z
    .array(z.object({ word: z.string(), accuracy: z.number(), errorType: z.string() }))
    .catch([])
    .default([]),
});

// The audio models can wrap JSON in ```fences``` or add stray prose. Pull out the
// first {...} block so JSON.parse doesn't choke on the wrapper.
function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  return start >= 0 && end > start ? body.slice(start, end + 1) : body;
}

// Body: multipart form { audio: raw 16kHz/16-bit/mono PCM, reference: string, language: string }
// The learner's clip is wrapped as WAV and sent to an OpenAI audio model, which
// LISTENS and judges pronunciation against the reference phrase. (A transcript
// diff would falsely pass mispronunciations - Whisper auto-corrects them.)
pronounceRouter.post("/pronounce", upload.single("audio"), async (req, res) => {
  const reference = String(req.body.reference || "");
  const language = String(req.body.language || "the target language");
  const pcm = req.file?.buffer;
  if (!pcm || !reference) {
    return res.status(400).json({ error: "need audio file + reference text" });
  }

  const wavB64 = pcmToWav(pcm).toString("base64");
  const instruction =
    `The learner is practicing ${language}. They were asked to say: "${reference}".\n` +
    `Listen to the audio and judge their pronunciation of that exact phrase.\n` +
    `Reply with ONLY a JSON object (no markdown, no prose): {"accuracy": 0-100, "coaching": ` +
    `"<one short encouraging sentence, name the specific sound to fix if any, no numbers>", ` +
    `"words": [{"word","accuracy","errorType"}]}.\n` +
    `errorType is one of None|Mispronunciation|Omission|Insertion. Be fair but honest.\n` +
    `If the audio is silent, too noisy, or you cannot make out the phrase, still reply with ` +
    `JSON: {"accuracy": 0, "coaching": "I couldn't catch that clearly - could you try once more?", "words": []}.`;

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        // Audio models don't accept response_format:json_object; we ask for JSON in
        // the prompt and extract it below.
        model: env.pronunciationModel,
        modalities: ["text"],
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: instruction },
              { type: "input_audio", input_audio: { data: wavB64, format: "wav" } },
            ],
          },
        ],
      }),
    });
    if (!r.ok) return res.status(502).json({ error: "openai_audio_failed", detail: await r.text() });

    const data = (await r.json()) as { choices: { message: { content?: string } }[] };
    const parsed = JudgeSchema.safeParse(safeJsonParse(extractJson(data.choices[0]?.message?.content ?? "")));

    // If the model couldn't produce a usable judgment (e.g. it heard nothing and
    // answered in prose), treat it as "couldn't catch that" - a recognition miss,
    // NOT a wrong answer - so the tutor asks for a retry instead of erroring.
    if (!parsed.success) {
      return res.json({
        accuracy: 0,
        fluency: 0,
        completeness: 0,
        pronunciation: 0,
        words: [],
        coaching: "I couldn't catch that clearly - could you try saying it once more?",
      } satisfies PronounceResult);
    }
    const j = parsed.data;

    const out: PronounceResult = {
      accuracy: j.accuracy,
      fluency: j.accuracy, // single-model judgment -> mirror overall
      completeness: j.accuracy,
      pronunciation: j.accuracy,
      words: j.words,
      // prefer the model's coaching; fall back to our threshold text if empty
      coaching: j.coaching?.trim() || coach(j.accuracy, j.words),
    };
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: "pronounce_error", detail: String(e) });
  }
});

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
