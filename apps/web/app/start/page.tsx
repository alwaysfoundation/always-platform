'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { api, type Org } from '@/lib/api';
import { getAuth, setOrg } from '@/lib/auth';
import { importSite, palette, toDataUrl } from '@/lib/brand-import';
import { CREED } from '@/lib/creed';
import { EmailCode } from '@/lib/email-code';
import { Wordmark } from '@/lib/logo';
import { Preview, type Look } from '@/lib/preview';

const DRAFT = 'always.start';
const STEPS = ['Your church', 'Your look', 'Your account'] as const;
const DEFAULT_SWATCHES = ['#1B4740', '#1F3A5F', '#5B2A86', '#8C1C13', '#0F5257', '#2D2D2D'];
const ACCENTS = ['#E8A577', '#F2C14E', '#7FB7BE', '#E07A5F', '#A8D5BA', '#F4F1DE'];
const STARTING_MODULES = ['respond', 'safety', 'reports', 'ai'];

type Draft = Look & { site: string };
const blank: Draft = { name: '', kind: 'church', site: '', primary: '#1B4740', accent: '#E8A577', heading: 'modern', logo: null };

export default function Start() {
  const router = useRouter();
  const [d, setD] = useState<Draft>(blank);
  const [step, setStep] = useState(0);
  const [found, setFound] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [creed, setCreed] = useState(false);
  const [msg, setMsg] = useState('');
  const [signedIn, setSignedIn] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    try { const saved = JSON.parse(localStorage.getItem(DRAFT) ?? 'null'); if (saved) setD({ ...blank, ...saved }); } catch { /* fresh start */ }
    setSignedIn(!!getAuth());
  }, []);
  useEffect(() => { try { localStorage.setItem(DRAFT, JSON.stringify(d)); } catch { /* storage unavailable */ } }, [d]);
  useEffect(() => { heading.current?.focus(); }, [step]);

  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));

  async function fromChurch(e: React.FormEvent) {
    e.preventDefault();
    if (d.name.trim().length < 2) return setMsg(`Add your ${d.kind}'s name.`);
    setMsg('');
    if (d.site.trim()) {
      setBusy(true);
      const f = await importSite(d.site.trim());
      setBusy(false);
      if (f && (f.logo || f.colors.length)) {
        setFound(f.colors);
        set({ logo: f.logo ?? d.logo, primary: f.colors[0] ?? d.primary, accent: f.colors[1] ?? d.accent });
        setNote('We brought in your logo and colours. Change anything you like.');
      } else setNote('We couldn\'t read your website, so add your logo below.');
    }
    setStep(1);
  }

  async function onLogo(file: File | undefined) {
    if (!file || !/^image\//.test(file.type)) return;
    const url = await toDataUrl(URL.createObjectURL(file));
    if (!url) return setNote('That image is too large. Try a smaller logo.');
    const colours = await palette(url);
    setFound(colours);
    set({ logo: url, ...(colours[0] ? { primary: colours[0] } : {}), ...(colours[1] ? { accent: colours[1] } : {}) });
    setNote(colours.length ? 'Colours picked from your logo.' : '');
  }

  async function create() {
    if (!creed) { setMsg('Tick to affirm the Nicene Creed.'); return; }
    setBusy(true); setMsg('');
    try {
      const existing = await api<{ orgs: Org[] }>('/v1/account/orgs');
      const same = existing.orgs.find((o) => o.name.toLowerCase() === d.name.trim().toLowerCase());
      const org = same ?? await api<Org>('/v1/account/orgs', { method: 'POST', body: {
        kind: d.kind, displayName: d.name.trim(), affirmsCreed: true, modules: STARTING_MODULES,
        brand: { primary: d.primary, accent: d.accent, heading: d.heading, logo: d.logo },
      } });
      setOrg(org.id);
      try { localStorage.removeItem(DRAFT); } catch { /* fine */ }
      router.replace('/home?welcome=1');
    } catch {
      setBusy(false);
      setMsg('We couldn\'t create your account just now. Your setup is saved on this device, so try again in a moment.');
    }
  }

  const swatches = [...new Set([...found, ...DEFAULT_SWATCHES])].slice(0, 5);
  const accents = [...new Set([...found.slice(1), ...ACCENTS])].slice(0, 5);
  const word = d.kind === 'church' ? 'church' : 'ministry';

  return (
    <div className="start">
      <header className="start-bar">
        <a href="https://alwaysfoundation.org" aria-label="Always Foundation home"><Wordmark height={24} /></a>
        <span className="start-links"><Link href="/demo" className="link">Try the demo</Link><Link href="/sign-in" className="link">Sign in</Link></span>
      </header>

      <div className="start-grid">
        <section className="start-steps" aria-label="Set up">
          <ol className="dots" aria-label="Progress">
            {STEPS.map((s, i) => (
              <li key={s} aria-current={i === step ? 'step' : undefined} data-done={i < step || undefined}>
                <button type="button" onClick={() => i < step && setStep(i)} disabled={i >= step}>{s}</button>
              </li>
            ))}
          </ol>

          {step === 0 && (
            <form onSubmit={fromChurch} className="pane" noValidate>
              <h1 ref={heading} tabIndex={-1}>Start with Always</h1>
              <p className="lead">Free tools for welcoming people who say yes to Jesus, under your own name. It takes about two minutes.</p>
              <div className="seg" role="radiogroup" aria-label="We are">
                {(['church', 'ministry'] as const).map((k) => (
                  <button key={k} type="button" role="radio" aria-checked={d.kind === k} onClick={() => set({ kind: k })}>{k === 'church' ? 'A church' : 'A ministry'}</button>
                ))}
              </div>
              <label className="fld">{d.kind === 'church' ? 'Church name' : 'Ministry name'}
                <input value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder={d.kind === 'church' ? 'Hope Church' : 'Streets Outreach'} autoComplete="organization" required />
              </label>
              <label className="fld">Website <span className="opt">optional, for your logo and colours</span>
                <input value={d.site} onChange={(e) => set({ site: e.target.value })} placeholder="hopechurch.org" inputMode="url" autoComplete="url" />
              </label>
              <button className="btn btn-brand btn-big" type="submit" disabled={busy}>{busy ? 'Bringing in your look…' : 'Continue'}</button>
              <p className="status" role="status">{msg}</p>
            </form>
          )}

          {step === 1 && (
            <form onSubmit={(e) => { e.preventDefault(); setMsg(''); setStep(2); }} className="pane" noValidate>
              <h1 ref={heading} tabIndex={-1}>Make it yours</h1>
              <p className="lead">{note || 'Add your logo and we\'ll pick up your colours.'}</p>
              <label className="drop">
                <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(e) => void onLogo(e.target.files?.[0])} />
                {d.logo ? <img src={d.logo} alt="Your logo" /> : <span className="drop-plus" aria-hidden="true">+</span>}
                <span>{d.logo ? 'Change logo' : 'Add your logo'}</span>
              </label>
              <fieldset className="sw"><legend>Main colour</legend>
                {swatches.map((c) => <button key={c} type="button" style={{ background: c }} aria-label={c} aria-pressed={d.primary === c} onClick={() => set({ primary: c })} />)}
                <label className="sw-pick" aria-label="Choose any colour"><input type="color" value={d.primary} onChange={(e) => set({ primary: e.target.value.toUpperCase() })} /></label>
              </fieldset>
              <fieldset className="sw"><legend>Button colour</legend>
                {accents.map((c) => <button key={c} type="button" style={{ background: c }} aria-label={c} aria-pressed={d.accent === c} onClick={() => set({ accent: c })} />)}
                <label className="sw-pick" aria-label="Choose any colour"><input type="color" value={d.accent} onChange={(e) => set({ accent: e.target.value.toUpperCase() })} /></label>
              </fieldset>
              <div className="seg" role="radiogroup" aria-label="Headings">
                <button type="button" role="radio" aria-checked={d.heading === 'modern'} onClick={() => set({ heading: 'modern' })}>Modern</button>
                <button type="button" role="radio" aria-checked={d.heading === 'classic'} onClick={() => set({ heading: 'classic' })} className="serif">Classic</button>
              </div>
              <button className="btn btn-brand btn-big" type="submit">Continue</button>
            </form>
          )}

          {step === 2 && (
            <div className="pane">
              <h1 ref={heading} tabIndex={-1}>Create your account</h1>
              <p className="lead">We&rsquo;ll switch on response pages, Safety, Reports and Always AI for {d.name.trim() || `your ${word}`}. Change them any time, and invite your team once you&rsquo;re in.</p>
              <div className="creed">
                <label className="agree"><input type="checkbox" checked={creed} onChange={(e) => setCreed(e.target.checked)} /><span>We affirm the Nicene Creed (AD 381), the faith Always partners share.</span></label>
                <details><summary>Read the Creed</summary>{CREED.map((p) => <p key={p.slice(0, 20)}>{p}</p>)}</details>
              </div>
              {signedIn ? (
                <button className="btn btn-brand btn-big" type="button" disabled={busy} onClick={() => void create()}>{busy ? 'Setting up…' : 'Create my account'}</button>
              ) : (
                <EmailCode cta="Create my account" before={() => (creed ? null : 'Tick to affirm the Nicene Creed.')} onSignedIn={create} />
              )}
              <p className="status" role="status">{msg}</p>
              <p className="fine">Free, with no ads. By creating an account you agree to the <a href="https://alwaysfoundation.org/#/docs/terms">terms</a> and <a href="https://alwaysfoundation.org/#/docs/privacy">privacy policy</a>. Questions first? <a href="https://alwaysfoundation.org/#/contact">Talk to us</a>.</p>
            </div>
          )}
        </section>

        <section className="start-stage" aria-label="Preview">
          <Preview look={d} />
          <p className="stage-note">A preview with example words. People see your name, not ours.</p>
        </section>
      </div>
    </div>
  );
}
