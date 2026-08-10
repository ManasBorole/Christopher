"use client";

import { useEffect } from "react";
import { SignedIn, SignedOut, SignInButton, UserButton, useAuth } from "@clerk/nextjs";
import { setTokenGetter, authReady } from "../lib/auth";

// Rendered only when Clerk is configured. Bridges Clerk's token to the api layer
// and shows sign-in / account controls. Guest still works without signing in.
export default function AuthBar() {
  const { isLoaded, getToken } = useAuth();
  useEffect(() => {
    setTokenGetter(() => getToken());
    return () => setTokenGetter(null);
  }, [getToken]);
  // Unblock backend requests once Clerk has resolved the session (signed in ->
  // real token; signed out -> guest). Until then ownerHeaders() waits.
  useEffect(() => {
    if (isLoaded) authReady();
  }, [isLoaded]);

  return (
    <div className="flex items-center gap-2">
      <SignedOut>
        <SignInButton mode="modal">
          <button className="rounded-full bg-neutral-800 px-3 py-1 text-sm hover:bg-neutral-700">
            Sign in
          </button>
        </SignInButton>
      </SignedOut>
      <SignedIn>
        <UserButton afterSignOutUrl="/" />
      </SignedIn>
    </div>
  );
}
