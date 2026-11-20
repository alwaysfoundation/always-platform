import { describe, it, expect } from 'vitest';
import { MILESTONES, MILESTONE_LABEL, withhold } from '../src/index.js';

describe('milestones', () => {
  it('labels every step of a handoff', () => {
    for (const m of MILESTONES) expect(MILESTONE_LABEL[m]).toBeTruthy();
  });

  it('withholds small numbers', () => {
    expect(withhold(9, 10)).toBeNull();
    expect(withhold(10, 10)).toBe(10);
  });
});
