import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { env } from "../env.js";
import { coach } from "../coach.js";
import { pcmToWav } from "../wav.js";
import type { PronounceResult } from "@vta/shared";

export const pronounceRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Shape we ask the audio model to return.
const JudgeSchema = z.object({
  accuracy: z.number().min(0).max(100),
  coaching: z.string(),
  words: z
    .array(z.object({ word: z.string(), accuracy: z.number(), errorType: z.string() }))
    .default([]),
});

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
    `Reply as JSON: {"accuracy": 0-100, "coaching": "<one short encouraging sentence, name the ` +
    `specific sound to fix if any, no numbers>", "words": [{"word","accuracy","errorType"}]}.\n` +
    `errorType is one of None|Mispronunciation|Omission|Insertion. Be fair but honest.`;

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: env.pronunciationModel,
        modalities: ["text"],
        response_format: { type: "json_object" },
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

    const data = (await r.json()) as { choices: { message: { content: string } }[] };
    const parsed = JudgeSchema.safeParse(JSON.parse(data.choices[0].message.content));
    if (!parsed.success) {
      return res.status(502).json({ error: "bad_judge_shape", detail: parsed.error.message });
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
