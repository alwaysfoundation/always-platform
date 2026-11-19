import { createCipheriv, createDecipheriv, createHmac, randomBytes, createHash, timingSafeEqual } from 'node:crypto';

/**
 * Field encryption for Restricted and Confidential data (DP-3, DP-4).
 * AES-256-GCM with a 32-byte data key. Ciphertext layout: version(1) | iv(12) | tag(16) | body.
 * In production the data key is unwrapped at start-up from AWS KMS (ap-southeast-2);
 * locally it comes from FIELD_KEY. The database only ever sees ciphertext.
 */
const VERSION = 1;

function key(name: 'FIELD_KEY' | 'HASH_KEY' | 'LINK_KEY' | 'ORG_CODE_KEY'): Buffer {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  const k = Buffer.from(v, 'base64');
  if (k.length !== 32) throw new Error(`${name} must be 32 bytes, base64-encoded`);
  return k;
}

export function encrypt(plain: string | null | undefined): Buffer | null {
  if (plain === null || plain === undefined || plain === '') return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key('FIELD_KEY'), iv);
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return Buffer.concat([Buffer.from([VERSION]), iv, cipher.getAuthTag(), body]);
}

export function decrypt(ct: Buffer | Uint8Array | null | undefined): string | null {
  if (!ct) return null;
  const buf = Buffer.from(ct);
  if (buf[0] !== VERSION) throw new Error('unknown_ciphertext_version');
  const iv = buf.subarray(1, 13);
  const tag = buf.subarray(13, 29);
  const decipher = createDecipheriv('aes-256-gcm', key('FIELD_KEY'), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(buf.subarray(29)), decipher.final()]).toString('utf8');
}

/** Keyed hash for lookups (emails, tokens) so equality works without storing plaintext. */
export function lookupHash(value: string): Buffer {
  return createHmac('sha256', key('HASH_KEY')).update(value.trim().toLowerCase()).digest();
}

/** Random, URL-safe secret with a readable prefix, e.g. alw_live_..., shown once. */
export function newToken(prefix: string): { token: string; hash: Buffer } {
  const token = `${prefix}_${randomBytes(24).toString('base64url')}`;
  return { token, hash: tokenHash(token) };
}

export function tokenHash(token: string): Buffer {
  return createHash('sha256').update(token).digest();
}

export function hmacSign(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Journeys (ADR 0012). The link is a keyed hash of a normalised mobile, held in the database and never returned.
 * LINK_KEY and ORG_CODE_KEY are separate from HASH_KEY so destroying LINK_KEY unlinks every journey without touching sign-in.
 */
export function journeyLink(normalisedMobile: string): Buffer {
  return createHmac('sha256', key('LINK_KEY')).update(normalisedMobile).digest();
}

/** A ministry's own code for a journey: stable for that ministry, unrelated between ministries. */
export function ministryCode(journeyId: string, orgId: string): string {
  return 'jny_' + createHmac('sha256', key('ORG_CODE_KEY')).update(`${journeyId}|${orgId}`).digest('base64url').slice(0, 22);
}
