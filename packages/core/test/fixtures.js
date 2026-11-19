// Synthetic fixtures only. No real people.
export const WESTMEAD = { lat: -33.8076, lng: 150.9875 };
export function org(id, over = {}) {
    return {
        id,
        displayName: id,
        trustLevel: 'verified',
        location: WESTMEAD,
        areaRadiusKm: 8,
        offers: ['church', 'explore', 'talk', 'group'],
        languages: ['English'],
        monthlyCapacity: 10,
        receivedThisMonth: 0,
        lastConfirmedAt: new Date('2026-11-01T00:00:00Z'),
        currentOpenOffers: 0,
        ...over,
    };
}
export function response(over = {}) {
    return { id: 'r1', createdAt: new Date('2026-11-17T09:00:00Z'), ageBand: '18+', step: 'church', location: WESTMEAD, ...over };
}
export function consent(over = {}) {
    return {
        id: 'c1',
        responseId: 'r1',
        purposes: ['connect.church'],
        recipients: ['a'],
        allowNextNearby: true,
        wordingVersion: '1.2',
        party: 'self',
        ageBand: '18+',
        collectedAt: new Date('2026-11-17T09:00:00Z'),
        ...over,
    };
}
/** 8pm Sydney on 17 Nov 2026 is 09:00Z (AEDT, UTC+11). */
export const SYD_8PM = new Date('2026-11-17T09:00:00Z');
export const minutes = (d, m) => new Date(d.getTime() + m * 60_000);
export const hours = (d, h) => minutes(d, h * 60);
