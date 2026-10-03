// Runnable check for how the progress sky turns conversations into stars.
// Run: npx tsx frontend/components/sky/days.selfcheck.ts
import assert from "node:assert";
import type { SkyCourse } from "@vta/shared";
import { buildSky, dayNumber, monthName } from "./days";

const at = (y: number, m: number, d: number, h: number) => new Date(y, m - 1, d, h).toISOString();
const now = new Date(2026, 9, 3, 18); // Saturday 3 October 2026, 6 pm local

const courses: SkyCourse[] = [
  {
    id: "a", language: "Spanish", createdAt: at(2026, 8, 1, 9),
    sessions: [
      { at: at(2026, 9, 30, 9), minutes: 5, words: ["hola", "gracias"] },
      { at: at(2026, 9, 30, 21), minutes: 7, words: ["Hola", "la cuenta"] }, // same local day: one star
      { at: at(2026, 10, 1, 20), minutes: 3, words: [] },
      { at: at(2026, 10, 2, 23), minutes: 0, words: ["adiós"] }, // late evening stays on the 2nd
    ],
  },
  { id: "b", language: "Japanese", createdAt: at(2026, 8, 20, 9), sessions: [{ at: at(2026, 9, 12, 8), minutes: 9, words: ["おにぎり"] }] },
];

const sky = buildSky(courses, now);
assert.equal(sky.langs[0].code, "es");
assert.equal(sky.langs[1].code, "ja");
assert.equal(sky.spoken, 4); // three Spanish days, one Japanese
const sep30 = sky.days.find((d) => d.lang === 0 && d.key === dayNumber(new Date(2026, 8, 30)))!;
assert.equal(sep30.minutes, 12);
assert.deepEqual(sep30.words, ["hola", "gracias", "la cuenta"]); // a word repeated in another case shows once
assert.equal(sep30.chats.length, 2);
assert.equal(sky.days.find((d) => d.key === dayNumber(new Date(2026, 9, 2)))!.minutes, 1); // never zero minutes
assert.equal(sky.words, 5); // hola and Hola count once
assert.equal(sky.focus, 0); // Spanish was spoken last
assert.equal(sky.streak, 3); // 30 Sep, 1 and 2 Oct; today not spoken yet
assert.ok(sky.tonight?.pending); // so tonight's star waits
assert.equal(sky.tonight?.lang, 0);

// speaking today lights tonight's star instead
const spokeToday = buildSky([{ ...courses[0], sessions: [...courses[0].sessions, { at: at(2026, 10, 3, 9), minutes: 4, words: [] }] }], now);
assert.equal(spokeToday.tonight?.pending, undefined);
assert.equal(spokeToday.streak, 4);

// nothing spoken yet: an empty sky, no waiting star
const empty = buildSky([{ id: "c", language: "French", createdAt: at(2026, 10, 1, 9), sessions: [] }], now);
assert.equal(empty.days.length, 0);
assert.equal(empty.tonight, null);
assert.equal(empty.streak, 0);

assert.equal(monthName("es", 2026 * 12 + 8), "Septiembre");
assert.equal(monthName("ja", 2026 * 12 + 8), "9月");

console.log("sky days self-check OK");
