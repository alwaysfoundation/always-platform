/**
 * Always Safety for products: assess a ministry's app or website, not just the ministry.
 *
 * The organisation check-up (compliance.ts) asks a ministry about itself. This asks a product team
 * to describe what their product does, as a profile: what it collects and from whom, who can see
 * it, how long it is kept, which services touch it, what it lets people do, and what its own
 * privacy policy and terms promise. The engine compares that profile against an open register of
 * product rules for each country, plus the app stores' rules, and reports gaps with
 * recommendations.
 *
 * Pure and deterministic, no I/O. A profile describes a product, never a person: it holds no
 * personal information. Missing facts are never assumed to be fine: a rule whose facts are unknown
 * is reported as needing information, not as met (fail closed).
 *
 * It applies only rules a named person on the foundation team has published. It is not legal
 * advice, and each ministry remains responsible for its own legal advice and decisions.
 */
import type { Country, LawRef } from './compliance.js';

// ---------------------------------------------------------------------------------------------
// The product profile
// ---------------------------------------------------------------------------------------------

export type Surface = 'website' | 'web_app' | 'mobile_app';
export type DataCategory =
  | 'contact'
  | 'identity'
  | 'date_of_birth'
  | 'location'
  | 'faith'
  | 'health'
  | 'photo'
  | 'user_content'
  | 'device'
  | 'usage';
export type DataSubject = 'adult' | 'minor' | 'third_party' | 'third_party_minor';
export type Audience = 'self' | 'leaders' | 'group' | 'members' | 'public' | 'staff';

/** One kind of information the product holds. Describes a field, never anyone's value. */
export interface DataItem {
  id: string;
  category: DataCategory;
  /** Whose information it is. A third party is someone the user tells the product about. */
  subjects: DataSubject[];
  purpose: string;
  /** Who in the product can see it. */
  visibleTo: Audience[];
  /** How long it is kept, in plain words or ISO 8601 ("P2Y"), or null when no rule is set. */
  retention: string | null;
  /** How agreement is given: express (asked for, opt-in), implied, or none. */
  consent?: 'express' | 'implied' | 'none';
}

export interface Processor {
  name: string;
  purpose: string;
  /** Where it stores or processes the information (ISO country code, or "multiple"). */
  country: string;
  /** A signed data processing agreement or equivalent terms. */
  dpa: boolean | null;
}

/** What the product's privacy policy and terms say. Compared against what the product does. */
export interface PolicyClaims {
  selfServiceDeletion?: boolean;
  /** The policy says the website uses cookies for analytics. */
  analyticsCookies?: boolean;
  minAge?: number | null;
  parentalPermissionUnder18?: boolean;
  /** Which of the product's surfaces the documents name. */
  surfacesNamed?: Surface[];
  /** Countries whose law the documents are written for. */
  countriesAddressed?: Country[];
  overseasDisclosure?: boolean;
  retentionStated?: boolean;
  automatedDecisionsExplained?: boolean;
  childFriendlyNotice?: boolean;
}

