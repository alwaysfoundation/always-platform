import { basicAuth, IntegrationError, requestJson } from './http.js';
const BASE = 'https://api.elvanto.com/v1';
/** Elvanto keeps Australian accounts on Australian servers; the .com.au address is how we tell them apart. */
export function elvantoRegion(accountDomain) {
    return /^[a-z0-9-]+\.elvanto\.com\.au$/i.test(accountDomain.trim()) ? 'AU' : 'offshore';
}
export function elvanto(settings, fetcher = fetch) {
    const headers = { authorization: basicAuth(settings.apiKey, 'x'), 'content-type': 'application/json' };
    async function call(method, body) {
        const reply = await requestJson('elvanto', fetcher, `${BASE}/${method}.json`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });
        if (reply.status !== 'ok')
            throw new IntegrationError('elvanto', `fail_${reply.error?.code ?? 'unknown'}`);
        return reply;
    }
    return {
        system: 'elvanto',
        dataRegion: () => elvantoRegion(settings.accountDomain),
        async createPerson(p) {
            const reply = await call('people/create', {
                firstname: p.firstName,
                // Elvanto requires a last name; many people give only a first name.
                lastname: p.lastName?.trim() || '-',
                ...(p.email ? { email: p.email } : {}),
                ...(p.mobile ? { mobile: p.mobile } : {}),
                ...(settings.categoryId ? { category_id: settings.categoryId } : {}),
            });
            return reply.person.id;
        },
        async addToPathway(personId) {
            if (!settings.pathwayGroupId)
                return undefined;
            await call('groups/addPerson', { group_id: settings.pathwayGroupId, person_id: personId });
            return settings.pathwayGroupId;
        },
        async createFollowUp() {
            return settings.categoryId;
        },
    };
}
