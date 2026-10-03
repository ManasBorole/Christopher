"use client";

import { useEffect, useState } from "react";
import { setSoundsOn, soundsOn } from "../lib/sfx";

// Sounds on or off: the quiet stamp, chime and postcard swish (and the short
// buzz on phones). On by default; the choice is saved in this browser.
export default function SoundToggle() {
  const [on, setOn] = useState(true);
  useEffect(() => setOn(soundsOn()), []);

  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => {
        setSoundsOn(!on);
        setOn(!on);
      }}
      className="flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold text-muted shadow-[inset_0_0_0_1.5px_var(--line)] transition-colors hover:text-ink aria-pressed:text-ink"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M11 5 6 9H2v6h4l5 4V5z" />
        {on ? <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" /> : <path d="m22 9-6 6M16 9l6 6" />}
      </svg>
      Sounds
    </button>
  );
}
