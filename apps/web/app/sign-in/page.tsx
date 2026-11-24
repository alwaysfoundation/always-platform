'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { getAuth, setOrg } from '@/lib/auth';
import { EmailCode } from '@/lib/email-code';
import { Wordmark } from '@/lib/logo';

/** Sign in with an emailed code. An invitation link lands here too, and is accepted once signed in. */
export default function SignIn() {
  const router = useRouter();
  const [invite, setInvite] = useState<string | null>(null);
  const [status, setStatus] = useState('');

  useEffect(() => {
    const t = new URLSearchParams(location.search).get('invite');
    setInvite(t && /^alw_inv_[A-Za-z0-9_-]{20,}$/.test(t) ? t : null);
  }, []);

  async function done() {
    if (invite) {
      try {
        const r = await api<{ orgId: string; name: string }>('/v1/account/invites/accept', { method: 'POST', body: { token: invite } });
        setOrg(r.orgId);
      } catch (e) {
        const code = (e as { code?: string }).code;
        setStatus(code === 'invite_for_another_email' ? 'This invitation was sent to a different email. Sign in with that one.' : 'This invitation has expired. Ask your team for a new one.');
        return;
      }
    }
    router.replace('/home');
  }

  useEffect(() => { if (getAuth() && !invite) router.replace('/home'); }, [invite, router]);

  return (
    <div className="gate">
      <div className="gate-card">
        <Wordmark height={28} />
        <h1>{invite ? 'Join your team' : 'Sign in'}</h1>
        <p className="meta">{invite ? 'Sign in with the email your invitation was sent to.' : 'We\'ll email you a code. No password needed.'}</p>
        <EmailCode cta="Email me a code" onSignedIn={done} />
        {status && <p className="status" role="alert">{status}</p>}
        {!invite && <p className="gate-alt">New to Always? <Link href="/start">Set up your church</Link>, or <Link href="/demo">try the demo</Link>.</p>}
      </div>
    </div>
  );
}