export interface ProductProfile {
  name: string;
  surfaces: Surface[];
  countries: Country[];
  /** US states the product serves, as postal codes, when it serves the US. Leave it out until known. */
  usStates?: string[];
  appStores?: ('apple' | 'google')[];
  audience: {
    /** The youngest age that may hold an account, or null when there is no rule. */
    minAge: number | null;
    /** Under-18s can use the product. */
    under18: boolean;
    /** How under-13s take part: not at all, through an adult (leaders add them), or with their own account. */
    under13: 'none' | 'via_adult' | 'own_accounts';
    /** The product is partly aimed at children (for example kids ministries), even if accounts are 13+. */
    partlyAimedAtChildren?: boolean;
  };
  accounts: {
    creation: boolean;
    selfServiceDeletion: { web: boolean; app: boolean };
    /** A web page where anyone can request deletion of their account and data. */
    deletionWebLink: boolean;
    socialSignIn?: ('apple' | 'google')[];
    /** Revokes Sign in with Apple tokens when an account is deleted. */
    revokesAppleTokens?: boolean;
  };
  ageAssurance: {
    method: 'none' | 'self_declared' | 'estimated' | 'verified';
    /** Asked neutrally (no default or hint that steers people to an older age). */
    neutral?: boolean;
    /** Checked on the server, not only in the page. */
    enforcedServerSide?: boolean;
  };
  parentalConsent: {
    /** How permission is obtained for under-18s, if at all. */
    under18: 'none' | 'attestation' | 'leader_attests' | 'verified';
    /** Verifiable parental consent for under-13s (COPPA), if collected. */
    under13: 'none' | 'verified';
    /** Separate consent before under-13s' information goes to third parties. */
    separateForThirdParties?: boolean;
  };
  data: DataItem[];
  processors: Processor[];
  social: {
    feed: boolean;
    userPosts: boolean;
    /** Likes, comments, follows or similar between users. */
    userInteraction: boolean;
    recommender: boolean;
    endlessFeed: boolean;
    directMessaging: boolean;
    /** An exclusion the team believes applies under Australia's social media minimum age rules, with advice. */
    auExclusionClaimed?: 'messaging' | 'gaming' | 'education' | 'health' | 'professional' | 'product_info' | null;
  };
  publicDisplay: { names: boolean; photos: boolean; minorsNamesOrPhotos: boolean };
  tracking: {
    cookies: 'none' | 'essential' | 'analytics' | 'advertising';
    analytics: 'none' | 'cookieless' | 'cookies';
    ads: boolean;
    sessionRecording: boolean;
    preciseLocation: boolean;
  };
  messaging: { marketing: boolean; marketingOnByDefault: boolean; unsubscribe: boolean; push: boolean; sms: boolean };
  moderation: { publicContentPreModerated: boolean; reporting: boolean };
  ai: { onMinorsData: boolean; onUserContent: boolean; automatedDecisions: boolean };
  security: {
    encryptionInTransit: boolean;
    encryptionAtRest: boolean;
    roleBasedAccess: boolean;
    breachResponsePlan: boolean;
    writtenSecurityProgram: boolean;
    writtenRetentionPolicy: boolean;
  };
  policies: { privacyPolicy: boolean; terms: boolean; claims: PolicyClaims };
  /** For US state laws with thresholds: the team has checked whether the product meets them. */
  usThresholdsReviewed?: boolean;
}

// ---------------------------------------------------------------------------------------------
// Conditions: small, declarative, three-valued
// ---------------------------------------------------------------------------------------------

/**
 * A condition on the profile. Paths are dotted ("accounts.creation"). `some` and `none` test each
 * item of an array (paths inside are relative to the item). Unknown shapes evaluate to false.
 */
export type ProductCondition =
  | { all: ProductCondition[] }
  | { any: ProductCondition[] }
  | { not: ProductCondition }
  | { path: string; is: boolean | string | number | null }
  | { path: string; in: (string | number)[] }
  | { path: string; includesAny: string[] }
  | { path: string; includesAll: string[] }
  | { path: string; lt: number }
  | { path: string; gte: number }
  | { path: string; some: ProductCondition }
  | { path: string; none: ProductCondition }
  | { path: string; known: true }
  /** Equal to the value at another path of the same object. */
  | { path: string; equalsPath: string }
  /** An array containing every item of the array at another path. */
  | { path: string; includesAllAt: string };

/** True, false, or unknown because the profile doesn't say. */
export type Tri = true | false | 'unknown';

