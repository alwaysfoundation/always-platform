/**
 * Always Compliance: the assessment engine.
 *
 * Pure functions, no I/O. Given the open obligations register, a ministry's profile,
 * its answers and what Always Platform already guarantees, produce an assessment:
 * which obligations apply, which are met, what needs attention, and what is coming.
 *
 * The engine never decides what the law says. It only applies obligations a qualified
 * person has approved into the register (RFC 0003). It is not legal advice.
 */

export type Jurisdiction = 'NSW' | 'VIC' | 'QLD' | 'WA' | 'SA' | 'TAS' | 'ACT' | 'NT';
export const JURISDICTIONS: readonly Jurisdiction[] = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];

export type Area = 'privacy' | 'child_safety' | 'charity' | 'messages';

/** What a ministry tells us about itself. Organisation facts only, never people's details. */
export interface ComplianceProfile {
  states: Jurisdiction[];
  collectsPersonalInfo: boolean;
  turnoverOver3m: boolean;
  providesHealthService: boolean;
  usesOverseasServices: boolean;
  worksWithChildren: boolean;
  onlineServicesForChildren: boolean;
  sendsEmailOrSms: boolean;
  acncRegistered: boolean;
  basicReligiousCharity: boolean;
  acncMediumOrLarge: boolean;
}

export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | { field: keyof ComplianceProfile; is: boolean }
  | { field: 'states'; includesAny: string[] };

/** Checks Always Platform can vouch for itself, because it enforces them in code. */
export type PlatformCheck = 'consent_records' | 'access_controls' | 'retention_schedule' | 'data_in_australia' | 'minors_rules';

export interface Evidence {
  id: string;
  kind: 'question' | 'document' | 'platform';
  prompt: string;
  check?: PlatformCheck;
  /** Ask only when this holds (for example, a financial report only for medium or large charities). */
  onlyWhen?: Condition;
}

export interface LawRef {
  name: string;
  url: string;
  jurisdiction?: Jurisdiction;
}

export interface Obligation {
  id: string;
  area: Area;
  jurisdiction: 'CTH' | 'STATES' | Jurisdiction;
  title: string;
  summary: string;
  law: LawRef[];
  status: 'in_force' | 'upcoming' | 'watch';
  commences?: string;
  appliesWhen: Condition;
  /** When the obligation is a legal requirement. Absent: required whenever it applies. */
  requiredWhen?: Condition;
  /** Good practice only, never a legal requirement in this register. */
  recommendedOnly?: boolean;
  evidence: Evidence[];
  guidance: string;
  confidence: 'reviewed' | 'draft' | 'verify';
}

export interface Register {
  name: string;
  version: string;
  status: 'draft' | 'reviewed';
  asOf: string;
  notice: string;
  obligations: Obligation[];
}

export type Answer = 'yes' | 'no' | 'unsure' | 'not_applicable';
export type Answers = Record<string, Answer | undefined>;
export type PlatformSignals = Partial<Record<PlatformCheck, boolean>>;

export type ItemStatus = 'met' | 'attention' | 'check' | 'upcoming';

export interface AssessmentItem {
  obligationId: string;
  area: Area;
  title: string;
  summary: string;
  strength: 'required' | 'recommended';
  status: ItemStatus;
  /** Evidence not yet shown (answered "no"). */
  missing: string[];
  /** Evidence not yet answered, or answered "unsure". */
  unanswered: string[];
  law: LawRef[];
  guidance: string;
  commences?: string;
}

export interface Assessment {
  asOf: string;
  registerVersion: string;
  registerStatus: Register['status'];
  items: AssessmentItem[];
  watching: { obligationId: string; title: string; summary: string }[];
  summary: { required: number; met: number; attention: number; check: number; upcoming: number };
  notice: string;
}

/** Evaluate a condition against a profile. Unknown shapes fail closed (false). */
export function holds(c: Condition | undefined, p: ComplianceProfile): boolean {
  if (!c) return true;
  if ('all' in c) return c.all.every((x) => holds(x, p));
  if ('any' in c) return c.any.some((x) => holds(x, p));
  if ('not' in c) return !holds(c.not, p);
  if ('includesAny' in c) return c.field === 'states' && c.includesAny.some((s) => p.states.includes(s as Jurisdiction));
  if ('is' in c) return (p[c.field] as unknown) === c.is;
  return false;
}

/** Whether the obligation is a legal requirement for this ministry, or good practice. */
export function strengthOf(o: Obligation, p: ComplianceProfile): AssessmentItem['strength'] {
  if (o.recommendedOnly) return 'recommended';
  return holds(o.requiredWhen, p) ? 'required' : 'recommended';
}

function evidenceStatus(e: Evidence, answers: Answers, signals: PlatformSignals): 'ok' | 'missing' | 'unanswered' {
  if (e.kind === 'platform') return e.check && signals[e.check] ? 'ok' : answer(answers[e.id]);
  return answer(answers[e.id]);
}

function answer(a: Answer | undefined): 'ok' | 'missing' | 'unanswered' {
  if (a === 'yes' || a === 'not_applicable') return 'ok';
  if (a === 'no') return 'missing';
  return 'unanswered';
}

const ORDER: Record<ItemStatus, number> = { attention: 0, check: 1, upcoming: 2, met: 3 };

