import postgres from 'postgres';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
/** One pooled connection per process. DATABASE_URL must point at an Australian region. */
export function connect(url = process.env.DATABASE_URL) {
    if (!url)
        throw new Error('DATABASE_URL is not set');
    return postgres(url, { max: Number(process.env.DB_POOL_MAX ?? 5), idle_timeout: 20, prepare: false });
}
/**
 * Run work inside a transaction as the app_user role with the request's org and
 * user set, so row-level security applies to every statement.
 */
export async function asApp(sql, ctx, fn) {
    return sql.begin(async (tx) => {
        await tx `select set_config('app.org_id', ${ctx.orgId ?? ''}, true), set_config('app.user_id', ${ctx.userId ?? ''}, true)`;
        await tx.unsafe('set local role app_user');
        return fn(tx);
    });
}
/** Run work as the service (owner) role. Only for the engine, scheduler and admin jobs. */
export async function asService(sql, fn) {
    return sql.begin(fn);
}
/** Apply migrations in order, once each. */
export async function migrate(sql, dir) {
    await sql `create table if not exists schema_migration (name text primary key, applied_at timestamptz not null default now())`;
    const done = new Set((await sql `select name from schema_migration`).map((r) => r.name));
    const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
    const applied = [];
    for (const f of files) {
        if (done.has(f))
            continue;
        // Files carry their own begin/commit for psql users; we run them inside one transaction here.
        const text = (await readFile(join(dir, f), 'utf8')).replace(/^\s*begin;\s*$/im, '').replace(/^\s*commit;\s*$/im, '');
        await sql.begin(async (tx) => {
            await tx.unsafe(text);
            await tx `insert into schema_migration (name) values (${f})`;
        });
        applied.push(f);
    }
    return applied;
}
