// Runnable check for the language picker data and search.
// Run: npx tsx frontend/lib/languages.selfcheck.ts
import assert from "node:assert";
import { allLanguages, searchLanguages } from "./languages";

const langs = allLanguages();
const by = (code: string) => langs.find((l) => l.code === code)!;

// native names come from the platform, and right-to-left scripts are flagged
assert.equal(by("mr").native, "मराठी");
assert.equal(by("ja").native, "日本語");
assert.equal(by("es").native, "Español");
assert.equal(by("ar").rtl, true);
assert.equal(by("fr").rtl, false);

// search matches English or native names, prefix matches first
assert.equal(searchLanguages(langs, "marathi")[0].code, "mr");
assert.equal(searchLanguages(langs, "日本")[0].code, "ja");
assert.equal(searchLanguages(langs, "  ").length, langs.length);
const ar = searchLanguages(langs, "ar");
assert.ok(ar[0].name.toLowerCase().startsWith("ar") || ar[0].native.toLowerCase().startsWith("ar"));

console.log("languages self-check OK");
