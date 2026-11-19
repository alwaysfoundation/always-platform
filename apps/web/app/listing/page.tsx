'use client';
import { useEffect, useState } from 'react';
import { Shell } from '../../lib/shell';
import { api, explain } from '../../lib/api';

type Feed = {
  optedIn: boolean; at: string | null; slug: string; welcomingNow: boolean; youthPartner: boolean;
  checks: { verified: boolean; trained: boolean; confirmedRecently: boolean; onTimeRate: number | null; recentOffers: number };
};

export default function Listing() {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { api<Feed>('/v1/org/feed').then(setFeed).catch((e) => setError(explain(e))); }, []);

  async function toggle(optIn: boolean) {
    setSaving(true); setError('');
    try { await api('/v1/org/feed', { method: 'PUT', body: { optIn } }); setFeed(await api<Feed>('/v1/org/feed')); }
    catch (e) { setError(explain(e)); }
    finally { setSaving(false); }
  }

  const c = feed?.checks;
  const rate = c?.onTimeRate == null ? 'No introductions yet' : `${Math.round(c.onTimeRate * 100)}% of your last ${c.recentOffers} on time`;
  return (
    <Shell>
      <h1>Your listing</h1>
      <p className="lede">Choose whether your church appears in the Always church feed, so ministries and apps can point people to you.</p>
      {error && <p className="error" role="alert">{error}</p>}
      {feed && (
        <>
          <section className="card">
            <h2>{feed.optedIn ? 'You’re in the church feed' : 'You’re not in the church feed yet'}</h2>
            <p>The feed shares your church’s name, suburb, denomination, service times and the next steps you offer. Never anyone’s personal details.</p>
            <button className="btn btn-green" disabled={saving} onClick={() => toggle(!feed.optedIn)}>
              {feed.optedIn ? 'Leave the church feed' : 'Join the church feed'}
            </button>
          </section>
          <section className="card">
            <h2>{feed.welcomingNow ? 'Welcoming now' : 'Not welcoming yet'}</h2>
            <p>People see the “welcoming now” badge when all of these are true. Only your team sees this page.</p>
            <ul className="checks">
              <li data-ok={c!.verified}>Verified with your denomination or network</li>
              <li data-ok={c!.trained}>Your connect lead has done the welcoming course</li>
              <li data-ok={c!.confirmedRecently}>Details checked in the last 90 days</li>
              <li data-ok={c!.onTimeRate == null || c!.onTimeRate >= 0.8}>Replying on time: {rate}</li>
            </ul>
          </section>
        </>
      )}
    </Shell>
  );
}