/** The assessment for one ministry, as of a date. Deterministic: same inputs, same output. */
export function assess(register: Register, profile: ComplianceProfile, answers: Answers, signals: PlatformSignals, asOf: Date): Assessment {
  const items: AssessmentItem[] = [];
  const watching: Assessment['watching'] = [];

  for (const o of register.obligations) {
    if (!holds(o.appliesWhen, profile)) continue;
    if (o.status === 'watch') {
      watching.push({ obligationId: o.id, title: o.title, summary: o.summary });
      continue;
    }
    const relevant = o.evidence.filter((e) => holds(e.onlyWhen, profile));
    const missing: string[] = [];
    const unanswered: string[] = [];
    for (const e of relevant) {
      const s = evidenceStatus(e, answers, signals);
      if (s === 'missing') missing.push(e.prompt);
      if (s === 'unanswered') unanswered.push(e.prompt);
    }
    const notYet = o.status === 'upcoming' && (!o.commences || new Date(`${o.commences}T00:00:00+10:00`) > asOf);
    const status: ItemStatus = notYet ? 'upcoming' : missing.length ? 'attention' : unanswered.length ? 'check' : 'met';
    items.push({
      obligationId: o.id,
      area: o.area,
      title: o.title,
      summary: o.summary,
      strength: strengthOf(o, profile),
      status,
      missing,
      unanswered,
      law: lawFor(o, profile),
      guidance: o.guidance,
      commences: o.commences,
    });
  }

  items.sort((a, b) => ORDER[a.status] - ORDER[b.status] || (a.strength === b.strength ? 0 : a.strength === 'required' ? -1 : 1));
  const count = (s: ItemStatus) => items.filter((i) => i.status === s).length;
  return {
    asOf: asOf.toISOString().slice(0, 10),
    registerVersion: register.version,
    registerStatus: register.status,
    items,
    watching,
    summary: { required: items.filter((i) => i.strength === 'required').length, met: count('met'), attention: count('attention'), check: count('check'), upcoming: count('upcoming') },
    notice: register.notice,
  };
}

/** For state-by-state obligations, show only the laws for the states the ministry works in. */
function lawFor(o: Obligation, p: ComplianceProfile): LawRef[] {
  if (o.jurisdiction !== 'STATES') return o.law;
  const local = o.law.filter((l) => !l.jurisdiction || p.states.includes(l.jurisdiction));
  return local.length ? local : o.law;
}

export interface RegisterChange {
  obligationId: string;
  title: string;
  change: 'added' | 'changed' | 'removed';
  /** Which parts changed, in plain words. */
  what: string[];
}

/** What changed between two register versions: the "what changed this quarter" feed. */
export function diffRegisters(before: Register, after: Register): RegisterChange[] {
  const old = new Map(before.obligations.map((o) => [o.id, o]));
  const now = new Map(after.obligations.map((o) => [o.id, o]));
  const out: RegisterChange[] = [];
  for (const o of after.obligations) {
    const prev = old.get(o.id);
    if (!prev) {
      out.push({ obligationId: o.id, title: o.title, change: 'added', what: [] });
      continue;
    }
    const what: string[] = [];
    if (prev.status !== o.status) what.push(`status: ${prev.status} to ${o.status}`);
    if (prev.commences !== o.commences) what.push('start date');
    if (JSON.stringify(prev.appliesWhen) !== JSON.stringify(o.appliesWhen) || JSON.stringify(prev.requiredWhen) !== JSON.stringify(o.requiredWhen)) what.push('who it applies to');
    if (JSON.stringify(prev.evidence) !== JSON.stringify(o.evidence)) what.push('what to show');
    if (prev.summary !== o.summary || prev.title !== o.title) what.push('wording');
    if (JSON.stringify(prev.law) !== JSON.stringify(o.law)) what.push('legal source');
    if (what.length) out.push({ obligationId: o.id, title: o.title, change: 'changed', what });
  }
  for (const o of before.obligations) if (!now.has(o.id)) out.push({ obligationId: o.id, title: o.title, change: 'removed', what: [] });
  return out;
}

/** Calendar quarter in Sydney time, for example "2026-Q4". */
export function quarterOf(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', year: 'numeric', month: 'numeric' }).formatToParts(d);
  const year = Number(parts.find((x) => x.type === 'year')!.value);
  const month = Number(parts.find((x) => x.type === 'month')!.value);
  return `${year}-Q${Math.floor((month - 1) / 3) + 1}`;
}

/** Problems with a register that would make assessments unreliable. Empty means usable. */
export function validateRegister(r: Register): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  const evidenceIds = new Set<string>();
  for (const o of r.obligations) {
    if (ids.has(o.id)) problems.push(`duplicate obligation ${o.id}`);
    ids.add(o.id);
    if (!o.law.length) problems.push(`${o.id}: no legal source`);
    for (const l of o.law) if (!/^https:\/\//.test(l.url)) problems.push(`${o.id}: source must be https`);
    if (o.status === 'upcoming' && !o.commences) problems.push(`${o.id}: upcoming without a start date`);
    for (const e of o.evidence) {
      if (evidenceIds.has(e.id)) problems.push(`duplicate evidence ${e.id}`);
      evidenceIds.add(e.id);
      if (e.kind === 'platform' && !e.check) problems.push(`${e.id}: platform evidence needs a check`);
    }
  }
  return problems;
}
