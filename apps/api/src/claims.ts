// Shared mail and site hosts: an address there proves nothing about who runs a church's website.
const SHARED = new Set([
  'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'yahoo.com', 'yahoo.com.au', 'icloud.com', 'me.com',
  'aol.com', 'proton.me', 'protonmail.com', 'gmx.com', 'bigpond.com', 'bigpond.net.au', 'optusnet.com.au', 'tpg.com.au', 'iinet.net.au',
  'google.com', 'sites.google.com', 'facebook.com', 'instagram.com', 'wixsite.com', 'squarespace.com', 'weebly.com', 'wordpress.com',
  'linktr.ee', 'churchcenter.com', 'github.io', 'netlify.app', 'vercel.app',
]);

export function websiteHost(website: string | null | undefined): string | null {
  if (!website) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`);
    return u.hostname.toLowerCase().replace(/^www\./, '') || null;
  } catch {
    return null;
  }
}

/** True when the email's domain is exactly the church website's host (ignoring www). */
export function emailMatchesWebsite(email: string, website: string | null | undefined): boolean {
  const host = websiteHost(website);
  const domain = email.split('@').pop()?.toLowerCase().trim();
  if (!host || !domain || SHARED.has(domain) || SHARED.has(host)) return false;
  return domain === host;
}
