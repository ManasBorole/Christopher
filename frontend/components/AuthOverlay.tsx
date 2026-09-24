"use client";

import { useEffect, useState } from "react";
import { SignInButton, SignUpButton, SignedIn } from "@clerk/nextjs";
import Mascot from "./Mascot";

const hasClerk = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

// Fires onEnter once the user is signed in (advances past the overlay).
function AutoAdvance({ onEnter }: { onEnter: () => void }) {
  useEffect(() => {
    onEnter();
  }, [onEnter]);
  return null;
}

export default function AuthOverlay({ onEnter, onClose }: { onEnter: () => void; onClose: () => void }) {
  const [leaving, setLeaving] = useState(false);

  // Play the exit animation, then hand control back to the parent.
  function leave() {
    if (leaving) return;
    setLeaving(true);
    setTimeout(onEnter, 320);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-title"
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      className={`sheet-backdrop ${leaving ? "is-leaving" : ""}`}
    >
      <div className="sheet">
        <div className="flex items-center gap-4">
          <Mascot pose="wave" className="w-24 shrink-0 sm:w-28" priority />
          <div>
            <h2 id="auth-title" className="font-display text-[1.75rem] font-extrabold leading-tight tracking-[-0.02em]">
              Before we talk
            </h2>
            <p className="mt-1 text-[15px] text-muted">Try it right away, or sign in so Christopher remembers you next time.</p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <button type="button" autoFocus onClick={leave} className="btn w-full">
            Try it as a guest
          </button>
          {hasClerk ? (
            <>
              <SignInButton mode="modal">
                <button type="button" className="btn-quiet w-full">
                  Sign in to keep your progress
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button type="button" className="self-center text-[15px] font-semibold text-ink underline decoration-line decoration-2 underline-offset-4 hover:decoration-ink">
                  Create an account
                </button>
              </SignUpButton>
              <SignedIn>
                <AutoAdvance onEnter={leave} />
              </SignedIn>
            </>
          ) : (
            <p className="text-center text-sm text-muted">Accounts are coming soon. Guest mode has everything for now.</p>
          )}
        </div>
        <p className="mt-5 text-center text-sm text-muted">As a guest, your words stay in this browser only.</p>
      </div>
    </div>
  );
}
