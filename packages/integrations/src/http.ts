import type { Fetcher } from './types.js';

export class IntegrationError extends Error {
  constructor(
    readonly system: string,
    readonly code: string,
  ) {
    super(`${system}:${code}`);
  }
}

/** JSON request with a timeout. Errors carry the status only: provider bodies can echo names and addresses. */
export async function requestJson<T>(system: string, fetcher: Fetcher, url: string, init: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetcher(url, { ...init, signal: AbortSignal.timeout(10_000) });
  } catch {
    throw new IntegrationError(system, 'network');
  }
  if (!res.ok) throw new IntegrationError(system, `http_${res.status}`);
  try {
    return (await res.json()) as T;
  } catch {
    throw new IntegrationError(system, 'bad_json');
  }
}

export function basicAuth(user: string, password: string): string {
  return `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;
}
