import { canProcess, rulesFor } from '@always/core';
/**
 * Every sync into a church's own system passes here first. Fails closed.
 * Order matters: minors, then consent, then the handoff, then trust, then residency.
 */
export function canSync(ctx, connector) {
    // Both bands are checked so a mismatch can never let a minor through.
    if (rulesFor(ctx.packet.ageBand).isMinor || rulesFor(ctx.handoff.ageBand).isMinor || rulesFor(ctx.consent?.ageBand).isMinor) {
        return { ok: false, reason: 'minor_not_synced' };
    }
    const consent = canProcess(ctx.consent, 'connect.church', ctx.packet.orgId, { now: ctx.now });
    if (!consent.ok)
        return { ok: false, reason: `consent_${consent.reason}` };
    const accepted = ctx.handoff.offers.some((o) => o.orgId === ctx.packet.orgId && o.outcome === 'accepted');
    if (!accepted || !['accepted', 'contacted', 'closed'].includes(ctx.handoff.state) || ctx.org.id !== ctx.packet.orgId) {
        return { ok: false, reason: 'not_accepted_by_org' };
    }
    if (ctx.org.trustLevel !== 'verified' && ctx.org.trustLevel !== 'verified_youth') {
        return { ok: false, reason: 'org_not_verified' };
    }
    if (connector.dataRegion() !== 'AU')
        return { ok: false, reason: 'data_leaves_australia' };
    return { ok: true };
}
