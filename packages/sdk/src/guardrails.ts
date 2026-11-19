import type { AgeBand } from './consent.js';

/**
 * Compliant by default: the rules Always Platform enforces, packaged for any app to use.
 * Each helper fails closed. They help a platform meet common obligations; they are not
 * legal advice, and the Always Safety register says which obligations apply.
 */

export interface AgeGuard {
  /** May the young person's own details be collected? */
  collectOwnDetails: boolean;
  /** Must a parent or guardian confirm before anything is shared? */
  requiresParentConfirmation: boolean;
  /** May only verified youth partners receive the person? */
  youthPartnersOnly: boolean;
  /** May AI features process this record? */
  aiAllowed: boolean;
  isMinor: boolean;
}

/** Ask age first. No age given is treated as under 13. These rules are not configurable. */
export function ageGuard(band: AgeBand | undefined): AgeGuard {
  switch (band ?? 'under13') {
    case 'under13':
      return { collectOwnDetails: false, requiresParentConfirmation: true, youthPartnersOnly: true, aiAllowed: false, isMinor: true };
    case '13-14':
      return { collectOwnDetails: true, requiresParentConfirmation: true, youthPartnersOnly: true, aiAllowed: false, isMinor: true };
    case '15-17':
      return { collectOwnDetails: true, requiresParentConfirmation: false, youthPartnersOnly: true, aiAllowed: false, isMinor: true };
    default:
      return { collectOwnDetails: true, requiresParentConfirmation: false, youthPartnersOnly: false, aiAllowed: true, isMinor: false };
  }
}

/** Throw unless the person agreed to this purpose. Use before any send, share, export or sync. */
export function requireConsent(receipt: { purposes: readonly string[]; withdrawnAt?: string | null } | null | undefined, purpose: string): void {
  if (!receipt || receipt.withdrawnAt || !receipt.purposes.includes(purpose)) throw new Error(`consent:${purpose}`);
}

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const AU_PHONE = /(?:\+?61|\b0)[\s-]?[2-478](?:[\s-]?\d){8}\b/;

/**
 * Notifications, logs and analytics must not carry people's details. Returns the problems
 * found, or an empty list. Names can't be detected reliably: send ids and a sign-in link.
 */
export function personalDataProblems(text: string): string[] {
  const out: string[] = [];
  if (EMAIL.test(text)) out.push('contains an email address');
  if (AU_PHONE.test(text)) out.push('contains a phone number');
  return out;
}

/**
 * Spam Act 2003: a commercial message needs consent, must identify the sender, and must
 * offer a working unsubscribe. Returns the problems found, or an empty list.
 */
export function spamActProblems(m: { consented: boolean; body: string; sender?: string; unsubscribeUrl?: string }): string[] {
  const out: string[] = [];
  if (!m.consented) out.push('no consent to send');
  if (!m.sender || !m.body.includes(m.sender)) out.push('does not identify the sender');
  if (!m.unsubscribeUrl || !/^https:\/\//.test(m.unsubscribeUrl)) out.push('no working unsubscribe link');
  else if (!m.body.includes(m.unsubscribeUrl)) out.push('unsubscribe link is not in the message');
  return out;
}

/** A footer that identifies the sender and offers a one-step unsubscribe. */
export function messageFooter(sender: string, unsubscribeUrl: string, kind: 'email' | 'sms' = 'email'): string {
  return kind === 'sms' ? `${sender}. Opt out: ${unsubscribeUrl}` : `Sent by ${sender}. Unsubscribe any time: ${unsubscribeUrl}`;
}
