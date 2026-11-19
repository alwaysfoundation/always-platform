import type { AgeBand, ConsentRecord } from './types.js';
import { canProcess, type ConsentDecision } from './consent.js';
import { rulesFor } from './minors.js';

/**
 * Journeys across ministries (ADR 0012). A journey links one adult's responses through different
 * ministries, only with their `share.journey` consent. Reports never read journeys: they read the
 * de-identified tally (ADR 0003).
 */

/** Milestones the platform records from what happened. */
export const PLATFORM_MILESTONES = ['responded', 'introduced', 'accepted', 'contacted', 'connected'] as const;
/** Milestones counted only when the person tells us themselves. */
export const SELF_MILESTONES = ['baptised', 'in_group', 'serving', 'connected_12m'] as const;
export type SelfMilestone = (typeof SELF_MILESTONES)[number];
export type JourneyMilestone = (typeof PLATFORM_MILESTONES)[number] | SelfMilestone;

export const MILESTONE_LABEL: Record<JourneyMilestone, string> = {
  responded: 'Said yes to a next step',
  introduced: 'Introduced to a church or ministry',
  accepted: 'Welcomed by a church or ministry',
  contacted: 'First conversation',
  connected: 'Connected with a church family',
  baptised: 'Baptised',
  in_group: 'Joined a small group',
  serving: 'Serving',
  connected_12m: 'Still connected a year on',
};

/** May this response be linked into a journey? Adults only, with a current share.journey consent. Not configurable. */
export function canLinkJourney(consent: ConsentRecord | undefined, now?: Date): ConsentDecision {
  if (!consent) return { ok: false, reason: 'no_consent_record' };
  if (rulesFor(consent.ageBand).isMinor) return { ok: false, reason: 'minors_never_linked' };
  return canProcess(consent, 'share.journey', null, { now });
}

/** Normalise an Australian mobile to +614XXXXXXXX so the same number always links the same way. */
export function normaliseMobile(raw: string): string | null {
  const d = raw.replace(/[\s()-]/g, '');
  const m = /^(?:\+?61|0)(4\d{8})$/.exec(d);
  return m ? `+61${m[1]}` : null;
}

export interface JourneyEvent {
  milestone: JourneyMilestone;
  at: Date;
  /** True when the viewing ministry is the one this step happened with. */
  byViewer?: boolean;
}

/**
 * What a ministry may see of earlier steps: the milestone and the month, nothing else.
 * No names of other ministries, no notes, no exact dates. Sorted oldest first, one entry per milestone and month.
 */
export function journeyView(events: JourneyEvent[]): { milestone: JourneyMilestone; label: string; month: string; byYou: boolean }[] {
  const seen = new Set<string>();
  return [...events]
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .map((e) => ({ milestone: e.milestone, label: MILESTONE_LABEL[e.milestone], month: e.at.toISOString().slice(0, 7), byYou: !!e.byViewer }))
    .filter((e) => { const k = `${e.milestone}|${e.month}|${e.byYou}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

/** Withhold any count below the minimum group size (POLICY.minGroupSize). */
export function withhold(n: number, min: number): number | null {
  return n >= min ? n : null;
}

export function isAdult(band: AgeBand): boolean {
  return !rulesFor(band).isMinor;
}
