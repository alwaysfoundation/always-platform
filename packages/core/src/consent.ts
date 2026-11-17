import type { ConsentPurpose, ConsentRecord } from './types.js';
import { rulesFor } from './minors.js';

export type ConsentDecision = { ok: true } | { ok: false; reason: string };

/**
 * The single gate every data movement passes through (DG-10, CP-1).
 * Fails closed: anything not explicitly allowed is refused.
 */
export function canProcess(
  consent: ConsentRecord | undefined,
  purpose: ConsentPurpose,
  recipientOrgId: string | null,
  opts: { isNextNearby?: boolean } = {},
): ConsentDecision {
  if (!consent) return { ok: false, reason: 'no_consent_record' };
  if (consent.withdrawnAt) return { ok: false, reason: 'withdrawn' };
  if (!consent.purposes.includes(purpose)) return { ok: false, reason: 'purpose_not_granted' };

  const rules = rulesFor(consent.ageBand);
  if (rules.requiresParentConfirmation) {
    if (consent.party !== 'parent' && !consent.parentConfirmedAt) return { ok: false, reason: 'parent_confirmation_required' };
  }

  if (recipientOrgId !== null) {
    const named = consent.recipients.includes(recipientOrgId);
    const nearbyAllowed = opts.isNextNearby === true && consent.allowNextNearby;
    if (!named && !nearbyAllowed) return { ok: false, reason: 'recipient_not_covered' };
  }
  return { ok: true };
}

/** CP-3 / DG-12: withdrawal is immediate for new uses. */
export function withdrawConsent(consent: ConsentRecord, at: Date): ConsentRecord {
  return { ...consent, withdrawnAt: consent.withdrawnAt ?? at };
}
