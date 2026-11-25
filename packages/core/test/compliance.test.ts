import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { assess, diffRegisters, holds, quarterOf, strengthOf, validateRegister, type ComplianceProfile, type Register } from '../src/compliance.js';

const register = JSON.parse(readFileSync(fileURLToPath(new URL('../../../spec/safety/register.json', import.meta.url)), 'utf8')) as Register;

/** A small NSW church: under the Privacy Act threshold, runs a youth group, registered with the ACNC. Synthetic. */
const church: ComplianceProfile = {
  states: ['NSW'],
  collectsPersonalInfo: true,
  turnoverOver3m: false,
  providesHealthService: false,
  usesOverseasServices: false,
  worksWithChildren: true,
  onlineServicesForChildren: false,
  sendsEmailOrSms: true,
  acncRegistered: true,
};
const allPlatform = { consent_records: true, access_controls: true, retention_schedule: true, data_in_australia: true, minors_rules: true };
const day = new Date('2026-11-19T01:00:00Z');
const ids = (a: ReturnType<typeof assess>) => a.items.map((i) => i.obligationId);

describe('the register', () => {
  it('is valid: unique ids, https sources, start dates for upcoming obligations', () => {
    expect(validateRegister(register)).toEqual([]);
  });
  it('is marked as a draft until a qualified person reviews it', () => {
    expect(register.status).toBe('draft');
    expect(register.notice).toMatch(/not legal advice/i);
  });
});

describe('conditions', () => {
  it('combine all, any and not, and match states', () => {
    expect(holds({ all: [{ field: 'worksWithChildren', is: true }, { field: 'states', includesAny: ['NSW'] }] }, church)).toBe(true);
    expect(holds({ any: [{ field: 'turnoverOver3m', is: true }, { field: 'providesHealthService', is: true }] }, church)).toBe(false);
    expect(holds({ not: { field: 'acncRegistered', is: true } }, church)).toBe(false);
    expect(holds({ field: 'states', includesAny: ['VIC', 'QLD'] }, church)).toBe(false);
  });
  it('fail closed on an unknown shape', () => {
    expect(holds({ nonsense: true } as never, church)).toBe(false);
  });
});

describe('who an obligation applies to', () => {
  it('privacy obligations are good practice for a small church, and required once over $3 million', () => {
    const o = register.obligations.find((x) => x.id === 'privacy-policy')!;
    expect(strengthOf(o, church)).toBe('recommended');
    expect(strengthOf(o, { ...church, turnoverOver3m: true })).toBe('required');
    expect(strengthOf(o, { ...church, providesHealthService: true })).toBe('required');
  });
  it('the statutory privacy tort applies whatever the size', () => {
    const o = register.obligations.find((x) => x.id === 'serious-invasion-of-privacy')!;
    expect(strengthOf(o, church)).toBe('required');
  });
  it('child safe standards follow the states a ministry works in', () => {
    const nsw = ids(assess(register, church, {}, {}, day));
    expect(nsw).toContain('child-safe-standards-nsw');
    expect(nsw).not.toContain('child-safe-standards-qld');
    const qld = ids(assess(register, { ...church, states: ['QLD', 'WA'] }, {}, {}, day));
    expect(qld).toEqual(expect.arrayContaining(['child-safe-standards-qld', 'child-safe-national-principles']));
  });
  it('a ministry without children sees no child safety obligations', () => {
    const a = assess(register, { ...church, worksWithChildren: false }, {}, {}, day);
    expect(a.items.some((i) => i.area === 'child_safety')).toBe(false);
  });
  it('working with children checks show only the local state schemes', () => {
    const item = assess(register, { ...church, states: ['VIC'] }, {}, {}, day).items.find((i) => i.obligationId === 'working-with-children-checks')!;
    expect(item.law.map((l) => l.jurisdiction)).toEqual(['VIC']);
  });
});

