// field-team: lets a ministry's signed-in leaders see and follow up their own field contacts.
// Auth: a Supabase Auth session (emailed sign-in link). The function checks the token itself with
// Supabase Auth (verify_jwt is off so browser preflight requests work), then checks field_team.
// Adults only: under-18s stay with the foundation's care team until a verified youth partner takes them.
// Run in Sydney (?forceFunctionRegion=ap-southeast-2). No personal data is logged.
import postgres from 'npm:postgres@3.4.5';

const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { max: 2, prepare: false });
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const ORIGIN = /^https:\/\/([a-z0-9-]+\.)?alwaysfoundation\.org$/;
const STATUSES = new Set(['new', 'contacted', 'connected']);

function cors(origin: string | null): Record<string, string> {
  const h: Record<string, string> = { 'vary': 'origin', 'cache-control': 'no-store' };
  if (origin && ORIGIN.test(origin)) {
    h['access-control-allow-origin'] = origin;
    h['access-control-allow-methods'] = 'GET, POST, OPTIONS';
    h['access-control-allow-headers'] = 'authorization, content-type';
    h['access-control-max-age'] = '86400';
  }
  return h;
}
const json = (status: number, body: unknown, h: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...h } });

async function leaderEmail(req: Request): Promise<string | null> {
  const auth = req.headers.get('authorization') ?? '';
  if (!/^Bearer [A-Za-z0-9._-]{20,}$/.test(auth)) return null;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { authorization: auth, apikey: ANON } });
  if (!r.ok) return null;
  const u = await r.json();
  return typeof u?.email === 'string' && u.email_confirmed_at ? u.email.toLowerCase() : null;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const h = cors(origin);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
  if (!origin || !ORIGIN.test(origin)) return json(403, { error: 'origin_not_allowed' }, h);

  try {
    const email = await leaderEmail(req);
    if (!email) return json(401, { error: 'sign_in_required' }, h);
    const url = new URL(req.url);
    const source = (url.searchParams.get('source') ?? '').slice(0, 40);
    const [member] = await sql`select 1 from field_team where source = ${source} and email = ${email} and removed_at is null`;
    if (!member) return json(403, { error: 'not_on_team' }, h);

    if (req.method === 'GET') {
      const contacts = await sql`
        select id, created_at, first_name, mobile, suburb, postcode, step, status, notify_sender, handled_at
        from field_contact
        where source = ${source} and age_band = '18+' and status <> 'withdrawn'
        order by created_at desc limit 500`;
      const [{ minors }] = await sql`select count(*)::int as minors from field_contact where source = ${source} and age_band <> '18+' and status <> 'withdrawn'`;
      return json(200, { contacts, minorsWithCareTeam: minors }, h);
    }

    if (req.method === 'POST') {
      const b = await req.json().catch(() => ({}));
      const id = typeof b.id === 'string' && /^[0-9a-f-]{36}$/.test(b.id) ? b.id : null;
      if (!id) return json(422, { error: 'invalid' }, h);
      if (b.action === 'withdraw') {
        // The person changed their mind: delete straight away.
        const gone = await sql`delete from field_contact where id = ${id} and source = ${source} and age_band = '18+' returning 1`;
        return json(gone.length ? 200 : 404, { ok: gone.length > 0 }, h);
      }
      if (!STATUSES.has(b.status)) return json(422, { error: 'invalid_status' }, h);
      const done = await sql`update field_contact set status = ${b.status}, handled_at = now(), handled_by = ${email}
                             where id = ${id} and source = ${source} and age_band = '18+' returning 1`;
      return json(done.length ? 200 : 404, { ok: done.length > 0 }, h);
    }
    return json(405, { error: 'method_not_allowed' }, h);
  } catch (e) {
    console.error('field_team_failed', (e as { code?: string }).code ?? 'unknown');
    return json(500, { error: 'failed' }, h);
  }
});
