"use client";

import { useState } from "react";
import { SignedIn, SignedOut, SignUpButton } from "@clerk/nextjs";
import { submitFeedback } from "../lib/api";
import Mascot from "./Mascot";

const hasClerk = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

// Shown when the free trial is over. Collects a waitlist email + feedback, and
// (for guests) offers a sign-up that grants one more free session.
export default function TrialModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function send() {
    if (busy || (!email.trim() && !message.trim())) return;
    setBusy(true);
    setFailed(false);
    try {
      await submitFeedback(email.trim(), message.trim());
      setSent(true);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="trial-title" className="sheet-backdrop">
      <div className="sheet">
        <div className="flex items-center gap-4">
          <Mascot pose={sent ? "wave" : "postcard"} className="w-24 shrink-0" />
          <div>
            <h2 id="trial-title" className="font-display text-2xl font-extrabold leading-tight tracking-[-0.02em]">
              {sent ? "Thank you, it's on its way" : "That was your free conversation"}
            </h2>
            <p className="mt-1 text-[15px] text-muted">
              {sent
                ? "You're on the list. We'll write when full access opens."
                : "Leave your email to hear when full access opens, and tell us how it felt."}
            </p>
          </div>
        </div>

        {!sent ? (
          <div className="mt-6 flex flex-col gap-3">
            <label htmlFor="trial-email" className="text-sm font-semibold">
              Email
            </label>
            <input
              id="trial-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border-[1.5px] border-line bg-paper px-4 py-3 text-ink placeholder:text-muted"
            />
            <label htmlFor="trial-msg" className="mt-1 text-sm font-semibold">
              How did it feel? <span className="font-normal text-muted">(optional)</span>
            </label>
            <textarea
              id="trial-msg"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="What helped, what felt awkward, what you'd want next"
              className="w-full resize-none rounded-xl border-[1.5px] border-line bg-paper px-4 py-3 text-ink placeholder:text-muted"
            />
            <button type="button" onClick={send} disabled={busy || (!email.trim() && !message.trim())} className="btn mt-1 w-full">
              {busy ? "Sending…" : "Join the waitlist"}
            </button>
            {failed && (
              <p role="alert" className="text-sm text-alert-ink">
                That didn&apos;t send. Check your connection and press Join the waitlist again.
              </p>
            )}
          </div>
        ) : (
          <div className="mt-6">
            <GuestUpsell />
          </div>
        )}

        <button type="button" onClick={onClose} className="btn-quiet mt-4 w-full">
          Back to your language
        </button>
      </div>
    </div>
  );
}

// After feedback: guests get a sign-up offer (one more free session); signed-in
// users see the paywall-coming message.
function GuestUpsell() {
  if (!hasClerk) {
    return <p className="text-center text-sm text-muted">Accounts are coming soon.</p>;
  }
  return (
    <div className="text-center">
      <SignedOut>
        <p className="mb-3 text-[15px]">Create a free account and get one more conversation.</p>
        <SignUpButton mode="modal">
          <button type="button" className="btn w-full">Create a free account</button>
        </SignUpButton>
      </SignedOut>
      <SignedIn>
        <p className="text-[15px] text-muted">You&apos;ve used your free conversations. Paid plans are on the way.</p>
      </SignedIn>
    </div>
  );
}
