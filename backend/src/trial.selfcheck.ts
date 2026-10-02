// Runnable check for the free-trial rules.
// Run: npx tsx backend/src/trial.selfcheck.ts
import assert from "node:assert";
import { connectRule, afterConnect, afterHeard, type Counts } from "./trial.js";

const l = { sessions: 1, unheardConnects: 4 };
const fresh: Counts = { sessionsUsed: 0, unheardConnects: 0 };

// A connect that failed before a token was handed out is never recorded: nothing changes.
assert.equal(connectRule(fresh, l), "free");

// Heard on the first connection: the trial is used once, and nothing counts as unheard.
let c = afterHeard(afterConnect(fresh, "free"), l);
assert.deepEqual(c, { sessionsUsed: 1, unheardConnects: 0 });
assert.equal(connectRule(c, l), "refuse", "trial used: the next connection is refused");

// Four silent connections are free, the fifth pays with the trial, the sixth is refused.
c = fresh;
for (let i = 0; i < 4; i++) {
  assert.equal(connectRule(c, l), "free", `silent connection ${i + 1} is free`);
  c = afterConnect(c, "free");
}
assert.equal(connectRule(c, l), "pay");
c = afterConnect(c, "pay");
assert.deepEqual(c, { sessionsUsed: 1, unheardConnects: 5 });
assert.equal(connectRule(c, l), "refuse");

// Heard on the paid connection: the trial is not used a second time.
assert.deepEqual(afterHeard(c, l), { sessionsUsed: 1, unheardConnects: 4 });

// Heard on the fourth free connection: that one uses the trial as normal.
c = fresh;
for (let i = 0; i < 4; i++) c = afterConnect(c, "free");
assert.deepEqual(afterHeard(c, l), { sessionsUsed: 1, unheardConnects: 3 });

// Several free conversations: heard ones never eat into the unheard budget.
const l3 = { sessions: 3, unheardConnects: 4 };
c = fresh;
for (let i = 0; i < 2; i++) c = afterHeard(afterConnect(c, "free"), l3);
assert.deepEqual(c, { sessionsUsed: 2, unheardConnects: 0 });
assert.equal(connectRule(c, l3), "free");

// A stray extra "heard" never drives the count below zero.
assert.deepEqual(afterHeard(fresh, l3), { sessionsUsed: 1, unheardConnects: 0 });

console.log("trial self-check OK");
