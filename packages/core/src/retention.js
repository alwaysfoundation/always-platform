import { POLICY } from './policy.js';
import { rulesFor } from './minors.js';
const DAY = 86_400_000;
/** Retention schedule from the Data Governance Policy, section 5. */
export function retentionPlan(r) {
    const P = POLICY.retention;
    const minor = rulesFor(r.ageBand).isMinor;
    const add = (d, days) => new Date(d.getTime() + days * DAY);
    if (r.withdrawnAt)
        return { trimAt: null, deleteAt: add(r.withdrawnAt, P.withdrawalDeleteDays) };
    if (r.state === 'awaiting_parent')
        return { trimAt: null, deleteAt: add(r.createdAt, P.parentConfirmationDays) };
    const received = r.acceptedAt !== undefined;
    if (!received)
        return { trimAt: null, deleteAt: add(r.createdAt, minor ? P.unreceivedMinorDays : P.unreceivedAdultDays) };
    const from = r.renewedAt ?? r.acceptedAt;
    if (minor)
        return { trimAt: add(from, P.activeMinorTrimDays), deleteAt: add(from, P.activeMinorDeleteDays) };
    return { trimAt: add(from, P.activeAdultDays), deleteAt: add(from, P.activeAdultDays + 365) };
}
/** Aggregates are suppressed below the minimum group size. */
export function suppress(count, minors) {
    const min = minors ? POLICY.minGroupSize.minors : POLICY.minGroupSize.adults;
    return count < min ? null : count;
}
