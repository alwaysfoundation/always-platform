'use client';
import { useEffect, useState } from 'react';
import { API } from './api';
import { ReportView, type Report } from './report';

/** What a funder sees from a share link: a frozen, de-identified report. No sign-in. */
export function SharedReport() {
  const [token, setToken] = useState('');
  useEffect(() => { setToken(decodeURIComponent(location.pathname.split('/').filter(Boolean)[1] ?? '')); }, []);
  const [r, setR] = useState<Report | null | undefined>(undefined);
  useEffect(() => {
    if (!token) return;
    fetch(`${API}/v1/reports/shared/${encodeURIComponent(token)}`).then((x) => (x.ok ? x.json() : null)).then(setR).catch(() => setR(null));
  }, [token]);
  return (
    <div className="public">
      {r === undefined ? <p className="meta">Loading…</p> : r === null ? (
        <div className="empty">This report link has expired or been switched off. Please ask the ministry for a new one.</div>
      ) : (<>
        <div className="row no-print"><button className="btn btn-line" onClick={() => window.print()}>Download as PDF</button></div>
        <ReportView r={r} />
      </>)}
    </div>
  );
}
