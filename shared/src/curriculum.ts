// The course path: can-do goals in the order a real class teaches them, from
// the CEFR "can do" descriptors (A1 to B2). Each lesson works toward one goal;
// the tutor marks it met when the learner uses it on their own, and two met
// conversations move the course to the next goal. Language-neutral on purpose:
// the tutor brings the words for whatever language is being learned.

export type Goal = { level: "A1" | "A2" | "B1" | "B2"; title: string; patterns: string };

export const CURRICULUM: readonly Goal[] = [
  { level: "A1", title: "Greet and introduce yourself", patterns: "hello, my name is, how are you, nice to meet you" },
  { level: "A1", title: "Say where you are from and what you do", patterns: "I am from, I live in, I work as, I study" },
  { level: "A1", title: "Talk about your family", patterns: "I have, he is, she is, my brother, my mother" },
  { level: "A1", title: "Order food and drinks", patterns: "I would like, please, how much is it, the bill please" },
  { level: "A1", title: "Numbers, prices and the time", patterns: "what time is it, it is three o'clock, it costs" },
  { level: "A1", title: "Describe your daily routine", patterns: "I get up at, then I, in the evening I (present tense)" },
  { level: "A2", title: "Say what you like and why", patterns: "I like, I don't like, I prefer, because" },
  { level: "A2", title: "Ask for and give directions", patterns: "where is, turn left, straight on, is it far" },
  { level: "A2", title: "Go shopping", patterns: "do you have, in another size, can I try it on, I'll take it" },
  { level: "A2", title: "Talk about yesterday", patterns: "yesterday I went, I ate, I saw (past tense)" },
  { level: "A2", title: "Make plans with a friend", patterns: "are you free on, shall we, I am going to, let's meet at" },
  { level: "A2", title: "Describe a place you have visited", patterns: "I have been to, it was, there were, the best part was" },
  { level: "B1", title: "Tell a short story", patterns: "first, then, suddenly, in the end (past tenses together)" },
  { level: "B1", title: "Give your opinion with reasons", patterns: "I think, in my opinion, on the other hand, because" },
  { level: "B1", title: "Sort out a travel problem", patterns: "polite requests and complaints: could you, there is a problem with" },
  { level: "B1", title: "Talk about plans and hopes", patterns: "I hope to, if I could, I would like to (future and conditional)" },
  { level: "B2", title: "Discuss a topic you care about", patterns: "explain, compare, give examples, ask the other side" },
  { level: "B2", title: "Argue a point and answer back", patterns: "I see your point, but; that depends on; to be fair" },
  { level: "B2", title: "Talk freely about anything", patterns: "open conversation at a natural pace" },
];

// Where a new course starts on the path, from the learner's stage (1-4).
// Someone who can already chat skips the A1 basics.
export function startGoal(stage: number | null | undefined): number {
  if (stage === 2) return 1;
  if (stage === 3) return CURRICULUM.findIndex((g) => g.level === "A2");
  if (stage === 4) return CURRICULUM.findIndex((g) => g.level === "B1");
  return 0;
}

// The goal at an index, clamped so the last one ("talk freely") repeats.
export function goalAt(i: number | null | undefined): Goal {
  return CURRICULUM[Math.min(Math.max(i ?? 0, 0), CURRICULUM.length - 1)];
}

// Conversations with the goal met that move a course on to the next goal.
export const MET_TO_ADVANCE = 2;
