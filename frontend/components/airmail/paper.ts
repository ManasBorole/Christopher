import { hash3, rng } from "./math";

// Canvas drawing for everything made of paper: grain, the airmail stripe,
// perforated stamps and postmarks.

export const C = {
  ink: "#1b2a2e",
  teal: "#1f6f78",
  red: "#d64545",
  blue: "#2f5da8",
  gold: "#e8b23a",
  ochre: "#94640c",
  paper: "#f3e8d2",
  brown: "#6d5a44",
  pen: "#24365e",
};

export type Ctx2D = CanvasRenderingContext2D;

// Canvas text needs the real family names. next/font hashes them, so read the
// first family of each CSS variable on <html> once the page is up.
export const FONT = {
  display: '"Bricolage Grotesque"',
  sans: '"Figtree"',
  hand: '"Gochi Hand"',
  jp: '"Noto Sans JP"',
  deva: '"Noto Sans Devanagari"',
  arab: '"Noto Naskh Arabic"',
  hebr: '"Noto Sans Hebrew"',
};
export function readFonts() {
  const cs = getComputedStyle(document.documentElement);
  for (const k of Object.keys(FONT) as (keyof typeof FONT)[]) {
    const v = cs.getPropertyValue(`--font-${k}`).split(",")[0].trim();
    if (v) FONT[k] = v;
  }
}
// native names on the language cards: every script the atlas needs
export const nativeStack = () =>
  `${FONT.display},${FONT.jp},${FONT.deva},${FONT.arab},${FONT.hebr},"Nirmala UI","Segoe UI Historic","Segoe UI",sans-serif`;

