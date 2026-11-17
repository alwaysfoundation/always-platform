/**
 * Import the Always directory CSV (churches and ministries) as "listed" organisations.
 * Usage: npm run import:directory -- path/to/directory_combined.csv
 * Idempotent: matches on name + suburb + state. Never overwrites a claimed or verified profile.
 */
import { readFile } from 'node:fs/promises';
import { connect } from '@always/db';

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows;
  return body.filter((r) => r.length > 1).map((r) => Object.fromEntries(head!.map((h, i) => [h.trim().toLowerCase(), (r[i] ?? '').trim()])));
}

const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80);
const STATES = new Set(['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT']);

const file = process.argv[2];
if (!file) throw new Error('Pass the CSV path');
const rows = parseCsv(await readFile(file, 'utf8'));
const sql = connect();
let added = 0, skipped = 0;
for (const r of rows) {
  const name = r.name;
  const state = (r.state ?? '').toUpperCase();
  if (!name || !STATES.has(state)) { skipped++; continue; }
  const kind = (r.type ?? 'church').toLowerCase() === 'ministry' ? 'ministry' : 'church';
  const postcode = (r.postcode ?? '').replace(/^'/, '') || null;
  const base = slugify(`${name} ${r.suburb ?? ''} ${state}`);
  const res = await sql`
    insert into organisation (kind, display_name, slug, denomination, category, suburb, state, postcode, address, website, source_url, source_date, geo_lat, geo_lng)
    select ${kind}, ${name}, ${base} || case when exists (select 1 from organisation where slug = ${base}) then '-' || substr(md5(random()::text), 1, 4) else '' end,
           ${r.denomination || null}, ${r.category || null}, ${r.suburb || null}, ${state}, ${postcode}, ${r.address || null}, ${r.website || null},
           ${r.source_url || r.source || null}, ${r['source date'] || r.source_date || null}::date,
           pc.lat, pc.lng
    from (select 1) x left join lateral (select lat, lng from place_centroid where postcode = ${postcode} order by (lower(suburb) = lower(${r.suburb ?? ''})) desc limit 1) pc on true
    on conflict (lower(display_name), lower(coalesce(suburb, '')), coalesce(state, '')) do nothing
    returning id`;
  if (res.length) added++; else skipped++;
}
console.log(`Imported ${added} organisations, skipped ${skipped} (duplicates or missing state).`);
await sql.end();
