/** Local development seed: a care team, two verified churches, a sender, tokens. Synthetic only. */
import { connect } from '@always/db';
import { encrypt, newToken } from '../apps/api/src/crypto.js';
const sql = connect();
await sql `insert into place_centroid values ('2150','Parramatta','NSW',-33.815,151.003), ('2000','Sydney','NSW',-33.8688,151.2093), ('5000','Adelaide','SA',-34.9285,138.6007) on conflict do nothing`;
const mk = async (name, slug, lat, lng, trust, care = false) => {
    const [o] = await sql `insert into organisation (kind, display_name, slug, suburb, state, postcode, geo_lat, geo_lng, trust_level, last_confirmed_at, notify_email_ct, is_care_team)
    values ('church', ${name}, ${slug}, 'Parramatta', 'NSW', '2150', ${lat}, ${lng}, ${trust}, now(), ${encrypt(`${slug}@example.org`)}, ${care})
    on conflict (slug) do update set display_name = excluded.display_name returning id`;
    await sql `insert into capacity (org_id) values (${o.id}) on conflict do nothing`;
    for (const c of ['church', 'explore', 'youth', 'talk'])
        await sql `insert into offer_category (org_id, category) values (${o.id}, ${c}) on conflict do nothing`;
    return o.id;
};
const ids = {
    care: await mk('Always care team', 'care-team', -33.8688, 151.2093, 'verified', true),
    hope: await mk('Hope Church Parramatta (demo)', 'hope-demo', -33.815, 151.004, 'verified_youth'),
    grace: await mk('Grace Church (demo)', 'grace-demo', -33.80, 151.0, 'verified'),
    uen: await mk('UEN (demo sender)', 'uen-demo', -34.9285, 138.6007, 'verified'),
};
for (const [org, scopes, label] of [[ids.uen, ['responses:write'], 'sender'], [ids.hope, ['inbox', 'profile', 'activity'], 'church']]) {
    const t = newToken('alw_test');
    await sql `insert into api_token (org_id, name, token_hash, scopes) values (${org}, ${label}, ${t.hash}, ${scopes})`;
    console.log(`${label} token: ${t.token}`);
}
console.log('Seeded. Tokens above are for local development only.');
await sql.end();
