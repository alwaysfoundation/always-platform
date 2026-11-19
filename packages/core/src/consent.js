import { rulesFor } from './minors.js';
/**
 * The single gate every data movement passes through (DG-10, CP-1).
 * Fails closed: anything not explicitly allowed is refused.
 */
export function canProcess(consent, purpose, recipientOrgId, opts = {}) {
    if (!consent)
        return { ok: false, reason: 'no_consent_record' };
    if (consent.withdrawnAt)
        return { ok: false, reason: 'withdrawn' };
    if ((opts.now ?? new Date()) >= consentExpiresAt(consent))
        return { ok: false, reason: 'expired' };
    if (!consent.purposes.includes(purpose))
        return { ok: false, reason: 'purpose_not_granted' };
    const rules = rulesFor(consent.ageBand);
    if (rules.requiresParentConfirmation) {
        if (consent.party !== 'parent' && !consent.parentConfirmedAt)
            return { ok: false, reason: 'parent_confirmation_required' };
    }
    if (rules.requiresChildAssent && !consent.childAssentAt)
        return { ok: false, reason: 'child_assent_required' };
    if (recipientOrgId !== null) {
        const named = consent.recipients.includes(recipientOrgId);
        const nearbyAllowed = opts.isNextNearby === true && consent.allowNextNearby;
        if (!named && !nearbyAllowed)
            return { ok: false, reason: 'recipient_not_covered' };
    }
    return { ok: true };
}
/** CP-3 / DG-12: withdrawal is immediate for new uses. */
export function withdrawConsent(consent, at) {
    return { ...consent, withdrawnAt: consent.withdrawnAt ?? at };
}
/** Consent lasts 12 months from when it was given, unless renewed (CP rules). */
export const CONSENT_MONTHS = 12;
export function consentExpiresAt(consent) {
    if (consent.expiresAt)
        return consent.expiresAt;
    const d = new Date(consent.collectedAt);
    d.setUTCMonth(d.getUTCMonth() + CONSENT_MONTHS);
    return d;
}
