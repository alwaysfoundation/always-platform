// field-contact: saves a consented outreach response to the Sydney database.
// Called by partner apps on foundation subdomains (e.g. sydneyfire.alwaysfoundation.org)
// with ?forceFunctionRegion=ap-southeast-2 so it runs in Sydney.
// No personal data is ever logged or returned.
// Deployed as a Supabase Edge Function (verify_jwt off: it checks the origin and validates every field itself).
import postgres from 'npm:postgres@3.4.5';

const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { max: 2, prepare: false });
const ORIGIN = /^https:\/\/([a-z0-9-]+\.)?alwaysfoundation\.org$/;
const SOURCES = new Set(['sydneyfire']);
const MOBILE = /^(\+?61|0)4\d{8}$/;
const BANDS = new Set(['under13', '13-14', '15-17', '18+']);
const STEPS = new Set(['church', 'youth', 'talk', 'explore']);
// Receiving partners a person can choose, and the step each serves.
const PARTNERS: Record<string, string> = { alpha: 'explore' };

function cors(origin: string | null): Record<string, string> {
  const h: Record<string, string> = { 'vary': 'origin' };
  if (origin && ORIGIN.test(origin)) {
    h['access-control-allow-origin'] = origin;
    h['access-control-allow-methods'] = 'POST, OPTIONS';
    h['access-control-allow-headers'] = 'content-type';
    h['access-control-max-age'] = '86400';
  }
  return h;
}
const json = (status: number, body: unknown, h: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...h } });
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const digits = (v: unknown) => str(v, 20).replace(/[\s()-]/g, '');

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const h = cors(origin);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' }, h);
  if (!origin || !ORIGIN.test(origin)) return json(403, { error: 'origin_not_allowed' }, h);
  if (Number(req.headers.get('content-length') ?? 0) > 8000) return json(413, { error: 'too_large' }, h);

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json(400, { error: 'bad_json' }, h); }
  if (str(b.website, 200)) return json(201, { ok: true }, h); // honeypot: quietly drop bots

  const source = str(b.source, 40);
  const ageBand = str(b.ageBand, 10);
  const step = str(b.step, 10);
  const c = (b.consent ?? {}) as Record<string, unknown>;
  const party = c.party === 'parent' ? 'parent' : 'self';
  const childAssent = c.childAssent === true;
  const mobile = digits(b.mobile);
  const parentMobile = digits(b.parentMobile);
  const firstName = str(b.firstName, 60);
  const suburb = str(b.suburb, 60);
  const postcode = str(b.postcode, 4);
  const wording = str(c.wordingVersion, 40);
  const shareWith = Array.isArray(c.shareWith) ? [...new Set(c.shareWith.filter((x): x is string => typeof x === 'string'))] : [];

  // Minors rules run first.
  if (!BANDS.has(ageBand)) return json(422, { error: 'age_band_required' }, h);
  if (ageBand === 'under13' && (party !== 'parent' || firstName)) return json(422, { error: 'under13_parent_only' }, h);
  if ((ageBand === 'under13' || ageBand === '13-14') && !childAssent && party === 'parent') return json(422, { error: 'child_assent_required' }, h);
  if (ageBand === '13-14' && !MOBILE.test(parentMobile)) return json(422, { error: 'parent_contact_required' }, h);
  if (ageBand !== '18+' && !['youth', 'talk'].includes(step)) return json(422, { error: 'step_not_for_minors' }, h);
  // Sharing with a partner: adults only, only for the step that partner serves.
  for (const p of shareWith) {
    if (PARTNERS[p] !== step || ageBand !== '18+') return json(422, { error: 'share_not_allowed' }, h);
  }
  // Consent fails closed.
  if (c.connect !== true) return json(422, { error: 'consent_required' }, h);
  if (!SOURCES.has(source) || !STEPS.has(step) || !wording) return json(422, { error: 'invalid' }, h);
  if (ageBand !== 'under13' && !firstName) return json(422, { error: 'first_name_required' }, h);
  if (!MOBILE.test(mobile) || suburb.length < 2 || !/^\d{4}$/.test(postcode)) return json(422, { error: 'invalid_details' }, h);

  try {
    // Simple flood guard: at most 40 saves a minute per source.
    const [{ n }] = await sql`select count(*)::int as n from field_contact where source = ${source} and created_at > now() - interval '1 minute'`;
    if (n >= 40) return json(429, { error: 'slow_down' }, h);
    // A 13-14 year old who filled it in themselves has given their own assent; a parent still needs to confirm.
    const assent = ageBand === '13-14' && party === 'self' ? true : childAssent;
    const status = ageBand === '13-14' ? 'parent_pending' : 'new';
    await sql`insert into field_contact (source, age_band, step, first_name, mobile, parent_mobile, suburb, postcode,
                consent_connect, allow_next_nearby, notify_sender, party, child_assent, wording_version, status, share_with)
              values (${source}, ${ageBand}, ${step}, ${ageBand === 'under13' ? null : firstName}, ${mobile},
                ${ageBand === '13-14' ? parentMobile : null}, ${suburb}, ${postcode}, true, ${c.allowNextNearby === true},
                ${c.notifySender === true}, ${party}, ${assent}, ${wording}, ${status}, ${shareWith})`;
    return json(201, { ok: true }, h);
  } catch (e) {
    console.error('field_contact_save_failed', (e as { code?: string }).code ?? 'unknown'); // code only, never the data
    return json(500, { error: 'save_failed' }, h);
  }
});
