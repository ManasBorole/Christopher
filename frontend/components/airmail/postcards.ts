import { rng } from "./math";
import { C, FONT, grain, miniPostmark, paperFill, stamp, stripeBorder, type Ctx2D } from "./paper";

// The story's postcards, drawn once into canvases and used as textures.

type Img = HTMLImageElement | null | undefined;

// the card Christopher sends after a conversation: words used, one thing to retry, next topic
export function drawAfter(c: Ctx2D, img: Img) {
  const W = c.canvas.width, H = c.canvas.height;
  paperFill(c, 0, 0, W, H, "#f0e4cc", 1, 2, 901);
  stripeBorder(c, 0, 0, W, H, W * 0.026);
  c.strokeStyle = "rgba(80,60,40,.3)";
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(W * 0.6, H * 0.1);
  c.lineTo(W * 0.6, H * 0.9);
  c.stroke();
  const X = W * 0.07;
  c.textAlign = "left";
  c.fillStyle = C.teal;
  c.font = `${H * 0.06}px ${FONT.hand}`;
  c.fillText("Greetings from", X, H * 0.15);
  c.fillStyle = C.ink;
  c.font = `700 ${H * 0.1}px ${FONT.jp}`;
  c.fillText("日本語", X, H * 0.27);
  const jw = c.measureText("日本語").width;
  c.fillStyle = C.brown;
  c.font = `600 ${H * 0.056}px ${FONT.display}`;
  c.fillText("Japanese", X + jw + 18, H * 0.265);
  let y = H * 0.38;
  const head = (t: string) => {
    c.fillStyle = C.ochre;
    c.font = `700 ${H * 0.03}px ${FONT.sans}`;
    c.fillText(t, X, y);
    y += H * 0.065;
  };
  // a run of [text, colour, japanese?, gap after] pieces on one line
  const run = (parts: [string, string, boolean, number][]) => {
    let x = X;
    for (const [t, col, jp, gap] of parts) {
      c.fillStyle = col;
      c.font = jp ? `500 ${H * 0.046}px ${FONT.jp}` : `500 ${H * 0.036}px ${FONT.sans}`;
      c.fillText(t, x, y);
      x += c.measureText(t).width + gap;
    }
  };
  head("Words you used");
  for (const [j, e] of [
    ["大好き", "love"],
    ["たべました", "ate"],
    ["サーモン", "salmon"],
  ]) {
    run([
      [j, C.ink, true, 16],
      [e, C.brown, false, 0],
    ]);
    y += H * 0.064;
  }
  y += H * 0.03;
  head("Worth another try");
  run([
    ["たべます", C.blue, true, 12],
    ["to", C.brown, false, 12],
    ["たべました", C.blue, true, 2],
    [", for yesterday", C.brown, false, 0],
  ]);
  y += H * 0.095;
  head("Next time");
  c.fillStyle = C.ink;
  c.font = `500 ${H * 0.042}px ${FONT.sans}`;
  c.fillText("Ordering at a sushi counter", X, y);
  // right side
  stamp(c, W * 0.79, H * 0.09, W * 0.14, W * 0.168, null, img ?? null, "#f3e8d2");
  c.fillStyle = C.pen;
  c.font = `${H * 0.062}px ${FONT.hand}`;
  c.save();
  c.translate(W * 0.64, H * 0.5);
  c.rotate(-0.03);
  c.fillText("Sam, that was", 0, 0);
  c.fillText("brilliant.", 0, H * 0.085);
  c.fillText("See you tomorrow?", 0, H * 0.17);
  c.restore();
  c.strokeStyle = "rgba(80,60,40,.35)";
  c.lineWidth = 2;
  for (let k = 0; k < 2; k++) {
    c.beginPath();
    c.moveTo(W * 0.65, H * (0.8 + k * 0.08));
    c.lineTo(W * 0.93, H * (0.8 + k * 0.08));
    c.stroke();
  }
}

