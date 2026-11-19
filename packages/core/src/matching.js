import { rulesFor } from './minors.js';
import { POLICY } from './policy.js';
const DAY = 86_400_000;
export function distanceKm(a, b) {
    const R = 6371;
    const rad = (d) => (d * Math.PI) / 180;
    const dLat = rad(b.lat - a.lat);
    const dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
}
/** Why an organisation cannot receive this response, or null if it can. Hard filters only. */
export function exclusionReason(org, r, now, alreadyOffered) {
    const rules = rulesFor(r.ageBand);
    if (alreadyOffered.has(org.id))
        return 'already_offered';
    if (rules.youthPartnersOnly) {
        if (org.trustLevel !== 'verified_youth')
            return 'not_youth_verified';
    }
    else if (org.trustLevel !== 'verified' && org.trustLevel !== 'verified_youth') {
        return 'not_verified';
    }
    if (!org.offers.includes(r.step))
        return 'step_not_offered';
    if (distanceKm(org.location, r.location) > org.areaRadiusKm)
        return 'out_of_area';
    if (r.language && r.language !== 'English' && !org.languages.includes(r.language))
        return 'language';
    if (org.pausedUntil && org.pausedUntil > now)
        return 'paused';
    if (org.receivedThisMonth >= org.monthlyCapacity)
        return 'at_capacity';
    if (now.getTime() - org.lastConfirmedAt.getTime() > POLICY.freshnessDays * DAY)
        return 'stale_profile';
    return null;
}
/**
 * Ranked candidates: distance first (in 2 km bands so nearby churches compete on speed),
 * then recent median time to accept, then fewest open offers to spread load.
 */
export function rankCandidates(r, orgs, now, alreadyOffered = new Set()) {
    return orgs
        .filter((o) => exclusionReason(o, r, now, alreadyOffered) === null)
        .map((org) => ({ org, distanceKm: distanceKm(org.location, r.location) }))
        .sort((a, b) => {
        const bandA = Math.floor(a.distanceKm / 2);
        const bandB = Math.floor(b.distanceKm / 2);
        if (bandA !== bandB)
            return bandA - bandB;
        const speedA = a.org.medianAcceptMinutes ?? 240;
        const speedB = b.org.medianAcceptMinutes ?? 240;
        if (speedA !== speedB)
            return speedA - speedB;
        if (a.org.currentOpenOffers !== b.org.currentOpenOffers)
            return a.org.currentOpenOffers - b.org.currentOpenOffers;
        return a.distanceKm - b.distanceKm;
    });
}
