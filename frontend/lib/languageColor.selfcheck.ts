// Runnable check for the language colours on the progress sky.
// Run: npx tsx frontend/lib/languageColor.selfcheck.ts
import assert from "node:assert";
import { languageColor, languageCss } from "./languageColor";

// the tuned four come back exactly
assert.deepEqual(languageColor(0), [1, 0.78, 0.46]);
assert.equal(languageCss(0), "rgb(255 199 117)");
assert.equal(languageCss(3), "rgb(173 135 255)");

// every colour is a valid sRGB triple, the same every time, and neighbours differ
for (let i = 0; i < 40; i++) {
  const c = languageColor(i);
  assert.ok(c.every((v) => v >= 0 && v <= 1), `colour ${i} out of range`);
  assert.deepEqual(languageColor(i), c);
  if (i > 0) {
    const p = languageColor(i - 1);
    assert.ok(Math.hypot(c[0] - p[0], c[1] - p[1], c[2] - p[2]) > 0.15, `colours ${i - 1} and ${i} look alike`);
  }
}

// the first generated colours stay clear of gold and teal
const far = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
assert.ok(far(languageColor(4), languageColor(0)) > 0.3);
assert.ok(far(languageColor(5), languageColor(1)) > 0.3);

console.log("languageColor self-check OK");
