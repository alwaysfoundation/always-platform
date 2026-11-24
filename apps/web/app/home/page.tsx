'use client';
import { useEffect, useState } from 'react';
import { api, explain, type Brand, type ModuleState, type Org } from '@/lib/api';
import { toDataUrl } from '@/lib/brand-import';
import { Shell } from '@/lib/shell';
import { useOrg } from '@/lib/org';

export default function HomePage() {
  return <Shell><Home /></Shell>;
}

const MODULES: { key: keyof Org['modules']; name: string; does: string }[] = [
  { key: 'respond', name: 'Respond', does: 'Response pages, QR codes and cards, so anyone can ask for a next step.' },
  { key: 'connect', name: 'Connect', does: 'Receive people near you who said yes to Jesus, and welcome them.' },
  { key: 'safety', name: 'Safety', does: 'Your rules register, quarterly check-up and board summary.' },
  { key: 'reports', name: 'Reports', does: 'A monthly report for your board, written from what happened.' },
];

function Home() {
  const { org } = useOrg();
  const [welcome, setWelcome] = useState(false);
  useEffect(() => { setWelcome(new URLSearchParams(location.search).get('welcome') === '1'); }, []);
  if (!org) return null;
  const admin = org.role === 'admin';
  return (
    <div className="home">
      <p className="kicker">{welcome ? 'You\'re all set' : 'Home'}</p>
      <h1>{welcome ? `Welcome, ${org.name}.` : org.name}</h1>
      <p className="lead">{welcome ? 'Your account is ready. Here\'s everything in one place: switch tools on, tune your look and bring in your team.' : 'Everything for your ' + org.kind + ', in one place.'}</p>
      <Modules />
      {admin && <Look />}
      {admin && <Team />}
      <Connect />
    </div>
  );
}

function Modules() {
  const { org, update } = useOrg();
  const [status, setStatus] = useState('');
  if (!org) return null;
  const on = (s: ModuleState) => s !== 'off';
  async function toggle(key: keyof Org['modules']) {
    const next = MODULES.filter((m) => (m.key === key ? !on(org!.modules[m.key]) : on(org!.modules[m.key]))).map((m) => m.key);
    try {
      const r = await api<{ modules: Org['modules'] }>(`/v1/account/orgs/${org!.id}/modules`, { method: 'PUT', body: { modules: next } });
      update({ ...org!, modules: r.modules });
      setStatus('');
    } catch (e) { setStatus(explain(e)); }
  }
  return (
    <section className="hsec" aria-labelledby="h-mod">
      <h2 id="h-mod">Your tools</h2>
      <div className="mods">
        {MODULES.map((m) => {
          const s = org.modules[m.key];
          return (
            <div key={m.key} className="mod" data-on={on(s) || undefined}>
              <div><h3>{m.name}</h3><p>{m.does}</p>{s === 'awaiting_check' && <p className="badge">On once we&rsquo;ve checked your details with your network</p>}</div>
              <button type="button" role="switch" aria-checked={on(s)} aria-label={`${m.name}`} disabled={org.role !== 'admin'} onClick={() => void toggle(m.key)}><i /></button>
            </div>
          );
        })}
      </div>
      <p className="status" role="status">{status}</p>
    </section>
  );
}

function Look() {
  const { org, update } = useOrg();
  const [b, setB] = useState<Brand>(org!.brand);
  const [status, setStatus] = useState('');
  async function save() {
    try {
      const r = await api<{ brand: Brand }>(`/v1/account/orgs/${org!.id}/brand`, { method: 'PUT', body: { ...b, primary: b.primary || '#1B4740', accent: b.accent || '#E8A577' } });
      update({ ...org!, brand: r.brand });
      setStatus('Saved. Your pages use it straight away.');
    } catch (e) { setStatus(explain(e)); }
  }
  return (
    <section className="hsec" aria-labelledby="h-look">
      <h2 id="h-look">Your look</h2>
      <div className="look">
        <label className="drop small">
          <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const u = await toDataUrl(URL.createObjectURL(f)); if (u) setB({ ...b, logo: u }); } }} />
          {b.logo ? <img src={b.logo} alt="Your logo" /> : <span className="drop-plus" aria-hidden="true">+</span>}
          <span>{b.logo ? 'Change logo' : 'Add logo'}</span>
        </label>
        <label className="fld">Main colour<input type="color" value={b.primary || '#1B4740'} onChange={(e) => setB({ ...b, primary: e.target.value.toUpperCase() })} /></label>
        <label className="fld">Button colour<input type="color" value={b.accent || '#E8A577'} onChange={(e) => setB({ ...b, accent: e.target.value.toUpperCase() })} /></label>
        <div className="seg" role="radiogroup" aria-label="Headings">
          <button type="button" role="radio" aria-checked={b.heading === 'modern'} onClick={() => setB({ ...b, heading: 'modern' })}>Modern</button>
          <button type="button" role="radio" aria-checked={b.heading === 'classic'} onClick={() => setB({ ...b, heading: 'classic' })} className="serif">Classic</button>
        </div>
        <button className="btn btn-brand" type="button" onClick={() => void save()}>Save look</button>
      </div>
      <p className="status" role="status">{status}</p>
    </section>
  );
}

