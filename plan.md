# AI Language Tutor Voice Agent

## Project Overview

Build a real-time AI voice tutor that teaches any spoken language through natural conversation instead of flashcards or quizzes.

The experience should feel like talking to a real language teacher.

Example:

User:
> Hi

Agent:
> Hello! Which language would you like to learn today?

User:
> Spanish

Agent:
> Great! We'll learn Spanish through conversation. I'll first explain in English, then say the sentence in Spanish. Repeat after me and I'll help you with pronunciation.

Conversation continues naturally.

---

# Goal

Create a production-quality portfolio project demonstrating:

- Realtime Voice AI (OpenAI Realtime API over WebRTC)
- LLM orchestration and prompt engineering
- Stateful AI agents
- Real pronunciation assessment (Azure)
- Full-stack TypeScript development
- Modern AI architecture

Polished enough to showcase during **AI engineering** interviews - where the realtime-systems depth (VAD, turn-taking, barge-in, latency budgets) is a direct differentiator.

**Delivery is phased (see Delivery Phases below):**
- **v1 (MVP):** OpenAI Realtime over WebRTC - guarantees a smooth, low-latency working demo.
- **v2 (depth):** swap in a custom **STT → LLM → TTS** pipeline with our own turn-taking, so every hard realtime part is ours to own and explain in interviews.

Both plug into the same **conversation-engine seam** on the frontend, so v2 is a swap, not a rewrite.

---

# User Experience

The application should feel like a real conversation. No buttons for every lesson. No flashcards. No multiple-choice. Just natural speaking.

Flow:

```
User opens website
  ↓ clicks microphone
  ↓ says hello
Agent greets user
  ↓ asks which language to learn
User answers
  ↓
Agent teaches naturally
  ↓ user repeats a phrase
Agent provides pronunciation feedback
  ↓
Conversation continues
```

---

# Core Features

## 1. Language Selection

The agent starts in the language the user speaks, then asks which language they want to learn. Store native language + target language in session state.

## 2. Natural Conversation

Teach through dialogue. Agent says the English meaning, then the target-language phrase, asks the user to repeat, responds to what they say. No lecture-mode.

## 3. Adaptive Teaching

The agent automatically raises difficulty as the learner improves. No manual lesson selection - the AI decides readiness via the system prompt, not hardcoded level gates.

Rough progression (guidance for the prompt, not a state machine):
- Greetings, names, introductions
- Family, work, hobbies
- Daily routine, travel, restaurants, shopping
- Open conversation, opinions, storytelling

## 4. Pronunciation Coaching

**Decision: real scoring via Azure Pronunciation Assessment** (not vibes-based).

After the user repeats a phrase:
- The browser records that user turn separately (out-of-band from the live Realtime stream).
- The audio + expected reference text is sent to the backend `/pronounce` endpoint.
- Backend calls Azure Pronunciation Assessment → gets accuracy / fluency / completeness / per-phoneme scores.
- Scores are turned into natural encouraging coaching, e.g. "The 'll' in 'llamo' sounds like a 'y' - try again", not a raw number.

This is the interview showpiece. Keep feedback encouraging.

## 5. Memory

Remember throughout the session (and persist to Neon so it survives reloads):
- User name, native language, target language, current level
- Vocabulary learned, previous mistakes, conversation history

## 6. Vocabulary Tracking

Maintain a vocabulary list during the session. End-of-session: "You learned 12 new words today."

## 7. Lesson Summary

When the session ends, generate: vocabulary learned, common pronunciation mistakes, grammar tips, suggestions for next lesson.

---

# Technical Stack

**One language end to end: TypeScript.** Frontend, backend, and ORM all TS - shared types, one runtime, no Python bridge.

## Frontend

- **Next.js 15** (App Router), **Tailwind CSS**
- **Zustand** for state (Realtime connection status, transcript, vocab, timer, level)
- **OpenAI Realtime via WebRTC** - the browser connects directly to OpenAI for the live audio conversation. WebRTC handles mic capture, jitter, and playback. (Not MediaRecorder+WebSocket for the live path - WebRTC is lower latency and less code.)
- **MediaRecorder** used only for the *separate* per-turn user recording sent to pronunciation scoring.

