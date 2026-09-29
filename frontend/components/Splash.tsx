"use client";

import Mascot from "./Mascot";

// Brand cold-open. Purely visual; the parent controls how long it shows.
export default function Splash() {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-paper px-4">
      <div className="flex flex-col items-center gap-5 text-center">
        <Mascot pose="wave" priority className="w-40 sm:w-48" />
        <p className="font-display text-3xl font-extrabold tracking-[-0.02em]">Christopher</p>
        <p className="-mt-3 text-muted">Your voice tutor, ready when you are.</p>
      </div>
    </div>
  );
}
