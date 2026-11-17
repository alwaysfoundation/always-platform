import type { MiddlewareHandler } from 'hono';

/**
 * Simple fixed-window rate limit per client IP (or token). Good enough for a single
 * region; at scale, put Cloudflare rate limiting in front and keep this as a backstop.
 */
export function rateLimit(opts: { windowMs: number; max: number }): MiddlewareHandler {
  const hits = new Map<string, { n: number; reset: number }>();
  return async (c, next) => {
    const key = c.req.header('authorization')?.slice(-16) ?? c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? 'local';
    const t = Date.now();
    const h = hits.get(key);
    if (!h || h.reset < t) hits.set(key, { n: 1, reset: t + opts.windowMs });
    else if (++h.n > opts.max) return c.json({ error: 'rate_limited' }, 429);
    if (hits.size > 10_000) hits.clear();
    await next();
  };
}
