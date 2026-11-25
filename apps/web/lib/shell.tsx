'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { getAuth, signOut } from './auth';
import { endDemo, isDemo } from './demo';
import { Icon } from './icons';
import { Wordmark } from './logo';
import { inkOn, OrgProvider, useOrg } from './org';

/** Signed-in layout: a quiet sidebar wearing the church's colour, and a tab bar on phones. */
export function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const out = useCallback(() => { const demo = isDemo(); endDemo(); signOut(); router.replace(demo ? '/start?from=demo' : '/sign-in'); }, [router]);

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
  const [demo, setDemo] = useState(false);

  useEffect(() => { setDemo(isDemo()); }, []);
  useEffect(() => { if (!org) router.replace('/start'); }, [org, router]);
  if (!org) return null;

  const nav = [
    { href: '/home', label: 'Home', icon: 'home' },
    { href: '/inbox', label: 'Inbox', icon: 'inbox' },
    { href: '/reports', label: 'Reports', icon: 'reports' },
    { href: '/settings', label: 'Settings', icon: 'settings' },
    ...(org.careTeam ? [{ href: '/foundation', label: 'Foundation', icon: 'foundation' }] : []),
  ];
  const here = (href: string) => path === href || path === href + '/' || (href === '/settings' && path.startsWith('/listing'));
  const primary = org.brand.primary || '#1B4740';
  const style = { '--brand': primary, '--brand-ink': inkOn(primary), '--brand-accent': org.brand.accent || '#E8A577' } as React.CSSProperties;
  const mark = org.brand.logo ? <img src={org.brand.logo} alt="" /> : <span aria-hidden="true">{org.name.slice(0, 1)}</span>;

  return (
    <div className="shell" style={style}>
      <aside className="side" aria-label="Main">
        <div className="side-org">
          <i className="side-mark">{mark}</i>
          {orgs.length > 1 ? (
            <select aria-label="Organisation" value={org.id} onChange={(e) => choose(e.target.value)}>
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          ) : <b>{org.name}</b>}
        </div>
        <nav>
          {nav.map((n) => (
            <Link key={n.href} href={n.href} aria-current={here(n.href) ? 'page' : undefined}><Icon name={n.icon} />{n.label}</Link>
          ))}
        </nav>
        <div className="side-foot">
          <button className="side-out" onClick={onSignOut}><Icon name="out" />{demo ? 'Leave the demo' : 'Sign out'}</button>
          <span className="runs-on">Runs on <Wordmark height={13} /></span>
        </div>
      </aside>

      <header className="top">
        <i className="side-mark">{mark}</i>
        <b>{org.name}</b>
        <button className="top-out" onClick={onSignOut} aria-label={demo ? 'Leave the demo' : 'Sign out'}><Icon name="out" /></button>
      </header>

      <main id="main">
        {demo && <p className="demo-bar"><b>Demo</b> Everything here is made up and stays in this browser. <Link href="/start?from=demo">Start for real</Link></p>}
        {children}
      </main>

      <nav className="tabs" aria-label="Main">
        {nav.filter((n) => n.href !== '/foundation').map((n) => (
          <Link key={n.href} href={n.href} aria-current={here(n.href) ? 'page' : undefined}><Icon name={n.icon} size={22} /><span>{n.label}</span></Link>
        ))}
      </nav>
    </div>
  );
}
