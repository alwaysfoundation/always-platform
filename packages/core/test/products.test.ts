import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  assessProduct,
  evaluate,
  hasEmailAddress,
  pathsOf,
  productReportMarkdown,
  validateProductProfile,
  validateProductRegister,
  type ProductProfile,
  type ProductRegister,
  type ProductRule,
} from '../src/products.js';

const read = <T>(rel: string) => JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')) as T;
const register = read<ProductRegister>('../../../spec/safety/product-register.json');
/** A synthetic youth campaign app with typical gaps. Describes a product, never a person. */
const example = read<ProductProfile>('../../../spec/safety/examples/youth-campaign-app.profile.json');

const day = new Date('2026-11-27T01:00:00Z');
const afterCode = new Date('2026-12-11T01:00:00Z');
const clone = (p: ProductProfile): ProductProfile => structuredClone(p);
const status = (a: ReturnType<typeof assessProduct>, id: string) => a.findings.find((f) => f.ruleId === id)?.status;

/** A product with everything in place: the baseline the gaps are measured against. Synthetic. */
function wellRun(): ProductProfile {
  const p = clone(example);
  p.usStates = ['TX'];
  p.usThresholdsReviewed = true;
  p.audience.under13 = 'none';
  p.accounts = { creation: true, selfServiceDeletion: { web: true, app: true }, deletionWebLink: true, socialSignIn: ['apple'], revokesAppleTokens: true };
  p.ageAssurance = { method: 'self_declared', neutral: true, enforcedServerSide: true };
  p.parentalConsent = { under18: 'leader_attests', under13: 'none', separateForThirdParties: true };
  p.data = p.data.map((d) => ({ ...d, retention: d.retention ?? 'P2Y', consent: d.category === 'faith' ? 'express' : d.consent }));
  p.processors = p.processors.map((x) => ({ ...x, dpa: true }));
  p.social.auExclusionClaimed = 'education';
  p.security = { encryptionInTransit: true, encryptionAtRest: true, roleBasedAccess: true, breachResponsePlan: true, writtenSecurityProgram: true, writtenRetentionPolicy: true };
  p.policies.claims = {
    ...p.policies.claims,
    analyticsCookies: false,
    surfacesNamed: ['website', 'web_app', 'mobile_app'],
    countriesAddressed: ['AU', 'US'],
    retentionStated: true,
    childFriendlyNotice: true,
  };
  return p;
}

describe('the product register', () => {
  it('is valid: unique ids, https sources, dates for upcoming rules, well-formed conditions', () => {
    expect(validateProductRegister(register)).toEqual([]);
  });

  it('is a draft, says it is not legal advice, and marks unreviewed law as verify', () => {
    expect(register.status).toBe('draft');
    expect(register.notice).toMatch(/not legal advice/i);
    for (const r of register.rules) expect(['reviewed', 'draft', 'verify']).toContain(r.confidence);
    expect(register.rules.some((r) => r.confidence === 'reviewed')).toBe(false);
  });

  it('covers Australia, the US and both app stores', () => {
    const ids = register.rules.map((r) => r.id);
    for (const id of ['au-social-media-minimum-age', 'au-childrens-code-defaults', 'us-coppa-age-screen', 'apple-account-deletion', 'google-account-deletion']) {
      expect(ids).toContain(id);
    }
  });

  it('catches broken rules', () => {
    const bad: ProductRule = { ...register.rules[0]!, id: 'x', law: [{ name: 'n', url: 'http://insecure' }], status: 'upcoming', commences: undefined, appliesWhen: { path: 'a' } as never };
    const problems = validateProductRegister({ ...register, notice: 'Guidance.', rules: [bad, bad] });
    expect(problems).toEqual(
      expect.arrayContaining([
        'notice must say it is not legal advice',
        'duplicate rule x',
        'x: source must be https',
        'x: upcoming without a start date',
        'x.appliesWhen: a path condition needs exactly one operator',
      ]),
    );
  });

  it('refuses a law with no country', () => {
    const r: ProductRule = { ...register.rules[0]!, id: 'y', kind: 'law', country: 'ALL' };
    expect(validateProductRegister({ ...register, rules: [r] })).toContain('y: a law belongs to a country');
  });
});

