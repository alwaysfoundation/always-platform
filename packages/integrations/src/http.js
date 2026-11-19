export class IntegrationError extends Error {
    system;
    code;
    constructor(system, code) {
        super(`${system}:${code}`);
        this.system = system;
        this.code = code;
    }
}
/** JSON request with a timeout. Errors carry the status only: provider bodies can echo names and addresses. */
export async function requestJson(system, fetcher, url, init) {
    let res;
    try {
        res = await fetcher(url, { ...init, signal: AbortSignal.timeout(10_000) });
    }
    catch {
        throw new IntegrationError(system, 'network');
    }
    if (!res.ok)
        throw new IntegrationError(system, `http_${res.status}`);
    try {
        return (await res.json());
    }
    catch {
        throw new IntegrationError(system, 'bad_json');
    }
}
export function basicAuth(user, password) {
    return `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;
}
