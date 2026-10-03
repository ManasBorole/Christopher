import { JP, LANGS, drawAtlas, drawBack } from "./cards";
import { skeletonWord, drawStampTex } from "./ending";
import { FONT, PAPER, cv, readFonts } from "./paper";
import { drawAfter, drawHeroBack, drawHeroFront, drawPolaroid, drawPreCard } from "./postcards";

/* Bakes the landing's artwork once, with the same drawing code and the page's
   own fonts. Paper grain is noise and would not compress, so the textures are
   baked as what sits on the paper (stripes, stamps, ink, photos) over
   transparency; the grain itself is regenerated off the main thread from the
   same seeds (paint.ts). The cold-open card ships whole because it shows
   before any script runs.

   To re-bake after changing a drawing:
     npm run dev --workspace frontend, open http://localhost:3000 in Chrome,
     run `await __bake(true)` in the console, move the PNG downloads into
     frontend/scripts/airmail-src/ and word.json into components/airmail/, run
     `node frontend/scripts/encode-airmail.mjs`, then bump ART_V in art.ts so
     browsers drop the old copies. */

const img = (src: string) =>
  new Promise<HTMLImageElement>((ok, no) => {
    const im = new Image();
    im.onload = () => ok(im);
    im.onerror = no;
    im.src = src;
  });

export async function bake(download = false) {
  readFonts();
  const names = LANGS.map((l) => l.n).join("");
  const jobs = [`700 64px ${FONT.display}`, `600 64px ${FONT.display}`, `500 30px ${FONT.sans}`, `600 30px ${FONT.sans}`, `700 30px ${FONT.sans}`, `40px ${FONT.hand}`].map((f) =>
    document.fonts.load(f, "Greetings from Christopher 0123")
  );
  for (const w of ["400", "500", "700"]) jobs.push(document.fonts.load(`${w} 40px ${FONT.jp}`, JP + names));
  for (const f of [FONT.deva, FONT.arab, FONT.hebr]) jobs.push(document.fonts.load(`700 40px ${f}`, names));
  await Promise.all(jobs);
  await document.fonts.ready;
  const m: Record<string, HTMLImageElement> = {};
  for (const n of ["wave", "listen", "think", "speak-open", "goahead", "postcard", "idle"]) m[n] = await img(`/mascot/${n}.webp`);

  const out: Record<string, string> = {};
  const put = (name: string, c: HTMLCanvasElement) => {
    out[name] = c.toDataURL("image/png"); // lossless; scripts/encode-airmail.mjs compresses
  };
  const draw = (w: number, h: number, fn: (x: CanvasRenderingContext2D) => void) => {
    const c = cv(w, h);
    fn(c.getContext("2d")!);
    return c;
  };
  const half = (c: HTMLCanvasElement) => draw(c.width / 2, c.height / 2, (x) => x.drawImage(c, 0, 0, c.width / 2, c.height / 2));

  // whole pictures
  const pre = draw(720, 480, (x) => drawPreCard(x, m.wave));
  put("pre", pre);
  put("pre-360", half(pre));
  const st = cv(480, 576);
  drawStampTex(st, m.postcard);
  put("stamp", st);
  // the header's round avatar shows idle.webp at 171% of 32px; 128px wide is plenty at 2x
  put("avatar", draw(128, Math.round((128 * m.idle.height) / m.idle.width), (x) => x.drawImage(m.idle, 0, 0, x.canvas.width, x.canvas.height)));
  // the order the hero card's ink draws in (a smooth ramp, read from red)
  const mask = cv(1536, 1024);
  drawHeroBack(cv(1536, 1024).getContext("2d")!, mask.getContext("2d")!, m.idle, true);
  put("hero-mask", half(mask));

  // what sits on the paper
  try {
    // the cards' writing only: their stripes and stamps are drawn with the grain
    Object.assign(PAPER, { on: false, art: false });
    put("atlas", drawAtlas(false));
    put("atlas-m", drawAtlas(true));
    PAPER.art = true;
    put("hero-front", draw(1536, 1024, (x) => drawHeroFront(x, m.wave)));
    put("hero-back", draw(1536, 1024, (x) => drawHeroBack(x, null, m.idle, false)));
    put("hero-ink", draw(1536, 1024, (x) => drawHeroBack(x, null, m.idle, true)));
    put("after-front", draw(1536, 1024, (x) => drawAfter(x, m.postcard)));
    put("after-back", draw(1024, 683, (x) => drawBack(x, 0, 0, 1024, 683, 3, 0.9, 1.5)));
    const POL: [string, string][] = [
      ["listen", "listening"],
      ["think", "thinking"],
      ["speak-open", "speaking"],
      ["goahead", "go ahead, you first"],
    ];
    POL.forEach(([im, cap], k) => put(`pola-${k}`, draw(600, 780, (x) => drawPolaroid(x, m[im], cap))));
  } finally {
    Object.assign(PAPER, { on: true, art: true });
  }
  out.word = "data:application/json," + encodeURIComponent(JSON.stringify(skeletonWord("Christopher", 183), (_, v) => (typeof v === "number" ? +v.toFixed(5) : v)));

  if (download)
    for (const [name, url] of Object.entries(out)) {
      const a = document.createElement("a");
      a.href = url;
      a.download = name + (name === "word" ? ".json" : ".png");
      a.click();
      await new Promise((r) => setTimeout(r, 150));
    }
  return out;
}
