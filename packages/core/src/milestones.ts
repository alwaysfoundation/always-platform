/** Steps of a response through a handoff, counted in the de-identified tally (ADR 0003). */
export const MILESTONES = ['responded', 'introduced', 'accepted', 'contacted', 'connected'] as const;
export type Milestone = (typeof MILESTONES)[number];

export const MILESTONE_LABEL: Record<Milestone, string> = {
  responded: 'Said yes to a next step',
  introduced: 'Introduced to a church or ministry',
  accepted: 'Welcomed by a church or ministry',
  contacted: 'First conversation',
  connected: 'Connected with a church family',
};

/** Withhold any count below the minimum group size (POLICY.minGroupSize). */
export function withhold(n: number, min: number): number | null {
  return n >= min ? n : null;
}