describe('conditions are three-valued', () => {
  const ctx = { a: true, n: 13, list: ['x'], items: [{ k: 1 }, { k: 2 }], same: 13, empty: null };

  it('evaluates paths and operators', () => {
    expect(evaluate({ path: 'a', is: true }, ctx)).toBe(true);
    expect(evaluate({ path: 'n', gte: 16 }, ctx)).toBe(false);
    expect(evaluate({ path: 'n', lt: 16 }, ctx)).toBe(true);
    expect(evaluate({ path: 'list', includesAny: ['x', 'y'] }, ctx)).toBe(true);
    expect(evaluate({ path: 'list', includesAll: ['x', 'y'] }, ctx)).toBe(false);
    expect(evaluate({ path: 'items', some: { path: 'k', is: 2 } }, ctx)).toBe(true);
    expect(evaluate({ path: 'items', none: { path: 'k', is: 3 } }, ctx)).toBe(true);
    expect(evaluate({ path: 'n', equalsPath: 'same' }, ctx)).toBe(true);
  });

  it('treats a missing fact as unknown, never as true or false', () => {
    expect(evaluate({ path: 'missing', is: true }, ctx)).toBe('unknown');
    expect(evaluate({ not: { path: 'missing', is: true } }, ctx)).toBe('unknown');
    expect(evaluate({ path: 'empty', gte: 16 }, ctx)).toBe('unknown');
    expect(evaluate({ path: 'n', equalsPath: 'missing' }, ctx)).toBe('unknown');
  });

  it('combines unknowns the safe way', () => {
    expect(evaluate({ all: [{ path: 'a', is: true }, { path: 'missing', is: true }] }, ctx)).toBe('unknown');
    expect(evaluate({ all: [{ path: 'a', is: false }, { path: 'missing', is: true }] }, ctx)).toBe(false);
    expect(evaluate({ any: [{ path: 'a', is: true }, { path: 'missing', is: true }] }, ctx)).toBe(true);
    expect(evaluate({ any: [{ path: 'a', is: false }, { path: 'missing', is: true }] }, ctx)).toBe('unknown');
  });

  it('fails closed on shapes it does not know', () => {
    expect(evaluate({ path: 'a', wobble: true } as never, ctx)).toBe(false);
    expect(evaluate({ banana: [] } as never, ctx)).toBe(false);
    expect(evaluate(null as never, ctx)).toBe(false);
  });

  it('lists the facts a condition reads', () => {
    expect(pathsOf({ all: [{ path: 'a', is: true }, { path: 'items', some: { path: 'k', is: 1 } }] })).toEqual(['a', 'items', 'items[].k']);
  });
});

describe('assessing a product', () => {
  it('finds the gaps a typical youth campaign app has', () => {
    const a = assessProduct(register, example, day);
    for (const id of [
      'apple-account-deletion',
      'google-account-deletion',
      'claims-deletion',
      'claims-parental-permission',
      'au-third-party-children',
      'au-social-media-minimum-age',
      'us-coppa-via-adults',
      'us-coppa-age-screen',
      'us-documents-cover-us',
      'au-retention',
    ]) {
      expect(status(a, id), id).toBe('gap');
    }
    expect(status(a, 'claims-cookies')).toBe('gap');
    expect(status(a, 'claims-surfaces')).toBe('gap');
  });

  it('puts high-severity gaps first', () => {
    const a = assessProduct(register, example, day);
    const firstMedium = a.findings.findIndex((f) => f.status === 'gap' && f.severity !== 'high');
    const lastHigh = a.findings.map((f) => f.status === 'gap' && f.severity === 'high').lastIndexOf(true);
    expect(lastHigh).toBeLessThan(firstMedium);
    expect(a.summary.high).toBeGreaterThan(0);
  });

  it('asks for US states rather than guessing', () => {
    const a = assessProduct(register, example, day);
    expect(status(a, 'us-states-known')).toBe('gap');
    const f = a.findings.find((x) => x.ruleId === 'us-state-privacy-nonprofits');
    expect(f?.status).toBe('needs_info');
    expect(f?.missingFacts).toContain('usStates');
  });

  it('applies state rules only for the states served', () => {
    const p = wellRun();
    expect(status(assessProduct(register, p, day), 'us-state-privacy-nonprofits')).toBeUndefined();
    p.usStates = ['CO'];
    p.usThresholdsReviewed = false;
    expect(status(assessProduct(register, p, day), 'us-state-privacy-nonprofits')).toBe('gap');
  });

  it('reports a well-run product with no gaps', () => {
    const a = assessProduct(register, wellRun(), day);
    expect(a.findings.filter((f) => f.status === 'gap' || f.status === 'needs_info')).toEqual([]);
    expect(a.summary.met).toBeGreaterThan(20);
  });

  it('marks rules that start later as coming, then applies them on the day', () => {
    const p = wellRun();
    p.policies.claims.childFriendlyNotice = false;
    expect(status(assessProduct(register, p, day), 'au-childrens-code-notice')).toBe('upcoming_gap');
    expect(status(assessProduct(register, p, afterCode), 'au-childrens-code-notice')).toBe('gap');
    p.policies.claims.childFriendlyNotice = true;
    expect(status(assessProduct(register, p, day), 'au-childrens-code-notice')).toBe('upcoming_met');
  });

  it('only checks the countries the product serves, plus app stores and good practice', () => {
    const p = wellRun();
    p.countries = ['AU'];
    const a = assessProduct(register, p, day);
    expect(a.findings.some((f) => f.country === 'US')).toBe(false);
    expect(a.findings.some((f) => f.country === 'ALL')).toBe(true);
  });

  it('treats a missing fact as needing information, never as met', () => {
    const p = wellRun() as unknown as Record<string, unknown>;
    delete (p.security as Record<string, unknown>).breachResponsePlan;
    const a = assessProduct(register, p as unknown as ProductProfile, day);
    expect(a.findings.find((f) => f.ruleId === 'au-breach-response')).toMatchObject({ status: 'needs_info', missingFacts: ['security.breachResponsePlan'] });
  });

  it('flags a minimum age that differs between the documents and the product', () => {
    const p = wellRun();
    p.policies.claims.minAge = 16;
    expect(status(assessProduct(register, p, day), 'claims-minimum-age')).toBe('gap');
  });

  it('accepts a social product whose minimum age is 16 or which relies on an exclusion', () => {
    const p = wellRun();
    p.social.auExclusionClaimed = null;
    expect(status(assessProduct(register, p, day), 'au-social-media-minimum-age')).toBe('gap');
    p.audience.minAge = 16;
    p.policies.claims.minAge = 16;
    expect(status(assessProduct(register, p, day), 'au-social-media-minimum-age')).toBe('met');
  });

  it('does not apply the social media rule to a product without posts and interaction', () => {
    const p = wellRun();
    p.social = { ...p.social, userPosts: false, userInteraction: false, auExclusionClaimed: null };
    expect(status(assessProduct(register, p, day), 'au-social-media-minimum-age')).toBeUndefined();
  });

  it('is deterministic', () => {
    expect(assessProduct(register, example, day)).toEqual(assessProduct(register, clone(example), day));
  });

  it('does not change the profile it is given', () => {
    const p = clone(example);
    const before = JSON.stringify(p);
    assessProduct(register, p, day);
    expect(JSON.stringify(p)).toBe(before);
  });
});

