import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { mountEvangelist, evangelistContent } from '../src/evangelist.js';
const app = new Hono();
mountEvangelist(app);
const get = async (path) => {
    const res = await app.request(path);
    return { status: res.status, body: (await res.json()), headers: res.headers };
};
describe('evangelist content', () => {
    const { passages, objections } = evangelistContent;
    it('has unique ids and complete passages', () => {
        expect(new Set(passages.map((p) => p.id)).size).toBe(passages.length);
        for (const p of passages) {
            expect(p.text.length).toBeGreaterThan(10);
            expect(p.ref).toMatch(/^[1-3]? ?[A-Z][a-z]+ \d+:\d+(-\d+)?$/);
            expect(p.themes.length).toBeGreaterThan(0);
            expect(['draft', 'approved']).toContain(p.status);
        }
    });
    it('only links objections to passages that exist', () => {
        const ids = new Set(passages.map((p) => p.id));
        for (const o of objections)
            for (const id of o.passages)
                expect(ids.has(id)).toBe(true);
    });
    it('capitalises pronouns for God in our own notes', () => {
        for (const text of [...passages.map((p) => p.explain), ...objections.map((o) => o.answer)]) {
            expect(text).not.toMatch(/\bGod\b[^.]*\b(he|him|his) (offers|gives|forgives|promises|knocks|came)\b/);
        }
    });
});
describe('evangelist API', () => {
    it('returns approved items only by default', async () => {
        const r = await get('/v1/evangelist/passages');
        expect(r.status).toBe(200);
        expect(r.body.includesDrafts).toBe(false);
        expect(r.body.items.every((p) => p.status === 'approved')).toBe(true);
    });
    it('includes clearly marked drafts on request', async () => {
        const r = await get('/v1/evangelist/passages?drafts=1&theme=suffering');
        expect(r.body.includesDrafts).toBe(true);
        expect(r.body.items.length).toBeGreaterThan(0);
        expect(r.body.items.every((p) => p.themes.includes('suffering'))).toBe(true);
    });
    it('searches passages', async () => {
        const r = await get('/v1/evangelist/passages?drafts=1&q=born%20again%20OR%20lost');
        expect(Array.isArray(r.body.items)).toBe(true);
        const lost = await get('/v1/evangelist/passages?drafts=1&q=lost');
        expect(lost.body.items.some((p) => p.id === 'luke-19-10')).toBe(true);
    });
    it('expands an objection with its passages', async () => {
        const r = await get('/v1/evangelist/objections/suffering?drafts=1');
        expect(r.status).toBe(200);
        expect(r.body.passages.map((p) => p.ref)).toContain('Revelation 21:4');
        expect(r.body.tips.length).toBeGreaterThan(0);
    });
    it('hides drafts unless asked', async () => {
        expect((await get('/v1/evangelist/objections/suffering')).status).toBe(404);
        expect((await get('/v1/evangelist/passages/john-3-16')).status).toBe(404);
    });
    it('links a passage to the objections it helps answer', async () => {
        const r = await get('/v1/evangelist/passages/romans-5-8?drafts=1');
        expect(r.body.objections.map((o) => o.id)).toContain('too-far-gone');
    });
    it('is open to any app', async () => {
        const res = await app.request('/v1/evangelist/themes', { headers: { origin: 'https://example.org' } });
        expect(res.headers.get('access-control-allow-origin')).toBe('*');
    });
});
