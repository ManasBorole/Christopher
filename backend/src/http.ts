import type { Request, Response, NextFunction } from "express";

// Express 4 doesn't forward async errors -> an unhandled rejection crashes the
// process (socket reset). Wrap async handlers so errors reach the error middleware.
export const ah =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);

// Last middleware: turn any thrown error into a readable 500 instead of a crash.
export function onError(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  console.error(err);
  res.status(500).json({ error: "server_error", detail: String((err as Error)?.message ?? err) });
}