describe('profiles describe products, never people', () => {
  it('accepts the example', () => {
    expect(validateProductProfile(example)).toEqual([]);
  });

  it('refuses email addresses and phone numbers', () => {
    const p = clone(example);
    p.name = 'App run by someone@example.org';
    expect(validateProductProfile(p)).toContain('contains an email address: a profile describes a product, never a person');
    for (const phone of ['0412 345 678', '+61 2 9999 9999', '(555) 123-4567', '555-123-4567']) {
      p.name = `Call ${phone}`;
      expect(validateProductProfile(p).some((x) => x.startsWith('contains a phone number')), phone).toBe(true);
    }
  });

  it('does not mistake dates or versions for phone numbers', () => {
    const p = clone(example);
    p.name = 'Release 2026.11.1 from 2026-11-27';
    expect(validateProductProfile(p)).toEqual([]);
  });

  it('stays fast on input crafted to slow down pattern matching', () => {
    const p = clone(example);
    p.name = `${'%'.repeat(1_900)}@${'"'.repeat(90)}`;
    const start = performance.now();
    validateProductProfile(p);
    expect(performance.now() - start).toBeLessThan(100);
  });

  it('refuses oversized profiles and values', () => {
    const p = clone(example);
    p.name = 'x'.repeat(2_001);
    expect(validateProductProfile(p)).toContain('a value is too long (over 2000 characters)');
    p.data = Array.from({ length: 2_000 }, (_, i) => ({ ...example.data[0]!, id: `item-${i}`, purpose: 'y'.repeat(150) }));
    expect(validateProductProfile(p).some((x) => x.startsWith('profile is too large'))).toBe(true);
  });

  it('recognises email addresses without being fooled by look-alikes', () => {
    expect(hasEmailAddress('write to someone@example.org.')).toBe(true);
    expect(hasEmailAddress('@handle and a@b and x@y.z')).toBe(false);
    expect(hasEmailAddress('Version 2026.11.1')).toBe(false);
  });

  it('needs a name, countries and a data list', () => {
    expect(validateProductProfile({})).toEqual(expect.arrayContaining(['name is required', 'countries is required', 'data must be a list (it can be empty)']));
  });

  it('catches duplicate data items and unknown countries', () => {
    const p = clone(example);
    p.data.push({ ...p.data[0]! });
    p.countries = ['AU', 'XX' as never];
    expect(validateProductProfile(p)).toEqual(expect.arrayContaining([`duplicate data item ${p.data[0]!.id}`, 'unknown country XX']));
  });
});

describe('the report', () => {
  it('leads with gaps, gives what to do and the source, and ends with the notice', () => {
    const md = productReportMarkdown(assessProduct(register, example, day));
    expect(md).toMatch(/^# Always Safety product check: Example youth campaign app/);
    expect(md.indexOf('## Gap')).toBeLessThan(md.indexOf('## Met'));
    expect(md).toContain('**What to do:**');
    expect(md).toMatch(/Source: \[.+\]\(https:\/\//);
    expect(md.trimEnd().endsWith(register.notice)).toBe(true);
  });

  it('names missing facts so a team can complete the profile', () => {
    expect(productReportMarkdown(assessProduct(register, example, day))).toContain('`usStates`');
  });
});