// a printed photo of Christopher with a handwritten caption; the grain is baked once per canvas
const grains = new WeakMap<HTMLCanvasElement, ImageData>();
export function drawPolaroid(c: Ctx2D, img: Img, caption: string) {
  const W = c.canvas.width, H = c.canvas.height;
  const g0 = grains.get(c.canvas);
  if (g0) c.putImageData(g0, 0, 0);
  else {
    c.fillStyle = "#f4ecdc";
    c.fillRect(0, 0, W, H);
    grain(c, 0, 0, W, H, 0.85, 1.5, caption.length * 31);
    grains.set(c.canvas, c.getImageData(0, 0, W, H));
  }
  const m = W * 0.06, pw = W - 2 * m, ph = pw * 1.2;
  if (img) c.drawImage(img, m, m, pw, ph);
  else {
    c.fillStyle = "#c6a590";
    c.fillRect(m, m, pw, ph);
  }
  const g = c.createLinearGradient(0, m, 0, m + ph);
  g.addColorStop(0, "rgba(255,255,255,.06)");
  g.addColorStop(1, "rgba(0,0,0,.06)");
  c.fillStyle = g;
  c.fillRect(m, m, pw, ph);
  c.fillStyle = C.ink;
  c.font = `${Math.round(W * 0.085)}px ${FONT.hand}`;
  c.textAlign = "left";
  c.fillText(caption, m + 6, m + ph + (H - m - ph) * 0.62);
}

// the hero card's picture side: greetings from Japanese, with Christopher's photo glued on
export function drawHeroFront(c: Ctx2D, img: Img) {
  const W = c.canvas.width, H = c.canvas.height;
  paperFill(c, 0, 0, W, H, "#f0e4cc", 1, 2, 5);
  stripeBorder(c, 0, 0, W, H, W * 0.026);
  c.fillStyle = C.teal;
  c.font = `${H * 0.095}px ${FONT.hand}`;
  c.textAlign = "left";
  c.fillText("Greetings from", W * 0.075, H * 0.25);
  c.fillStyle = C.ink;
  c.font = `700 ${H * 0.25}px ${FONT.jp}`;
  c.fillText("日本語", W * 0.068, H * 0.56);
  c.fillStyle = C.brown;
  c.font = `600 ${H * 0.075}px ${FONT.display}`;
  c.fillText("Japanese", W * 0.078, H * 0.7);
  // "Say こんにちは. I will wait for you." on one line: Gochi Hand for Latin, Noto Sans JP for the Japanese
  const parts: [string, string, string][] = [
    ["Say ", FONT.hand, ""],
    ["こんにちは", FONT.jp, "500 "],
    [". I will wait for you.", FONT.hand, ""],
  ];
  const size = (fam: string, z: number) => z * (fam === FONT.jp ? 0.82 : 1);
  let fs = H * 0.056;
  const lw = (z: number) =>
    parts.reduce((a, [t, fam, wt]) => {
      c.font = `${wt}${size(fam, z)}px ${fam}`;
      return a + c.measureText(t).width;
    }, 0);
  const maxW = W * 0.52;
  if (lw(fs) > maxW) fs *= maxW / lw(fs);
  c.fillStyle = C.pen;
  let lx = W * 0.08;
  for (const [t, fam, wt] of parts) {
    c.font = `${wt}${size(fam, fs)}px ${fam}`;
    c.fillText(t, lx, H * 0.86);
    lx += c.measureText(t).width;
  }
  // glued photo
  c.save();
  c.translate(W * 0.75, H * 0.5);
  c.rotate(0.05);
  const pw = W * 0.29, ph = pw * 1.2, b = pw * 0.05;
  c.shadowColor = "rgba(60,40,20,.28)";
  c.shadowBlur = 24;
  c.shadowOffsetY = 8;
  c.fillStyle = "#faf6ec";
  c.fillRect(-pw / 2 - b, -ph / 2 - b, pw + 2 * b, ph + 2 * b);
  c.shadowColor = "transparent";
  if (img) c.drawImage(img, -pw / 2, -ph / 2, pw, ph);
  c.fillStyle = "rgba(235,225,195,.72)";
  c.save();
  c.rotate(-0.5);
  c.fillRect(-pw * 0.42, -ph * 0.52, pw * 0.34, pw * 0.1);
  c.restore();
  c.save();
  c.rotate(0.45);
  c.fillRect(pw * 0.04, -ph * 0.73, pw * 0.34, pw * 0.1);
  c.restore();
  c.restore();
}

