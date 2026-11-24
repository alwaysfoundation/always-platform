'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, type Org } from './api';
import { getOrg, setOrg } from './auth';

type Ctx = { orgs: Org[]; org: Org | null; choose: (id: string) => void; reload: () => Promise<void>; update: (o: Org) => void };
const OrgContext = createContext<Ctx | null>(null);

export function OrgProvider({ children, onSignedOut }: { children: React.ReactNode; onSignedOut: () => void }) {
  const [orgs, setOrgs] = useState<Org[] | null>(null);
  const [current, setCurrent] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const r = await api<{ orgs: Org[] }>('/v1/account/orgs');
      const saved = getOrg();
      const pick = r.orgs.find((o) => o.id === saved)?.id ?? r.orgs[0]?.id ?? null;
      setOrg(pick);
      setCurrent(pick);
      setOrgs(r.orgs);
    } catch {
      onSignedOut();
    }
  }, [onSignedOut]);

  useEffect(() => { void reload(); }, [reload]);

  if (!orgs) return null;
  const value: Ctx = {
    orgs,
    org: orgs.find((o) => o.id === current) ?? null,
    choose: (id) => { setOrg(id); setCurrent(id); },
    reload,
    update: (o) => setOrgs((all) => (all ?? []).map((x) => (x.id === o.id ? o : x))),
  };
  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrg() {
  const c = useContext(OrgContext);
  if (!c) throw new Error('useOrg outside OrgProvider');
  return c;
}

/** Cream or near-black text, whichever reads better on the given colour. */
export function inkOn(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b! > 0.32 ? '#1E2A26' : '#F8F3EA';
}
