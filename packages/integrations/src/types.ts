import type { AgeBand, ConsentRecord, Handoff, Organisation, StepCategory } from '@always/core';

/**
 * The least a church needs to welcome someone into its own church management system.
 * Never faith details beyond the next step, never a street address, never notes.
 */
export interface HandoffPacket {
  responseId: string;
  orgId: string;
  ageBand: AgeBand;
  firstName: string;
  lastName?: string;
  email?: string;
  mobile?: string;
  postcode?: string;
  step: StepCategory;
  language?: string;
}

export type DataRegion = 'AU' | 'offshore';

export interface SyncContext {
  packet: HandoffPacket;
  consent: ConsentRecord | undefined;
  handoff: Handoff;
  org: Organisation;
  now: Date;
}

export type Gate = { ok: true } | { ok: false; reason: GateRefusal };

export type GateRefusal =
  | 'minor_not_synced'
  | 'consent_no_consent_record'
  | 'consent_withdrawn'
  | 'consent_expired'
  | 'consent_purpose_not_granted'
  | 'consent_parent_confirmation_required'
  | 'consent_child_assent_required'
  | 'consent_recipient_not_covered'
  | `consent_${string}`
  | 'not_accepted_by_org'
  | 'org_not_verified'
  | 'data_leaves_australia';

/** Where the church's records end up after a sync. Ids only, never personal data. */
export interface SyncResult {
  externalPersonId: string;
  pathway?: string;
  followUp?: string;
}

/** A church's own system. One instance per church, built from that church's encrypted settings. */
export interface ChmsConnector {
  readonly system: 'elvanto' | 'planning_center';
  /** Where this church's account keeps people's data. Offshore accounts are refused. */
  dataRegion(): DataRegion;
  createPerson(p: HandoffPacket): Promise<string>;
  addToPathway?(externalPersonId: string): Promise<string | undefined>;
  createFollowUp?(externalPersonId: string): Promise<string | undefined>;
}

export type Fetcher = typeof fetch;
