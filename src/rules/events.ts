// Events: voting, multiplier, and fade

export type EventSize = 'big_w' | 'small_w' | 'small_l' | 'big_l';

const EVENT_EFFECTS: Record<EventSize, number> = {
  big_w: 0.15,
  small_w: 0.05,
  small_l: -0.05,
  big_l: -0.15,
};

export function eventEffect(size: EventSize): number {
  return EVENT_EFFECTS[size];
}

/**
 * Event multiplier for a member: 1 + sum of all active effects (faded).
 * Each effect fades linearly to 0 over 28 days.
 * Clamped between 0.5 and 2.0.
 */
export interface ActiveEffect {
  size: EventSize;
  resolvedAt: string; // ISO
}

export function fadedEffect(effect: ActiveEffect, nowIso: string): number {
  const ageMs = new Date(nowIso).getTime() - new Date(effect.resolvedAt).getTime();
  const ageDays = ageMs / 86400000;
  if (ageDays >= 28) return 0;
  const fraction = 1 - ageDays / 28;
  return EVENT_EFFECTS[effect.size] * fraction;
}

export function eventMultiplier(effects: ActiveEffect[], nowIso: string): number {
  const sum = effects.reduce((acc, e) => acc + fadedEffect(e, nowIso), 0);
  return Math.min(2.0, Math.max(0.5, 1 + sum));
}

/**
 * How many votes needed to pass: ceil(eligibleVoters / 2)
 * eligibleVoters = all members except the subject
 */
export function votesNeededToPass(totalMembers: number): number {
  const eligible = totalMembers - 1;
  return Math.ceil(eligible / 2);
}

/**
 * Check if event passes given current vote count and total members.
 */
export function eventPasses(votesFor: number, totalMembers: number): boolean {
  return votesFor >= votesNeededToPass(totalMembers);
}
