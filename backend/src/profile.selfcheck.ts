// Runnable check: a corrected name overwrites, a blank never wipes.
// Run: npx tsx backend/src/profile.selfcheck.ts
import assert from "node:assert";
import { profileFields } from "./profile.js";

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

console.log("profile selfcheck ok");
