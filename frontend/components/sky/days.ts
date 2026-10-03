import type { SkyCourse } from "@vta/shared";
import { findLanguage } from "../../lib/languages";

// The progress sky's data: every day the learner spoke a language becomes one
// star. Sessions are grouped into days in the learner's own time zone, so a
// late-evening conversation counts for the evening it happened, not for UTC.
// Pure and DOM-free: the scene, the strip and the stats all read the same model.

export type SkyLang = { name: string; code: string; native: string; rtl: boolean };

export type SkyDay = {
  lang: number; // index into SkyModel.langs, which is also the colour index
  key: number; // local calendar day as a day number (consecutive days differ by 1)
  date: Date; // local noon of that day
  month: number; // local year * 12 + month
  minutes: number;
  words: string[];
  chats: { at: Date; minutes: number }[];
  pending?: boolean; // tonight's star, waiting for today's first conversation
};

export type SkyModel = {
  langs: SkyLang[];
  days: SkyDay[]; // oldest first; tonight's waiting star last when there is one
  spoken: number; // days spoken, counted per language (the number of lit stars)
  streak: number; // days in a row with any language, up to today or yesterday
  words: number; // unique words across every conversation
  focus: number; // the language spoken most recently
  today: number; // today's day number
  thisMonth: number; // year * 12 + month, today
  tonight: SkyDay | null; // the star for today: spoken, or waiting
};

export const dayNumber = (d: Date) => Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
export const monthOf = (d: Date) => d.getFullYear() * 12 + d.getMonth();

export function skyLang(name: string): SkyLang {
  const l = findLanguage(name);
  return { name, code: l?.code ?? "en", native: l?.native ?? name, rtl: l?.rtl ?? false };
}

export function buildSky(courses: SkyCourse[], now = new Date()): SkyModel {
  const langs = courses.map((c) => skyLang(c.language));
  const today = dayNumber(now);
  const byDay = new Map<string, SkyDay>();
  const unique = new Set<string>();
  let lastAt = -Infinity, focus = 0;

  courses.forEach((c, lang) => {
    for (const s of c.sessions) {
      const at = new Date(s.at);
      if (Number.isNaN(at.getTime())) continue;
      if (at.getTime() > lastAt) { lastAt = at.getTime(); focus = lang; }
      const key = dayNumber(at), id = `${lang}:${key}`;
      let day = byDay.get(id);
      if (!day) {
        day = { lang, key, date: new Date(at.getFullYear(), at.getMonth(), at.getDate(), 12), month: monthOf(at), minutes: 0, words: [], chats: [] };
        byDay.set(id, day);
      }
      day.minutes += Math.max(1, s.minutes);
      day.chats.push({ at, minutes: Math.max(1, s.minutes) });
      for (const w of s.words) {
        const t = w.trim();
        if (!t) continue;
        if (!day.words.some((x) => x.toLocaleLowerCase() === t.toLocaleLowerCase())) day.words.push(t);
        unique.add(t.toLocaleLowerCase());
      }
    }
  });

  const days = [...byDay.values()].sort((a, b) => a.key - b.key || a.lang - b.lang);
  const spokenKeys = new Set(days.map((d) => d.key));
  // A streak still stands on a day not yet spoken: it counts up to yesterday.
  let streak = 0;
  for (let k = spokenKeys.has(today) ? today : today - 1; spokenKeys.has(k); k--) streak++;

  let tonight: SkyDay | null = days.find((d) => d.key === today && d.lang === focus) ?? null;
  if (!tonight && days.length) {
    const mid = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
    tonight = { lang: focus, key: today, date: mid, month: monthOf(now), minutes: 0, words: [], chats: [], pending: true };
    days.push(tonight);
  }

  return { langs, days, spoken: byDay.size, streak, words: unique.size, focus, today, thisMonth: monthOf(now), tonight };
}

// "Septiembre", "9月", "Сентябрь": a month named in the language being learned.
export function monthName(code: string, month: number): string {
  const d = new Date(Math.floor(month / 12), month % 12, 15);
  try {
    const n = new Intl.DateTimeFormat(code, { month: "long" }).format(d);
    return n.charAt(0).toLocaleUpperCase(code) + n.slice(1);
  } catch {
    return d.toLocaleDateString("en-GB", { month: "long" });
  }
}
