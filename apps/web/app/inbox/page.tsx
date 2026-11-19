'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, explain } from '@/lib/api';
import { Shell } from '@/lib/shell';

type Item = {
  handoffId: string; state: string; offer: 'pending' | 'accepted';
  firstName?: string; suburb: string; ageBand: string; step: string; language?: string;
  contact?: { kind: string; value: string }; note?: string;
};

const STEPS: Record<string, string> = {
  church: 'Find a church', explore: 'Explore faith', talk: 'Talk with someone', youth: 'Youth group',
  group: 'Join a small group', help: 'Practical help', read: 'Start reading the Bible',
};
const PASS = [
  { value: 'capacity', label: "We're full this month" },
  { value: 'language', label: 'Language' },
  { value: 'fit', label: "Not the right fit" },
  { value: 'safeguarding', label: 'Safeguarding concern' },
  { value: 'other', label: 'Something else' },
];

export default function Inbox() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(() => {
    api<{ items: Item[] }>('/v1/inbox').then((r) => setItems(r.items)).catch((e) => { setItems([]); setStatus(explain(e)); });
  }, []);
  useEffect(load, [load]);

  async function act(id: string, path: string, body?: unknown, done?: string) {
    setBusy(id); setStatus('');
    try { await api(`/v1/handoffs/${id}/${path}`, { method: 'POST', body: body ?? {} }); setStatus(done ?? ''); load(); }
    catch (e) { setStatus(explain(e)); }
    finally { setBusy(''); }
  }

  const waiting = items?.filter((i) => i.offer === 'pending') ?? [];
  const walking = items?.filter((i) => i.offer === 'accepted') ?? [];

  return (
    <Shell>
      <p className="kicker">Inbox</p>
      <h1>People near you</h1>
      <p className="lead">Accept to see their number and welcome them, or pass so the next church nearby is offered. Passing is always OK.</p>
      <p className="status" role="status" aria-live="polite">{status}</p>

      <h2 style={{ fontSize: 22, margin: '28px 0 14px' }}>Waiting for you</h2>
      {items === null ? <p className="meta">Loading…</p> : waiting.length === 0 ? (
        <div className="empty">No one is waiting right now. We'll email you when someone nearby asks for a next step.</div>
      ) : (
        <div className="list">
          {waiting.map((i) => (
            <article className="card" key={i.handoffId}>
              <div className="row"><h3>{i.firstName ?? 'Someone'}</h3><span className="badge">New</span></div>
              <p className="meta">{i.suburb} · {STEPS[i.step] ?? i.step} · {i.ageBand}{i.language ? ` · ${i.language}` : ''}</p>
              <div className="row">
                <button className="btn btn-green" disabled={busy === i.handoffId} onClick={() => act(i.handoffId, 'accept', undefined, 'Accepted. Their number is now shown below.')}>Accept</button>
                <label className="row" style={{ gap: 8 }}>
                  <span className="meta">Pass:</span>
                  <select aria-label={`Pass ${i.firstName ?? 'this introduction'}`} defaultValue="" disabled={busy === i.handoffId}
                    onChange={(e) => e.target.value && act(i.handoffId, 'pass', { reason: e.target.value }, 'Passed. The next church nearby has been offered.')}
                    style={{ minHeight: 44, borderRadius: 12, border: '1px solid var(--line)', padding: '0 12px', background: 'var(--paper)', font: 'inherit' }}>
                    <option value="" disabled>Choose a reason</option>
                    {PASS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </label>
              </div>
            </article>
          ))}
        </div>
      )}

      <h2 style={{ fontSize: 22, margin: '36px 0 14px' }}>Walking with</h2>
      {walking.length === 0 ? <div className="empty">When you accept someone, they'll appear here with their number.</div> : (
        <div className="list">
          {walking.map((i) => (
            <article className="card" key={i.handoffId}>
              <div className="row"><h3>{i.firstName ?? 'Someone'}</h3><span className="badge ok">{i.state === 'contacted' ? 'In touch' : 'Accepted'}</span></div>
              <p className="meta">{i.suburb} · {STEPS[i.step] ?? i.step}</p>
              {i.contact && <p style={{ margin: 0 }}><a href={i.contact.kind === 'mobile' ? `sms:${i.contact.value}` : `mailto:${i.contact.value}`}>{i.contact.value}</a></p>}
              {i.state !== 'contacted' && (
                <div className="row">
                  <button className="btn btn-line" disabled={busy === i.handoffId} onClick={() => act(i.handoffId, 'contacted', undefined, "Thanks. We've noted that you got in touch.")}>We've been in touch</button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </Shell>
  );
}
