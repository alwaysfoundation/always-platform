/** Plain-language wording, versioned. Changing a word means a new version. */
export const CONSENT_WORDING = {
    v1: {
        'connect.church': 'Share my first name and contact details with one local church or ministry so someone can get in touch about my next step.',
        allowNextNearby: "If that church can't help, it's OK to offer me to the next suitable one nearby.",
        'notify.sender': 'Let the people who ran this event know I was connected (no details, just that it happened).',
        resources: 'Send me a few helpful resources by text or email. I can stop these any time.',
        'stats.anonymous': 'Include me in anonymous totals that help churches learn. Never with my name.',
    },
};
export function buildConsent(opts) {
    if (!opts.connect)
        throw new Error('A connection needs the person to agree to connect.church');
    const party = opts.ageBand === 'under13' ? 'parent' : (opts.party ?? 'self');
    const purposes = ['connect.church'];
    if (opts.notifySender)
        purposes.push('notify.sender');
    if (opts.resources && opts.ageBand === '18+')
        purposes.push('resources'); // no marketing-style texts to minors
    if (opts.stats)
        purposes.push('stats.anonymous');
    return { purposes, recipients: opts.recipients ?? [], allowNextNearby: !!opts.allowNextNearby, wordingVersion: opts.wordingVersion ?? 'v1', party };
}
