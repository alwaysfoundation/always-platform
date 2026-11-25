'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type M = {
  welcomed: number | null; medianDaysToContact: number | null; churchesWelcomingNow: number;
  funnel: { accountsCreated: number; firstToolOn: number; firstWelcome: number };
  activeAfter90Days: { cohort: number; active: number };
  care: { passes: number; careTeamCatches: number | null; consentWithdrawn: number | null; safetyFlags: number | null };
};

const show = (n: number | null) => (n === null ? 'Under 5' : n.toLocaleString());
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—');

function quarter() {
  const d = new Date(), q = Math.floor(d.getMonth() / 3);
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  return { from: iso(new Date(Date.UTC(d.getFullYear(), q * 3, 1))), to: iso(new Date(Date.UTC(d.getFullYear(), q * 3 + 3, 0))) };
}

/** The foundation's measures, this quarter. One outcome first; everything else leads to it or protects it. */
export function Measures() {
  const [m, setM] = useState<M | null>(null);
  useEffect(() => { const q = quarter(); api<M>(`/v1/ops/measures?from=${q.from}&to=${q.to}`).then(setM).catch(() => setM(null)); }, []);
  if (!m) return null;
  const f = m.funnel;
  return (
    <section className="ms" aria-labelledby="h-ms">
      <h2 id="h-ms">This quarter</h2>
      <div className="ms-hero">
        <div><b>{show(m.welcomed)}</b><span>People welcomed by a local church</span></div>
        <div><b>{m.medianDaysToContact ?? '—'}</b><span>Days from introduction to first contact (median)</span></div>
        <div><b>{m.churchesWelcomingNow}</b><span>Churches welcoming now</span></div>
      </div>
      <div className="ms-row">
        <div className="ms-card">
          <h3>New accounts</h3>
          <ol className="ms-funnel">
            <li><span>Created</span><b>{f.accountsCreated}</b></li>
            <li><span>Switched on a tool</span><b>{f.firstToolOn}</b><em>{pct(f.firstToolOn, f.accountsCreated)}</em></li>
            <li><span>Welcomed someone</span><b>{f.firstWelcome}</b><em>{pct(f.firstWelcome, f.accountsCreated)}</em></li>
          </ol>
        </div>
        <div className="ms-card">
          <h3>Still active after 90 days</h3>
          <p className="ms-big">{pct(m.activeAfter90Days.active, m.activeAfter90Days.cohort)}</p>
          <p className="meta">{m.activeAfter90Days.active} of {m.activeAfter90Days.cohort} accounts older than 90 days used Always in the last 30.</p>
        </div>
        <div className="ms-card">
          <h3>Early warnings</h3>
          <ul className="ms-warn">
            <li><span>Passes</span><b>{m.care.passes}</b></li>
            <li><span>Caught by the care team</span><b>{show(m.care.careTeamCatches)}</b></li>
            <li><span>Consent withdrawn</span><b>{show(m.care.consentWithdrawn)}</b></li>
            <li><span>Safety concerns raised</span><b>{show(m.care.safetyFlags)}</b></li>
          </ul>
        </div>
      </div>
      <p className="meta">Totals only. Counts of people under five are withheld. We never measure individuals, or journeys between ministries.</p>
    </section>
  );
}
