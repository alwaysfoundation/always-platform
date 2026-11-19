/**
 * Verify an Always webhook (CloudEvents 1.0, HMAC-SHA256). Reject anything older than
 * 5 minutes to stop replays. Works in Node 18+, Deno, Bun and edge runtimes.
 */
export async function verifyWebhook(opts) {
    const now = opts.now ?? Math.floor(Date.now() / 1000);
    if (Math.abs(now - Number(opts.timestamp)) > (opts.toleranceSec ?? 300))
        return false;
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(opts.secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${opts.timestamp}.${opts.body}`));
    const expected = 'v1=' + [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
    if (expected.length !== opts.signature.length)
        return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++)
        diff |= expected.charCodeAt(i) ^ opts.signature.charCodeAt(i);
    return diff === 0;
}
