import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { creedText, modelfile, systemPrompt } from '../src/pack.js';
import { score, summarise, type Case } from '../src/score.js';

const file = (p: string) => readFileSync(fileURLToPath(new URL(`../${p}`, import.meta.url)), 'utf8');

describe('Always AI instructions', () => {
  it('carry the full Nicene Creed of 381', () => {
    const p = systemPrompt();
    for (const line of ['Maker of heaven and earth', 'Light of Light', 'Pontius Pilate', 'Lord and Giver of life', 'life of the world to come'])
      expect(p).toContain(line);
    expect(p).not.toContain('{{CREED}}');
    expect(creedText()).not.toMatch(/^#/m);
  });

  it('keep the non-negotiable rules', () => {
    const p = systemPrompt();
    expect(p).toMatch(/Never work with identifying information about anyone under 18/);
    expect(p).toMatch(/13 11 14/);
    expect(p).toMatch(/Never say or imply that you have sent/);
    expect(p).toMatch(/Never invent verses/);
  });

  it('append a church library only when one is given', () => {
    expect(systemPrompt()).not.toContain('## Church library');
    expect(systemPrompt('We baptise believers by immersion.')).toMatch(/## Church library\n\nWe baptise believers by immersion\.$/);
    expect(systemPrompt('   ')).not.toContain('## Church library');
  });

  it('ship a Modelfile in sync with the instructions', () => {
    expect(file('Modelfile')).toBe(modelfile());
  });
});

describe('prompt checker', () => {
  const c: Case = { id: 't', category: 'actions', prompt: 'p', all: ['draft'], any: ['send it', 'copy'], none: ["I('ve| have) sent"], minLength: 10, note: 'n' };

  it('passes a reply that meets every check', () => {
    expect(score(c, 'Here is a draft you can copy.').pass).toBe(true);
  });

  it('reports each failed check', () => {
    const r = score(c, "I've sent it");
    expect(r.pass).toBe(false);
    expect(r.failures).toEqual(['missing: draft', 'none of: send it | copy', "should not contain: I('ve| have) sent"]);
  });

  it('enforces a minimum length', () => {
    expect(score({ id: 'x', category: 'everyday', prompt: '', minLength: 50, note: '' }, 'short').failures).toEqual(['shorter than 50 characters']);
  });

  it('summarises by category', () => {
    const s = summarise([
      { id: 'a', category: 'creed', pass: true, failures: [] },
      { id: 'b', category: 'creed', pass: false, failures: ['x'] },
      { id: 'c', category: 'children', pass: true, failures: [] },
    ]);
    expect(s).toEqual({ pass: 2, total: 3, categories: { creed: { pass: 1, total: 2 }, children: { pass: 1, total: 1 } } });
  });

  it('has well-formed cases covering every category', () => {
    const cases = JSON.parse(file('evals/cases.json')) as Case[];
    const ids = new Set(cases.map((x) => x.id));
    expect(ids.size).toBe(cases.length);
    for (const x of cases) {
      expect(x.note.length).toBeGreaterThan(10);
      expect((x.all?.length ?? 0) + (x.any?.length ?? 0) + (x.none?.length ?? 0) + (x.minLength ? 1 : 0)).toBeGreaterThan(0);
      for (const p of [...(x.all ?? []), ...(x.any ?? []), ...(x.none ?? [])]) expect(() => new RegExp(p, 'i')).not.toThrow();
    }
    expect(new Set(cases.map((x) => x.category))).toEqual(new Set(['creed', 'differences', 'church-library', 'scripture', 'fabrication', 'care', 'children', 'actions', 'authority', 'boundaries', 'everyday']));
  });
});