function get(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const key of path.split('.')) {
    if (cur === null || typeof cur !== 'object' || !(key in (cur as Record<string, unknown>))) return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

const and = (xs: Tri[]): Tri => (xs.includes(false) ? false : xs.includes('unknown') ? 'unknown' : true);
const or = (xs: Tri[]): Tri => (xs.includes(true) ? true : xs.includes('unknown') ? 'unknown' : false);
const not = (x: Tri): Tri => (x === 'unknown' ? 'unknown' : !x);

/** Evaluate a condition. A missing fact is unknown, never false and never true. */
export function evaluate(c: ProductCondition, ctx: unknown): Tri {
  if (!c || typeof c !== 'object') return false;
  if ('all' in c) return Array.isArray(c.all) ? and(c.all.map((x) => evaluate(x, ctx))) : false;
  if ('any' in c) return Array.isArray(c.any) ? or(c.any.map((x) => evaluate(x, ctx))) : false;
  if ('not' in c) return not(evaluate(c.not, ctx));
  if (!('path' in c) || typeof c.path !== 'string') return false;
  const v = get(ctx, c.path);
  if ('known' in c) return v !== undefined;
  if (v === undefined) return 'unknown';
  if ('equalsPath' in c) {
    const other = get(ctx, c.equalsPath);
    return other === undefined ? 'unknown' : v === other;
  }
  if ('includesAllAt' in c) {
    const other = get(ctx, c.includesAllAt);
    if (other === undefined) return 'unknown';
    return Array.isArray(v) && Array.isArray(other) ? other.every((x) => v.includes(x)) : false;
  }
  if ('is' in c) return v === c.is;
  if ('in' in c) return Array.isArray(c.in) && c.in.includes(v as string | number);
  if ('lt' in c) return v === null ? 'unknown' : typeof v === 'number' ? v < c.lt : false;
  if ('gte' in c) return v === null ? 'unknown' : typeof v === 'number' ? v >= c.gte : false;
  if ('includesAny' in c) return Array.isArray(v) ? c.includesAny.some((x) => v.includes(x)) : false;
  if ('includesAll' in c) return Array.isArray(v) ? c.includesAll.every((x) => v.includes(x)) : false;
  if ('some' in c) return Array.isArray(v) ? or(v.map((item) => evaluate(c.some, item))) : false;
  if ('none' in c) return Array.isArray(v) ? not(or(v.map((item) => evaluate(c.none, item)))) : false;
  return false;
}

// ---------------------------------------------------------------------------------------------
// The product rules register
// ---------------------------------------------------------------------------------------------

export type RuleKind = 'law' | 'platform_rule' | 'good_practice';
export type Severity = 'high' | 'medium' | 'low';

export interface ProductRule {
  id: string;
  /** A country, or ALL for app store rules and good practice that apply everywhere. */
  country: Country | 'ALL';
  kind: RuleKind;
  area: 'privacy' | 'children' | 'messages' | 'security' | 'accounts' | 'transparency';
  title: string;
  summary: string;
  law: LawRef[];
  status: 'in_force' | 'upcoming' | 'watch';
  commences?: string;
  /** When the rule applies to this product. */
  appliesWhen: ProductCondition;
  /** What the product must do. A rule that applies and isn't met is a gap. */
  meets: ProductCondition;
  severity: Severity;
  recommendation: string;
  confidence: 'reviewed' | 'draft' | 'verify';
}

export interface ProductRegister {
  name: string;
  version: string;
  status: 'draft' | 'reviewed';
  asOf: string;
  notice: string;
  rules: ProductRule[];
}

// ---------------------------------------------------------------------------------------------
// The assessment
// ---------------------------------------------------------------------------------------------

export type FindingStatus = 'gap' | 'needs_info' | 'met' | 'upcoming_gap' | 'upcoming_met';

export interface Finding {
  ruleId: string;
  country: ProductRule['country'];
  kind: RuleKind;
  area: ProductRule['area'];
  title: string;
  summary: string;
  status: FindingStatus;
  severity: Severity;
  recommendation: string;
  law: LawRef[];
  confidence: ProductRule['confidence'];
  commences?: string;
  /** Profile facts the rule needed but the profile doesn't give. */
  missingFacts: string[];
}

export interface ProductAssessment {
  product: string;
  asOf: string;
  registerVersion: string;
  registerStatus: ProductRegister['status'];
  findings: Finding[];
  watching: { ruleId: string; country: ProductRule['country']; title: string; summary: string }[];
  summary: { gaps: number; high: number; needsInfo: number; met: number; upcoming: number };
  notice: string;
}

const STATUS_ORDER: Record<FindingStatus, number> = { gap: 0, needs_info: 1, upcoming_gap: 2, upcoming_met: 3, met: 4 };
const SEVERITY_ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

/** Dotted paths a condition reads, for telling a team which facts to add. */
export function pathsOf(c: ProductCondition, prefix = ''): string[] {
  if (!c || typeof c !== 'object') return [];
  if ('all' in c) return c.all.flatMap((x) => pathsOf(x, prefix));
  if ('any' in c) return c.any.flatMap((x) => pathsOf(x, prefix));
  if ('not' in c) return pathsOf(c.not, prefix);
  if (!('path' in c)) return [];
  const here = prefix ? `${prefix}.${c.path}` : c.path;
  if ('equalsPath' in c) return [here, prefix ? `${prefix}.${c.equalsPath}` : c.equalsPath];
  if ('includesAllAt' in c) return [here, prefix ? `${prefix}.${c.includesAllAt}` : c.includesAllAt];
  if ('some' in c) return [here, ...pathsOf(c.some, `${here}[]`)];
  if ('none' in c) return [here, ...pathsOf(c.none, `${here}[]`)];
  return [here];
}

function missingFacts(c: ProductCondition, profile: ProductProfile): string[] {
  return [...new Set(pathsOf(c).filter((p) => !p.includes('[]') && get(profile, p) === undefined))];
}

function inScope(rule: ProductRule, profile: ProductProfile): boolean {
  return rule.country === 'ALL' || profile.countries.includes(rule.country);
}

/**
 * Assess a product, as of a date. Deterministic: the same inputs give the same output.
 * An applicability that is unknown counts as applying (fail closed).
 */
export function assessProduct(register: ProductRegister, profile: ProductProfile, asOf: Date): ProductAssessment {
  const findings: Finding[] = [];
  const watching: ProductAssessment['watching'] = [];

  for (const rule of register.rules) {
    if (!inScope(rule, profile)) continue;
    const applies = evaluate(rule.appliesWhen, profile);
    if (applies === false) continue;
    if (rule.status === 'watch') {
      watching.push({ ruleId: rule.id, country: rule.country, title: rule.title, summary: rule.summary });
      continue;
    }
    const meets = evaluate(rule.meets, profile);
    const notYet = rule.status === 'upcoming' && (!rule.commences || new Date(`${rule.commences}T00:00:00Z`) > asOf);
    let status: FindingStatus;
    if (applies === 'unknown' || meets === 'unknown') status = notYet ? 'upcoming_gap' : 'needs_info';
    else if (meets) status = notYet ? 'upcoming_met' : 'met';
    else status = notYet ? 'upcoming_gap' : 'gap';
    findings.push({
      ruleId: rule.id,
      country: rule.country,
      kind: rule.kind,
      area: rule.area,
      title: rule.title,
      summary: rule.summary,
      status,
      severity: rule.severity,
      recommendation: rule.recommendation,
      law: rule.law,
      confidence: rule.confidence,
      commences: rule.commences,
      missingFacts: [...new Set([...missingFacts(rule.appliesWhen, profile), ...missingFacts(rule.meets, profile)])],
    });
  }

  findings.sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      a.ruleId.localeCompare(b.ruleId),
  );
  const count = (...s: FindingStatus[]) => findings.filter((f) => s.includes(f.status)).length;
  return {
    product: profile.name,
    asOf: asOf.toISOString().slice(0, 10),
    registerVersion: register.version,
    registerStatus: register.status,
    findings,
    watching,
    summary: {
      gaps: count('gap'),
      high: findings.filter((f) => f.status === 'gap' && f.severity === 'high').length,
      needsInfo: count('needs_info'),
      met: count('met'),
      upcoming: count('upcoming_gap', 'upcoming_met'),
    },
    notice: register.notice,
  };
}

