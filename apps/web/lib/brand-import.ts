'use client';
/** Reads a church's public website for its name, colours and logo, and turns a logo into a palette. Nothing is stored. */
const BRAND = 'https://brand.alwaysfoundation.org';

export type Found = { name: string; colors: string[]; logo: string | null };

export async function importSite(site: string): Promise<Found | null> {
  const url = /^https?:\/\//i.test(site) ? site : `https://${site}`;
  try {
    const r = await fetch(`${BRAND}/v1/page?url=${encodeURIComponent(url)}`);
    if (!r.ok) return null;
    const d = (await r.json()) as { name?: string; colors?: string[]; logo?: string | null; icon?: string | null };
    const src = d.logo ?? d.icon ?? null;
    const logo = src ? await toDataUrl(`${BRAND}/v1/image?url=${encodeURIComponent(src)}`) : null;
    return { name: d.name ?? '', colors: d.colors ?? [], logo };
  } catch {
    return null;
  }
}

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, fail) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => ok(i); i.onerror = fail; i.src = src; });
}

/** Shrinks an image to fit 256 px and returns it as a PNG data URL, the form the API keeps. */
export async function toDataUrl(src: string): Promise<string | null> {
  try {
    const img = await load(src);
    const s = Math.min(1, 256 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * s)); c.height = Math.max(1, Math.round(img.naturalHeight * s));
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    const out = c.toDataURL('image/png');
    return out.length < 330_000 ? out : null;
  } catch {
    return null;
  }
}

/** The most common strong colours in an image, most frequent first. */
export async function palette(dataUrl: string): Promise<string[]> {
  try {
    const img = await load(dataUrl);
    const c = document.createElement('canvas'); c.width = 64; c.height = 64;
    const x = c.getContext('2d')!; x.drawImage(img, 0, 0, 64, 64);
    const px = x.getImageData(0, 0, 64, 64).data;
    const count = new Map<string, number>();
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3]! < 200) continue;
      const [r, g, b] = [px[i]!, px[i + 1]!, px[i + 2]!];
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
      if (l < 25 || l > 235 || (mx - mn) / (mx || 1) < 0.2) continue;
      const k = [r, g, b].map((v) => Math.round(v / 24) * 24).map((v) => Math.min(255, v).toString(16).padStart(2, '0')).join('');
      count.set(k, (count.get(k) ?? 0) + 1);
    }
    return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => `#${k.toUpperCase()}`);
  } catch {
    return [];
  }
}