## Backend

- **Express + TypeScript.**
- **v1 jobs (thin):**
  1. `POST /session` - mint an **ephemeral Realtime token** so the API key never reaches the browser.
  2. `POST /pronounce` - accept a user-turn audio clip + reference text, call **Azure Pronunciation Assessment** (`microsoft-cognitiveservices-speech-sdk`), return scores.
  3. Session-data CRUD via Prisma.

  In v1 the backend does **not** proxy the live media stream - WebRTC goes browser↔OpenAI directly. Express only issues the token.
- **v2 adds** a WebSocket conversation orchestrator (`/ws/conversation`) that becomes the live audio hub: receives streamed mic audio, runs STT → LLM → TTS, and manages VAD / endpointing / barge-in. This is the depth feature (see Delivery Phases).

## Conversation Engine (the swappable seam)

Frontend talks to a single `ConversationEngine` interface - `connect() / sendAudio() / onAgentAudio() / onTranscript() / interrupt() / disconnect()`. Two implementations:
- **v1 `RealtimeEngine`** - WebRTC direct to OpenAI Realtime.
- **v2 `CustomPipelineEngine`** - WebSocket to Express, which orchestrates STT+LLM+TTS.

This is the *one* justified abstraction: the second implementation is planned, not speculative. Everything above the seam (UI, Zustand, transcript, vocab, pronunciation flow) is identical for both.

## LLM / Voice

- **v1 - OpenAI Realtime API** (latest Realtime model). Combines streaming STT + LLM + TTS + VAD + interruptions in one connection.
- **v2 - custom pipeline:** streaming STT (**Deepgram**) → LLM (**GPT** streaming) → **TTS** (OpenAI TTS or ElevenLabs), with our own VAD/endpointing and barge-in. Owns the whole realtime path; target end-to-end latency < ~800ms.

## Pronunciation

- **Azure Pronunciation Assessment** - purpose-built, returns word- and phoneme-level accuracy. Node SDK.

## Database / ORM

- **Neon** (serverless Postgres) + **Prisma**. Prisma is native in a TS backend. Neon gives real cloud Postgres for the portfolio (and scales to zero on the free tier).

## Deployment

- Frontend → **Vercel**
- Express backend → **Railway** (or Render)
- Database → **Neon**

---

# Architecture

```
                ┌───────────────────────────────────────────┐
                │                Browser                     │
                │  Next.js + Zustand                         │
                └───────────────────────────────────────────┘
                   │ 1. POST /session          │ 3. POST /pronounce
                   │    (get ephemeral token)  │    (user-turn WAV + reference text)
                   ▼                           ▼
                ┌───────────────────────────────────────────┐
                │            Express (TypeScript)            │
                │  /session   → mint ephemeral token         │
                │  /pronounce → Azure Assessment             │
                │  Prisma CRUD → Neon                        │
                └───────────────────────────────────────────┘
                   │                    │            │
        token ─────┘         Azure ─────┘      Neon ─┘ (Postgres)
                                (scores)
                   │
                   │ 2. WebRTC (direct, live audio conversation)
                   ▼
                ┌───────────────────────────────────────────┐
                │          OpenAI Realtime API               │
                └───────────────────────────────────────────┘
```

Two audio paths in v1: **WebRTC live stream** (browser↔OpenAI, conversation) and **batch clip** (browser→Express→Azure, scoring). Keep them separate.

**v2 custom-pipeline path** (live conversation moves onto our backend):

```
Browser ──WS audio──> Express /ws/conversation
                         ├─ Deepgram streaming STT  (interim + final)
                         ├─ VAD / endpointing / barge-in
                         ├─ GPT (streaming)
                         └─ TTS ──> streamed back to browser
Pronunciation scoring (Azure) and Neon persistence are unchanged.
```

Only the `ConversationEngine` implementation swaps. UI and data layer stay put.

---

# Delivery Phases