// ---------------------------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------------------------

const RULE_COUNTRIES = ['AU', 'US', 'CA', 'GB', 'EU', 'NZ', 'ALL'];

function conditionProblems(c: unknown, where: string): string[] {
  if (!c || typeof c !== 'object') return [`${where}: condition must be an object`];
  const o = c as Record<string, unknown>;
  if ('all' in o || 'any' in o) {
    const list = (o.all ?? o.any) as unknown;
    if (!Array.isArray(list) || list.length === 0) return [`${where}: all/any needs a non-empty list`];
    return list.flatMap((x, i) => conditionProblems(x, `${where}[${i}]`));
  }
  if ('not' in o) return conditionProblems(o.not, `${where}.not`);
  if (typeof o.path !== 'string' || !o.path) return [`${where}: unknown condition shape`];
  const ops = ['is', 'in', 'includesAny', 'includesAll', 'lt', 'gte', 'some', 'none', 'known', 'equalsPath', 'includesAllAt'].filter((k) => k in o);
  if (ops.length !== 1) return [`${where}: a path condition needs exactly one operator`];
  if ('some' in o) return conditionProblems(o.some, `${where}.some`);
  if ('none' in o) return conditionProblems(o.none, `${where}.none`);
  return [];
}

/** Problems with a product register that would make assessments unreliable. Empty means usable. */
export function validateProductRegister(r: ProductRegister): string[] {
  const problems: string[] = [];
  if (!/not legal advice/i.test(r.notice ?? '')) problems.push('notice must say it is not legal advice');
  const ids = new Set<string>();
  for (const rule of r.rules ?? []) {
    if (ids.has(rule.id)) problems.push(`duplicate rule ${rule.id}`);
    ids.add(rule.id);
    if (!RULE_COUNTRIES.includes(rule.country)) problems.push(`${rule.id}: unknown country ${rule.country}`);
    if (!rule.law?.length) problems.push(`${rule.id}: no source`);
    for (const l of rule.law ?? []) if (!/^https:\/\//.test(l.url)) problems.push(`${rule.id}: source must be https`);
    if (rule.status === 'upcoming' && !/^\d{4}-\d{2}-\d{2}$/.test(rule.commences ?? '')) problems.push(`${rule.id}: upcoming without a start date`);
    if (rule.kind === 'law' && rule.country === 'ALL') problems.push(`${rule.id}: a law belongs to a country`);
    if (!rule.recommendation?.trim()) problems.push(`${rule.id}: no recommendation`);
    problems.push(...conditionProblems(rule.appliesWhen, `${rule.id}.appliesWhen`));
    problems.push(...conditionProblems(rule.meets, `${rule.id}.meets`));
  }
  return problems;
}

/** Numbers starting with + or 0 and 9 to 13 digits long (0412 345 678, +61 2 9999 9999). Dates don't match. */
const PHONE_AU_INTL = /(?:^|[^\d])(?:\+\d{1,3}|0)[\s-]?\d(?:[\s-]?\d){7,11}(?!\d)/;
/** North American numbers: (555) 123-4567, 555-123-4567. */
const PHONE_US = /\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/;

/**
 * Problems with a product profile. A profile must describe a product, so values that look like
 * a person's details (an email address or phone number) are refused.
 */
export function validateProductProfile(p: unknown): string[] {
  const problems: string[] = [];
  if (!p || typeof p !== 'object') return ['profile must be an object'];
  const profile = p as Partial<ProductProfile>;
  if (!profile.name) problems.push('name is required');
  if (!Array.isArray(profile.countries) || profile.countries.length === 0) problems.push('countries is required');
  for (const c of profile.countries ?? []) if (!RULE_COUNTRIES.includes(c) || c === ('ALL' as Country)) problems.push(`unknown country ${c}`);
  if (!Array.isArray(profile.data)) problems.push('data must be a list (it can be empty)');
  const ids = new Set<string>();
  for (const d of profile.data ?? []) {
    if (ids.has(d.id)) problems.push(`duplicate data item ${d.id}`);
    ids.add(d.id);
  }
  const text = JSON.stringify(p);
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text)) problems.push('contains an email address: a profile describes a product, never a person');
  if (PHONE_AU_INTL.test(text) || PHONE_US.test(text)) problems.push('contains a phone number: a profile describes a product, never a person');
  return problems;
}

