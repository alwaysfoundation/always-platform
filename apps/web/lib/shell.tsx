'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { getAuth, signOut } from './auth';
import { endDemo, isDemo } from './demo';
import { Wordmark } from './logo';
import { inkOn, OrgProvider, useOrg } from './org';

/** Signed-in layout. The side bar wears the church's own colours and logo; Always stays in the background. */
export function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const out = useCallback(() => { const demo = isDemo(); endDemo(); signOut(); router.replace(demo ? '/start' : '/sign-in'); }, [router]);

  useEffect(() => {
    if (!getAuth() && !isDemo()) router.replace('/sign-in');
    else setReady(true);
  }, [router]);

  if (!ready) return null;
  return <OrgProvider onSignedOut={out}><Frame onSignOut={out}>{children}</Frame></OrgProvider>;
}

function Frame({ children, onSignOut }: { children: React.ReactNode; onSignOut: () => void }) {
  const path = usePathname();
  const router = useRouter();
  const { org, orgs, choose } = useOrg();

  useEffect(() => { if (!org) router.replace('/start'); }, [org, router]);
  if (!org) return null;

  const nav = [
    { href: '/home', label: 'Home' },
    ...(org.modules.ai !== 'off' ? [{ href: '/ai', label: 'Always AI' }] : []),
    { href: '/inbox', label: 'Inbox' },
    { href: '/reports', label: 'Reports' },
    { href: '/listing', label: 'Your listing' },
    ...(org.careTeam ? [{ href: '/foundation', label: 'Foundation' }] : []),
  ];
  const primary = org.brand.primary || '#1B4740';
  const style = { '--brand': primary, '--brand-ink': inkOn(primary), '--brand-accent': org.brand.accent || '#E8A577' } as React.CSSProperties;

  return (
    <div className="shell" style={style}>
      <aside className="side">
        <div className="who-org">
          {org.brand.logo ? <img src={org.brand.logo} alt="" /> : <span className="mono" aria-hidden="true">{org.name.slice(0, 1)}</span>}
          {orgs.length > 1 ? (
            <select aria-label="Organisation" value={org.id} onChange={(e) => choose(e.target.value)}>
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          ) : <b>{org.name}</b>}
        </div>
        <nav aria-label="Main">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} aria-current={path === n.href || (path.startsWith(n.href + '/') && n.href !== '/reports') ? 'page' : undefined}>{n.label}</Link>
          ))}
        </nav>
        <div className="who">
          <button className="btn btn-ghost" onClick={onSignOut}>Sign out</button>
          <span className="runs-on">Runs on <Wordmark dark={inkOn(primary) !== '#1E2A26'} height={14} /></span>
        </div>
      </aside>
      <main id="main">
        {isDemo() && <p className="demo-bar">You&rsquo;re in the demo account. Everything here is made up and stays in this browser. <button className="link" onClick={onSignOut}>Leave the demo</button></p>}
        {children}
      </main>
    </div>
  );
}
