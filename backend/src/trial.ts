// Free-trial rules as plain functions (no db, no env) so they can be checked.
//
// Christopher never speaks first, so a connection where the learner is never
// heard costs next to nothing. Still, each owner gets only `unheardConnects`
// of those for free; past that a new connection pays with the trial up front.

export type Limits = { sessions: number; unheardConnects: number };
export type Counts = { sessionsUsed: number; unheardConnects: number };

// May this owner open a new connection, and does it cost them the trial?
export function connectRule(c: Counts, l: Limits): "refuse" | "free" | "pay" {
  if (c.sessionsUsed >= l.sessions) return "refuse";
  return c.unheardConnects >= l.unheardConnects ? "pay" : "free";
}

// Counts after a connection was handed out (it is unheard until proven otherwise).
export function afterConnect(c: Counts, rule: "free" | "pay"): Counts {
  return { sessionsUsed: c.sessionsUsed + (rule === "pay" ? 1 : 0), unheardConnects: c.unheardConnects + 1 };
}

// Christopher heard the learner on the latest connection: it stops counting as
// unheard, and it uses the trial unless that connection already paid for it.
export function afterHeard(c: Counts, l: Limits): Counts {
  const paid = c.unheardConnects > l.unheardConnects;
  return { sessionsUsed: c.sessionsUsed + (paid ? 0 : 1), unheardConnects: Math.max(0, c.unheardConnects - 1) };
}