export function cv(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

export function stripeBorder(c: Ctx2D, x: number, y: number, w: number, h: number, b: number) {
  c.save();
  c.beginPath();
  c.rect(x, y, w, h);
  c.rect(x + b, y + b, w - 2 * b, h - 2 * b);
  c.clip("evenodd");
  const u = b * 2.2;
  c.translate(x, y);
  c.rotate(-Math.PI / 4);
  const L = (w + h) * 1.5;
  for (let k = -L; k < L; k += u * 4) {
    c.fillStyle = C.red;
    c.fillRect(k, -L, u * 1.5, L * 2);
    c.fillStyle = C.blue;
    c.fillRect(k + u * 2, -L, u * 1.5, L * 2);
  }
  c.restore();
}

// paper grain baked into the texture: low-frequency grey-beige mottling + fine speckle (cell px) + a few fibres
export function grain(c: Ctx2D, x: number, y: number, w: number, h: number, amt: number, cell: number, seed: number) {
  x |= 0;
  y |= 0;
  w |= 0;
  h |= 0;
  for (const [div, al] of [[38, 0.26], [11, 0.16]]) {
    const sw = Math.max(2, Math.ceil(w / div)), sh = Math.max(2, Math.ceil(h / div));
    const m = cv(sw, sh), mc = m.getContext("2d")!, md = mc.createImageData(sw, sh);
    for (let k = 0; k < sw * sh; k++) {
      const v = 128 + (hash3(k, div, seed) - 0.5) * 150;
      md.data[k * 4] = v;
      md.data[k * 4 + 1] = v * 0.99;
      md.data[k * 4 + 2] = v * 0.95;
      md.data[k * 4 + 3] = 255;
    }
    mc.putImageData(md, 0, 0);
    c.save();
    c.globalCompositeOperation = "overlay";
    c.globalAlpha = al * amt;
    c.imageSmoothingEnabled = true;
    c.drawImage(m, x, y, w, h);
    c.restore();
  }
  const id = c.getImageData(x, y, w, h), d = id.data;
  for (let py = 0; py < h; py++) {
    const cy = (py / cell) | 0;
    for (let px = 0; px < w; px++) {
      const cx = (px / cell) | 0, n = hash3(cx, cy, seed), n2 = hash3(cy, cx, seed + 7);
      let k = (n - 0.5) * 44 * amt;
      if (n2 < 0.045) k -= (20 + 60 * n) * amt;
      else if (n2 > 0.975) k += 18 * amt;
      const o = (py * w + px) * 4;
      d[o] += k;
      d[o + 1] += k * 0.97;
      d[o + 2] += k * 0.92;
    }
  }
  c.putImageData(id, x, y);
  const r = rng(seed + 3);
  c.save();
  c.lineWidth = Math.max(0.6, cell * 0.6);
  for (let k = 0, nF = ((w * h) / 7000) * amt; k < nF; k++) {
    const fx = x + r() * w, fy = y + r() * h, a = r() * 6.283, L = (3 + r() * 10) * cell;
    c.strokeStyle = r() > 0.5 ? `rgba(105,85,60,${0.16 * amt})` : `rgba(255,252,240,${0.22 * amt})`;
    c.beginPath();
    c.moveTo(fx, fy);
    c.quadraticCurveTo(
      fx + Math.cos(a) * L * 0.5 + (r() - 0.5) * cell * 3,
      fy + Math.sin(a) * L * 0.5 + (r() - 0.5) * cell * 3,
      fx + Math.cos(a) * L,
      fy + Math.sin(a) * L
    );
    c.stroke();
  }
  c.restore();
}

export function paperFill(c: Ctx2D, x: number, y: number, w: number, h: number, tone: string, amt = 0.5, cell = 1, seed = 1) {
  c.fillStyle = tone;
  c.fillRect(x, y, w, h);
  grain(c, x, y, w, h, amt, cell, seed);
}

// a perforated stamp: either a photo or a little harbour scene in `fill`
export function stamp(c: Ctx2D, x: number, y: number, w: number, h: number, fill: string | null, img: HTMLImageElement | null, paper: string) {
  c.fillStyle = "#fbf6ea";
  c.fillRect(x, y, w, h);
  const r = Math.max(2, w * 0.045), step = r * 2.6;
  c.fillStyle = paper;
  for (let i = x + step / 2; i < x + w; i += step) {
    c.beginPath();
    c.arc(i, y, r, 0, 7);
    c.arc(i, y + h, r, 0, 7);
    c.fill();
  }
  for (let j = y + step / 2; j < y + h; j += step) {
    c.beginPath();
    c.arc(x, j, r, 0, 7);
    c.arc(x + w, j, r, 0, 7);
    c.fill();
  }
  const m = w * 0.1;
  if (img) {
    const iw = w - 2 * m, ih = h - 2 * m, ar = img.width / img.height;
    let sw = img.width, sh = img.height, sx = 0, sy = 0;
    if (iw / ih > ar) {
      sh = img.width / (iw / ih);
      sy = (img.height - sh) * 0.25;
    } else {
      sw = img.height * (iw / ih);
      sx = (img.width - sw) / 2;
    }
    c.drawImage(img, sx, sy, sw, sh, x + m, y + m, iw, ih);
  } else {
    c.fillStyle = fill ?? C.teal;
    c.fillRect(x + m, y + m, w - 2 * m, h - 2 * m);
    c.fillStyle = "rgba(243,232,210,.85)";
    c.beginPath();
    c.arc(x + w * 0.62, y + h * 0.42, w * 0.16, 0, 7);
    c.fill();
    c.strokeStyle = "rgba(243,232,210,.7)";
    c.lineWidth = Math.max(1, w * 0.03);
    for (let k = 0; k < 2; k++) {
      c.beginPath();
      for (let t = 0; t <= 1.001; t += 0.1) {
        const xx = x + m + t * (w - 2 * m);
        c.lineTo(xx, y + h * (0.68 + k * 0.1) + Math.sin(t * 9 + k) * w * 0.025);
      }
      c.stroke();
    }
  }
}

export function miniPostmark(c: Ctx2D, cx: number, cy: number, r: number, col: string, rnd: () => number) {
  c.save();
  c.strokeStyle = col;
  c.globalAlpha = 0.55 + rnd() * 0.25;
  c.lineWidth = Math.max(1, r * 0.08);
  c.beginPath();
  c.arc(cx, cy, r, 0, 7);
  c.stroke();
  c.beginPath();
  c.arc(cx, cy, r * 0.72, 0, 7);
  c.stroke();
  for (let k = 0; k < 4; k++) {
    c.beginPath();
    for (let t = 0; t <= 1.001; t += 0.05) c.lineTo(cx + r * 1.1 + t * r * 2.6, cy - r * 0.6 + k * r * 0.4 + Math.sin(t * 12) * r * 0.08);
    c.stroke();
  }
  c.restore();
}

// shrink a line until it fits maxW; returns the size it settled on
export function fitFont(c: Ctx2D, text: string, weight: string | number, family: string, maxW: number, maxS: number) {
  let s = maxS;
  c.font = `${weight} ${s}px ${family}`;
  const w = c.measureText(text).width;
  if (w > maxW) s = Math.floor((s * maxW) / w);
  c.font = `${weight} ${s}px ${family}`;
  return s;
}

// the red "said out loud" postmark that stamps the after-conversation card
export function drawPostmark(c: Ctx2D, S: number) {
  c.clearRect(0, 0, S, S);
  c.save();
  c.translate(S / 2, S / 2);
  c.rotate(-0.22);
  c.strokeStyle = c.fillStyle = "rgba(200,52,52,0.9)";
  c.lineWidth = S * 0.022;
  c.beginPath();
  c.arc(0, 0, S * 0.36, 0, 7);
  c.stroke();
  c.lineWidth = S * 0.012;
  c.beginPath();
  c.arc(0, 0, S * 0.25, 0, 7);
  c.stroke();
  c.font = `700 ${S * 0.062}px ${FONT.sans}`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  const txt = "SAID OUT LOUD", R = S * 0.305, span = 2.1;
  [...txt].forEach((ch, k) => {
    const a = -Math.PI / 2 - span / 2 + span * (k / (txt.length - 1));
    c.save();
    c.rotate(a + Math.PI / 2);
    c.fillText(ch, 0, -R);
    c.restore();
  });
  for (const a of [Math.PI / 2 - 0.9, Math.PI / 2 + 0.9]) {
    c.beginPath();
    c.arc(Math.cos(a) * R, Math.sin(a) * R, S * 0.012, 0, 7);
    c.fill();
  }
  // stamped with the visitor's own date, the day they read it
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = now.toLocaleString("en-GB", { month: "short" }).slice(0, 3).toUpperCase();
  c.font = `700 ${S * 0.085}px ${FONT.sans}`;
  c.fillText(`${day} ${month}`, 0, -S * 0.04);
  c.font = `600 ${S * 0.07}px ${FONT.sans}`;
  c.fillText(String(now.getFullYear()), 0, S * 0.07);
  c.restore();
  // ink texture: knock out speckles
  c.globalCompositeOperation = "destination-out";
  const rnd = rng(42);
  for (let i = 0; i < 1400; i++) {
    c.globalAlpha = 0.3 + rnd() * 0.7;
    c.beginPath();
    c.arc(rnd() * S, rnd() * S, rnd() * S * 0.006, 0, 7);
    c.fill();
  }
  c.globalAlpha = 1;
  c.globalCompositeOperation = "source-over";
}