**Phase 1 - Realtime MVP (ship this first, it's the safety net):**
- Next.js UI, Zustand, WebRTC `RealtimeEngine`, `/session` token endpoint
- Neon + Prisma persistence
- Azure pronunciation scoring via `/pronounce`
- Session summary
- Meets all success criteria → always have a smooth demo.

**Phase 2 - Custom pipeline (the AI-eng depth story):**
- `CustomPipelineEngine` + Express `/ws/conversation`
- Deepgram streaming STT, own VAD/endpointing, barge-in (cancel TTS + LLM on interrupt)
- Streaming GPT + TTS, measured latency budget
- Feature-flag which engine is active; keep Realtime as fallback.

Do not start Phase 2 until Phase 1 is a clean, working demo.

---

# Session State

Held in Zustand on the client, mirrored to Neon for persistence:

```ts
type SessionState = {
  userName: string
  nativeLanguage: string
  targetLanguage: string
  currentLevel: string        // e.g. "A1"
  conversationHistory: Turn[]
  vocabulary: string[]
  grammarTopics: string[]
  pronunciationNotes: string[]
}
```

---

# AI Prompt Design

Dedicated system prompt. The AI behaves like an experienced language teacher.

Rules:
- Be encouraging. Never overwhelm beginners.
- Speak naturally; prefer conversation over explanation.
- Keep responses concise. Introduce one concept at a time.
- Correct mistakes politely. Encourage repetition.
- Adapt difficulty automatically. Remember previous mistakes.
- If the learner struggles repeatedly, switch back to the native language before continuing.

---

# Project Structure

```
language-voice-agent/
├── frontend/                 # Next.js 15
│   ├── app/
│   ├── components/
│   ├── store/                # Zustand
│   ├── lib/
│   │   ├── engine/
│   │   │   ├── ConversationEngine.ts   # interface (the seam)
│   │   │   ├── RealtimeEngine.ts        # v1 - WebRTC → OpenAI
│   │   │   └── CustomPipelineEngine.ts  # v2 - WS → Express
│   │   └── recorder.ts       # per-turn user recording for scoring
│   └── ...
├── backend/                  # Express + TypeScript
│   ├── src/
│   │   ├── routes/
│   │   │   ├── session.ts     # ephemeral token
│   │   │   ├── pronounce.ts   # Azure assessment
│   │   │   └── sessionData.ts # Prisma CRUD
│   │   ├── services/
│   │   └── index.ts
│   └── prisma/
│       └── schema.prisma     # Neon
├── shared/                   # Zod schemas / shared TS types
└── README.md
```

---

# UI

Minimal. Homepage only:
- Large microphone button
- Current target language
- Conversation transcript
- Live speaking indicator
- Vocabulary learned
- Session timer

Nothing more. The focus is the conversation.

---

# Stretch Features (only if time allows)

CEFR progression (A1→C2), multiple tutor personalities, speech-speed adjustment, roleplay scenarios (restaurant, airport, hotel), streaks, daily goals, voice selection, session history, export summary as PDF.

---

# Coding Guidelines

- Modular, readable, business logic separate from routes.
- Async throughout. Handle failures gracefully (audio drops, token expiry, Azure/OpenAI errors).
- Don't over-abstract: no interface with one implementation, no layer that isn't earning its keep. The whole backend is three endpoints - keep it that size.
- Share types via `shared/` instead of duplicating request/response shapes.

---

# Success Criteria

The MVP is complete when:

- ✅ User opens the website and speaks naturally
- ✅ AI responds with voice (low latency, natural interruptions)
- ✅ User selects a language by speaking
- ✅ AI teaches through conversation
- ✅ User repeats phrases → AI gives **real** pronunciation feedback (Azure)
- ✅ AI remembers the conversation (persisted to Neon)
- ✅ AI adapts lesson difficulty
- ✅ Session summary is generated

It should feel like talking to a real tutor, not completing lessons in an app.

---

# Important Development Principle

Prioritize **conversation quality** over feature quantity. A smooth, low-latency, natural interaction beats many mediocre features. When deciding, prefer the option that reduces latency, simplifies the architecture, and improves the conversational experience.
