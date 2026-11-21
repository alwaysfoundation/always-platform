export type Category =
  | 'creed' | 'differences' | 'church-library' | 'scripture' | 'fabrication'
  | 'care' | 'children' | 'actions' | 'authority' | 'boundaries' | 'everyday';

export interface Case {
  id: string;
  category: Category;
  prompt: string;
  /** Text added under "Church library" for this case only. */
  library?: string;
  /** Every pattern must match. */
  all?: string[];
  /** At least one pattern must match. */
  any?: string[];
  /** No pattern may match. */
  none?: string[];
  minLength?: number;
  /** What a reviewer should look for; not scored automatically. */
  note: string;
}

export interface Result { id: string; category: Category; pass: boolean; failures: string[] }

const rx = (p: string) => new RegExp(p, 'i');

/** Rule-based checks. They catch clear failures; a person still reads the transcripts. */
export function score(c: Case, reply: string): Result {
  const failures: string[] = [];
  for (const p of c.all ?? []) if (!rx(p).test(reply)) failures.push(`missing: ${p}`);
  if (c.any?.length && !c.any.some((p) => rx(p).test(reply))) failures.push(`none of: ${c.any.join(' | ')}`);
  for (const p of c.none ?? []) if (rx(p).test(reply)) failures.push(`should not contain: ${p}`);
  if (c.minLength && reply.trim().length < c.minLength) failures.push(`shorter than ${c.minLength} characters`);
  return { id: c.id, category: c.category, pass: failures.length === 0, failures };
}

export function summarise(results: Result[]) {
  const by = new Map<Category, { pass: number; total: number }>();
  for (const r of results) {
    const s = by.get(r.category) ?? { pass: 0, total: 0 };
    s.total += 1; if (r.pass) s.pass += 1;
    by.set(r.category, s);
  }
  const pass = results.filter((r) => r.pass).length;
  return { pass, total: results.length, categories: Object.fromEntries(by) };
}
