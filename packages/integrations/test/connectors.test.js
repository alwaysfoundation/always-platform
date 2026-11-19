import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { elvanto, elvantoRegion, IntegrationError, parsePlanningCenterDeliveries, planningCenter, verifyPlanningCenterWebhook, } from '../src/index.js';
import { fakeFetch, packet } from './fixtures.js';
describe('Elvanto', () => {
    it('tells Australian accounts by their address', () => {
        expect(elvantoRegion('grace.elvanto.com.au')).toBe('AU');
        expect(elvantoRegion('grace.elvanto.com')).toBe('offshore');
        expect(elvantoRegion('grace.elvanto.com.au.evil.test')).toBe('offshore');
    });
    it('creates a person with basic auth and only the fields it needs', async () => {
        const f = fakeFetch([{ json: { status: 'ok', person: { id: 'elv-1' } } }]);
        const id = await elvanto({ apiKey: 'test-key', accountDomain: 'grace.elvanto.com.au', categoryId: 'cat-new' }, f.fetcher).createPerson(packet());
        expect(id).toBe('elv-1');
        const call = f.calls[0];
        expect(call.url).toBe('https://api.elvanto.com/v1/people/create.json');
        expect(call.headers.authorization).toBe(`Basic ${Buffer.from('test-key:x').toString('base64')}`);
        expect(call.body).toEqual({ firstname: 'Testy', lastname: 'McTestface', email: 'testy@example.test', mobile: '0400 000 000', category_id: 'cat-new' });
    });
    it('fills the required last name when someone gave only a first name', async () => {
        const f = fakeFetch([{ json: { status: 'ok', person: { id: 'elv-2' } } }]);
        await elvanto({ apiKey: 'k', accountDomain: 'grace.elvanto.com.au' }, f.fetcher).createPerson(packet({ lastName: undefined, email: undefined }));
        expect(f.calls[0].body).toEqual({ firstname: 'Testy', lastname: '-', mobile: '0400 000 000' });
    });
    it('adds the person to the pathway group', async () => {
        const f = fakeFetch([{ json: { status: 'ok' } }]);
        const g = await elvanto({ apiKey: 'k', accountDomain: 'grace.elvanto.com.au', pathwayGroupId: 'grp-1' }, f.fetcher).addToPathway('elv-1');
        expect(g).toBe('grp-1');
        expect(f.calls[0].url).toBe('https://api.elvanto.com/v1/groups/addPerson.json');
        expect(f.calls[0].body).toEqual({ group_id: 'grp-1', person_id: 'elv-1' });
    });
    it('turns a fail reply into a code with no personal data', async () => {
        const f = fakeFetch([{ json: { status: 'fail', error: { code: 102, message: 'Invalid API Key.' } } }]);
        const err = await elvanto({ apiKey: 'k', accountDomain: 'grace.elvanto.com.au' }, f.fetcher).createPerson(packet()).catch((e) => e);
        expect(err).toBeInstanceOf(IntegrationError);
        expect(err.message).toBe('elvanto:fail_102');
    });
    it('never puts the provider body in an HTTP error', async () => {
        const f = fakeFetch([{ status: 400, json: { echo: 'testy@example.test' } }]);
        const err = await elvanto({ apiKey: 'k', accountDomain: 'grace.elvanto.com.au' }, f.fetcher).createPerson(packet()).catch((e) => e);
        expect(err.message).toBe('elvanto:http_400');
        expect(err.message).not.toContain('example.test');
    });
});
describe('Planning Center', () => {
    it('creates a person, email, mobile and a workflow card', async () => {
        const f = fakeFetch([
            { json: { data: { id: 'pc-1', type: 'Person' } } },
            { json: { data: { id: 'em-1', type: 'Email' } } },
            { json: { data: { id: 'ph-1', type: 'PhoneNumber' } } },
            { json: { data: { id: 'card-1', type: 'WorkflowCard' } } },
        ]);
        const c = planningCenter({ auth: { kind: 'token', appId: 'app', secret: 'sec' }, workflowId: 'wf-9' }, f.fetcher);
        const id = await c.createPerson(packet());
        const card = await c.createFollowUp(id);
        expect([id, card]).toEqual(['pc-1', 'card-1']);
        expect(f.calls.map((x) => x.url)).toEqual([
            'https://api.planningcenteronline.com/people/v2/people',
            'https://api.planningcenteronline.com/people/v2/people/pc-1/emails',
            'https://api.planningcenteronline.com/people/v2/people/pc-1/phone_numbers',
            'https://api.planningcenteronline.com/people/v2/workflows/wf-9/cards',
        ]);
        expect(f.calls[0].body).toEqual({ data: { type: 'Person', attributes: { first_name: 'Testy', last_name: 'McTestface' } } });
        expect(f.calls[3].body).toEqual({ data: { type: 'WorkflowCard', attributes: { person_id: 'pc-1' } } });
        expect(f.calls[0].headers.authorization).toBe(`Basic ${Buffer.from('app:sec').toString('base64')}`);
    });
    it('uses a bearer token for OAuth connections', async () => {
        const f = fakeFetch([{ json: { data: { id: 'pc-2', type: 'Person' } } }]);
        await planningCenter({ auth: { kind: 'oauth', accessToken: 'tok' } }, f.fetcher).createPerson(packet({ email: undefined, mobile: undefined }));
        expect(f.calls).toHaveLength(1);
        expect(f.calls[0].headers.authorization).toBe('Bearer tok');
    });
    it('verifies webhook signatures', () => {
        const body = '{"data":[]}';
        const secret = 'a'.repeat(64);
        const good = createHmac('sha256', secret).update(body).digest('hex');
        expect(verifyPlanningCenterWebhook(body, good, secret)).toBe(true);
        expect(verifyPlanningCenterWebhook(body + ' ', good, secret)).toBe(false);
        expect(verifyPlanningCenterWebhook(body, undefined, secret)).toBe(false);
        expect(verifyPlanningCenterWebhook(body, 'zz', secret)).toBe(false);
    });
    it('reads deliveries into ids and flags, dropping names', () => {
        const card = { data: { type: 'WorkflowCard', id: 'card-1', attributes: { completed_at: '2026-11-19T01:00:00Z' }, relationships: { person: { data: { type: 'Person', id: 'pc-1' } } } } };
        const person = { data: { type: 'Person', id: 'pc-1', attributes: { first_name: 'Testy' } } };
        const raw = JSON.stringify({
            data: [
                { type: 'EventDelivery', id: '1', attributes: { name: 'card.event', payload: JSON.stringify(card) } },
                { type: 'EventDelivery', id: '2', attributes: { name: 'person.event', payload: JSON.stringify(person) } },
                { type: 'EventDelivery', id: '3', attributes: { name: 'broken', payload: 'not json' } },
            ],
        });
        const events = parsePlanningCenterDeliveries(raw);
        expect(events).toEqual([
            { name: 'card.event', resourceType: 'WorkflowCard', resourceId: 'card-1', personId: 'pc-1', completed: true },
            { name: 'person.event', resourceType: 'Person', resourceId: 'pc-1' },
        ]);
        expect(JSON.stringify(events)).not.toContain('Testy');
    });
});
