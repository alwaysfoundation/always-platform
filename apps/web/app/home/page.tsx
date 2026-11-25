'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Icon } from '@/lib/icons';
import { Shell } from '@/lib/shell';
import { useOrg } from '@/lib/org';
import type { Report } from '@/lib/report';
import { PageCard } from '@/lib/page-card';

const TOTALS = { responded: 'Responded', introduced: 'Introduced', accepted: 'Welcomed', contacted: 'Contacted', connected: 'Connected' } as const;

export default function HomePage() {
  return <Shell><Home /></Shell>;
}

type Item = { handoffId: string; state: string; offer: 'pending' | 'accepted'; firstName?: string; suburb: string };
type Step = { icon: string; title: string; detail: string; href: string; action: string; tone?: 'urgent' };

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function quarter() {
  const d = new Date(), q = Math.floor(d.getMonth() / 3);
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  return { from: iso(new Date(Date.UTC(d.getFullYear(), q * 3, 1))), to: iso(new Date(Date.UTC(d.getFullYear(), q * 3 + 3, 0))) };
}

function Home() {
  const { org } = useOrg();
  const router = useRouter();
  const [welcome, setWelcome] = useState(false);
  const [items, setItems] = useState<Item[] | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [invites, setInvites] = useState(0);

  useEffect(() => { setWelcome(new URLSearchParams(location.search).get('welcome') === '1'); }, []);
  useEffect(() => {
    if (!org) return;
    if (org.modules.connect !== 'off') api<{ items: Item[] }>('/v1/inbox').then((r) => setItems(r.items)).catch(() => setItems([]));
    else setItems([]);
    if (org.modules.reports !== 'off') { const q = quarter(); api<Report>(`/v1/org/report?from=${q.from}&to=${q.to}`).then(setReport).catch(() => setReport(null)); }
    if (org.role === 'admin') api<{ invites: unknown[] }>(`/v1/account/orgs/${org.id}/team`).then((t) => setInvites(t.invites.length)).catch(() => setInvites(0));
  }, [org]);

  if (!org) return null;

  const waiting = items?.filter((i) => i.offer === 'pending') ?? [];
  const toContact = items?.filter((i) => i.offer === 'accepted' && i.state !== 'contacted') ?? [];
  const steps: Step[] = [];
  if (waiting.length) steps.push({ icon: 'inbox', tone: 'urgent', title: waiting.length === 1 ? 'Someone near you is waiting to be welcomed' : `${waiting.length} people near you are waiting to be welcomed`, detail: `From ${[...new Set(waiting.map((w) => w.suburb))].slice(0, 3).join(', ')}. Accept to see how to reach them.`, href: '/inbox', action: 'Open inbox' });
  for (const p of toContact.slice(0, 2)) steps.push({ icon: 'person', title: `Get in touch with ${p.firstName ?? 'the person you accepted'}`, detail: 'You accepted them. A short, warm message today makes all the difference.', href: '/inbox', action: 'See details' });
  if (welcome || !org.brand.logo) steps.push({ icon: 'paint', title: 'Make it look like you', detail: 'Add your logo and colours. They appear on everything people see.', href: '/settings#h-look', action: 'Add your look' });
  if (org.role === 'admin') steps.push(invites ? { icon: 'team', title: `${invites} ${invites === 1 ? 'invitation is' : 'invitations are'} waiting`, detail: 'Remind them to check their email, or send a new one.', href: '/settings#h-team', action: 'See team' } : { icon: 'team', title: 'Bring in your team', detail: 'Invite your follow-up and youth leaders by email. Each sees only what their role needs.', href: '/settings#h-team', action: 'Invite' });
  if (report) steps.push({ icon: 'reports', title: 'This quarter’s report is ready', detail: 'Share it with your board or funders in one link. Totals only, never names.', href: '/reports', action: 'View report' });
  if (items && items.length === 0 && org.modules.connect !== 'off') steps.push({ icon: 'globe', title: 'Check how people find you', detail: 'Choose whether you appear in the church feed, so ministries nearby can introduce people to you.', href: '/listing', action: 'Your listing' });
  if (org.modules.safety !== 'off') steps.push({ icon: 'shield', title: 'Your quarterly safety check-up', detail: 'Ten minutes to check your rules are current, with a summary for your board.', href: 'https://alwaysfoundation.org/#/mysafety', action: 'Start check-up' });

  const t = report?.totals ?? {};
  const fig = (k: string) => (typeof t[k] === 'number' ? (t[k] as number).toLocaleString() : '—');
  const quiet = items !== null && waiting.length === 0 && toContact.length === 0;
  const empty = !report || Object.values(t).every((v) => !v);
  const shown = (Object.keys(TOTALS) as (keyof typeof TOTALS)[]).filter((k) => typeof t[k] === 'number').slice(-3);

  return (
    <div className="today">
      <header className="today-head">
        <p className="today-date">{new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <h1>{welcome ? `Welcome to Always, ${org.name}.` : `${greeting()}.`}</h1>
        {quiet && org.modules.connect !== 'off' && <p className="today-calm"><Icon name="check" size={16} />No one is waiting for you right now.</p>}
      </header>

      <section className="next" aria-labelledby="h-next">
        <h2 id="h-next">Next steps</h2>
        {items === null ? <p className="meta">Loading…</p> : (
          <ul>
            {steps.slice(0, 5).map((s) => (
              <li key={s.title} data-tone={s.tone}>
                <a href={s.href} onClick={(e) => { if (s.href.startsWith('/')) { e.preventDefault(); router.push(s.href); } }}>
                  <i className="next-ic"><Icon name={s.icon} /></i>
                  <span className="next-tx"><b>{s.title}</b><span>{s.detail}</span></span>
                  <span className="next-go">{s.action}<Icon name="arrow" size={16} /></span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <PageCard />

      {org.modules.reports !== 'off' && empty && items !== null && (
        <section className="glance" aria-labelledby="h-glance">
          <div className="glance-head"><h2 id="h-glance">This quarter</h2></div>
          <p className="glance-empty">Your figures appear here after your first welcome. Totals only, never names.</p>
        </section>
      )}
      {report && !empty && (
        <section className="glance" aria-labelledby="h-glance">
          <div className="glance-head"><h2 id="h-glance">This quarter</h2><Link href="/reports">Full report</Link></div>
          <dl>
            {(shown.length ? shown : (['accepted', 'contacted', 'connected'] as const)).map((k) => <div key={k}><dt>{TOTALS[k]}</dt><dd>{fig(k)}</dd></div>)}
          </dl>
        </section>
      )}
    </div>
  );
}