describe('statuses', () => {
  it('unanswered evidence asks you to check; a "no" needs attention; yes or not applicable is met', () => {
    const base = assess(register, church, {}, allPlatform, day).items.find((i) => i.obligationId === 'privacy-policy')!;
    expect(base.status).toBe('check');
    const no = assess(register, church, { 'pp-published': 'no', 'pp-reviewed': 'yes' }, allPlatform, day).items.find((i) => i.obligationId === 'privacy-policy')!;
    expect(no.status).toBe('attention');
    expect(no.missing).toHaveLength(1);
    const yes = assess(register, church, { 'pp-published': 'yes', 'pp-reviewed': 'not_applicable' }, allPlatform, day).items.find((i) => i.obligationId === 'privacy-policy')!;
    expect(yes.status).toBe('met');
  });
  it('Always Platform vouches for what it enforces in code', () => {
    const without = assess(register, church, { 'cn-forms': 'yes' }, {}, day).items.find((i) => i.obligationId === 'collection-notice')!;
    expect(without.status).toBe('check');
    const withPlatform = assess(register, church, { 'cn-forms': 'yes' }, allPlatform, day).items.find((i) => i.obligationId === 'collection-notice')!;
    expect(withPlatform.status).toBe('met');
  });
  it('upcoming obligations stay upcoming until they start, then are assessed', () => {
    const p = { ...church, onlineServicesForChildren: true };
    expect(assess(register, p, {}, {}, day).items.find((i) => i.obligationId === 'childrens-online-privacy-code')!.status).toBe('upcoming');
    expect(assess(register, p, {}, {}, new Date('2027-01-10T00:00:00Z')).items.find((i) => i.obligationId === 'childrens-online-privacy-code')!.status).toBe('check');
  });
  it('watch items are listed separately, never as actions', () => {
    const a = assess(register, church, {}, {}, day);
    expect(ids(a)).not.toContain('privacy-reform-tranche-2');
    expect(a.watching.map((w) => w.obligationId)).toContain('privacy-reform-tranche-2');
  });
  it('orders what needs attention first, required before recommended', () => {
    const a = assess(register, church, { 'wwcc-register': 'no', 'pp-published': 'no' }, allPlatform, day);
    expect(a.items[0]!.status).toBe('attention');
    expect(a.items[0]!.strength).toBe('required');
    expect(a.summary.attention).toBe(2);
  });
  it('is deterministic', () => {
    expect(assess(register, church, {}, allPlatform, day)).toEqual(assess(register, church, {}, allPlatform, day));
  });
});

describe('what changed', () => {
  it('reports added, changed and removed obligations in plain words', () => {
    const after: Register = JSON.parse(JSON.stringify(register));
    after.version = '2027.01.0';
    after.obligations = after.obligations.filter((o) => o.id !== 'privacy-policy');
    const code = after.obligations.find((o) => o.id === 'childrens-online-privacy-code')!;
    code.status = 'in_force';
    after.obligations.push({ ...code, id: 'new-thing', title: 'Something new' });
    const changes = diffRegisters(register, after);
    expect(changes).toEqual(expect.arrayContaining([
      expect.objectContaining({ obligationId: 'childrens-online-privacy-code', change: 'changed', what: ['status: upcoming to in_force'] }),
      expect.objectContaining({ obligationId: 'new-thing', change: 'added' }),
      expect.objectContaining({ obligationId: 'privacy-policy', change: 'removed' }),
    ]));
  });
});

describe('quarters', () => {
  it('use Sydney time', () => {
    expect(quarterOf(new Date('2026-12-31T13:30:00Z'))).toBe('2027-Q1'); // 12:30am 1 Jan in Sydney
    expect(quarterOf(new Date('2026-11-19T01:00:00Z'))).toBe('2026-Q4');
  });
});

describe('register diff and stored copies', () => {
  it('ignores key order, which jsonb changes', () => {
    const reg = JSON.parse(readFileSync(fileURLToPath(new URL('../../../spec/safety/register.json', import.meta.url)), 'utf8'));
    const reordered = JSON.parse(JSON.stringify(reg), (_k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).reverse()) : v));
    expect(diffRegisters(reg, reordered)).toEqual([]);
  });
});

describe('countries', () => {
  const base = { ...church, states: [] as never[], acncRegistered: false };
  it('treats a profile without countries as Australian', () => {
    expect(ids(assess(register, church, {}, {}, day))).toContain('privacy-policy');
  });
  it('gives a US-only ministry US obligations and no Australian ones', () => {
    const a = assess(register, { ...base, countries: ['US'] }, {}, {}, day);
    expect(ids(a)).toContain('us-privacy-notice');
    expect(ids(a).some((id) => register.obligations.find((o) => o.id === id)?.country === 'AU')).toBe(false);
  });
  it('covers every country in the register, and only listed countries', () => {
    const seen = new Set(register.obligations.map((o) => o.country ?? 'AU'));
    expect([...seen].sort()).toEqual(['AU', 'CA', 'EU', 'GB', 'NZ', 'US']);
  });
  it('combines countries for a ministry in more than one place', () => {
    const a = assess(register, { ...base, countries: ['GB', 'NZ'] }, {}, {}, day);
    expect(ids(a)).toEqual(expect.arrayContaining(['gb-breach', 'nz-breach']));
  });
  it('reads unanswered questions as "no"', () => {
    const a = assess(register, { countries: ['CA'], states: [], collectsPersonalInfo: true } as never, {}, {}, day);
    expect(ids(a)).toContain('ca-privacy');
  });
});
