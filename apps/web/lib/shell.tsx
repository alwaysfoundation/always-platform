'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getSession, setSession, type Session } from './api';
import { Wordmark } from './logo';

/** Signed-in layout: green side bar with the two areas, and sign out. */
export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [session, setS] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    const s = getSession();
    if (!s) router.replace('/sign-in');
    setS(s);
  }, [router]);

  if (!session) return null;
  const nav = [
    { href: '/inbox', label: 'Inbox' },
    { href: '/reports', label: 'Reports' },
    { href: '/listing', label: 'Your listing' },
    { href: '/foundation', label: 'Foundation' },
  ];
  return (
    <div className="shell">
      <aside className="side">
        <Wordmark dark />
        <nav aria-label="Main">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} aria-current={path === n.href || (path.startsWith(n.href + '/') && n.href !== '/reports') ? 'page' : undefined}>{n.label}</Link>
          ))}
        </nav>
        <div className="who">
          <button className="btn btn-ghost" onClick={() => { setSession(null); router.replace('/sign-in'); }}>Sign out</button>
        </div>
      </aside>
      <main id="main">{children}</main>
    </div>
  );
}
