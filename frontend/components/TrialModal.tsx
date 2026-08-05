"use client";

import { useState } from "react";
import { SignedIn, SignedOut, SignUpButton } from "@clerk/nextjs";
import { submitFeedback } from "../lib/api";

const hasClerk = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

// Shown when the free trial is over. Collects a waitlist email + feedback, and
// (for guests) offers a sign-up that grants one more free session.
export default function TrialModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function send() {
    if (busy || (!email.trim() && !message.trim())) return;
    setBusy(true);
    try {
      await submitFeedback(email.trim(), message.trim());
      setSent(true);
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center p-4"
      style={{ background: "rgba(4,5,10,.6)", backdropFilter: "blur(14px)", animation: "fadeIn .4s both" }}
    >
      <div className="glass w-full max-w-md rounded-[28px] p-8 animate-scalein" style={{ boxShadow: "0 40px 120px -30px rgba(0,0,0,.8)" }}>
        <div className="mb-5 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl text-2xl" style={{ background: "linear-gradient(140deg,var(--c1),var(--c3))" }}>
            ✨
          </div>
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            {sent ? "Thank you!" : "That's your free trial"}
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {sent
              ? "You're on the list. We'll be in touch when full access opens up."
              : "Thanks for trying Christopher. Leave your email to join the waitlist and tell us what you think."}
          </p>
        </div>

        {!sent ? (
          <div className="flex flex-col gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              className="w-full rounded-xl border border-[var(--line)] bg-white/[0.04] px-3 py-2.5 text-sm outline-none focus:border-emerald-400/50"
            />
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="What did you like? What would you improve?"
              className="w-full resize-none rounded-xl border border-[var(--line)] bg-white/[0.04] px-3 py-2.5 text-sm outline-none focus:border-emerald-400/50"
            />
            <button onClick={send} disabled={busy} className="btn-primary w-full disabled:opacity-50">
              {busy ? "Sending..." : "Join the waitlist"}
            </button>
          </div>
        ) : (
          <GuestUpsell />
        )}

        <p className="mt-5 text-center text-xs text-[var(--muted)]">
          Full access unlocks at launch with paid plans.
        </p>
        <button onClick={onClose} className="mt-3 w-full text-sm text-[var(--muted)] transition hover:text-[var(--fg)]">
          Back to dashboard
        </button>
      </div>
    </div>
  );
}

// After feedback: guests get a sign-up offer (one more free session); signed-in
// users see the paywall-coming message.
function GuestUpsell() {
  if (!hasClerk) {
    return <p className="text-center text-sm text-[var(--muted)]">Accounts are coming soon.</p>;
  }
  return (
    <div className="text-center">
      <SignedOut>
        <p className="mb-3 text-sm text-[var(--fg)]">Create a free account for one more session.</p>
        <SignUpButton mode="modal">
          <button className="btn-primary w-full">Sign up - get another 60s</button>
        </SignUpButton>
      </SignedOut>
      <SignedIn>
        <p className="text-sm text-[var(--muted)]">You've used your free sessions. Paid plans are on the way.</p>
      </SignedIn>
    </div>
  );
}
