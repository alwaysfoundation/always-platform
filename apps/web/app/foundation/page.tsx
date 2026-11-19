'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, explain } from '@/lib/api';
import { Shell } from '@/lib/shell';

type Queue = { claims: number; events: number; feedback: number; careTeam: number; acceptedNoContact: number };
type Claim = { id: string; role: string; evidence?: string; email: string; display_name: string; suburb?: string; state?: string; created_at: string };
type Ev = { id: string; title: string; kind: string; starts_at: string; suburb?: string; state: string; url?: string; source: string };
type Fb = { id: string; kind: string; area: string; message: string; created_at: string; wants_reply: boolean };
type Tab = 'claims' | 'events' | 'feedback';

const date = (s: string) => new Date(s).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });

/** The foundation team's console. A person decides every item; the Always Agent prepares, never decides. */
export default function Foundation() {
  const [q, setQ] = useState<Queue | null>(null);
  const [tab, setTab] = useState<Tab>('claims');
  const [claims, setClaims] = useState<Claim[]>([]);
  const [events, setEvents] = useState<Ev[]>([]);
  const [feedback, setFeedback] = useState<Fb[]>([]);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(() => {
    Promise.all([
      api<Queue>('/v1/ops/queue'), api<{ items: Claim[] }>('/v1/ops/claims'),
      api<{ items: Ev[] }>('/v1/ops/events'), api<{ items: Fb[] }>('/v1/ops/feedback'),
    ]).then(([qq, c, e, f]) => { setQ(qq); setClaims(c.items); setEvents(e.items); setFeedback(f.items); })
      .catch((e) => setStatus(explain(e)));
  }, []);
  useEffect(load, [load]);

  async function decide(path: string, body: unknown, id: string, done: string) {
    setBusy(id); setStatus('');
    try { await api(path, { method: 'POST', body }); setStatus(done); load(); }
    catch (e) { setStatus(explain(e)); }
    finally { setBusy(''); }
  }

  const tiles = q ? [
    ['Church claims', q.claims], ['Events to check', q.events], ['Ideas and problems', q.feedback],
    ['With the care team', q.careTeam], ['Accepted, no contact logged', q.acceptedNoContact],
  ] as const : [];

  return (
    <Shell>
      <p className="kicker">Foundation</p>
      <h1>What needs a person today</h1>
      <p className="lead">Check church claims with their denomination or network, review suggested events, and read what people tell us.</p>
      <div className="tiles">{tiles.map(([l, n]) => <div className="tile" key={l}><b>{n}</b><span>{l}</span></div>)}</div>
      <div className="tabs" role="tablist" aria-label="Queues">
        {(['claims', 'events', 'feedback'] as Tab[]).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
            {t === 'claims' ? 'Church claims' : t === 'events' ? 'Events' : 'Ideas and problems'}
          </button>
        ))}
      </div>
      <p className="status" role="status" aria-live="polite">{status}</p>

      {tab === 'claims' && (claims.length === 0 ? <div className="empty">No claims waiting.</div> : (
        <div className="list">{claims.map((c) => (
          <article className="card" key={c.id}>
            <h3>{c.display_name}</h3>
            <p className="meta">{[c.suburb, c.state].filter(Boolean).join(', ')} · claimed {date(c.created_at)}</p>
            <p style={{ margin: 0 }}><b>{c.role}</b> · {c.email}</p>
            {c.evidence && <p className="meta" style={{ margin: 0 }}>{c.evidence}</p>}
            <div className="row">
              <button className="btn btn-green" disabled={busy === c.id} onClick={() => decide(`/v1/ops/claims/${c.id}/decide`, { decision: 'approve' }, c.id, `Approved. ${c.display_name} can now set up their page.`)}>Approve claim</button>
              <button className="btn btn-line" disabled={busy === c.id} onClick={() => decide(`/v1/ops/claims/${c.id}/decide`, { decision: 'reject' }, c.id, 'Declined. We emailed them to help.')}>Decline</button>
            </div>
          </article>))}
        </div>))}

      {tab === 'events' && (events.length === 0 ? <div className="empty">No events waiting.</div> : (
        <div className="list">{events.map((e) => (
          <article className="card" key={e.id}>
            <h3>{e.title}</h3>
            <p className="meta">{date(e.starts_at)} · {[e.suburb, e.state].filter(Boolean).join(', ')} · {e.kind} · {e.source}</p>
            {e.url && <p style={{ margin: 0 }}><a href={e.url} target="_blank" rel="noopener noreferrer">Event page</a></p>}
            <div className="row">
              <button className="btn btn-green" disabled={busy === e.id} onClick={() => decide(`/v1/ops/events/${e.id}/decide`, { decision: 'publish' }, e.id, 'Published on the Events page.')}>Publish</button>
              <button className="btn btn-line" disabled={busy === e.id} onClick={() => decide(`/v1/ops/events/${e.id}/decide`, { decision: 'hide' }, e.id, 'Hidden.')}>Hide</button>
            </div>
          </article>))}
        </div>))}

      {tab === 'feedback' && (feedback.length === 0 ? <div className="empty">Nothing new.</div> : (
        <div className="list">{feedback.map((f) => (
          <article className="card" key={f.id}>
            <div className="row"><span className="badge">{f.kind === 'bug' ? 'Problem' : f.kind === 'missing' ? 'Missing church' : 'Idea'}</span><span className="meta">{f.area} · {date(f.created_at)}{f.wants_reply ? ' · wants a reply' : ''}</span></div>
            <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{f.message}</p>
          </article>))}
        </div>))}
    </Shell>
  );
}
