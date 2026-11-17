import { POLICY } from './policy.js';
import type { AgeBand } from './types.js';
import { rulesFor } from './minors.js';

export type ActivityKind = 'call' | 'message' | 'text' | 'met' | 'note' | 'reply_received';

export interface ActivityLite {
  kind: ActivityKind;
  at: Date;
}

const HOUR = 3_600_000;

export interface FollowUpAdvice {
  /** When the next attempt is due, or null if none is needed. */
  nextAttemptAt: Date | null;
  attemptsMade: number;
  windowEndsAt: Date | null;
  reason: 'replied' | 'first_attempt_due' | 'second_attempt_window' | 'more_attempts_needed' | 'window_complete';
}

const ATTEMPTS: ActivityKind[] = ['call', 'message', 'text'];

/**
 * Persistence rules: second attempt 8-12 hours after the first if no reply,
 * then at least three attempts within seven days. Stops as soon as the person replies.
 */
export function followUpAdvice(activities: ActivityLite[], acceptedAt: Date, now: Date): FollowUpAdvice {
  const sorted = [...activities].sort((a, b) => a.at.getTime() - b.at.getTime());
  if (sorted.some((a) => a.kind === 'reply_received' || a.kind === 'met')) {
    return { nextAttemptAt: null, attemptsMade: sorted.filter((a) => ATTEMPTS.includes(a.kind)).length, windowEndsAt: null, reason: 'replied' };
  }
  const attempts = sorted.filter((a) => ATTEMPTS.includes(a.kind));
  if (attempts.length === 0) return { nextAttemptAt: acceptedAt, attemptsMade: 0, windowEndsAt: null, reason: 'first_attempt_due' };
  const first = attempts[0]!.at;
  const windowEndsAt = new Date(first.getTime() + POLICY.followUp.windowDays * 24 * HOUR);
  if (attempts.length === 1) {
    return { nextAttemptAt: new Date(first.getTime() + POLICY.followUp.secondAttemptMinHours * HOUR), attemptsMade: 1, windowEndsAt, reason: 'second_attempt_window' };
  }
  if (attempts.length < POLICY.followUp.minAttempts && now < windowEndsAt) {
    const last = attempts[attempts.length - 1]!.at;
    return { nextAttemptAt: new Date(last.getTime() + 48 * HOUR), attemptsMade: attempts.length, windowEndsAt, reason: 'more_attempts_needed' };
  }
  return { nextAttemptAt: null, attemptsMade: attempts.length, windowEndsAt, reason: 'window_complete' };
}

/** Minors may only be contacted 8am to 8pm local time (CY-23). */
export function contactAllowedNow(band: AgeBand, localHour: number): boolean {
  if (!rulesFor(band).isMinor) return true;
  return localHour >= POLICY.minorContactHours.startHour && localHour < POLICY.minorContactHours.endHour;
}
