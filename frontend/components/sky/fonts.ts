import { Caveat, Gamja_Flower, Klee_One, Patrick_Hand } from "next/font/google";
import type { SkyFonts } from "./scene";

// Handwritten faces for the month names, one per script: Patrick Hand has no
// Japanese, Korean or Cyrillic. None preload; each arrives when the sky first
// draws a name in its script (unicode-range keeps the CJK ones to the few
// characters a month name needs).
const latin = Patrick_Hand({ weight: "400", subsets: ["latin", "latin-ext"], display: "swap", preload: false });
const ja = Klee_One({ weight: "600", display: "swap", preload: false });
const ko = Gamja_Flower({ weight: "400", display: "swap", preload: false });
const cyrillic = Caveat({ weight: "500", subsets: ["cyrillic", "latin"], display: "swap", preload: false });

export const skyFonts: SkyFonts = {
  latin: latin.style.fontFamily,
  ja: ja.style.fontFamily,
  ko: ko.style.fontFamily,
  cyrillic: cyrillic.style.fontFamily,
};
