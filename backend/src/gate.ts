import { prisma } from "./db.js";
import { FREE } from "./env.js";

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

// Is this owner out of free sessions? Checked at mint (does NOT consume, so a
// failed/aborted connect never burns the allowance).
export async function isBlocked(ownerId: string): Promise<boolean> {
  if (isUnlimited(ownerId)) return false;
  const u = await prisma.usage.findUnique({ where: { ownerId } });
  return !!u && u.sessionsUsed >= FREE.sessionsPerOwner;
}

// Consume one free session. Called once the conversation actually goes live.
export async function consumeSession(ownerId: string): Promise<void> {
  await prisma.usage.upsert({
    where: { ownerId },
    update: { sessionsUsed: { increment: 1 } },
    create: { ownerId, sessionsUsed: 1 },
  });
}

export async function addSeconds(ownerId: string, seconds: number): Promise<void> {
  if (!(seconds > 0)) return;
  await prisma.usage
    .update({ where: { ownerId }, data: { secondsUsed: { increment: Math.round(seconds) } } })
    .catch(() => {});
}
