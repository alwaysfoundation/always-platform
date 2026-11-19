import { createHash } from 'node:crypto';
/**
 * Append-only, hash-chained audit log (GOV-9, IR-3). Each entry's hash covers the
 * previous hash, so any edit or deletion breaks the chain and is detectable.
 * Never put personal data in action, subject or reason: use ids.
 */
export async function audit(tx, e) {
    await tx `select pg_advisory_xact_lock(42001)`; // serialise the chain
    const [prev] = await tx `select hash from audit_event order by id desc limit 1`;
    const at = new Date();
    const prevHash = prev?.hash ? Buffer.from(prev.hash) : null;
    const hash = createHash('sha256')
        .update(prevHash ?? Buffer.alloc(0))
        .update(JSON.stringify([at.toISOString(), e.actor ?? null, e.orgId ?? null, e.action, e.subject, e.reason ?? null]))
        .digest();
    await tx `insert into audit_event (at, actor, org_id, action, subject_ref, reason, prev_hash, hash)
           values (${at}, ${e.actor ?? null}, ${e.orgId ?? null}, ${e.action}, ${e.subject}, ${e.reason ?? null}, ${prevHash}, ${hash})`;
}
/** Verify the whole chain. Returns the id of the first broken entry, or null. */
export async function verifyChain(tx) {
    const rows = await tx `select * from audit_event order by id`;
    let prev = null;
    for (const r of rows) {
        const expected = createHash('sha256')
            .update(prev ?? Buffer.alloc(0))
            .update(JSON.stringify([new Date(r.at).toISOString(), r.actor ?? null, r.org_id ?? null, r.action, r.subject_ref, r.reason ?? null]))
            .digest();
        if (!expected.equals(Buffer.from(r.hash)))
            return Number(r.id);
        prev = Buffer.from(r.hash);
    }
    return null;
}
