import { describe, it, expect } from 'vitest';
import { shows, profileFromForm } from '../src/safety-widget.js';

describe('safety widget questions', () => {
  const qs = [
    { id: 'countries', type: 'countries' as const, label: 'Where?' },
    { id: 'states', type: 'states' as const, label: 'Which states?', onlyWhen: { field: 'countries', includesAny: ['AU'] } },
    { id: 'registeredCharity', type: 'boolean' as const, label: 'Charity?', onlyWhen: { field: 'countries', includesAny: ['US', 'GB'] } },
  ];
  it('shows Australian questions only when Australia is chosen', () => {
    expect(shows(qs[1]!.onlyWhen, { countries: ['US'] })).toBe(false);
    expect(shows(qs[1]!.onlyWhen, { countries: ['AU'] })).toBe(true);
  });
  it('builds a profile from only the questions that apply', () => {
    const f = new FormData();
    f.append('countries', 'GB');
    f.append('states', 'NSW');
    f.append('registeredCharity', 'yes');
    expect(profileFromForm(qs, f)).toEqual({ countries: ['GB'], registeredCharity: true });
  });
  it('fails closed on an unknown condition', () => {
    expect(shows({ nope: 1 } as never, {})).toBe(false);
  });
});
