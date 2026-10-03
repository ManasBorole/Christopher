// Runnable check for the stage words and the note the live model gets.
// Run: npx tsx frontend/lib/stage.selfcheck.ts
import assert from "node:assert";
import { STAGE_CHOICES, modelStage, stageLabel, stageNote } from "./stage";

assert.deepEqual(
  STAGE_CHOICES.map((c) => c.stage),
  [1, 2, 3, 4]
);
assert.equal(stageLabel(1, "Spanish"), "Mostly English");
assert.equal(stageLabel(2, "Spanish"), "English and Spanish");
assert.equal(stageLabel(3, "Spanish"), "Mostly Spanish");
assert.equal(stageLabel(4, "Spanish"), "All Spanish");
assert.equal(stageLabel(null, "Spanish"), "Finding your level");
assert.match(stageNote(2, 3), /more English: switch to stage 2/);
assert.match(stageNote(4, 3), /more of the language they are learning: switch to stage 4/);
assert.match(stageNote(3, null), /stage 3/);

assert.equal(modelStage(null, 3, 0), 3); // first judgement stands
assert.equal(modelStage(3, 2, 0), 2); // down at once
assert.equal(modelStage(2, 3, 1), null); // up too soon
assert.equal(modelStage(2, 3, 3), 3);
assert.equal(modelStage(1, 4, 5), 2); // one step at a time

console.log("stage self-check OK");
