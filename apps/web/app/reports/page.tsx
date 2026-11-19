'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, explain, getSession } from '@/lib/api';
import { ReportView, type Report } from '@/lib/report';
import { Shell } from '@/lib/shell';

type Share = { id: string; label: string; from_day: string; to_day: string; expires_at: string; revoked_at: string | null; views: number };
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Standard periods only, so small churches can't subtract one report from another to find a neighbour's figures. */
function periods(today = new Date()) {
  const y = today.getFullYear(), m = today.getMonth();
  const monthStart = (yy: number, mm: number) => new Date(Date.UTC(yy, mm, 1));
  const monthEnd = (yy: number, mm: number) => new Date(Date.UTC(yy, mm + 1, 0));
  const q = Math.floor(m / 3);
  const fyStartYear = m >= 6 ? y : y - 1;
  return [
    { id: 'this-month', label: 'This month', from: iso(monthStart(y, m)), to: iso(monthEnd(y, m)) },
    { id: 'last-month', label: 'Last month', from: iso(monthStart(y, m - 1)), to: iso(monthEnd(y, m - 1)) },
    { id: 'this-quarter', label: 'This quarter', from: iso(monthStart(y, q * 3)), to: iso(monthEnd(y, q * 3 + 2)) },
    { id: 'last-quarter', label: 'Last quarter', from: iso(monthStart(y, q * 3 - 3)), to: iso(monthEnd(y, q * 3 - 1)) },
    { id: 'financial-year', label: 'This financial year (July to June)', from: iso(monthStart(fyStartYear, 6)), to: iso(monthEnd(fyStartYear + 1, 5)) },
    { id: 'calendar-year', label: 'This calendar year', from: `${y}-01-01`, to: `${y}-12-31` },
  ];
}

export default function Reports() {
  const ps = useMemo(() => periods(), []);
  const [period, setPeriod] = useState('last-month');
  const [view, setView] = useState<'sender' | 'receiver'>('sender');
  const [report, setReport] = useState<Report | null>(null);
  const [shares, setShares] = useState<Share[]>([]);
  const [status, setStatus] = useState('');
  const [link, setLink] = useState('');
  const p = ps.find((x) => x.id === period)!;
  const qs = `from=${p.from}&to=${p.to}&view=${view}`;

  const load = useCallback(() => {
    setStatus('');
    api<Report>(`/v1/org/report?${qs}`).then(setReport).catch((e) => { setReport(null); setStatus(explain(e)); });
    api<{ items: Share[] }>('/v1/org/report-shares').then((r) => setShares(r.items)).catch(() => {});
  }, [qs]);
  useEffect(load, [load]);

  async function csv() {
    const s = getSession();
    const res = await fetch(`/api/v1/org/report.csv?${qs}`, { headers: s ? { authorization: `Bearer ${s.token}`, 'x-always-org': s.org } : {} });
    if (!res.ok) return setStatus('The spreadsheet could not be made. Please try again.');
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a'); a.href = url; a.download = `always-report-${p.from}-to-${p.to}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  async function share(form: HTMLFormElement) {
    const label = String(new FormData(form).get('label') ?? '').trim();
    if (label.length < 2) return setStatus('Add who the link is for, like "Board, Q1".');
    try {
      const r = await api<{ token: string }>('/v1/org/report-shares', { method: 'POST', body: { label, from: p.from, to: p.to } });
      setLink(`${location.origin}/r/${r.token}`); form.reset(); load();
    } catch (e) { setStatus(explain(e)); }
  }

  async function saveProfile(form: HTMLFormElement) {
    const f = new FormData(form);
    try {
      await api('/v1/org/report-profile', { method: 'PUT', body: { title: f.get('title') || undefined, funderName: f.get('funder') || undefined, intro: f.get('intro') || undefined } });
      setStatus('Saved. Your reports now use these words.'); load();
    } catch (e) { setStatus(explain(e)); }
  }

  return (
    <Shell>
      <p className="kicker">Reports</p>
      <h1>Your reports</h1>
      <p className="lead">The same five steps every ministry counts, ready for your board and funders. Totals only, so no one can be identified. <Link href="/reports/examples">See example reports</Link>.</p>

      <div className="controls">
        <label>Period
          <select value={period} onChange={(e) => setPeriod(e.target.value)}>{ps.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select>
        </label>
        <label>Show
          <select value={view} onChange={(e) => setView(e.target.value as 'sender' | 'receiver')}>
            <option value="sender">People who responded through us</option>
            <option value="receiver">People we welcomed</option>
          </select>
        </label>
        <button className="btn btn-green" onClick={() => window.print()}>Download as PDF</button>
        <button className="btn btn-line" onClick={csv}>Download spreadsheet</button>
      </div>
      <p className="status" role="status" aria-live="polite">{status}</p>

      {report ? <ReportView r={report} /> : <div className="empty">Your report will appear here.</div>}

      <form className="panel" onSubmit={(e) => { e.preventDefault(); share(e.currentTarget); }}>
        <h3>Share with a funder</h3>
        <p className="meta" style={{ margin: 0 }}>A private link to this report as it is today. It stays the same after you share it, and you can switch it off at any time.</p>
        <div className="row"><input className="field" name="label" placeholder="Who it's for, like “Board, Q1”" aria-label="Who the link is for" style={{ flex: 1, minWidth: 220 }} /><button className="btn btn-peach" type="submit">Create link</button></div>
        {link && <p style={{ margin: 0 }}>Copy this link now, it won&apos;t be shown again: <code style={{ wordBreak: 'break-all' }}>{link}</code></p>}
        {shares.length > 0 && (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {shares.map((s) => (
              <li key={s.id} className="meta">
                {s.label} · {s.from_day.slice(0, 10)} to {s.to_day.slice(0, 10)} · viewed {s.views} times · {s.revoked_at ? 'switched off' : `until ${new Date(s.expires_at).toLocaleDateString('en-AU')}`}
                {!s.revoked_at && <> · <button type="button" className="btn btn-line" style={{ minHeight: 32, padding: '0 10px', fontSize: 13 }} onClick={async () => { await api(`/v1/org/report-shares/${s.id}/revoke`, { method: 'POST', body: {} }).catch(() => {}); load(); }}>Switch off</button></>}
              </li>
            ))}
          </ul>
        )}
      </form>

      <form className="panel" onSubmit={(e) => { e.preventDefault(); saveProfile(e.currentTarget); }}>
        <h3>Make it yours</h3>
        <p className="meta" style={{ margin: 0 }}>Your title, who it&apos;s for, and a short introduction in your own words.</p>
        <input className="field" name="title" placeholder="Report title, like “Summer camp follow-up”" defaultValue={report?.profile?.title ?? ''} aria-label="Report title" />
        <input className="field" name="funder" placeholder="Prepared for, like “The Example Foundation”" defaultValue={report?.profile?.funder_name ?? ''} aria-label="Prepared for" />
        <textarea name="intro" placeholder="A short introduction" defaultValue={report?.profile?.intro ?? ''} aria-label="Introduction" />
        <div><button className="btn btn-green" type="submit">Save</button></div>
      </form>
    </Shell>
  );
}