// back of the hero card: paper (no ink), full ink, and a reveal-order mask
export function drawHeroBack(c: Ctx2D, mask: Ctx2D | null, img: Img, withInk: boolean) {
  const W = c.canvas.width, H = c.canvas.height, rnd = rng(77);
  paperFill(c, 0, 0, W, H, "#f0e4cc", 1, 2, 77);
  stripeBorder(c, 0, 0, W, H, W * 0.026);
  c.strokeStyle = "rgba(80,60,40,.3)";
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(W * 0.64, H * 0.12);
  c.lineTo(W * 0.64, H * 0.88);
  c.stroke();
  stamp(c, W * 0.8, H * 0.1, W * 0.13, W * 0.156, null, img ?? null, "#f3e8d2");
  miniPostmark(c, W * 0.76, H * 0.32, H * 0.07, "#30302e", rnd);
  c.strokeStyle = "rgba(80,60,40,.35)";
  c.lineWidth = 2;
  for (let k = 0; k < 3; k++) {
    c.beginPath();
    c.moveTo(W * 0.69, H * (0.62 + k * 0.1));
    c.lineTo(W * 0.93, H * (0.62 + k * 0.1));
    c.stroke();
  }
  c.fillStyle = C.pen;
  c.font = `${H * 0.06}px ${FONT.hand}`;
  c.textAlign = "left";
  c.fillText("Sam", W * 0.7, H * 0.6);
  // the exchange
  const X = W * 0.07, lab = `700 ${H * 0.03}px ${FONT.sans}`, jp = `500 ${H * 0.058}px ${FONT.jp}`;
  const lines = [
    { who: "Christopher", col: C.teal, text: "きのう、なにを たべましたか？", y: H * 0.2 },
    { who: "You", col: C.ochre, text: "すしを… たべます？", y: H * 0.38 },
    { who: "Christopher", col: C.teal, text: "いいですね！すしを たべましたね。", y: H * 0.56 },
  ];
  const segs: { x: number; y: number; w: number; h: number; t0: number; t1: number }[] = [];
  lines.forEach((l, k) => {
    c.font = lab;
    c.fillStyle = l.col;
    c.beginPath();
    c.arc(X + 7, l.y - H * 0.01, 7, 0, 7);
    c.fill();
    c.fillText(l.who, X + 24, l.y);
    if (withInk) {
      c.font = jp;
      c.fillStyle = C.ink;
      c.fillText(l.text, X, l.y + H * 0.085);
    }
    c.font = jp;
    segs.push({ x: X - 4, y: l.y + H * 0.02, w: c.measureText(l.text).width + 10, h: H * 0.09, t0: 0.02 + k * 0.17, t1: 0.17 + k * 0.17 });
  });
  // wavy underline under たべました
  c.font = jp;
  const pre = c.measureText("いいですね！すしを ").width, uw = c.measureText("たべました").width;
  const uy = lines[2].y + H * 0.112;
  if (withInk) {
    c.strokeStyle = C.blue;
    c.lineWidth = H * 0.008;
    c.lineCap = "round";
    c.beginPath();
    for (let t = 0; t <= 1.001; t += 0.01) c.lineTo(X + pre + t * uw, uy + Math.sin(t * Math.PI * 7) * H * 0.008);
    c.stroke();
  }
  segs.push({ x: X + pre - 8, y: uy - H * 0.02, w: uw + 16, h: H * 0.04, t0: 0.53, t1: 0.64 });
  // handwritten note
  const nf = `${H * 0.054}px ${FONT.hand},${FONT.jp}`;
  const n1 = "Yesterday is past, so たべます (eat)", n2 = "becomes たべました (ate).";
  c.font = nf;
  if (withInk) {
    c.fillStyle = C.pen;
    c.save();
    c.translate(X, H * 0.8);
    c.rotate(-0.012);
    c.fillText(n1, 0, 0);
    c.fillText(n2, 0, H * 0.075);
    c.restore();
  }
  segs.push({ x: X - 6, y: H * 0.74, w: c.measureText(n1).width + 14, h: H * 0.08, t0: 0.64, t1: 0.86 });
  segs.push({ x: X - 6, y: H * 0.82, w: c.measureText(n2).width + 14, h: H * 0.08, t0: 0.86, t1: 1.0 });
  if (mask) {
    mask.fillStyle = "#000";
    mask.fillRect(0, 0, W, H);
    for (const s of segs) {
      const g = mask.createLinearGradient(s.x, 0, s.x + s.w, 0);
      const v0 = Math.round(8 + s.t0 * 245), v1 = Math.round(8 + s.t1 * 245);
      g.addColorStop(0, `rgb(${v0},${v0},${v0})`);
      g.addColorStop(1, `rgb(${v1},${v1},${v1})`);
      mask.fillStyle = g;
      mask.fillRect(s.x, s.y, s.w, s.h);
    }
  }
}
