// Runnable check: a corrected name overwrites, a blank never wipes, and the
// session context treats a shared name correctly.
// Run: npx tsx backend/src/profile.selfcheck.ts
import assert from "node:assert";
import { profileFields } from "./profile.js";
import { courseContext } from "./prompts/tutor.js";

// Prisma applies these in order; simulate the stored row across PATCHes.
let row: Record<string, unknown> = { userName: "", nativeLanguage: "", level: "A1", stage: null };
const patch = (b: Record<string, unknown>) => {
  for (const [k, v] of Object.entries(profileFields(b))) if (v !== undefined) row = { ...row, [k]: v };
};

patch({ userName: "Jerry" });
assert.equal(row.userName, "Jerry", "first name is stored");
patch({ userName: " Tom " });
assert.equal(row.userName, "Tom", "a correction overwrites the existing name");
patch({ userName: "" });
patch({ addVocabulary: ["hola"] });
assert.equal(row.userName, "Tom", "blank or missing name leaves it alone");
patch({ currentLevel: "A2", nativeLanguage: "English" });
assert.deepEqual(row, { userName: "Tom", nativeLanguage: "English", level: "A2", stage: null });

// Stage: the tutor's moves and the learner's nudges are saved; junk is ignored.
patch({ stage: 3 });
assert.equal(row.stage, 3, "a stage move is saved");
patch({ stage: 9 });
patch({ stage: "2.5" });
patch({ userName: "Tom" });
assert.equal(row.stage, 3, "out-of-range, fractional or missing stage leaves it alone");
patch({ stage: "1" });
assert.equal(row.stage, 1, "a stage sent as text still counts");

// Session context: a name shared from another course is used, but only real
// history makes the learner "returning".
const course = { language: "Korean", userName: "Tom", nativeLanguage: "", level: "A1", vocabulary: [], pronunciationNotes: [] };
const fresh = courseContext(course, false);
assert.match(fresh, /first session in Korean/, "name alone is not returning");
assert.match(fresh, /name is Tom/, "shared name is used");
assert.match(fresh, /do not ask their name/, "does not ask a known name");
assert.match(courseContext({ ...course, userName: "" }, false), /Christopher, ask their name/, "unknown name is asked");
const back = courseContext(course, true);
assert.match(back, /continuing an ongoing course/, "history makes it returning");
assert.match(back, /by name \(Tom\)/, "returning greeting uses the name");

// The saved stage reaches the session instructions.
assert.match(courseContext({ ...course, stage: 3 }, true), /Last time they were at stage 3 \(Conversational\): start in Korean/);
assert.match(courseContext({ ...course, stage: 1 }, false), /stage 1 \(New\)\. Start mostly in English/);
assert.match(courseContext(course, false), /stage is not known yet/, "no stage: judge it from their first words");

console.log("profile selfcheck ok");
