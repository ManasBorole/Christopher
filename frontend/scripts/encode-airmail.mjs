// Compresses the landing's baked artwork (PNGs from bake.ts) into the WebP
// files the page loads. Usage: node frontend/scripts/encode-airmail.mjs [srcDir]
import { readdirSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const src = process.argv[2] ?? join(here, "airmail-src");
const out = join(here, "../public/airmail");
mkdirSync(out, { recursive: true });

// writing over transparency and the ink timing mask compress best losslessly;
// pictures with photos or grain are lossy, at a quality that keeps the grain
const LOSSLESS = new Set(["atlas", "atlas-m", "hero-mask"]);
const QUALITY = { pre: 75, "pre-360": 75 };

for (const f of readdirSync(src).filter((f) => f.endsWith(".png"))) {
  const name = f.slice(0, -4);
  const opts = LOSSLESS.has(name) ? { lossless: true, effort: 6 } : { quality: QUALITY[name] ?? 82, alphaQuality: 90, effort: 6 };
  const info = await sharp(join(src, f)).webp(opts).toFile(join(out, name + ".webp"));
  console.log(name.padEnd(12), String(info.width).padStart(5), "x", String(info.height).padEnd(5), (info.size / 1024).toFixed(0).padStart(5), "KB");
}
