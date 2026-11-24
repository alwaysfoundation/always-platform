/**
 * Core domain types for the Always network.
 * Shapes follow the Always Handoff standard (spec/schemas). Restricted fields
 * are marked; they are field-encrypted at rest and never logged.
 */

export type AgeBand = 'under13' | '13-14' | '15-17' | '18+';

export type StepCategory =
  | 'church' // Sunday welcome / find a church
  | 'explore' // discovery course
  | 'talk' // a conversation
  | 'youth' // youth group
  | 'group' // small group
  | 'help' // practical help
  | 'read'; // reading plan (always-available fallback)

export type ConsentPurpose = 'connect.church' | 'notify.sender' | 'resources' | 'stats.anonymous';

export type ConsentingParty = 'self' | 'parent';

export interface ConsentRecord {
  id: string;
  responseId: string;
  purposes: ConsentPurpose[];
  /** Organisation ids the person agreed may receive their details. '*nearby' = the next suitable nearby church. */
  recipients: string[];
  allowNextNearby: boolean;
  wordingVersion: string;
  party: ConsentingParty;
  ageBand: AgeBand;
  collectedAt: Date;
  withdrawnAt?: Date;
  /** For under-15s: when a parent or guardian confirmed. */
  parentConfirmedAt?: Date;
  /** For under-15s: when the child agreed too (CY rules). A parent's yes alone is not enough. */
  childAssentAt?: Date;
  /** Consent lapses 12 months after it was given unless renewed. Defaults to collectedAt + 12 months. */
  expiresAt?: Date;
}

export type TrustLevel = 'listed' | 'claimed' | 'verified' | 'verified_youth';

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface Organisation {
  id: string;
  displayName: string;
  trustLevel: TrustLevel;
  location: GeoPoint;
  areaRadiusKm: number;
  offers: StepCategory[];
  languages: string[];
  monthlyCapacity: number;
  receivedThisMonth: number;
  pausedUntil?: Date;
  /** Last time the church re-confirmed its profile and capacity (directory freshness). */
  lastConfirmedAt: Date;
  /** Recent median minutes to accept, used to reward speed in ranking. */
  medianAcceptMinutes?: number;
  currentOpenOffers: number;
}

export interface ResponseRecord {
  id: string;
  createdAt: Date;
  ageBand: AgeBand;
  step: StepCategory;
  /** Restricted: approximate location from suburb or postcode, never a street address. */
  location: GeoPoint;
  language?: string;
}

export type OfferOutcome = 'pending' | 'accepted' | 'passed' | 'expired' | 'returned';

export type PassReason = 'capacity' | 'language' | 'fit' | 'safeguarding' | 'other';

export interface Offer {
  orgId: string;
  offeredAt: Date;
  deadline: Date;
  outcome: OfferOutcome;
  decidedAt?: Date;
  passReason?: PassReason;
}

export type HandoffState =
  | 'awaiting_parent' // under-15: waiting for parent or guardian confirmation
  | 'routing' // looking for the next church
  | 'offered' // one church holds the offer
  | 'accepted' // church accepted; first contact due
  | 'contacted' // first contact made
  | 'care_team' // network care team holds the person
  | 'closed' // person-confirmed connection or other closure
  | 'withdrawn'; // person withdrew; deletion scheduled

export interface Handoff {
  id: string;
  responseId: string;
  createdAt: Date;
  ageBand: AgeBand;
  state: HandoffState;
  offers: Offer[];
  careHelloAt?: Date;
  acceptedAt?: Date;
  firstContactAt?: Date;
  /** Person confirmed they are connected (the only thing that counts as "connected"). */
  personConfirmedConnectedAt?: Date;
  /** First visit made with a named companion ("a friend at the door"). */
  companionNamed?: boolean;
}

export type EngineAction =
  | { kind: 'offer'; orgId: string; deadline: Date }
  | { kind: 'remind'; orgId: string }
  | { kind: 'expire'; orgId: string }
  | { kind: 'care.hello' }
  | { kind: 'care.assign'; reason: 'no_match' | 'max_offers' | 'network_ceiling' | 'first_contact_overdue' }
  | { kind: 'first_contact.overdue'; orgId: string }
  | { kind: 'parent.expired' };
