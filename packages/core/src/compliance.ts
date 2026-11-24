/**
 * Always Safety: the assessment engine.
 *
 * Pure functions, no I/O. Given the open obligations register, a ministry's profile,
 * its answers and what Always Platform already guarantees, produce an assessment:
 * which obligations apply, which are met, what needs attention, and what is coming.
 *
 * The engine never decides what the law says. It only applies obligations a named person
 * on the foundation team has published into the register. It is not legal advice.
 */

/** Countries and regions the register covers. GB is the United Kingdom; EU is EU-wide law. */
export type Country = 'AU' | 'US' | 'CA' | 'GB' | 'EU' | 'NZ';
export const COUNTRIES: readonly Country[] = ['AU', 'US', 'CA', 'GB', 'EU', 'NZ'];

/** Australian states and territories. */
export type Jurisdiction = 'NSW' | 'VIC' | 'QLD' | 'WA' | 'SA' | 'TAS' | 'ACT' | 'NT';
export const JURISDICTIONS: readonly Jurisdiction[] = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];

export type Area = 'privacy' | 'child_safety' | 'charity' | 'messages';

/** What a ministry tells us about itself. Organisation facts only, never people's details. */
export interface SafetyProfile {
  /** Where the ministry operates. Missing means Australia, for profiles saved before other countries were added. */
  countries?: Country[];
  /** Australian states and territories, when the ministry operates in Australia. */
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
  /** A registered charity or recognised tax-exempt nonprofit outside Australia. */
  registeredCharity?: boolean;
  /** A church, convention or association of churches (matters for US filing rules). */
  isChurch?: boolean;
}

/** @deprecated Use SafetyProfile. */
export type ComplianceProfile = SafetyProfile;

const BOOLEAN_FIELDS = ['collectsPersonalInfo', 'turnoverOver3m', 'providesHealthService', 'usesOverseasServices', 'worksWithChildren',
  'onlineServicesForChildren', 'sendsEmailOrSms', 'acncRegistered', 'basicReligiousCharity', 'acncMediumOrLarge', 'registeredCharity', 'isChurch'] as const;

/** Fill defaults so unanswered questions read as "no", and older profiles mean Australia. */
export function normaliseProfile(p: SafetyProfile): Required<SafetyProfile> {
  const out = { ...p } as Record<string, unknown>;
  for (const f of BOOLEAN_FIELDS) out[f] = p[f] === true;
  out.states = Array.isArray(p.states) ? p.states : [];
  out.countries = p.countries?.length ? [...new Set(p.countries)] : ['AU'];
  return out as Required<SafetyProfile>;
}

export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | { field: (typeof BOOLEAN_FIELDS)[number]; is: boolean }
  | { field: 'states' | 'countries'; includesAny: string[] };

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
  /** The country or region the obligation belongs to. Missing means Australia. */
  country?: Country;
  area: Area;
  /** Where in that country: national (CTH, US, CA, GB, EU, NZ), STATES for state-by-state rules, or one Australian state. */
  jurisdiction: 'CTH' | 'STATES' | Jurisdiction | Country;
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
export function holds(c: Condition | undefined, p: SafetyProfile): boolean {
  if (!c) return true;
  if ('all' in c) return c.all.every((x) => holds(x, p));
  if ('any' in c) return c.any.some((x) => holds(x, p));
  if ('not' in c) return !holds(c.not, p);
  if ('includesAny' in c) {
    if (c.field === 'states') return c.includesAny.some((s) => p.states.includes(s as Jurisdiction));
    if (c.field === 'countries') return c.includesAny.some((s) => (p.countries ?? ['AU']).includes(s as Country));
    return false;
  }
  if ('is' in c) return (p[c.field] === true) === c.is;
  return false;
}

/** Whether the obligation is a legal requirement for this ministry, or good practice. */
export function strengthOf(o: Obligation, p: SafetyProfile): AssessmentItem['strength'] {
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
export function assess(register: Register, input: SafetyProfile, answers: Answers, signals: PlatformSignals, asOf: Date): Assessment {
  const profile = normaliseProfile(input);
  const items: AssessmentItem[] = [];
  const watching: Assessment['watching'] = [];

  for (const o of register.obligations) {
    if (!profile.countries.includes(o.country ?? 'AU')) continue;
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
function lawFor(o: Obligation, p: SafetyProfile): LawRef[] {
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
/** JSON with sorted keys, so a stored copy (jsonb reorders keys) compares equal to the original. */
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`).join(',')}}`;
  return JSON.stringify(v) ?? 'null';
}

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
    if (stable(prev.appliesWhen) !== stable(o.appliesWhen) || stable(prev.requiredWhen) !== stable(o.requiredWhen)) what.push('who it applies to');
    if (stable(prev.evidence) !== stable(o.evidence)) what.push('what to show');
    if (prev.summary !== o.summary || prev.title !== o.title) what.push('wording');
    if (stable(prev.law) !== stable(o.law)) what.push('legal source');
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
    if (o.country && !COUNTRIES.includes(o.country)) problems.push(`${o.id}: unknown country ${o.country}`);
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
