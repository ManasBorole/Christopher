// Owner identity for API calls. Guest by default (stable per-browser uuid);
// if signed in with Clerk, a session token is also attached and the backend
// prefers it. Sign-in is optional.

let tokenGetter: (() => Promise<string | null>) | null = null;

// Clerk loads asynchronously. Until it has, getToken() can hang or return null, so
// a request fired on mount would go out as a guest and load the WRONG account's
// data (signed-in user sees no cards; opening a course 404s). Gate backend requests
// on Clerk being ready so the very first request already carries the real token.
// When Clerk isn't configured there is nothing to wait for.
const hasClerk = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
let markReady: (() => void) | undefined;
const authReadyPromise: Promise<void> = hasClerk
  ? new Promise<void>((resolve) => (markReady = resolve))
  : Promise.resolve();

// Called by the Clerk bridge (AuthBar) once Clerk has finished loading.
export function authReady() {
  markReady?.();
}

// Set once from a client component that has Clerk's useAuth().getToken.
export function setTokenGetter(fn: (() => Promise<string | null>) | null) {
  tokenGetter = fn;
}

export function guestId(): string {
  let g = localStorage.getItem("vta_guest");
  if (!g) {
    g = crypto.randomUUID();
    localStorage.setItem("vta_guest", g);
  }
  return g;
}

// Headers identifying the owner. Include as `headers` on every backend fetch.
export async function ownerHeaders(): Promise<Record<string, string>> {
  const h: Record<string, string> = { "x-guest-id": guestId() };
  // Wait for Clerk to load so getToken() yields the real token instead of null
  // mid-load. Bounded so a broken/unreachable Clerk can never hang the app - it
  // falls back to guest. Once ready resolves (after first load) this is instant.
  // ponytail: 4s ceiling; raise it only if Clerk cold-load is measurably slower.
  await Promise.race([authReadyPromise, delay(4000)]);
  try {
    const t = await Promise.race([
      Promise.resolve(tokenGetter?.() ?? null),
      delay(4000).then(() => null),
    ]);
    if (t) h["Authorization"] = `Bearer ${t}`;
  } catch {
    /* not signed in / token unavailable -> stay guest */
  }
  return h;
}

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
