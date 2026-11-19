/**
 * <always-church-finder> — "Find a church near me" for any website.
 *
 *   <script type="module" src="https://cdn.alwaysfoundation.org/sdk/v0/finder.js"></script>
 *   <always-church-finder accent="#1B4740" step="church"></always-church-finder>
 *
 * Reads the public church feed only: facts churches chose to share, never anyone's details.
 * Nothing the visitor types is stored or sent anywhere except their postcode, to find churches nearby.
 * Accessible (labels, 44 px targets, keyboard, live region), no cookies, no tracking.
 */
type Church = { slug: string; name: string; suburb: string | null; denomination: string | null; distanceKm?: number; welcomingNow: boolean; youthPartner: boolean; serviceTimes: string | null; url: string };

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export class AlwaysChurchFinder extends HTMLElement {
  connectedCallback() {
    const accent = this.getAttribute('accent') ?? '#1B4740';
    const api = this.getAttribute('api') ?? 'https://api.alwaysfoundation.org';
    const step = this.getAttribute('step') ?? '';
    const youth = this.hasAttribute('youth');
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
        :host { --a: ${esc(accent)}; display: block; font: 16px/1.5 Inter, system-ui, sans-serif; color: #1E2A26; }
        .box { max-width: 520px; padding: 24px; border-radius: 20px; background: var(--always-surface, #F8F3EA); }
        h2 { margin: 0 0 4px; font: 700 22px/1.2 Inter, system-ui, sans-serif; color: var(--a); }
        p.sub { margin: 0 0 16px; color: #56625D; }
        form { display: flex; gap: 10px; }
        label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
        input { flex: 1; font: inherit; min-height: 48px; padding: 10px 14px; border: 1px solid #C9CCC3; border-radius: 12px; background: #fff; }
        button { min-height: 48px; padding: 0 20px; border: 0; border-radius: 999px; background: var(--a); color: #fff; font: 700 16px Inter, sans-serif; cursor: pointer; }
        button:focus-visible, input:focus-visible, a:focus-visible { outline: 3px solid var(--a); outline-offset: 2px; }
        ul { list-style: none; margin: 18px 0 0; padding: 0; display: grid; gap: 10px; }
        li a { display: block; padding: 14px 16px; border-radius: 14px; background: #fff; color: inherit; text-decoration: none; min-height: 44px; }
        li b { display: block; color: var(--a); }
        li span { font-size: 14px; color: #56625D; }
        .badge { display: inline-block; margin-top: 6px; padding: 2px 10px; border-radius: 999px; background: #E3EEE8; color: #1B4740; font-size: 13px; font-weight: 600; }
        .msg { margin-top: 14px; color: #56625D; }
        .credit { margin-top: 14px; font-size: 12px; color: #7A847F; }
      </style>
      <div class="box">
        <h2>Find a church near me</h2>
        <p class="sub">Enter your postcode to see churches nearby.</p>
        <form><label for="pc">Postcode</label><input id="pc" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" placeholder="Postcode, like 2150" autocomplete="postal-code" required><button type="submit">Search</button></form>
        <div role="status" aria-live="polite" class="msg"></div>
        <ul></ul>
        <p class="credit">From the Always church feed</p>
      </div>`;
    const form = root.querySelector('form')!, input = root.querySelector('input')!, list = root.querySelector('ul')!, msg = root.querySelector('[role=status]')!;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const pc = input.value.trim();
      if (!/^\d{4}$/.test(pc)) { msg.textContent = 'Please enter a four-digit postcode.'; return; }
      msg.textContent = 'Looking for churches near you…'; list.innerHTML = '';
      try {
        const q = new URLSearchParams({ postcode: pc, limit: '8' });
        if (step) q.set('step', step);
        if (youth) q.set('youth', 'true');
        const res = await fetch(`${api}/v1/feed/churches?${q}`);
        if (!res.ok) throw new Error(String(res.status));
        const { items } = (await res.json()) as { items: Church[] };
        if (!items.length) { msg.textContent = 'No churches in the feed near that postcode yet. Try a nearby one.'; return; }
        msg.textContent = `${items.length} ${items.length === 1 ? 'church' : 'churches'} near ${pc}`;
        list.innerHTML = items.map((c) => `<li><a href="${esc(c.url)}" target="_blank" rel="noopener"><b>${esc(c.name)}</b><span>${esc([c.suburb, c.denomination, c.distanceKm != null ? `${c.distanceKm} km` : null].filter(Boolean).join(' · '))}</span>${c.serviceTimes ? `<span><br>${esc(c.serviceTimes)}</span>` : ''}${c.welcomingNow ? '<br><span class="badge">Welcoming now</span>' : ''}</a></li>`).join('');
      } catch {
        msg.textContent = "We couldn't reach the church feed. Please try again.";
      }
    });
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('always-church-finder')) customElements.define('always-church-finder', AlwaysChurchFinder);
