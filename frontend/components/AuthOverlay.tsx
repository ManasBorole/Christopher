"use client";

import { useEffect, useState } from "react";
import { SignInButton, SignUpButton, SignedIn } from "@clerk/nextjs";

const hasClerk = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

// Fires onEnter once the user is signed in (advances past the overlay).
function AutoAdvance({ onEnter }: { onEnter: () => void }) {
  useEffect(() => {
    onEnter();
  }, [onEnter]);
  return null;
}

export default function AuthOverlay({ onEnter }: { onEnter: () => void }) {
  const [leaving, setLeaving] = useState(false);

  // Play the exit animation, then hand control back to the parent.
  function leave() {
    if (leaving) return;
    setLeaving(true);
    setTimeout(onEnter, 420);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-title"
      className="fixed inset-0 z-40 grid place-items-center p-4"
      style={{
        background: "rgba(4,5,10,.55)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        animation: leaving ? "fadeIn .4s reverse both" : "fadeIn .5s both",
      }}
    >
      <div
        className={`glass w-full max-w-md rounded-[28px] p-8 ${leaving ? "" : "animate-scalein"}`}
        style={{
          boxShadow: "0 40px 120px -30px rgba(0,0,0,.8)",
          transform: leaving ? "scale(.94)" : undefined,
          opacity: leaving ? 0 : undefined,
          transition: "transform .42s cubic-bezier(.2,.8,.2,1), opacity .42s",
        }}
      >
        <div className="mb-6 text-center">
          <div
            className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl text-xl font-bold"
            style={{ background: "linear-gradient(140deg,var(--c1),var(--c3))", color: "#04120c" }}
          >
            L
          </div>
          <h2 id="auth-title" className="font-display text-2xl font-semibold tracking-tight">
            Welcome to Christopher
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Choose how you'd like to begin.</p>
        </div>

        {/* benefit callouts */}
        <div className="mb-6 grid gap-3 text-sm">
          <div className="rounded-2xl border border-[var(--line)] bg-white/[0.03] p-3">
            <p className="font-medium text-[var(--fg)]">Sign in - keep everything</p>
            <p className="text-[var(--muted)]">
              Save progress, sync across devices, track achievements, and get personalized insights.
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--line)] bg-white/[0.03] p-3">
            <p className="font-medium text-[var(--fg)]">Guest - instant access</p>
            <p className="text-[var(--muted)]">
              Jump straight in. Progress lives only in this browser and isn't permanently saved.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {hasClerk ? (
            <>
              <SignUpButton mode="modal">
                <button className="btn-primary w-full">Create account</button>
              </SignUpButton>
              <SignInButton mode="modal">
                <button className="btn-ghost w-full">Sign in</button>
              </SignInButton>
              <SignedIn>
                <AutoAdvance onEnter={leave} />
              </SignedIn>
            </>
          ) : (
            <p className="text-center text-xs text-[var(--muted)]">
              Accounts are being set up - continue as guest for now.
            </p>
          )}
          <button
            autoFocus
            onClick={leave}
            className="w-full rounded-full px-6 py-3 text-sm font-medium text-[var(--muted)] transition hover:text-[var(--fg)]"
          >
            Continue as guest →
          </button>
        </div>
      </div>
    </div>
  );
}
