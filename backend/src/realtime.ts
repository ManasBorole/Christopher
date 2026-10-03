// The Realtime session config, shared by POST /session and the dev voice test
// (backend/scripts/convo-test.mts) so the test runs exactly what learners get.

export type TranscriptionHint = {
  language: string; // the language being learned, English name ("Japanese")
  nativeLanguage?: string;
  userName?: string;
  vocabulary?: string[];
};

// Steer the learner-side transcription. It is display only (the realtime model
// hears the audio itself), so it must write down what was actually said.
// Not language-pinned on purpose: learners mix the target language with
// English, and a pinned transcriber forces English speech into the target
// language (or a translation of it), so the chat showed things nobody said.
// The prompt names both languages instead, which keeps the script right.
export function transcriptionPrompt(h: TranscriptionHint): string {
  if (!h.language) return "";
  const other = h.nativeLanguage && !/^english$/i.test(h.nativeLanguage) ? `${h.nativeLanguage} or English` : "English";
  let p =
    `A ${h.language} lesson. The speaker is learning ${h.language} and speaks ${h.language}, ${other}, or a mix of both. ` +
    `Write exactly what is said, word for word, in the language it is said in, ${h.language} in its usual script. ` +
    `Never translate. Keep the learner's mistakes as spoken; do not correct them.`;
  if (h.userName) p += ` The speaker's name may be ${h.userName}.`;
  const words = (h.vocabulary ?? []).slice(0, 30);
  if (words.length) p += ` Words they practise: ${words.join(", ")}.`;
  return p;
}

export function realtimeSession(o: { model: string; voice: string; instructions: string; transcription: string }) {
  return {
    type: "realtime" as const,
    model: o.model,
    instructions: o.instructions,
    output_modalities: ["audio"],
    audio: {
      input: {
        // gpt-4o-transcribe (not the -mini): the mini mis-detects the language of
        // short target-language clips (e.g. Japanese transcribed as Chinese).
        transcription: {
          model: "gpt-4o-transcribe",
          ...(o.transcription ? { prompt: o.transcription } : {}),
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
      output: { voice: o.voice },
    },
    tool_choice: "auto",
    tools: [
      {
        type: "function",
        name: "update_profile",
        description:
          "Call this as soon as you learn the learner's name, their native language, or their level changes, every time you move the learner to a different conversation stage, and with goalMet true once they use today's goal on their own. Send only the fields you learned. If the learner corrects their name, call it again with the corrected userName: it replaces the old name.",
        parameters: {
          type: "object",
          properties: {
            userName: { type: "string" },
            nativeLanguage: { type: "string" },
            currentLevel: { type: "string", enum: ["A1", "A2", "B1", "B2", "C1", "C2"] },
            stage: {
              type: "integer",
              enum: [1, 2, 3, 4],
              description: "Conversation stage: 1 New, 2 Building, 3 Conversational, 4 Fluent.",
            },
            goalMet: {
              type: "boolean",
              description: "True once the learner uses today's goal pattern correctly on their own.",
            },
          },
        },
      },
    ],
  };
}
