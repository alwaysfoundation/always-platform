/**
 * Import Christian events from a ticketing platform export (Humanitix, Eventbrite, TryBooking)
 * or the foundation's curated list. Input is JSON: an array of
 *   { externalId, title, kind?, startsAt, endsAt?, venue?, suburb?, state, postcode?, url? }
 * Idempotent: re-running updates existing events by (source, externalId).
 * Only use exports and APIs where the platform's terms allow it.
 *
 *   npm run import:events -- path/to/events.json [import|foundation]
 */
import { readFileSync } from 'node:fs';
import { connect } from '@always/db';
const [file, source = 'import'] = process.argv.slice(2);
if (!file || !['import', 'foundation'].includes(source)) {
    console.error('usage: import-events <file.json> [import|foundation]');
    process.exit(1);
}
const STATES = new Set(['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT']);
const KINDS = new Set(['worship', 'music', 'outreach', 'conference', 'youth', 'course', 'prayer', 'training', 'other']);
const rows = JSON.parse(readFileSync(file, 'utf8'));
const sql = connect();
let n = 0, skipped = 0;
for (const r of rows) {
    if (!r.externalId || !r.title || !r.startsAt || !STATES.has(r.state) || (r.url && !r.url.startsWith('https://'))) {
        skipped++;
        continue;
    }
    const kind = r.kind && KINDS.has(r.kind) ? r.kind : 'other';
    await sql `insert into event (title, kind, starts_at, ends_at, venue, suburb, state, postcode, url, source, external_id, status)
    values (${r.title}, ${kind}, ${r.startsAt}, ${r.endsAt ?? null}, ${r.venue ?? null}, ${r.suburb ?? null}, ${r.state}, ${r.postcode ?? null},
            ${r.url ?? null}, ${source}, ${r.externalId}, ${source === 'foundation' ? 'published' : 'pending'})
    on conflict (source, external_id) do update set title = excluded.title, kind = excluded.kind, starts_at = excluded.starts_at,
      ends_at = excluded.ends_at, venue = excluded.venue, suburb = excluded.suburb, state = excluded.state, postcode = excluded.postcode, url = excluded.url`;
    n++;
}
console.log(`events imported: ${n}, skipped: ${skipped}`);
await sql.end();
