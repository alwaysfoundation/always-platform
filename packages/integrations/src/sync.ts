import { canSync } from './gate.js';
import type { ChmsConnector, GateRefusal, SyncContext, SyncResult } from './types.js';

export type SyncOutcome = { ok: true; result: SyncResult } | { ok: false; reason: GateRefusal };

/**
 * Puts one accepted person into their church's own system: a person record,
 * then the church's pathway and follow-up, where the church has set them up.
 * Pass the id from an earlier sync to avoid creating the person twice.
 */
export async function syncToChms(ctx: SyncContext, connector: ChmsConnector, existingExternalId?: string): Promise<SyncOutcome> {
  const gate = canSync(ctx, connector);
  if (!gate.ok) return gate;

  const externalPersonId = existingExternalId ?? (await connector.createPerson(ctx.packet));
  const result: SyncResult = { externalPersonId };
  const pathway = await connector.addToPathway?.(externalPersonId);
  if (pathway) result.pathway = pathway;
  const followUp = await connector.createFollowUp?.(externalPersonId);
  if (followUp) result.followUp = followUp;
  return { ok: true, result };
}
