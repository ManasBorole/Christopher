import { prisma } from "./db.js";
import { FREE } from "./env.js";
import { connectRule, afterConnect, afterHeard, type Counts } from "./trial.js";

// Free-trial gate. All allowance logic lives here so a subscription/payment
// system can replace it without touching the routes.

export type UsageInfo = {
  sessionsUsed: number;
  secondsUsed: number;
  sessionsLimit: number;
  secondsPerSession: number;
  blocked: boolean;
};

// Allowlisted owners (e.g. you) bypass the trial entirely.
function isUnlimited(ownerId: string): boolean {
  return FREE.unlimitedOwners.includes(ownerId);
}

export async function getUsage(ownerId: string): Promise<UsageInfo> {
  const u = await prisma.usage.findUnique({ where: { ownerId } });
  const sessionsUsed = u?.sessionsUsed ?? 0;
  if (isUnlimited(ownerId)) {
    return {
      sessionsUsed,
      secondsUsed: u?.secondsUsed ?? 0,
      sessionsLimit: Number.MAX_SAFE_INTEGER,
      secondsPerSession: Number.MAX_SAFE_INTEGER,
      blocked: false,
    };
  }
  return {
    sessionsUsed,
    secondsUsed: u?.secondsUsed ?? 0,
    sessionsLimit: FREE.sessionsPerOwner,
    secondsPerSession: FREE.secondsPerSession,
    blocked: sessionsUsed >= FREE.sessionsPerOwner,
  };
}

const LIMITS = { sessions: FREE.sessionsPerOwner, unheardConnects: FREE.unheardConnects };

async function counts(ownerId: string): Promise<Counts> {
  const u = await prisma.usage.findUnique({ where: { ownerId } });
  return { sessionsUsed: u?.sessionsUsed ?? 0, unheardConnects: u?.unheardConnects ?? 0 };
}

function save(ownerId: string, c: Counts) {
  return prisma.usage.upsert({ where: { ownerId }, update: c, create: { ownerId, ...c } });
}

// May this owner connect? Checked before minting; changes nothing, so a
// connect that fails before a token is handed out never counts.
export async function checkConnect(ownerId: string): Promise<"refuse" | "free" | "pay"> {
  if (isUnlimited(ownerId)) return "free";
  return connectRule(await counts(ownerId), LIMITS);
}

// A token was handed out: count it as unheard (and charge the trial if it pays).
// ponytail: read-then-write, so parallel mints can slip a connection or two past
// the cap; a guest can mint a new owner id anyway. Use one SQL update if it matters.
export async function recordConnect(ownerId: string, rule: "free" | "pay"): Promise<void> {
  if (isUnlimited(ownerId)) return;
  await save(ownerId, afterConnect(await counts(ownerId), rule));
}

// Christopher heard the learner for the first time in a conversation: that
// uses the free session (unless this connection already paid for it), so a
// silent or wrong microphone never uses up the trial by itself.
export async function consumeSession(ownerId: string): Promise<void> {
  await save(ownerId, afterHeard(await counts(ownerId), LIMITS));
}

export async function addSeconds(ownerId: string, seconds: number): Promise<void> {
  if (!(seconds > 0)) return;
  await prisma.usage
    .update({ where: { ownerId }, data: { secondsUsed: { increment: Math.round(seconds) } } })
    .catch(() => {});
}
