"use client";

import type { Summary } from "@vta/shared";
// Real SVG flags. Flag EMOJI don't render on Windows (they show as "JP", "KR"...),
// which defeats the whole point; these are cross-platform and bundled locally.
// Named imports so the bundler only ships the flags we actually reference.
import {
  ES, FR, DE, IT, BR, GB, JP, IN, CN, KR, SA, RU, NL, TR, MN, PL, SE, GR, IL,
  VN, TH, ID, MY, PH, UA, CZ, RO, HU, FI, DK, NO, BG, HR, RS, SK, SI, IR, PK,
  BD, KE, IE, IS, EE, LV, LT,
} from "country-flag-icons/react/3x2";

export function MicIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  );
}

export function Dots() {
  return (
    <span className="flex gap-1">
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-2 w-2 rounded-full bg-[#05140d]" style={{ animation: `float .9s ${i * 0.15}s ease-in-out infinite` }} />
      ))}
    </span>
  );
}

export function Bubble({ role, text, faint }: { role: "user" | "agent"; text: string; faint?: boolean }) {
  const mine = role === "user";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"} animate-fadeup`}>
      <div
        className={`max-w-[82%] rounded-2xl px-4 py-2 text-sm ${faint ? "opacity-60" : ""}`}
        style={
          mine
            ? { background: "linear-gradient(120deg,var(--c1),var(--c2))", color: "#05140d" }
            : { background: "var(--glass-strong)", border: "1px solid var(--line)" }
        }
      >
        {text}
      </div>
    </div>
  );
}

export function SummaryCard({ summary: sum }: { summary: Summary }) {
  return (
    <section className="glass w-full space-y-3 rounded-3xl p-6 animate-fadeup">
      <h2 className="font-display text-lg font-semibold">
        Lesson summary{sum.language ? ` · ${sum.language}` : ""}
      </h2>
      {sum.vocabulary.length > 0 && (
        <div>
          <h3 className="mb-1 text-xs uppercase tracking-wider text-[var(--muted)]">Vocabulary</h3>
          <ul className="space-y-0.5 text-sm">
            {sum.vocabulary.map((v, i) => (
              <li key={i}>
                <span className="font-medium">{v.term}</span>
                <span className="text-[var(--muted)]"> - {v.translation}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <SumList title="Watch out for" items={sum.mistakes} />
      <SumList title="Grammar tips" items={sum.grammarTips} />
      {sum.nextLesson && (
        <div>
          <h3 className="mb-1 text-xs uppercase tracking-wider text-[var(--muted)]">Next lesson</h3>
          <p className="text-sm">{sum.nextLesson}</p>
        </div>
      )}
    </section>
  );
}

function SumList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <h3 className="mb-1 text-xs uppercase tracking-wider text-[var(--muted)]">{title}</h3>
      <ul className="list-inside list-disc space-y-0.5 text-sm">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}

// Language (English name the picker stores) -> ISO 3166-1 alpha-2 country whose
// flag represents it. Names match Intl.DisplayNames("en"), used by LanguagePicker.
const LANGUAGE_COUNTRY: Record<string, string> = {
  spanish: "ES", french: "FR", german: "DE", italian: "IT", portuguese: "BR",
  english: "GB", japanese: "JP", hindi: "IN", mandarin: "CN", chinese: "CN",
  korean: "KR", arabic: "SA", russian: "RU", dutch: "NL", turkish: "TR",
  mongolian: "MN", polish: "PL", swedish: "SE", greek: "GR", hebrew: "IL",
  vietnamese: "VN", thai: "TH", indonesian: "ID", malay: "MY", filipino: "PH",
  tagalog: "PH", ukrainian: "UA", czech: "CZ", romanian: "RO", hungarian: "HU",
  finnish: "FI", danish: "DK", norwegian: "NO", "norwegian bokmål": "NO",
  bulgarian: "BG", croatian: "HR", serbian: "RS", slovak: "SK", slovenian: "SI",
  persian: "IR", urdu: "PK", bengali: "BD", tamil: "IN", telugu: "IN",
  punjabi: "IN", swahili: "KE", catalan: "ES", welsh: "GB", irish: "IE",
  icelandic: "IS", estonian: "EE", latvian: "LV", lithuanian: "LT",
  bhojpuri: "IN",
};

const FLAGS: Record<string, typeof JP> = {
  ES, FR, DE, IT, BR, GB, JP, IN, CN, KR, SA, RU, NL, TR, MN, PL, SE, GR, IL,
  VN, TH, ID, MY, PH, UA, CZ, RO, HU, FI, DK, NO, BG, HR, RS, SK, SI, IR, PK,
  BD, KE, IE, IS, EE, LV, LT,
};

// Country flag beside a language name, as a real SVG (renders identically on every
// OS). Falls back to a globe for any language we don't have a flag mapping for.
export function LangFlag({ language, className }: { language: string; className?: string }) {
  const Flag = FLAGS[LANGUAGE_COUNTRY[language.trim().toLowerCase()] ?? ""];
  if (!Flag) return <span className={className} role="img" aria-label={`${language} flag`}>🌐</span>;
  return <Flag className={className} role="img" aria-label={`${language} flag`} />;
}

// "3h ago" style relative time.
export function timeAgo(iso: string): string {
  const d = Date.now() - new Date(iso).getTime();
  const min = Math.floor(d / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
}
