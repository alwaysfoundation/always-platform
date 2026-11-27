import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from '../../../scripts/safety-check-product.js';

const example = fileURLToPath(new URL('../../../spec/safety/examples/youth-campaign-app.profile.json', import.meta.url));
const capture = () => {
  let text = '';
  return { out: (s: string) => (text += s), text: () => text };
};

describe('safety-check-product', () => {
  it('prints a Markdown report and fails on high gaps by default', () => {
    const c = capture();
    expect(run([example, '--date', '2026-11-27'], c.out)).toBe(1);
    expect(c.text()).toMatch(/^# Always Safety product check/);
  });

  it('passes when told not to fail', () => {
    expect(run([example, '--fail-on', 'none', '--date', '2026-11-27'], capture().out)).toBe(0);
  });

  it('prints JSON', () => {
    const c = capture();
    run([example, '--format', 'json', '--fail-on', 'none', '--date', '2026-11-27'], c.out);
    expect(JSON.parse(c.text()).summary.gaps).toBeGreaterThan(0);
  });

  it('refuses a profile with contact details, with exit code 2', () => {
    const dir = mkdtempSync(join(tmpdir(), 'safety-'));
    const bad = join(dir, 'p.json');
    const p = JSON.parse(readFileSync(example, 'utf8'));
    p.name = 'Run by someone@example.org';
    writeFileSync(bad, JSON.stringify(p));
    const c = capture();
    expect(run([bad], c.out)).toBe(2);
    expect(c.text()).toMatch(/email address/);
  });

  it('rejects unknown options and a bad date', () => {
    expect(run([example, '--format', 'pdf'], capture().out)).toBe(2);
    expect(run([example, '--date', 'soon'], capture().out)).toBe(2);
    expect(run([], capture().out)).toBe(2);
  });
});
