'use client';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { api } from '@/lib/api';
import { Icon } from '@/lib/icons';
import { useOrg } from '@/lib/org';

export type OwnPage = { slug: string; title: string; steps: string[]; active: boolean; showAlways: boolean; url: string };

export function useOwnPage(): [OwnPage | null, (p: OwnPage) => void] {
  const { org } = useOrg();
  const [page, setPage] = useState<OwnPage | null>(null);
  useEffect(() => {
    if (!org || org.modules.respond === 'off') return;
    api<OwnPage>(`/v1/account/orgs/${org.id}/page`).then(setPage).catch(() => setPage(null));
  }, [org]);
  return [page, setPage];
}

/** The church's response page: link, QR code and a print-ready card. */
export function PageCard() {
  const { org } = useOrg();
  const [page] = useOwnPage();
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!page) return;
    QRCode.toString(page.url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#14352F', light: '#FFFFFF' } }).then(setQr).catch(() => setQr(''));
  }, [page]);

  if (!org || !page) return null;

  function download() {
    const blob = new Blob([qr], { type: 'image/svg+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${page!.slug}-qr.svg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function print() {
    const w = window.open('', '_blank', 'noopener=no');
    if (!w) return;
    const name = org!.name.replace(/[<>&]/g, '');
    w.document.write(`<!DOCTYPE html><html><head><title>${name} welcome card</title><style>@page{size:A6;margin:0}body{margin:0;font-family:Inter,system-ui,sans-serif;color:#14352F}.c{width:105mm;height:148mm;box-sizing:border-box;padding:12mm;display:flex;flex-direction:column;gap:6mm}h1{font-size:22pt;line-height:1.05;margin:0}p{margin:0;font-size:11pt;color:#4E5F58}.q svg{width:62mm;height:62mm}small{margin-top:auto;font-size:8pt;color:#8A968F}</style></head><body><div class="c"><b>${name}</b><h1>New here? Say hello.</h1><p>Scan with your phone camera to ask for a next step.</p><div class="q">${qr}</div><small>Your details stay with the church.</small></div><script>onload=()=>print()</script></body></html>`);
    w.document.close();
  }

  return (
    <section className="pgc" aria-labelledby="h-pgc">
      <div className="pgc-qr" aria-hidden="true" dangerouslySetInnerHTML={{ __html: qr }} />
      <div className="pgc-tx">
        <h2 id="h-pgc">Your response page</h2>
        <p>Share it anywhere people might say yes: on slides, cards, your website and after services.</p>
        <a className="pgc-url" href={page.url} target="_blank" rel="noreferrer">{page.url.replace(/^https?:\/\//, '')}</a>
        <div className="pgc-acts">
          <button type="button" className="btn btn-brand" onClick={() => { void navigator.clipboard?.writeText(page.url); setCopied(true); setTimeout(() => setCopied(false), 1800); }}>
            <Icon name={copied ? 'check' : 'globe'} size={18} />{copied ? 'Copied' : 'Copy link'}
          </button>
          <button type="button" className="btn pgc-quiet" onClick={print}>Print a welcome card</button>
          <button type="button" className="btn pgc-quiet" onClick={download}>Download QR</button>
        </div>
      </div>
    </section>
  );
}
