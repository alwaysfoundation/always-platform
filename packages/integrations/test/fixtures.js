// Synthetic fixtures only. No real people.
export const NOW = new Date('2026-11-19T07:00:00Z');
export const packet = (over = {}) => ({
    responseId: 'r-test-1',
    orgId: 'org-grace',
    ageBand: '18+',
    firstName: 'Testy',
    lastName: 'McTestface',
    email: 'testy@example.test',
    mobile: '0400 000 000',
    postcode: '2145',
    step: 'church',
    ...over,
});
export const consent = (over = {}) => ({
    id: 'c-test-1',
    responseId: 'r-test-1',
    purposes: ['connect.church'],
    recipients: ['org-grace'],
    allowNextNearby: false,
    wordingVersion: '1.2',
    party: 'self',
    ageBand: '18+',
    collectedAt: new Date('2026-11-18T09:00:00Z'),
    ...over,
});
export const handoff = (over = {}) => ({
    id: 'h-test-1',
    responseId: 'r-test-1',
    createdAt: new Date('2026-11-18T09:00:00Z'),
    ageBand: '18+',
    state: 'accepted',
    acceptedAt: new Date('2026-11-18T10:00:00Z'),
    offers: [
        {
            orgId: 'org-grace',
            offeredAt: new Date('2026-11-18T09:00:00Z'),
            deadline: new Date('2026-11-18T13:00:00Z'),
            outcome: 'accepted',
            decidedAt: new Date('2026-11-18T10:00:00Z'),
        },
    ],
    ...over,
});
export const org = (over = {}) => ({
    id: 'org-grace',
    displayName: 'Grace Test Church',
    trustLevel: 'verified',
    location: { lat: -33.8076, lng: 150.9875 },
    areaRadiusKm: 8,
    offers: ['church'],
    languages: ['English'],
    monthlyCapacity: 10,
    receivedThisMonth: 0,
    lastConfirmedAt: new Date('2026-11-01T00:00:00Z'),
    currentOpenOffers: 0,
    ...over,
});
export const ctx = (over = {}) => ({
    packet: packet(),
    consent: consent(),
    handoff: handoff(),
    org: org(),
    now: NOW,
    ...over,
});
/** A fake fetch that records calls and answers from a queue. */
export function fakeFetch(replies) {
    const calls = [];
    const fetcher = (async (url, init = {}) => {
        calls.push({
            url: String(url),
            method: init.method ?? 'GET',
            headers: init.headers,
            body: init.body ? JSON.parse(String(init.body)) : undefined,
        });
        const r = replies.shift() ?? { status: 500, json: {} };
        return new Response(JSON.stringify(r.json), { status: r.status ?? 200, headers: { 'content-type': 'application/json' } });
    });
    return { fetcher, calls };
}
