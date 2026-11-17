/**
 * The consent primitive: the heart of Always.
 *
 * A consent receipt travels with every person, everywhere their details go. It records
 * exactly what they agreed to (purposes), who may receive their details (recipients, or
 * "the next suitable nearby church"), who agreed (the person or a parent), the age band,
 * and the exact wording they saw. Every system that touches the person checks it first
 * and fails closed. Withdrawal is one tap and reaches every holder.
 *
 * Shape follows ISO/IEC TS 27560 (consent records) and the Always Handoff standard.
 */
export type Purpose = 'connect.church' | 'notify.sender' | 'resources' | 'stats.anonymous';
export type AgeBand = 'under13' | '13-14' | '15-17' | '18+';

export interface ConsentInput {
  purposes: Purpose[];
  recipients: string[];
  allowNextNearby: boolean;
  wordingVersion: string;
  party: 'self' | 'parent';
}

/** Plain-language wording, versioned. Changing a word means a new version. */
export const CONSENT_WORDING = {
  v1: {
    'connect.church': 'Share my first name and contact details with one local church or ministry so someone can get in touch about my next step.',
    allowNextNearby: "If that church can't help, it's OK to offer me to the next suitable one nearby.",
    'notify.sender': 'Let the people who ran this event know I was connected (no details, just that it happened).',
    resources: 'Send me a few helpful resources by text or email. I can stop these any time.',
    'stats.anonymous': 'Include me in anonymous totals that help churches learn. Never with my name.',
  },
} as const;

export type WordingVersion = keyof typeof CONSENT_WORDING;

export function buildConsent(opts: {
  ageBand: AgeBand;
  connect: boolean;
  allowNextNearby?: boolean;
  notifySender?: boolean;
  resources?: boolean;
  stats?: boolean;
  recipients?: string[];
  party?: 'self' | 'parent';
  wordingVersion?: WordingVersion;
}): ConsentInput {
  if (!opts.connect) throw new Error('A connection needs the person to agree to connect.church');
  const party = opts.ageBand === 'under13' ? 'parent' : (opts.party ?? 'self');
  const purposes: Purpose[] = ['connect.church'];
  if (opts.notifySender) purposes.push('notify.sender');
  if (opts.resources && opts.ageBand === '18+') purposes.push('resources'); // no marketing-style texts to minors
  if (opts.stats) purposes.push('stats.anonymous');
  return { purposes, recipients: opts.recipients ?? [], allowNextNearby: !!opts.allowNextNearby, wordingVersion: opts.wordingVersion ?? 'v1', party };
}
