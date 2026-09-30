// Runnable check for the postmark wording on course tags.
// Run: npx tsx frontend/lib/lastChat.selfcheck.ts
import assert from "node:assert";
import { lastChat } from "./lastChat";

const now = Date.parse("2026-09-30T12:00:00Z");
const ago = (days: number) => new Date(now - days * 86_400_000).toISOString();

assert.equal(lastChat(ago(0.2), now), "today");
assert.equal(lastChat(ago(1.5), now), "yesterday");
assert.equal(lastChat(ago(5), now), "5 days ago");
assert.equal(lastChat(ago(13), now), "13 days ago");
assert.equal(lastChat(ago(14), now), "2 weeks ago");
assert.equal(lastChat(ago(51), now), "7 weeks ago");
assert.equal(lastChat(ago(70), now), "2 months ago");
assert.equal(lastChat(ago(200), now), "7 months ago");
assert.equal(lastChat(ago(365), now), "a year ago");
assert.equal(lastChat(ago(800), now), "2 years ago");

console.log("lastChat self-check OK");
