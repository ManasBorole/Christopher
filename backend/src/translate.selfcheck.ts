// Runnable check for POST /translate's core: one paid call per distinct line,
// and a per-owner cap. fetch is stubbed, so this never reaches OpenAI.
// Run: npx tsx backend/src/translate.selfcheck.ts
import assert from "node:assert";

process.env.OPENAI_API_KEY ||= "test-key";
let calls = 0;
let sent: any = null;
globalThis.fetch = (async (_url: string, init: RequestInit) => {
  calls++;
  sent = JSON.parse(String(init.body));
  return new Response(JSON.stringify({ choices: [{ message: { content: " How are you? " } }] }));
}) as typeof fetch;

const { translateLine, allow } = await import("./routes/translate.js");

assert.equal(await translateLine("¿Cómo estás?", "Spanish"), "How are you?");
assert.equal(await translateLine("¿Cómo estás?", "Spanish"), "How are you?");
assert.equal(calls, 1, "the same line is translated once");
assert.equal(sent.messages[1].content, "¿Cómo estás?");
assert.match(sent.messages[0].content, /Spanish/);

for (let i = 0; i < 30; i++) assert.ok(allow("guest:a", 1000 + i), "under the cap");
assert.equal(allow("guest:a", 2000), false, "31st in a minute is refused");
assert.ok(allow("guest:b", 2000), "the cap is per owner");
assert.ok(allow("guest:a", 70_000), "the window slides");

console.log("translate self-check OK");
