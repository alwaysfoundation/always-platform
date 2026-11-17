import { POLICY } from './policy.js';

const fmtCache = new Map<string, Intl.DateTimeFormat>();

function localHour(at: Date, timeZone: string): number {
  let f = fmtCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-AU', { timeZone, hour: 'numeric', hourCycle: 'h23' });
    fmtCache.set(timeZone, f);
  }
  return Number(f.format(at));
}

export function isStaffed(at: Date, hours = POLICY.staffedHours): boolean {
  const h = localHour(at, hours.timeZone);
  return h >= hours.startHour && h < hours.endHour;
}

const MINUTE = 60_000;

/** Staffed minutes between two instants (whole minutes, counted minute by minute). */
export function staffedMinutesBetween(from: Date, to: Date, hours = POLICY.staffedHours): number {
  if (to <= from) return 0;
  let count = 0;
  // Step a minute at a time; windows are at most a few days, so this stays cheap and exact across DST changes.
  for (let t = from.getTime(); t < to.getTime(); t += MINUTE) {
    if (isStaffed(new Date(t), hours)) count++;
  }
  return count;
}

/** The instant at which `minutes` staffed minutes will have elapsed after `from`. */
export function addStaffedMinutes(from: Date, minutes: number, hours = POLICY.staffedHours): Date {
  let t = from.getTime();
  let left = minutes;
  const limit = t + 14 * 24 * 60 * MINUTE;
  while (left > 0 && t < limit) {
    if (isStaffed(new Date(t), hours)) left--;
    t += MINUTE;
  }
  return new Date(t);
}
