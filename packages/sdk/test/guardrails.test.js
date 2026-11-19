import { describe, it, expect } from 'vitest';
import { rulesFor } from '@always/core';
import { ageGuard, requireConsent, personalDataProblems, spamActProblems, messageFooter, AlwaysClient } from '@always/sdk';
describe('age guard', () => {
    it('matches the platform minors rules for every band, and treats no band as under 13', () => {
        for (const band of ['under13', '13-14', '15-17', '18+']) {
            const core = rulesFor(band);
            expect(ageGuard(band)).toEqual({ collectOwnDetails: core.collectOwnDetails, requiresParentConfirmation: core.requiresParentConfirmation, youthPartnersOnly: core.youthPartnersOnly, aiAllowed: core.aiAllowed, isMinor: core.isMinor });
        }
        expect(ageGuard(undefined)).toEqual(ageGuard('under13'));
    });
});
describe('consent', () => {
    it('fails closed without a receipt, without the purpose, or after withdrawal', () => {
        expect(() => requireConsent(null, 'connect.church')).toThrow('consent:connect.church');
        expect(() => requireConsent({ purposes: ['resources'] }, 'connect.church')).toThrow();
        expect(() => requireConsent({ purposes: ['connect.church'], withdrawnAt: '2026-11-01T00:00:00Z' }, 'connect.church')).toThrow();
        expect(() => requireConsent({ purposes: ['connect.church'] }, 'connect.church')).not.toThrow();
    });
});
describe('messages', () => {
    it('finds email addresses and Australian phone numbers in notifications', () => {
        expect(personalDataProblems('Sam (sam@example.org) is waiting')).toEqual(['contains an email address']);
        expect(personalDataProblems('Call 0412 345 678 today')).toEqual(['contains a phone number']);
        expect(personalDataProblems('Someone is waiting. Open your inbox.')).toEqual([]);
    });
    it('checks a message against the Spam Act basics, and the footer passes', () => {
        const footer = messageFooter('Hope Church', 'https://example.org/u/abc');
        expect(spamActProblems({ consented: true, sender: 'Hope Church', unsubscribeUrl: 'https://example.org/u/abc', body: `Youth night is on. ${footer}` })).toEqual([]);
        expect(spamActProblems({ consented: false, body: 'Hello' })).toEqual(['no consent to send', 'does not identify the sender', 'no working unsubscribe link']);
    });
});
describe('compliance client', () => {
    it('reads open data without a token and posts the stateless check-up', async () => {
        const calls = [];
        const fake = (async (url, init) => {
            calls.push({ url, init });
            return new Response(JSON.stringify({ ok: true }), { status: 200 });
        });
        const c = new AlwaysClient({ baseUrl: 'https://api.test', fetch: fake });
        await c.compliance.register('2027.01.0');
        await c.compliance.check({ states: ['NSW'], collectsPersonalInfo: true, turnoverOver3m: false, providesHealthService: false, usesOverseasServices: false, worksWithChildren: true, onlineServicesForChildren: false, sendsEmailOrSms: true, acncRegistered: true, basicReligiousCharity: true, acncMediumOrLarge: false });
        expect(calls[0].url).toBe('https://api.test/v1/compliance/register/2027.01.0');
        expect(calls[0].init.headers.authorization).toBeUndefined();
        expect(calls[1].init.method).toBe('POST');
        expect(JSON.parse(calls[1].init.body).answers).toEqual({});
    });
});
