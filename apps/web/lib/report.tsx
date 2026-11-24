/** One report layout for the console, funder links, PDFs and the examples. */
export type Figure = number | null;
export type Report = {
  organisation?: string;
  label?: string;
  profile?: { title?: string | null; funder_name?: string | null; intro?: string | null } | null;
  period: { from: string; to: string };
  view: 'sender' | 'receiver' | 'network';
  totals: Record<string, Figure>;
  byMonth: ({ month: string } & Record<string, Figure | string>)[];
  byStep: { step: string; count: Figure }[];
  byRegion: { region: string; count: Figure }[];
  youngPeople: Figure;
  definitions: Record<string, string>;
  privacy: string;
  stories?: { quote: string; by: string }[];
  example?: boolean;
};

export const LABELS: Record<string, string> = {
  responded: 'Responded', introduced: 'Introduced nearby', accepted: 'Welcomed',
  contacted: 'Contacted', connected: 'Connected', care_team: 'Helped by the care team',
};
export const STEPS: Record<string, string> = {
  church: 'Find a church', explore: 'Explore faith', talk: 'Talk with someone', youth: 'Youth group',
  group: 'Join a small group', help: 'Practical help', read: 'Start reading the Bible',
};
const fmt = (v: Figure | string | undefined) => (v === null ? 'Too few' : typeof v === 'number' ? v.toLocaleString('en-AU') : v ?? '0');
const date = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
const month = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString('en-AU', { month: 'short', year: 'numeric' });

export function ReportView({ r }: { r: Report }) {
  const keys = Object.keys(r.totals);
  const top = keys.map((k) => r.totals[k]).find((v) => typeof v === 'number' && v > 0) as number | undefined;
  const pct = (v: Figure) => (typeof v === 'number' && top ? Math.max(3, Math.round((v / top) * 100)) : 0);
  return (
    <article className="report">
      <header className="report-head">
        <p className="kicker">{r.example ? 'Example report' : r.view === 'network' ? 'The Always Network' : 'Report'}</p>
        <h2>{r.profile?.title || r.organisation || 'Always report'}</h2>
        <p className="meta">{date(r.period.from)} to {date(r.period.to)}{r.profile?.funder_name ? ` · ${r.profile.funder_name}` : ''}{r.label ? ` · ${r.label}` : ''}</p>
        {r.profile?.intro && <p className="lead" style={{ marginTop: 14 }}>{r.profile.intro}</p>}
      </header>

      <section aria-label="The journey" className="journey">
        {keys.map((k) => (
          <div className="step" key={k}>
            {r.totals[k] === null ? <b className="few" title="Withheld to protect privacy">Too few to show</b> : <b>{fmt(r.totals[k])}</b>}
            <span>{LABELS[k] ?? k}</span>
            <i aria-hidden="true"><em style={{ width: `${pct(r.totals[k])}%` }} /></i>
          </div>
        ))}
      </section>

      <div className="report-grid">
        <section>
          <h3>What people asked for</h3>
          <table><tbody>{r.byStep.map((s) => <tr key={s.step}><th scope="row">{STEPS[s.step] ?? s.step}</th><td>{fmt(s.count)}</td></tr>)}</tbody></table>
        </section>
        <section>
          <h3>Where</h3>
          <table><tbody>{r.byRegion.map((s) => <tr key={s.region}><th scope="row">{s.region}</th><td>{fmt(s.count)}</td></tr>)}</tbody></table>
          {r.youngPeople !== 0 && <p className="meta" style={{ marginTop: 10 }}>Young people (under 18): {fmt(r.youngPeople)}</p>}
        </section>
      </div>

      {r.byMonth.length > 1 && (
        <section>
          <h3>Month by month</h3>
          <div className="table-wrap"><table>
            <thead><tr><th scope="col">Month</th>{keys.map((k) => <th scope="col" key={k}>{LABELS[k] ?? k}</th>)}</tr></thead>
            <tbody>{r.byMonth.map((m) => <tr key={m.month}><th scope="row">{month(m.month)}</th>{keys.map((k) => <td key={k}>{fmt(m[k] as Figure)}</td>)}</tr>)}</tbody>
          </table></div>
        </section>
      )}

      {r.stories && r.stories.length > 0 && (
        <section>
          <h3>In their words</h3>
          {r.stories.map((s, i) => <blockquote key={i} className="story">“{s.quote}”<footer>{s.by}</footer></blockquote>)}
        </section>
      )}

      <footer className="report-foot">
        <h3>What these numbers mean</h3>
        <dl>{keys.map((k) => <div key={k}><dt>{LABELS[k] ?? k}</dt><dd>{r.definitions[k]}</dd></div>)}</dl>
        <p className="meta">{r.privacy} Prepared with Always, alwaysfoundation.org.{r.example ? ' Every figure here is an example.' : ''}</p>
      </footer>
    </article>
  );
}
