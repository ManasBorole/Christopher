// Runnable check: a corrected name overwrites, a blank never wipes, and the
// session context treats a shared name correctly.
// Run: npx tsx backend/src/profile.selfcheck.ts
import assert from "node:assert";
import { profileFields } from "./profile.js";
import { courseContext } from "./prompts/tutor.js";

// Prisma applies these in order; simulate the stored row across PATCHes.
let row = { userName: "", nativeLanguage: "", level: "A1" };
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
assert.deepEqual(row, { userName: "Tom", nativeLanguage: "English", level: "A2" });

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

console.log("profile selfcheck ok");
