import { inkOn } from './org';

export type Look = { name: string; kind: 'church' | 'ministry'; primary: string; accent: string; heading: 'modern' | 'classic'; logo: string | null };

/** A live preview of what people will see: the response page on a phone, and the card by the door. */
export function Preview({ look }: { look: Look }) {
  const named = look.name.trim();
  const name = named || (look.kind === 'church' ? 'Your church' : 'Your ministry');
  const style = {
    '--p': look.primary, '--a': look.accent, '--p-ink': inkOn(look.primary), '--a-ink': inkOn(look.accent),
    '--h': look.heading === 'classic' ? "'Newsreader', Georgia, serif" : "'Manrope', system-ui, sans-serif",
  } as React.CSSProperties;
  const mark = look.logo ? <img src={look.logo} alt="" /> : <span>{name.slice(0, 1)}</span>;
  return (
    <div className="pv" style={style} aria-label={`Preview of ${name}'s response page and welcome card`} role="img">
      <div className="pv-phone">
        <div className="pv-screen">
          <div className="pv-top"><i className="pv-mark">{mark}</i><b>{name}</b></div>
          <h3>Want to know more about Jesus?</h3>
          <p>We&rsquo;d love to hear from you. Choose one and we&rsquo;ll be in touch.</p>
          <span className="pv-btn pv-btn-a">I&rsquo;ve decided to follow Jesus</span>
          <span className="pv-btn">I&rsquo;d like to know more</span>
          <span className="pv-btn">Please pray for me</span>
          <small>Your details stay with {named || (look.kind === 'church' ? 'the church' : 'the ministry')}.</small>
        </div>
      </div>
      <div className="pv-card">
        <div className="pv-card-top"><i className="pv-mark">{mark}</i><b>{name}</b></div>
        <h4>New here? Say hello.</h4>
        <Qr />
        <small>Scan with your phone camera</small>
      </div>
    </div>
  );
}

/** A QR-style pattern for the preview only: three finder squares and fixed modules. It encodes nothing. */
function Qr() {
  const n = 21;
  const finder = (x: number, y: number) => [[0, 0], [n - 7, 0], [0, n - 7]].some(([fx, fy]) => x >= fx! && x < fx! + 7 && y >= fy! && y < fy! + 7);
  const cells: string[] = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (finder(x, y)) continue;
    if (((x * 31 + y * 17 + x * y * 7) % 11) < 5) cells.push(`M${x} ${y}h1v1h-1z`);
  }
  const ring = (x: number, y: number) => `M${x} ${y}h7v7h-7zM${x + 1} ${y + 1}v5h5v-5zM${x + 2} ${y + 2}h3v3h-3z`;
  return (
    <svg className="pv-qr" viewBox={`-1 -1 ${n + 2} ${n + 2}`} aria-hidden="true">
      <rect x="-1" y="-1" width={n + 2} height={n + 2} fill="#fff" />
      <path fillRule="evenodd" fill="#1E2A26" d={ring(0, 0) + ring(n - 7, 0) + ring(0, n - 7) + cells.join('')} />
    </svg>
  );
}
