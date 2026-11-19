/**
 * <always-compliance-check> — the free Always Safety check-up, embeddable in any site or app.
 *
 *   <script type="module" src="https://cdn.alwaysfoundation.org/sdk/v0/compliance-widget.js"></script>
 *   <always-compliance-check accent="#5B67D8"></always-compliance-check>
 *
 * It calls the public, stateless check-up: answers stay in the browser and nothing is stored.
 * No token, no cookies, no tracking. A guide to common obligations, not legal advice.
 */

interface Question { id: string; type: 'states' | 'boolean'; label: string; help?: string }
interface Item { obligationId: string; title: string; summary: string; strength: string; status: string; guidance: string }
interface Result { registerVersion: string; items: Item[]; summary: { required: number; met: number; attention: number; check: number; upcoming: number }; notice: string }

const STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function profileFromForm(questions: Question[], f: FormData): Record<string, unknown> {
  const p: Record<string, unknown> = {};
  for (const q of questions) p[q.id] = q.type === 'states' ? f.getAll(q.id).map(String) : f.get(q.id) === 'yes';
  return p;
}

export class AlwaysComplianceCheck extends HTMLElement {
  private root!: ShadowRoot;
  private get api() { return (this.getAttribute('api') ?? 'https://api.alwaysfoundation.org').replace(/\/$/, ''); }

  async connectedCallback() {
    const accent = this.getAttribute('accent') ?? '#1B4740';
    this.root = this.attachShadow({ mode: 'open' });
    this.root.innerHTML = `
      <style>
        :host { --a: ${/^#[0-9a-f]{6}$/i.test(accent) ? accent : '#1B4740'}; display: block; font: 16px/1.5 Inter, system-ui, sans-serif; color: #1E2A26; }
        .card { max-width: 640px; padding: 28px; border-radius: 22px; background: var(--always-surface, #FFFDF8); box-shadow: 0 1px 0 rgba(30,42,38,.06); }
        h2 { margin: 0 0 6px; font: 800 24px/1.2 Manrope, system-ui, sans-serif; color: var(--a); }
        fieldset { border: 0; padding: 14px 0; margin: 0; border-top: 1px solid #E9DFCF; }
        legend { font-weight: 700; padding: 0; } .help { margin: 2px 0 10px; font-size: 14px; color: #4E5F58; }
        .opts { display: flex; flex-wrap: wrap; gap: 8px; }
        .opts label { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 14px; border: 1px solid #D9D2C4; border-radius: 12px; cursor: pointer; }
        input { accent-color: var(--a); width: 18px; height: 18px; }
        button { min-height: 48px; margin-top: 16px; padding: 0 22px; border: 0; border-radius: 14px; background: var(--a); color: #fff; font: 700 16px Inter, sans-serif; cursor: pointer; }
        button:focus-visible, label:focus-within { outline: 3px solid var(--a); outline-offset: 2px; }
        ol { list-style: none; padding: 0; margin: 16px 0 0; display: grid; gap: 10px; }
        li { padding: 14px 16px; border-radius: 14px; background: #F4EFE6; } li b { display: block; } li span { font-size: 14px; color: #3E4D47; }
        .fine { margin-top: 16px; font-size: 13px; color: #4E5F58; }
      </style>
      <div class="card" aria-live="polite"><p>Loading the check-up…</p></div>`;
    try {
      const reg = await (await fetch(`${this.api}/v1/compliance/register`)).json();
      this.renderForm(reg.profileQuestions as Question[]);
    } catch {
      this.card().innerHTML = '<p>The check-up could not load. Please try again later.</p>';
    }
  }

  private card() { return this.root.querySelector('.card') as HTMLElement; }

  private renderForm(questions: Question[]) {
    const field = (q: Question) => `<fieldset><legend>${esc(q.label)}</legend>${q.help ? `<p class="help">${esc(q.help)}</p>` : ''}<div class="opts">${
      q.type === 'states'
        ? STATES.map((s) => `<label><input type="checkbox" name="${esc(q.id)}" value="${s}"> ${s}</label>`).join('')
        : `<label><input type="radio" name="${esc(q.id)}" value="yes" required> Yes</label><label><input type="radio" name="${esc(q.id)}" value="no"> No</label>`
    }</div></fieldset>`;
    this.card().innerHTML = `<h2>Free safety check-up</h2><p class="help">About five minutes. Nothing is saved.</p><form>${questions.map(field).join('')}<button type="submit">See what applies to us</button></form>`;
    this.root.querySelector('form')!.addEventListener('submit', async (e) => {
      e.preventDefault();
      const profile = profileFromForm(questions, new FormData(e.target as HTMLFormElement));
      if (!(profile.states as string[]).length) return void (this.root.querySelector('legend') as HTMLElement).scrollIntoView();
      const res = await fetch(`${this.api}/v1/compliance/check`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ profile }) });
      if (!res.ok) return void (this.card().innerHTML = '<p>Something went wrong. Please check your answers and try again.</p>');
      this.renderResult((await res.json()) as Result);
    });
  }

  private renderResult(r: Result) {
    const todo = r.items.filter((i) => i.status !== 'met');
    this.card().innerHTML = `<h2>${r.summary.required} obligations apply to you</h2>
      <p class="help">${todo.length} to look at. Start with the first.</p>
      <ol>${todo.map((i) => `<li><b>${esc(i.title)}</b><span>${esc(i.summary)}</span></li>`).join('')}</ol>
      <p class="fine">${esc(r.notice)} Register version ${esc(r.registerVersion)}.</p>`;
    this.dispatchEvent(new CustomEvent('always-compliance-result', { detail: { summary: r.summary, registerVersion: r.registerVersion }, bubbles: true }));
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('always-compliance-check')) customElements.define('always-compliance-check', AlwaysComplianceCheck);