type Team = { members: { id: string; email: string; role: string; you: boolean }[]; invites: { id: string; email: string; role: string }[] };
const ROLE: Record<string, string> = { admin: 'Admin', follow_up: 'Follow-up', youth: 'Youth leader' };

function Team() {
  const { org } = useOrg();
  const [team, setTeam] = useState<Team | null>(null);
  const [status, setStatus] = useState('');
  const load = () => api<Team>(`/v1/account/orgs/${org!.id}/team`).then(setTeam).catch((e) => setStatus(explain(e)));
  useEffect(() => { void load(); }, [org?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function invite(f: HTMLFormElement) {
    const data = new FormData(f);
    try {
      await api(`/v1/account/orgs/${org!.id}/invites`, { method: 'POST', body: { email: String(data.get('email') ?? '').trim(), role: data.get('role') } });
      f.reset(); setStatus('Invitation sent.'); void load();
    } catch (e) { setStatus((e as { code?: string }).code === 'already_a_member' ? 'They\'re already on your team.' : explain(e)); }
  }
  async function remove(path: string) {
    try { await api(path, { method: 'DELETE' }); void load(); } catch (e) { setStatus((e as { code?: string }).code === 'last_admin' ? 'Your team needs at least one admin.' : explain(e)); }
  }
  return (
    <section className="hsec" aria-labelledby="h-team">
      <h2 id="h-team">Your team</h2>
      <ul className="team">
        {team?.members.map((m) => (
          <li key={m.id}><span>{m.email}{m.you && <em> (you)</em>}</span><span className="meta">{ROLE[m.role] ?? m.role}</span>
            {!m.you && <button className="link" onClick={() => void remove(`/v1/account/orgs/${org!.id}/members/${m.id}`)}>Remove</button>}</li>
        ))}
        {team?.invites.map((i) => (
          <li key={i.id}><span>{i.email}</span><span className="meta">Invited · {ROLE[i.role] ?? i.role}</span>
            <button className="link" onClick={() => void remove(`/v1/account/orgs/${org!.id}/invites/${i.id}`)}>Cancel</button></li>
        ))}
      </ul>
      <form className="invite" onSubmit={(e) => { e.preventDefault(); void invite(e.currentTarget); }}>
        <label className="fld">Invite by email<input name="email" type="email" required placeholder="name@yourchurch.org" /></label>
        <label className="fld">Role<select name="role" defaultValue="follow_up"><option value="follow_up">Follow-up</option><option value="youth">Youth leader</option><option value="admin">Admin</option></select></label>
        <button className="btn btn-brand" type="submit">Send invite</button>
      </form>
      <p className="meta">Youth leaders see young people&rsquo;s details only once their Working With Children Check is recorded.</p>
      <p className="status" role="status">{status}</p>
    </section>
  );
}

function Connect() {
  const { org } = useOrg();
  const [copied, setCopied] = useState(false);
  const snippet = `<script type="module" src="https://cdn.alwaysfoundation.org/sdk/v0/widget.js"></script>\n<always-response accent="${org!.brand.accent || '#E8A577'}"></always-response>`;
  const items: [string, string, string, boolean][] = [
    ['Your website', 'Put your response page on your own site with the code below.', 'Live', true],
    ['Church management', 'Welcomed people land in your own system with a follow-up task.', 'Elvanto and Planning Center: building', false],
    ['Email and newsletters', 'Add people who ask for it to your newsletter list, with their consent.', 'Mailchimp and others: planned', false],
    ['Zapier and webhooks', 'Connect anything else. Signed webhooks carry ids, never people\'s details.', 'Webhooks: live · Zapier: planned', true],
  ];
  return (
    <section className="hsec" aria-labelledby="h-con">
      <h2 id="h-con">Connect your systems</h2>
      <div className="cons">
        {items.map(([t, d, s, live]) => <div key={t} className="con"><h3>{t}</h3><p>{d}</p><span className={`badge${live ? ' ok' : ''}`}>{s}</span></div>)}
      </div>
      <div className="snip">
        <code>{snippet}</code>
        <button className="btn btn-line" type="button" onClick={() => { void navigator.clipboard?.writeText(snippet); setCopied(true); }}>{copied ? 'Copied' : 'Copy website code'}</button>
      </div>
      <p className="meta">Guides for each are in the <a href="https://alwaysfoundation.org/#/docs/integrations">docs</a>.</p>
    </section>
  );
}
