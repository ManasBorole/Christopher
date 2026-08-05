import { Router } from "express";
import { prisma } from "../db.js";
import { ah } from "../http.js";
import { owner, type OwnedRequest } from "../owner.js";
import { getUsage, addSeconds, consumeSession } from "../gate.js";

export const usageRouter = Router();
usageRouter.use(owner);

// Remaining free allowance for this owner (drives the UI notice + block state).
usageRouter.get(
  "/usage",
  ah(async (req: OwnedRequest, res) => {
    res.json(await getUsage(req.ownerId!));
  })
);

// Consume one free session - called once the conversation actually goes live.
usageRouter.post(
  "/usage/consume",
  ah(async (req: OwnedRequest, res) => {
    await consumeSession(req.ownerId!);
    res.json({ ok: true });
  })
);

// Record seconds actually spoken (analytics + soft server-side accounting).
usageRouter.post(
  "/usage/spent",
  ah(async (req: OwnedRequest, res) => {
    await addSeconds(req.ownerId!, Number(req.body?.seconds ?? 0));
    res.json({ ok: true });
  })
);

// Waitlist email + feedback captured when a trial ends.
usageRouter.post(
  "/feedback",
  ah(async (req: OwnedRequest, res) => {
    const email = String(req.body?.email ?? "").trim().slice(0, 200);
    const message = String(req.body?.message ?? "").trim().slice(0, 2000);
    if (!email && !message) return res.status(400).json({ error: "empty" });
    await prisma.feedback.create({ data: { ownerId: req.ownerId!, email, message } });
    res.json({ ok: true });
  })
);