// ---------------------------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------------------------

const STATUS_LABEL: Record<FindingStatus, string> = {
  gap: 'Gap',
  needs_info: 'Needs information',
  upcoming_gap: 'Coming: not ready yet',
  upcoming_met: 'Coming: ready',
  met: 'Met',
};
const KIND_LABEL: Record<RuleKind, string> = { law: 'Law', platform_rule: 'App store rule', good_practice: 'Good practice' };

/** A plain-English Markdown report a team can read or post on a pull request. */
export function productReportMarkdown(a: ProductAssessment): string {
  const lines: string[] = [];
  lines.push(`# Always Safety product check: ${a.product}`);
  lines.push('');
  lines.push(`As of ${a.asOf}, register ${a.registerVersion} (${a.registerStatus}).`);
  lines.push('');
  lines.push(`**${a.summary.gaps} gaps** (${a.summary.high} high), ${a.summary.needsInfo} need information, ${a.summary.upcoming} coming, ${a.summary.met} met.`);
  lines.push('');
  for (const status of ['gap', 'needs_info', 'upcoming_gap', 'upcoming_met', 'met'] as FindingStatus[]) {
    const group = a.findings.filter((f) => f.status === status);
    if (!group.length) continue;
    lines.push(`## ${STATUS_LABEL[status]} (${group.length})`);
    lines.push('');
    for (const f of group) {
      const tag = status === 'met' || status === 'upcoming_met' ? '' : ` · ${f.severity}`;
      lines.push(`### ${f.title}`);
      lines.push('');
      lines.push(`${f.country === 'ALL' ? 'Everywhere' : f.country} · ${KIND_LABEL[f.kind]}${tag}${f.commences ? ` · from ${f.commences}` : ''}${f.confidence !== 'reviewed' ? ` · ${f.confidence}` : ''}`);
      lines.push('');
      lines.push(f.summary);
      if (status !== 'met' && status !== 'upcoming_met') {
        lines.push('');
        lines.push(`**What to do:** ${f.recommendation}`);
      }
      if (f.missingFacts.length && status !== 'met') {
        lines.push('');
        lines.push(`**Facts to add to the profile:** ${f.missingFacts.map((m) => `\`${m}\``).join(', ')}`);
      }
      lines.push('');
      lines.push(`Source: ${f.law.map((l) => `[${l.name}](${l.url})`).join('; ')}`);
      lines.push('');
    }
  }
  if (a.watching.length) {
    lines.push(`## Watching (${a.watching.length})`);
    lines.push('');
    for (const w of a.watching) lines.push(`- **${w.title}** (${w.country === 'ALL' ? 'everywhere' : w.country}): ${w.summary}`);
    lines.push('');
  }
  lines.push('---');
  lines.push('');
  lines.push(a.notice);
  return `${lines.join('\n')}\n`;
}
