// The colour of each language the learner studies, used on the progress sky and
// anywhere a language needs its own colour.
//
// index = the language's place in the learner's list, in the order they added it.
// The first four are hand-tuned for the night sky (gold, teal, coral, lavender).
// From the fifth on: OKLCH at a fixed lightness and chroma, stepping the hue by
// the golden angle from the last tuned hue, so neighbours in the list never look
// alike however many languages there are. The steps start 111 degrees past
// lavender, which lands the first new hues in the gaps between the tuned four
// instead of on top of gold and teal.

export type RGB = [number, number, number]; // sRGB, each 0..1

const TUNED: RGB[] = [
  [1, 0.78, 0.46], // gold
  [0.5, 0.86, 0.92], // teal
  [1, 0.5, 0.42], // coral
  [0.68, 0.53, 1], // lavender
];
const LAST_TUNED_HUE = 296.5; // OKLCH hue of the lavender
const HUE_START = 111;
const GOLDEN_ANGLE = 137.508;
const L = 0.8; // lightness and chroma that read like the tuned four on a dark sky
const C_MAX = 0.14;

export function languageColor(index: number): RGB {
  if (index < TUNED.length) return [...TUNED[index]] as RGB;
  const h = (((LAST_TUNED_HUE + HUE_START + (index - TUNED.length + 1) * GOLDEN_ANGLE) % 360) * Math.PI) / 180;
  // chroma eases off until the colour fits in sRGB
  for (let c = C_MAX; ; c -= 0.01) {
    const a = c * Math.cos(h), b = c * Math.sin(h);
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    const lin = [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ];
    if (c <= 0.02 || lin.every((v) => v >= -0.001 && v <= 1.001)) return lin.map(toSrgb) as RGB;
  }
}

function toSrgb(v: number): number {
  v = Math.min(1, Math.max(0, v));
  return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
}

// The same colour as a CSS value, e.g. "rgb(255 199 117)".
export function languageCss(index: number): string {
  return `rgb(${languageColor(index).map((v) => Math.round(v * 255)).join(" ")})`;
}
