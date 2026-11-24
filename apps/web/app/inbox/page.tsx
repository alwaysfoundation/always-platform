'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, explain } from '@/lib/api';
import { Shell } from '@/lib/shell';
import { Icon } from '@/lib/icons';

type Item = {
  handoffId: string; state: string; offer: 'pending' | 'accepted';
  firstName?: string; suburb: string; ageBand: string; step: string; language?: string;
  contact?: { kind: string; value: string }; note?: string;
};

const ASKED: Record<string, string> = {
  church: 'Wants to find a church', explore: 'Wants to explore faith', talk: 'Wants to talk with someone', youth: 'Looking for a youth group',
  group: 'Wants to join a small group', help: 'Needs practical help', read: 'Wants to start reading the Bible',
};
const PASS = [
  { value: 'capacity', label: 'We’re full this month' },
  { value: 'language', label: 'Language' },
  { value: 'fit', label: 'Not the right fit' },
  { value: 'safeguarding', label: 'Safeguarding concern' },
  { value: 'other', label: 'Something else' },
];

function language(code?: string) {
  if (!code) return null;
  try { return new Intl.DisplayNames(['en'], { type: 'language' }).of(code) ?? code; } catch { return code; }
}

export default function Inbox() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState('');
  const [passing, setPassing] = useState('');

  const load = useCallback(() => {
    api<{ items: Item[] }>('/v1/inbox').then((r) => setItems(r.items)).catch((e) => { setItems([]); setStatus(explain(e)); });
  }, []);
  useEffect(load, [load]);

  async function act(id: string, path: string, body?: unknown, done?: string) {
    setBusy(id); setStatus('');
    try { await api(`/v1/handoffs/${id}/${path}`, { method: 'POST', body: body ?? {} }); setStatus(done ?? ''); setPassing(''); load(); }
    catch (e) { setStatus(explain(e)); }
    finally { setBusy(''); }
  }

  const waiting = items?.filter((i) => i.offer === 'pending') ?? [];
  const walking = items?.filter((i) => i.offer === 'accepted') ?? [];

  return (
    <Shell>
      <div className="page-wrap">
        <header className="page-head">
          <h1>Inbox</h1>
          <p className="lead">People near you who asked for a next step. Accept to see how to reach them, or pass and the next church nearby is offered.</p>
        </header>
        <p className="status" role="status" aria-live="polite">{status}</p>

        <section className="ib-sec" aria-labelledby="ib-wait">
          <h2 id="ib-wait">Waiting for you {waiting.length > 0 && <span className="ib-count">{waiting.length}</span>}</h2>
          {items === null ? <p className="meta">Loading…</p> : waiting.length === 0 ? (
            <div className="ib-empty"><Icon name="inbox" size={28} /><p>No one is waiting right now. We’ll email you when someone nearby asks for a next step.</p></div>
          ) : (
            <ul className="ib-list">
              {waiting.map((i) => (
                <li className="ib-card" key={i.handoffId}>
                  <div className="ib-top">
                    <span className="ib-av" aria-hidden="true"><Icon name="person" /></span>
                    <div className="ib-who">
                      <b><i className="ib-new" aria-hidden="true" /><span className="sr">New: </span>{ASKED[i.step] ?? i.step}</b>
                      <span>{[i.suburb, i.ageBand.replace('-', '–'), language(i.language)].filter(Boolean).join(' · ')}</span>
                    </div>
                  </div>
                  {passing === i.handoffId ? (
                    <div className="ib-pass" role="group" aria-label="Why are you passing?">
                      <p>Passing is always OK. Why are you passing?</p>
                      <div className="ib-chips">
                        {PASS.map((p) => <button key={p.value} type="button" disabled={busy === i.handoffId} onClick={() => act(i.handoffId, 'pass', { reason: p.value }, 'Passed. The next church nearby has been offered.')}>{p.label}</button>)}
                        <button type="button" className="ib-cancel" onClick={() => setPassing('')}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="ib-acts">
                      <button className="btn btn-green" disabled={busy === i.handoffId} onClick={() => act(i.handoffId, 'accept', undefined, 'Accepted. You can reach them now.')}><Icon name="check" size={18} />Accept</button>
                      <button className="btn ib-quiet" disabled={busy === i.handoffId} onClick={() => setPassing(i.handoffId)}>Pass</button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="ib-sec" aria-labelledby="ib-walk">
          <h2 id="ib-walk">Walking with</h2>
          {walking.length === 0 ? <div className="ib-empty"><Icon name="team" size={28} /><p>When you accept someone, they’ll appear here with how to reach them.</p></div> : (
            <ul className="ib-list">
              {walking.map((i) => {
                const touched = i.state === 'contacted';
                return (
                  <li className="ib-card" key={i.handoffId}>
                    <div className="ib-top">
                      <span className="ib-av on" aria-hidden="true">{(i.firstName ?? '?').slice(0, 1)}</span>
                      <div className="ib-who">
                        <b>{i.firstName ?? 'Someone'}</b>
                        <span>{[ASKED[i.step] ?? i.step, i.suburb].join(' · ')}</span>
                      </div>
                      <span className={`ib-tag ${touched ? 'ok' : 'wait'}`}>{touched ? 'In touch' : 'Say hello'}</span>
                    </div>
                    <div className="ib-acts">
                      {i.contact && (
                        <a className="btn btn-line" href={i.contact.kind === 'mobile' ? `sms:${i.contact.value}` : `mailto:${i.contact.value}`}>
                          <Icon name="chat" size={18} />{i.contact.kind === 'mobile' ? 'Text' : 'Email'} {i.contact.value}
                        </a>
                      )}
                      {!touched && <button className="btn ib-quiet" disabled={busy === i.handoffId} onClick={() => act(i.handoffId, 'contacted', undefined, 'Thanks. We’ve noted that you got in touch.')}>We’ve been in touch</button>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </Shell>
  );
}
