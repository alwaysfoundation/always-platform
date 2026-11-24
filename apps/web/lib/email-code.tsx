'use client';
import { useRef, useState } from 'react';
import { sendCode, verifyCode } from './auth';

/**
 * Email, then the code we send. No passwords. Used by sign-in and by the last step of starting.
 * `before` runs before a code is sent, so a form can check its own fields first.
 */
export function EmailCode({ cta, onSignedIn, before, defaultEmail = '', children }: {
  cta: string;
  onSignedIn: () => Promise<void> | void;
  before?: () => string | null;
  defaultEmail?: string;
  children?: React.ReactNode;
}) {
  const [email, setEmail] = useState(defaultEmail);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const codeRef = useRef<HTMLInputElement>(null);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const problem = before?.();
    if (problem) return setStatus(problem);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setStatus('Add your email address.');
    setBusy(true); setStatus('');
    try {
      await sendCode(email.trim());
      setSent(true);
      setTimeout(() => codeRef.current?.focus(), 50);
    } catch (err) {
      setStatus((err as Error).message === 'too_many' ? 'Too many codes asked for. Wait a minute, then try again.' : 'We couldn\'t send a code just now. Please try again.');
    } finally { setBusy(false); }
  }

  async function verify(code: string) {
    setBusy(true); setStatus('');
    try {
      await verifyCode(email.trim(), code);
      await onSignedIn();
    } catch {
      setStatus('That code didn\'t work. Check the latest email, or send a new code.');
      setBusy(false);
    }
  }

  if (!sent) {
    return (
      <form className="ec" onSubmit={send} noValidate>
        <label className="fld">Email
          <input type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@yourchurch.org" required />
        </label>
        {children}
        <button className="btn btn-brand btn-big" type="submit" disabled={busy}>{busy ? 'Sending…' : cta}</button>
        <p className="status" role="status">{status}</p>
      </form>
    );
  }
  return (
    <form className="ec" onSubmit={(e) => { e.preventDefault(); void verify(codeRef.current?.value.trim() ?? ''); }} noValidate>
      <p className="ec-sent">We&rsquo;ve sent a code to <b>{email}</b>. It works for an hour.</p>
      <label className="fld">Code from the email
        <input ref={codeRef} className="ec-code" inputMode="numeric" autoComplete="one-time-code" maxLength={10} pattern="[0-9]*"
          onChange={(e) => { const v = e.target.value.replace(/\D/g, ''); e.target.value = v; if (v.length >= 6 && !busy) void verify(v); }} required />
      </label>
      <button className="btn btn-brand btn-big" type="submit" disabled={busy}>{busy ? 'Checking…' : 'Continue'}</button>
      <p className="ec-again"><button type="button" className="link" onClick={() => { setSent(false); setStatus(''); }}>Use a different email</button> · <button type="button" className="link" onClick={() => void send()}>Send a new code</button></p>
      <p className="status" role="status">{status}</p>
    </form>
  );
}
