'use client';
import { useEffect, useRef, useState } from 'react';
import { api, explain } from '@/lib/api';
import { inkOn } from '@/lib/org';

/** A church's public response page (/p/<slug>). No sign-in. Minors rules shape the form before anything else. */

type Look = { primary: string | null; accent: string | null; heading: string; logo: string | null };
type Page = { slug: string; title: string; steps: string[]; ministry: string; look: Look; showAlways: boolean };
type Band = '18+' | '15-17' | '13-14' | 'under13';

const STEP: Record<string, string> = {
  church: 'Find a church near me', explore: 'Explore faith', talk: 'Talk with someone', read: 'Start reading the Bible',
  youth: 'Find a youth group', group: 'Join a small group', help: 'Get practical help',
};
const STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];
const SITEKEY = '0x4AAAAAAGRXyyVGuZ6DhWOD';
const WORDING = 'page-2026-11';

declare global { interface Window { turnstile?: { render: (el: HTMLElement, o: Record<string, unknown>) => string; execute: (id: string) => void; reset: (id: string) => void } } }

export default function ResponsePage() {
  const [page, setPage] = useState<Page | null | 'missing'>(null);
  const [step, setStep] = useState('');
  const [band, setBand] = useState<Band>('18+');
  const [kind, setKind] = useState<'mobile' | 'email'>('mobile');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [embed, setEmbed] = useState(false);
  const human = useRef<HTMLDivElement>(null);
  const widget = useRef<string>('');
  const pending = useRef<((t: string) => void) | null>(null);

  useEffect(() => {
    setEmbed(new URLSearchParams(location.search).get('embed') === '1');
    const slug = location.pathname.split('/').filter(Boolean)[1] ?? '';
    if (!/^[a-z0-9-]{3,62}$/.test(slug)) { setPage('missing'); return; }
    api<Page>(`/v1/pages/${slug}`).then(setPage).catch(() => setPage('missing'));
  }, []);

  useEffect(() => {
    if (!step || widget.current) return;
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = () => {
      if (!human.current || !window.turnstile) return;
      widget.current = window.turnstile.render(human.current, { sitekey: SITEKEY, size: 'invisible', callback: (t: string) => pending.current?.(t) });
    };
    document.head.appendChild(s);
  }, [step]);

  if (page === null) return <main className={embed ? 'rp-shell rp-embed' : 'rp-shell'} />;
  if (page === 'missing') return <main className={embed ? 'rp-shell rp-embed' : 'rp-shell'}><div className="rp-card"><h1>This page isn’t available</h1><p>Check the link, or ask the church or ministry that shared it.</p></div></main>;

  const primary = page.look.primary ?? '#1B4740';
  const accent = page.look.accent ?? '#E8A577';
  const style = { '--rp': primary, '--rp-ink': inkOn(primary), '--rp-acc': accent, '--rp-acc-ink': inkOn(accent) } as React.CSSProperties;
  const parentFills = band === 'under13';

  function token(): Promise<string> {
    return new Promise((resolve) => {
      if (!window.turnstile || !widget.current) return resolve('');
      pending.current = resolve;
      window.turnstile.execute(widget.current);
      setTimeout(() => resolve(''), 8000);
    });
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (typeof page !== 'object' || !page) return;
    const f = new FormData(e.currentTarget);
    const v = (k: string) => String(f.get(k) ?? '').trim();
    setBusy(true); setErr('');
    try {
      const humanToken = await token();
      await api(`/v1/pages/${page.slug}/respond`, {
        method: 'POST',
        body: {
          humanToken, step, ageBand: band,
          ...(parentFills ? {} : { firstName: v('firstName') || undefined }),
          contact: { kind, value: v('contact') },
          ...(band === '13-14' ? { parentContact: { kind: 'mobile', value: v('parent') } } : {}),
          suburb: v('suburb'), postcode: v('postcode'), state: v('state'), language: navigator.language?.slice(0, 2),
          note: v('note') || undefined,
          consent: { purposes: ['connect.church'], recipients: [], allowNextNearby: true, wordingVersion: WORDING, party: parentFills ? 'parent' : 'self', ...(parentFills ? { childAssent: f.get('assent') === 'on' } : {}) },
        },
      });
      setDone(true);
    } catch (x) {
      setErr(explain(x));
      if (window.turnstile && widget.current) window.turnstile.reset(widget.current);
    } finally { setBusy(false); }
  }

  return (
    <main className={embed ? 'rp-shell rp-embed' : 'rp-shell'} style={style}>
      <div className="rp-card">
        <header className="rp-head">
          {page.look.logo ? <img src={page.look.logo} alt="" /> : <span className="rp-mark" aria-hidden="true">{page.ministry.slice(0, 1)}</span>}
          <b>{page.ministry}</b>
        </header>

        {done ? (
          <section className="rp-done" aria-live="polite">
            <h1 className={page.look.heading === 'classic' ? 'serif' : undefined}>Thank you.</h1>
            <p>Someone from {page.ministry}, or a church near you, will be in touch soon. You can change your mind at any time from the message we send.</p>
          </section>
        ) : !step ? (
          <section>
            <h1 className={page.look.heading === 'classic' ? 'serif' : undefined}>Want to know more about Jesus?</h1>
            <p className="rp-lead">We’d love to hear from you. Choose a next step and we’ll be in touch.</p>
            <div className="rp-steps">
              {page.steps.map((s, i) => <button key={s} type="button" className={i === 0 ? 'on' : undefined} onClick={() => setStep(s)}>{STEP[s] ?? s}</button>)}
            </div>
          </section>
        ) : (
          <form className="rp-form" onSubmit={submit}>
            <button type="button" className="rp-back" onClick={() => setStep('')}>← {STEP[step]}</button>
            <fieldset className="rp-band">
              <legend>How old are you?</legend>
              {(['18+', '15-17', '13-14', 'under13'] as Band[]).map((b) => (
                <label key={b}><input type="radio" name="band" checked={band === b} onChange={() => setBand(b)} />{b === 'under13' ? 'Under 13' : b.replace('-', '–')}</label>
              ))}
            </fieldset>

            {parentFills && <p className="rp-note">If you’re under 13, please ask a parent or guardian to fill this in for you. We’ll only take their details.</p>}

            {!parentFills && <label className="rp-fld">First name<input name="firstName" autoComplete="given-name" maxLength={60} /></label>}
            <div className="rp-fld">
              <span>{parentFills ? 'Parent or guardian’s contact' : 'How can we reach you?'}</span>
              <div className="rp-kind" role="radiogroup" aria-label="Contact by">
                <button type="button" role="radio" aria-checked={kind === 'mobile'} onClick={() => setKind('mobile')}>Mobile</button>
                <button type="button" role="radio" aria-checked={kind === 'email'} onClick={() => setKind('email')}>Email</button>
              </div>
              <input name="contact" required type={kind === 'email' ? 'email' : 'tel'} autoComplete={kind === 'email' ? 'email' : 'tel'} aria-label={kind === 'email' ? 'Email' : 'Mobile'} />
            </div>
            {band === '13-14' && <label className="rp-fld">A parent or guardian’s mobile<small>We’ll ask them to say yes before anyone gets in touch.</small><input name="parent" required type="tel" autoComplete="off" /></label>}
            <div className="rp-row">
              <label className="rp-fld">Suburb<input name="suburb" required autoComplete="address-level2" maxLength={60} /></label>
              <label className="rp-fld">Postcode<input name="postcode" required inputMode="numeric" pattern="\d{4}" maxLength={4} autoComplete="postal-code" /></label>
              <label className="rp-fld">State<select name="state" required defaultValue="">{['', ...STATES].map((s) => <option key={s} value={s} disabled={!s}>{s || 'Choose'}</option>)}</select></label>
            </div>
            <label className="rp-fld">Anything you’d like us to know? <small>Optional</small><textarea name="note" rows={2} maxLength={500} /></label>

            <label className="rp-consent">
              <input type="checkbox" required />
              <span>I’m happy for {page.ministry} to pass my details to one church or ministry near me, so they can get in touch. If they can’t, the next one nearby may be asked. My details are used only for this.</span>
            </label>
            {parentFills && <label className="rp-consent"><input type="checkbox" name="assent" required /><span>I’m their parent or guardian, and my child has agreed too.</span></label>}

            <div ref={human} />
            <p className="rp-err" role="alert">{err}</p>
            <button className="rp-go" disabled={busy}>{busy ? 'Sending…' : 'Send'}</button>
          </form>
        )}

        <footer className="rp-foot">
          <a href="https://alwaysfoundation.org/#/docs/privacy">Privacy</a>
          {page.showAlways && <a href="https://alwaysfoundation.org" className="rp-always">Runs on Always</a>}
        </footer>
      </div>
    </main>
  );
}
