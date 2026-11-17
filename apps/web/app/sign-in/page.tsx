'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { setSession } from '@/lib/api';
import { Wordmark } from '@/lib/logo';

/**
 * Pilot sign-in: a staff session token and the organisation it acts for.
 * Passkey sign-in through Supabase Auth replaces this before launch (see ROADMAP.md).
 */
export default function SignIn() {
  const router = useRouter();
  const [status, setStatus] = useState('');
  return (
    <div className="signin">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const token = String(f.get('token') ?? '').trim();
          const org = String(f.get('org') ?? '').trim();
          if (!token || !org) return setStatus('Add your session token and organisation ID.');
          setSession({ token, org });
          router.replace('/inbox');
        }}
      >
        <Wordmark height={30} />
        <h1 style={{ fontSize: 28 }}>Sign in</h1>
        <p className="meta" style={{ margin: 0 }}>For pilot partners. Your session stays in this tab and ends when you close it.</p>
        <label>Session token<input name="token" type="password" autoComplete="off" required /></label>
        <label>Organisation ID<input name="org" autoComplete="off" required /></label>
        <button className="btn btn-green" type="submit">Sign in</button>
        <p className="status" role="status">{status}</p>
      </form>
    </div>
  );
}
