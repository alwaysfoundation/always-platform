/**
 * <always-safety-check>: the free Always Safety check-up, embeddable in any site or app.
 *
 *   <script type="module" src="https://alwaysfoundation.org/sdk/v0/safety-widget.js"></script>
 *   <always-safety-check accent="#5B67D8"></always-safety-check>
 *
 * It calls the public, stateless check-up: answers stay in the browser and nothing is stored.
 * No token, no cookies, no tracking. A guide to common obligations, not legal advice.
 * The earlier <always-compliance-check> element name still works.
 */

type Condition = { all: Condition[] } | { any: Condition[] } | { not: Condition } | { field: string; is: boolean } | { field: string; includesAny: string[] };
interface Question { id: string; type: 'countries' | 'states' | 'boolean'; label: string; help?: string; onlyWhen?: Condition }
interface Item { obligationId: string; title: string; summary: string; strength: string; status: string; guidance: string }
interface Result { registerVersion: string; items: Item[]; summary: { required: number; met: number; attention: number; check: number; upcoming: number }; notice: string }

export const COUNTRY_NAMES: Record<string, string> = { AU: 'Australia', US: 'United States', CA: 'Canada', GB: 'United Kingdom', EU: 'European Union', NZ: 'New Zealand' };
export const STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Whether a question applies, given the answers so far. Unknown shapes fail closed. */
export function shows(c: Condition | undefined, p: Record<string, unknown>): boolean {
  if (!c) return true;
  if ('all' in c) return c.all.every((x) => shows(x, p));
  if ('any' in c) return c.any.some((x) => shows(x, p));
  if ('not' in c) return !shows(c.not, p);
  if ('includesAny' in c) return c.includesAny.some((v) => ((p[c.field] as string[] | undefined) ?? []).includes(v));
  if ('is' in c) return (p[c.field] === true) === c.is;
  return false;
}

export function profileFromForm(questions: Question[], f: FormData): Record<string, unknown> {
  const p: Record<string, unknown> = {};
  for (const q of questions) {
    if (!shows(q.onlyWhen, p)) continue;
    p[q.id] = q.type === 'boolean' ? f.get(q.id) === 'yes' : f.getAll(q.id).map(String);
  }
  return p;
}

// Server-side and test environments have no HTMLElement; the helpers above still work there.
const Base = (typeof HTMLElement !== 'undefined' ? HTMLElement : class {}) as typeof HTMLElement;

export class AlwaysSafetyCheck extends Base {
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
        fieldset { border: 0; padding: 14px 0; margin: 0; border-top: 1px solid #E9DFCF; } fieldset[hidden] { display: none; }
        legend { font-weight: 700; padding: 0; } .help { margin: 2px 0 10px; font-size: 14px; color: #4E5F58; }
        .opts { display: flex; flex-wrap: wrap; gap: 8px; }
        .opts label { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 14px; border: 1px solid #D9D2C4; border-radius: 12px; cursor: pointer; }
        input { accent-color: var(--a); width: 18px; height: 18px; }
        button { min-height: 48px; margin-top: 16px; padding: 0 22px; border: 0; border-radius: 14px; background: var(--a); color: #fff; font: 700 16px Inter, sans-serif; cursor: pointer; }
        button:focus-visible, label:focus-within { outline: 3px solid var(--a); outline-offset: 2px; }
        .err { color: #A3381A; font-weight: 600; min-height: 1.4em; margin: 10px 0 0; }
        ol { list-style: none; padding: 0; margin: 16px 0 0; display: grid; gap: 10px; }
        li { padding: 14px 16px; border-radius: 14px; background: #F4EFE6; } li b { display: block; } li span { font-size: 14px; color: #3E4D47; }
        .fine { margin-top: 16px; font-size: 13px; color: #4E5F58; }
      </style>
      <div class="card" aria-live="polite"><p>Loading the check-up…</p></div>`;
    try {
      const res = await fetch(`${this.api}/v1/safety/register`);
      if (!res.ok) throw new Error(String(res.status));
      this.renderForm(((await res.json()) as { profileQuestions: Question[] }).profileQuestions);
    } catch {
      this.card().innerHTML = '<p>The check-up could not load. Please try again later.</p>';
    }
  }

  private card() { return this.root.querySelector('.card') as HTMLElement; }

  private renderForm(questions: Question[]) {
    const options = (q: Question) => {
      if (q.type === 'countries') return Object.entries(COUNTRY_NAMES).map(([v, n]) => `<label><input type="checkbox" name="${esc(q.id)}" value="${v}"> ${esc(n)}</label>`).join('');
      if (q.type === 'states') return STATES.map((s) => `<label><input type="checkbox" name="${esc(q.id)}" value="${s}"> ${s}</label>`).join('');
      return `<label><input type="radio" name="${esc(q.id)}" value="yes"> Yes</label><label><input type="radio" name="${esc(q.id)}" value="no"> No</label>`;
    };
    const field = (q: Question) => `<fieldset data-q="${esc(q.id)}"><legend>${esc(q.label)}</legend>${q.help ? `<p class="help">${esc(q.help)}</p>` : ''}<div class="opts">${options(q)}</div></fieldset>`;
    this.card().innerHTML = `<h2>Free safety check-up</h2><p class="help">About five minutes. Nothing is saved. A guide to common obligations, not legal advice.</p><form novalidate>${questions.map(field).join('')}<p class="err" role="alert"></p><button type="submit">See what applies to us</button></form>`;
    const form = this.root.querySelector('form')!;
    const sync = () => {
      const p = profileFromForm(questions, new FormData(form));
      for (const q of questions) (form.querySelector(`[data-q="${q.id}"]`) as HTMLElement).hidden = !shows(q.onlyWhen, p);
    };
    form.addEventListener('change', sync);
    sync();
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = form.querySelector('.err') as HTMLElement;
      const f = new FormData(form);
      const profile = profileFromForm(questions, f);
      const missing = questions.find((q) => shows(q.onlyWhen, profile) && (q.type === 'boolean' ? !f.get(q.id) : !(profile[q.id] as string[]).length));
      if (missing) { err.textContent = `Please answer: ${missing.label}`; return; }
      err.textContent = '';
      const res = await fetch(`${this.api}/v1/safety/check`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ profile }) });
      if (!res.ok) return void (err.textContent = 'Something went wrong. Please check your answers and try again.');
      this.renderResult((await res.json()) as Result);
    });
  }

  private renderResult(r: Result) {
    const todo = r.items.filter((i) => i.status !== 'met');
    this.card().innerHTML = `<h2>${r.summary.required} obligations apply to you</h2>
      <p class="help">${todo.length} to look at. Start with the first.</p>
      <ol>${todo.map((i) => `<li><b>${esc(i.title)}</b><span>${esc(i.summary)}</span></li>`).join('')}</ol>
      <p class="fine">${esc(r.notice)} Register version ${esc(r.registerVersion)}.</p>`;
    const detail = { summary: r.summary, registerVersion: r.registerVersion };
    this.dispatchEvent(new CustomEvent('always-safety-result', { detail, bubbles: true }));
    this.dispatchEvent(new CustomEvent('always-compliance-result', { detail, bubbles: true }));
  }
}

/** @deprecated Use AlwaysSafetyCheck. */
export class AlwaysComplianceCheck extends AlwaysSafetyCheck {}

if (typeof customElements !== 'undefined') {
  if (!customElements.get('always-safety-check')) customElements.define('always-safety-check', AlwaysSafetyCheck);
  if (!customElements.get('always-compliance-check')) customElements.define('always-compliance-check', AlwaysComplianceCheck);
}
