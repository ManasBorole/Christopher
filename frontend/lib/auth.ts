// Owner identity for API calls. Guest by default (stable per-browser uuid);
// if signed in with Clerk, a session token is also attached and the backend
// prefers it. Sign-in is optional.

let tokenGetter: (() => Promise<string | null>) | null = null;

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
  try {
    const t = await tokenGetter?.();
    if (t) h["Authorization"] = `Bearer ${t}`;
  } catch {
    /* not signed in / token unavailable -> stay guest */
  }
  return h;
}
