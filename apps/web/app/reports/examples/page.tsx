'use client';
import { useState } from 'react';
import { EXAMPLES } from '@/lib/examples';
import { ReportView } from '@/lib/report';

/** Public examples: no sign-in, made-up figures. */
export default function Examples() {
  const [slug, setSlug] = useState(EXAMPLES[0]!.slug);
  const ex = EXAMPLES.find((e) => e.slug === slug)!;
  return (
    <div className="public">
      <div className="no-print">
        <p className="kicker">Example reports</p>
        <h1>Reporting your funders can trust</h1>
        <p className="lead">Every ministry on Always gets reports like these, built from the same five steps. Pick an example. Every figure here is made up.</p>
        <div className="tabs" role="tablist" aria-label="Examples" style={{ marginTop: 20 }}>
          {EXAMPLES.map((e) => <button key={e.slug} role="tab" aria-selected={e.slug === slug} onClick={() => setSlug(e.slug)}>{e.name}</button>)}
        </div>
        <p className="meta">{ex.who}</p>
        <div className="row" style={{ margin: '12px 0' }}><button className="btn btn-line" onClick={() => window.print()}>Download as PDF</button></div>
      </div>
      <ReportView r={ex.report} />
    </div>
  );
}
