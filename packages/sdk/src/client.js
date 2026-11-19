export class AlwaysError extends Error {
    status;
    code;
    constructor(status, code) {
        super(`${status} ${code}`);
        this.status = status;
        this.code = code;
    }
}
/**
 * The Always API client. Server-side only when you pass a secret token (alw_live_...).
 * Never ship a secret token to a browser or app bundle: use the widget with your own
 * backend endpoint, or a publishable placement key.
 */
export class AlwaysClient {
    opts;
    constructor(opts = {}) {
        this.opts = opts;
    }
    async req(method, path, body) {
        const f = this.opts.fetch ?? fetch;
        const headers = { 'content-type': 'application/json' };
        if (this.opts.token)
            headers.authorization = `Bearer ${this.opts.token}`;
        if (this.opts.org)
            headers['x-always-org'] = this.opts.org;
        if (this.opts.appKey)
            headers['x-always-key'] = this.opts.appKey;
        const res = await f(`${this.opts.baseUrl ?? 'https://api.alwaysfoundation.org'}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
        const json = (await res.json().catch(() => ({})));
        if (!res.ok)
            throw new AlwaysError(res.status, json.error ?? 'request_failed');
        return json;
    }
    directory = {
        search: (q = {}) => this.req('GET', `/v1/directory?${new URLSearchParams(Object.entries(q).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))}`),
        tally: () => this.req('GET', '/v1/directory/tally'),
        get: (slug) => this.req('GET', `/v1/orgs/${encodeURIComponent(slug)}`),
        claim: (orgId, b) => this.req('POST', `/v1/orgs/${orgId}/claims`, b),
    };
    /** The church feed: facts about churches that opted in, never people. Safe to call from a browser. */
    feed = {
        churches: (q = {}) => {
            const p = new URLSearchParams();
            for (const [k, v] of Object.entries(q))
                if (v !== undefined)
                    p.set(k, String(v));
            return this.req('GET', `/v1/feed/churches?${p}`);
        },
        /** Whether a church is verified and welcoming now. */
        verify: (slug) => this.req('GET', `/v1/verify/${encodeURIComponent(slug)}`),
    };
    /** Evangelist API: Scripture with an evangelism layer. Approved content only unless `drafts` is set. */
    evangelist = {
        passages: (q = {}) => this.req('GET', `/v1/evangelist/passages?${evQuery(q)}`),
        passage: (id, opts = {}) => this.req('GET', `/v1/evangelist/passages/${encodeURIComponent(id)}?${evQuery(opts)}`),
        objections: (opts = {}) => this.req('GET', `/v1/evangelist/objections?${evQuery(opts)}`),
        objection: (id, opts = {}) => this.req('GET', `/v1/evangelist/objections/${encodeURIComponent(id)}?${evQuery(opts)}`),
        themes: (opts = {}) => this.req('GET', `/v1/evangelist/themes?${evQuery(opts)}`),
    };
    responses = {
        create: (r) => this.req('POST', '/v1/responses', r),
    };
    inbox = {
        list: () => this.req('GET', '/v1/inbox'),
    };
    handoffs = {
        accept: (id) => this.req('POST', `/v1/handoffs/${id}/accept`),
        pass: (id, reason) => this.req('POST', `/v1/handoffs/${id}/pass`, { reason }),
        contacted: (id) => this.req('POST', `/v1/handoffs/${id}/contacted`),
        activity: (id, kind, note) => this.req('POST', `/v1/handoffs/${id}/activity`, { kind, note }),
    };
    profile = {
        get: () => this.req('GET', '/v1/org/profile'),
        update: (p) => this.req('PUT', '/v1/org/profile', p),
    };
    /** Open compliance data and the stateless check-up. No token needed for these. */
    compliance = {
        register: (version) => this.req('GET', version ? `/v1/compliance/register/${encodeURIComponent(version)}` : '/v1/compliance/register'),
        versions: () => this.req('GET', '/v1/compliance/register/versions'),
        changes: () => this.req('GET', '/v1/compliance/changes'),
        check: (profile, answers = {}) => this.req('POST', '/v1/compliance/check', { profile, answers }),
    };
    /** Signed webhooks, including compliance change alerts. The secret is returned once, on create. */
    webhooks = {
        list: () => this.req('GET', '/v1/webhooks'),
        create: (url, events) => this.req('POST', '/v1/webhooks', { url, events }),
        remove: (id) => this.req('DELETE', `/v1/webhooks/${id}`),
    };
    /** Person self-service, with the private link token from their text message. */
    person = {
        status: (token) => this.req('GET', `/v1/me/${token}`),
        withdraw: (token) => this.req('POST', `/v1/me/${token}/withdraw`),
        connected: (token, companion) => this.req('POST', `/v1/me/${token}/connected`, { companion }),
    };
}
function evQuery(q) {
    const p = new URLSearchParams();
    if (q.theme)
        p.set('theme', q.theme);
    if (q.q)
        p.set('q', q.q);
    if (q.drafts)
        p.set('drafts', '1');
    return p.toString();
}
