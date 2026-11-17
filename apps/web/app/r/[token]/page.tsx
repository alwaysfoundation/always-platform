'use client';
import { use, useEffect, useState } from 'react';
import { ReportView, type Report } from '@/lib/report';

/** What a funder sees from a share link: a frozen, de-identified report. No sign-in. */
export default function Shared({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [r, setR] = useState<Report | null | undefined>(undefined);
  useEffect(() => {
    fetch(`/api/v1/reports/shared/${encodeURIComponent(token)}`).then((x) => (x.ok ? x.json() : null)).then(setR).catch(() => setR(null));
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
