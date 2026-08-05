import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "@clerk/backend";

// Resolve the caller to a stable owner id:
//   signed in  -> "clerk:<userId>"   (from a verified Clerk session token)
//   guest      -> "guest:<uuid>"     (from the x-guest-id header)
// Guest is allowed (optional sign-in), so we only 401 if neither is present.
export interface OwnedRequest extends Request {
  ownerId?: string;
}

export async function owner(req: OwnedRequest, res: Response, next: NextFunction) {
  const auth = req.header("authorization");
  const secret = process.env.CLERK_SECRET_KEY;
  if (auth?.startsWith("Bearer ") && secret) {
    try {
      const { sub } = await verifyToken(auth.slice(7), { secretKey: secret });
      if (sub) {
        req.ownerId = `clerk:${sub}`;
        return next();
      }
    } catch {
      /* fall through to guest */
    }
  }
  const guest = req.header("x-guest-id");
  if (guest) {
    req.ownerId = `guest:${guest}`;
    return next();
  }
  res.status(401).json({ error: "no_owner", detail: "sign in or send x-guest-id" });
}
