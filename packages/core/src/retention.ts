import { POLICY } from './policy.js';
import type { AgeBand, HandoffState } from './types.js';
import { rulesFor } from './minors.js';

const DAY = 86_400_000;

export interface RetentionInput {
  ageBand: AgeBand;
  createdAt: Date;
  state: HandoffState;
  acceptedAt?: Date;
  withdrawnAt?: Date;
  renewedAt?: Date;
}

export interface RetentionPlan {
  /** Restricted fields trimmed (name and contact removed, status kept). */
  trimAt: Date | null;
  /** Record deleted entirely. */
  deleteAt: Date;
}

/** Retention schedule from the Data Governance Policy, section 5. */
export function retentionPlan(r: RetentionInput): RetentionPlan {
  const P = POLICY.retention;
  const minor = rulesFor(r.ageBand).isMinor;
  const add = (d: Date, days: number) => new Date(d.getTime() + days * DAY);

  if (r.withdrawnAt) return { trimAt: null, deleteAt: add(r.withdrawnAt, P.withdrawalDeleteDays) };
  if (r.state === 'awaiting_parent') return { trimAt: null, deleteAt: add(r.createdAt, P.parentConfirmationDays) };

  const received = r.acceptedAt !== undefined;
  if (!received) return { trimAt: null, deleteAt: add(r.createdAt, minor ? P.unreceivedMinorDays : P.unreceivedAdultDays) };

  const from = r.renewedAt ?? r.acceptedAt!;
  if (minor) return { trimAt: add(from, P.activeMinorTrimDays), deleteAt: add(from, P.activeMinorDeleteDays) };
  return { trimAt: add(from, P.activeAdultDays), deleteAt: add(from, P.activeAdultDays + 365) };
}

/** Aggregates are suppressed below the minimum group size. */
export function suppress(count: number, minors: boolean): number | null {
  const min = minors ? POLICY.minGroupSize.minors : POLICY.minGroupSize.adults;
  return count < min ? null : count;
}
