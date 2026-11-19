/**
 * Reports for ministries, churches, funders and the foundation.
 * Built only from journey_tally (de-identified counts). Every figure below the minimum group size is withheld,
 * and any figure that includes young people uses the higher minimum (POLICY.minGroupSize).
 */
import type { Sql, Tx } from '@always/db';
import { POLICY } from '@always/core';

export const MILESTONES = ['responded', 'introduced', 'accepted', 'contacted', 'connected', 'care_team'] as const;
type Milestone = (typeof MILESTONES)[number];
export type Figure = number | null; // null: withheld because the group is too small to share safely

export interface ReportQuery { orgId?: string; view: 'sender' | 'receiver' | 'network'; from: string; to: string; sourceId?: string }

export const DEFINITIONS: Record<Milestone, string> = {
  responded: 'People who responded and agreed to be introduced to a next step.',
  introduced: 'People introduced to a partner church or ministry near them.',
  accepted: 'Introductions a church or ministry accepted, so they could reach out.',
  contacted: 'People a church or ministry logged getting in touch with.',
  connected: 'People who told us themselves that they are connected.',
  care_team: 'People the care team helped because no church nearby could yet.',
};

/** Withhold small groups. Any cell that includes a young person uses the minors minimum. */
export function safe(total: number, minors: number): Figure {
  if (total === 0) return 0;
  const min = minors > 0 ? POLICY.minGroupSize.minors : POLICY.minGroupSize.adults;
  return total < min ? null : total;
}

type Row = { milestone: Milestone; step: string; region: string; minor: boolean; month: string; n: number };

export async function buildReport(tx: Sql | Tx, q: ReportQuery) {
  const rows = (await tx`
    select milestone::text as milestone, step::text as step, region, minor, to_char(day, 'YYYY-MM') as month, sum(n)::int as n
    from journey_tally
    where day between ${q.from}::date and ${q.to}::date
      and (${q.view} = 'network'
           or (${q.view} = 'sender' and sender_org_id = ${q.orgId ?? null})
           or (${q.view} = 'receiver' and receiver_org_id = ${q.orgId ?? null}))
      and (${q.sourceId ?? null}::uuid is null or source_id = ${q.sourceId ?? null}::uuid)
    group by 1, 2, 3, 4, 5`) as unknown as Row[];

  const sum = (pred: (r: Row) => boolean) => {
    let total = 0, minors = 0;
    for (const r of rows) if (pred(r)) { total += r.n; if (r.minor) minors += r.n; }
    return safe(total, minors);
  };
  const milestones = q.view === 'receiver' ? (['accepted', 'contacted', 'connected'] as Milestone[]) : [...MILESTONES];
  const totals = Object.fromEntries(milestones.map((m) => [m, sum((r) => r.milestone === m)])) as Record<Milestone, Figure>;
  const months = [...new Set(rows.map((r) => r.month))].sort();
  const firstMilestone: Milestone = q.view === 'receiver' ? 'accepted' : 'responded';
  const by = (key: 'step' | 'region') =>
    [...new Set(rows.filter((r) => r.milestone === firstMilestone).map((r) => r[key]))].sort()
      .map((k) => ({ [key]: k, count: sum((r) => r.milestone === firstMilestone && r[key] === k) }));

  return {
    period: { from: q.from, to: q.to },
    view: q.view,
    totals,
    byMonth: months.map((m) => ({ month: m, ...Object.fromEntries(milestones.map((x) => [x, sum((r) => r.month === m && r.milestone === x)])) })),
    byStep: by('step'),
    byRegion: by('region'),
    youngPeople: sum((r) => r.milestone === firstMilestone && r.minor),
    definitions: Object.fromEntries(milestones.map((m) => [m, DEFINITIONS[m]])),
    privacy: `Totals only. Figures under ${POLICY.minGroupSize.adults} people (${POLICY.minGroupSize.minors} where young people are included) are withheld so no one can be identified.`,
  };
}

export type Report = Awaited<ReturnType<typeof buildReport>>;

/** A spreadsheet-friendly CSV of a report. Withheld figures are written as "fewer than N". */
export function toCsv(r: Report): string {
  const cell = (v: Figure) => (v === null ? `fewer than ${POLICY.minGroupSize.adults}` : String(v));
  const keys = Object.keys(r.totals) as Milestone[];
  const lines = [
    `Always report,${r.period.from} to ${r.period.to}`,
    '',
    ['Month', ...keys].join(','),
    ...r.byMonth.map((m) => [m.month, ...keys.map((k) => cell(((m as unknown) as Record<string, Figure>)[k] ?? 0))].join(',')),
    ['Total', ...keys.map((k) => cell(r.totals[k]))].join(','),
    '',
    'Next step asked for,People',
    ...r.byStep.map((s) => `${s.step},${cell(s.count)}`),
    '',
    'State or territory,People',
    ...r.byRegion.map((s) => `${s.region},${cell(s.count)}`),
    '',
    `"${r.privacy}"`,
  ];
  return lines.join('\n') + '\n';
}
