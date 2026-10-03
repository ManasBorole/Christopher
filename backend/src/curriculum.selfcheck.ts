// Self-check for the course path: where a course starts and that today's goal
// reaches the tutor. Run: npx tsx src/curriculum.selfcheck.ts
import assert from "node:assert/strict";
import { CURRICULUM, goalAt, startGoal } from "@vta/shared";
import { courseContext } from "./prompts/tutor.js";

assert.equal(startGoal(null), 0);
assert.equal(startGoal(1), 0);
assert.equal(CURRICULUM[startGoal(3)].level, "A2");
assert.equal(CURRICULUM[startGoal(4)].level, "B1");
assert.equal(goalAt(999).title, CURRICULUM[CURRICULUM.length - 1].title); // the last goal repeats

const ctx = courseContext(
  { language: "Spanish", userName: "Tom", nativeLanguage: "", level: "A1", vocabulary: [], pronunciationNotes: [], stage: 2, goal: 3 },
  true,
  ["said 'yo es' for 'yo soy'"]
);
assert.ok(ctx.includes(`"${CURRICULUM[3].title}"`));
assert.ok(ctx.includes("in Spanish"));
assert.ok(ctx.includes("yo es"));

console.log("curriculum self-check OK");
