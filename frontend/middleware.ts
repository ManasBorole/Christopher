import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Clerk is optional: without keys the middleware is a passthrough so guest mode
// works immediately. Sign-in activates once CLERK_SECRET_KEY is set.
export default process.env.CLERK_SECRET_KEY ? clerkMiddleware() : () => NextResponse.next();

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/"],
};
