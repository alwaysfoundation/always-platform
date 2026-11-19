import type { Hono } from 'hono';
import { cors } from 'hono/cors';
import passagesData from '../../../content/evangelist/passages.json' with { type: 'json' };
import objectionsData from '../../../content/evangelist/objections.json' with { type: 'json' };

/**
 * Evangelist API: Scripture with an evangelism layer on top.
 * Read-only, open, and with no personal data. Bible text is the KJV (public domain in Australia);
 * the notes, answers and tips are CC BY 4.0.
 *
 * Every item is drafted (often by AI) and published only after an experienced evangelist and a
 * theology reviewer approve it. By default the API returns approved items only; `?drafts=1`
 * includes drafts, clearly marked, for review tools and prototypes.
 */
export interface Passage {
  id: string;
  ref: string;
  translation: string;
  text: string;
  themes: string[];
  explain: string;
  whenToShare: string;
  status: 'draft' | 'approved';
  source: string;
}
export interface Objection {
  id: string;
  question: string;
  answer: string;
  passages: string[];
  tips: string[];
  status: 'draft' | 'approved';
  source: string;
}

const PASSAGES = passagesData.passages as Passage[];
const OBJECTIONS = objectionsData.objections as Objection[];
const BY_ID = new Map(PASSAGES.map((p) => [p.id, p]));

export const evangelistContent = { passages: PASSAGES, objections: OBJECTIONS, version: passagesData.version };

const visible = <T extends { status: string }>(items: T[], drafts: boolean) => items.filter((i) => drafts || i.status === 'approved');
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function mountEvangelist(app: Hono<any>) {
  app.use('/v1/evangelist/*', cors({ origin: '*', allowMethods: ['GET', 'OPTIONS'], maxAge: 86400 }));

  const meta = (drafts: boolean) => ({
    version: passagesData.version,
    licence: 'Bible text: King James Version (public domain in Australia). Notes and answers: CC BY 4.0, Always Foundation.',
    includesDrafts: drafts,
  });

  app.get('/v1/evangelist/themes', (c) => {
    const drafts = c.req.query('drafts') === '1';
    const counts = new Map<string, number>();
    for (const p of visible(PASSAGES, drafts)) for (const t of p.themes) counts.set(t, (counts.get(t) ?? 0) + 1);
    return c.json({ ...meta(drafts), themes: [...counts].sort().map(([id, passages]) => ({ id, passages })) });
  });

  app.get('/v1/evangelist/passages', (c) => {
    const drafts = c.req.query('drafts') === '1';
    const theme = c.req.query('theme');
    const q = c.req.query('q');
    let items = visible(PASSAGES, drafts);
    if (theme) items = items.filter((p) => p.themes.includes(theme));
    if (q) {
      const n = norm(q);
      items = items.filter((p) => norm(`${p.ref} ${p.text} ${p.explain} ${p.themes.join(' ')}`).includes(n));
    }
    return c.json({ ...meta(drafts), items });
  });

  app.get('/v1/evangelist/passages/:id', (c) => {
    const drafts = c.req.query('drafts') === '1';
    const p = BY_ID.get(c.req.param('id'));
    if (!p || (!drafts && p.status !== 'approved')) return c.json({ error: 'not_found' }, 404);
    const answers = visible(OBJECTIONS, drafts).filter((o) => o.passages.includes(p.id)).map((o) => ({ id: o.id, question: o.question }));
    return c.json({ ...meta(drafts), ...p, objections: answers });
  });

  app.get('/v1/evangelist/objections', (c) => {
    const drafts = c.req.query('drafts') === '1';
    const items = visible(OBJECTIONS, drafts).map(({ id, question, status }) => ({ id, question, status }));
    return c.json({ ...meta(drafts), items });
  });

  app.get('/v1/evangelist/objections/:id', (c) => {
    const drafts = c.req.query('drafts') === '1';
    const o = OBJECTIONS.find((x) => x.id === c.req.param('id'));
    if (!o || (!drafts && o.status !== 'approved')) return c.json({ error: 'not_found' }, 404);
    // Show only passages a reader may see: never an approved answer resting on an unapproved passage.
    const passages = o.passages.map((id) => BY_ID.get(id)!).filter((p) => drafts || p.status === 'approved');
    return c.json({ ...meta(drafts), ...o, passages });
  });
}
