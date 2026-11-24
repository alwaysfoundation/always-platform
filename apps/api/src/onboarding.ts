import { hmacSign } from './crypto.js';

/** A link that stops setup emails for one organisation, without signing in. */
export function onboardingStopToken(orgId: string): string {
  const key = process.env.HASH_KEY;
  if (!key) throw new Error('HASH_KEY is not set');
  return hmacSign(key, `onboarding-stop:${orgId}`).slice(0, 32);
}
