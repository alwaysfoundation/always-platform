import { CONSENT_WORDING } from './consent.js';

/**
 * <always-response> — a drop-in, consent-first response card for any website or event page.
 *
 *   <script type="module" src="https://cdn.alwaysfoundation.org/sdk/v0/widget.js"></script>
 *   <always-response endpoint="/api/always/respond" event="YouthAlive Adelaide" accent="#5B67D8"></always-response>
 *
 * It posts to YOUR endpoint (which calls the Always API with your secret token), so no
 * secret ever reaches the browser. Accessible (labels, 44 px targets, keyboard), no
 * tracking, no cookies. Brand it with the accent attribute or CSS custom properties.
 */
const STEPS: [string, string][] = [
  ['church', 'Find a church near me'],
  ['explore', 'Explore faith in a course'],
  ['talk', 'Talk with someone'],
  ['youth', 'Join a youth group'],
  ['read', 'Start reading the Bible'],
];

export class AlwaysResponse extends HTMLElement {
  connectedCallback() {
    const accent = this.getAttribute('accent') ?? '#0F5C4D';
    const w = CONSENT_WORDING.v1;
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
        :host { --a: ${accent}; display: block; font: 16px/1.5 Inter, system-ui, sans-serif; color: #13201C; }
        form { display: grid; gap: 14px; max-width: 460px; padding: 24px; border-radius: 20px; background: var(--always-surface, #FBF4E8); }
        h2 { margin: 0; font: 700 24px/1.15 'Space Grotesk', system-ui, sans-serif; }
        label { display: grid; gap: 6px; font-weight: 600; font-size: 14px; }
        input, select { font: inherit; min-height: 44px; padding: 10px 12px; border: 1px solid #C9CCC3; border-radius: 12px; background: #fff; }
        .check { display: flex; gap: 10px; align-items: flex-start; font-weight: 400; }
        .check input { min-height: 22px; width: 22px; margin-top: 2px; accent-color: var(--a); }
        button { min-height: 48px; border: 0; border-radius: 999px; background: var(--a); color: #fff; font: 700 16px Inter, sans-serif; cursor: pointer; }
        button:focus-visible, input:focus-visible, select:focus-visible { outline: 3px solid var(--a); outline-offset: 2px; }
        .done { padding: 24px; border-radius: 20px; background: var(--always-surface, #FBF4E8); }
      </style>
      <form novalidate>
        <h2>We'd love to help with your next step</h2>
        <label>What would help most?<select name="step">${STEPS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>
        <label>First name<input name="firstName" autocomplete="given-name" required></label>
        <label>Mobile<input name="mobile" inputmode="tel" autocomplete="tel" required></label>
        <label>Suburb<input name="suburb" autocomplete="address-level2" required></label>
        <label>Postcode<input name="postcode" inputmode="numeric" pattern="\\d{4}" required></label>
        <label>Age<select name="ageBand"><option value="18+">18 or over</option><option value="15-17">15 to 17</option><option value="13-14">13 or 14</option><option value="under13">Under 13</option></select></label>
        <label class="check"><input type="checkbox" name="connect" required> ${w['connect.church']}</label>
        <label class="check"><input type="checkbox" name="nearby" checked> ${w.allowNextNearby}</label>
        <button type="submit">Connect me</button>
      </form>`;
    root.querySelector('form')!.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(e.target as HTMLFormElement);
      if (!f.get('connect')) return;
      const ageBand = String(f.get('ageBand'));
      if (ageBand === 'under13') {
        root.innerHTML = `<div class="done">Thanks for reaching out! Please ask a parent or your leader to help you sign up.</div>`;
        return;
      }
      await fetch(this.getAttribute('endpoint')!, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          step: f.get('step'), firstName: f.get('firstName'), contact: { kind: 'mobile', value: f.get('mobile') },
          suburb: f.get('suburb'), postcode: f.get('postcode'), ageBand, event: this.getAttribute('event'),
          consent: { purposes: ['connect.church'], recipients: [], allowNextNearby: !!f.get('nearby'), wordingVersion: 'v1', party: 'self' },
        }),
      });
      root.innerHTML = `<div class="done"><h2>Thank you</h2><p>Someone will be in touch soon. We've sent you a text with a link to see what's happening or change your mind.</p></div>`;
    });
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('always-response')) customElements.define('always-response', AlwaysResponse);
