import type { AgeBand } from './types.js';

/**
 * Minors rules. These run before any other rule and are not configurable.
 * See the Children and Young People's Information Policy (CY-1 to CY-50).
 */
export interface AgeRules {
  /** May the child's own details be collected? */
  collectOwnDetails: boolean;
  /** Is parent or guardian confirmation required before any handoff? */
  requiresParentConfirmation: boolean;
  /** Only Verified youth partners may receive. */
  youthPartnersOnly: boolean;
  /** May AI features process this record? */
  aiAllowed: boolean;
  /** May the record appear in bulk views or exports? */
  bulkAllowed: boolean;
  isMinor: boolean;
}

export function rulesFor(band: AgeBand | undefined): AgeRules {
  // CY-1: no band given is treated as under 13.
  const b: AgeBand = band ?? 'under13';
  switch (b) {
    case 'under13':
      return { collectOwnDetails: false, requiresParentConfirmation: true, youthPartnersOnly: true, aiAllowed: false, bulkAllowed: false, isMinor: true };
    case '13-14':
      return { collectOwnDetails: true, requiresParentConfirmation: true, youthPartnersOnly: true, aiAllowed: false, bulkAllowed: false, isMinor: true };
    case '15-17':
      return { collectOwnDetails: true, requiresParentConfirmation: false, youthPartnersOnly: true, aiAllowed: false, bulkAllowed: false, isMinor: true };
    case '18+':
      return { collectOwnDetails: true, requiresParentConfirmation: false, youthPartnersOnly: false, aiAllowed: true, bulkAllowed: true, isMinor: false };
  }
}

/** CY-3: if there is reason to believe a stated age is wrong, the lower band applies. */
export function lowerBand(a: AgeBand, b: AgeBand): AgeBand {
  const order: AgeBand[] = ['under13', '13-14', '15-17', '18+'];
  return order[Math.min(order.indexOf(a), order.indexOf(b))]!;
}
