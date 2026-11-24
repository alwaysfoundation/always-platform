'use client';
/**
 * Picks the model for this device, following ai/models/recommended.json: the strongest open model
 * that will run well here, smaller when memory or graphics are limited. A person can change it.
 */
export type Choice = { id: string; name: string; size: string; licence: string; note: string };

const F16 = 'q4f16_1-MLC', F32 = 'q4f32_1-MLC';
export const MODELS = (f16: boolean) => ({
  large: { id: `gemma-4-E2B-it-${f16 ? F16 : F32}`, name: 'Gemma 4 E2B', size: f16 ? '3.4 GB' : '3.9 GB', licence: 'Apache 2.0', note: 'Best answers. For newer laptops with 8 GB or more.' },
  standard: { id: `Qwen3.5-2B-${f16 ? F16 : F32}`, name: 'Qwen 3.5 2B', size: f16 ? '2.2 GB' : '2.6 GB', licence: 'Apache 2.0', note: 'Good answers on most laptops.' },
  light: { id: `Qwen3.5-0.8B-${f16 ? F16 : F32}`, name: 'Qwen 3.5 0.8B', size: f16 ? '1.6 GB' : '1.9 GB', licence: 'Apache 2.0', note: 'Quickest. For older or smaller machines.' },
});

export type Device = { gpu: boolean; f16: boolean; memoryGB: number | null; maxBufferMB: number; mobile: boolean };

export async function detect(): Promise<Device> {
  const nav = navigator as Navigator & { gpu?: { requestAdapter(): Promise<{ features: Set<string>; limits: { maxBufferSize: number } } | null> }; deviceMemory?: number };
  const mobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
  const adapter = await nav.gpu?.requestAdapter().catch(() => null);
  if (!adapter) return { gpu: false, f16: false, memoryGB: nav.deviceMemory ?? null, maxBufferMB: 0, mobile };
  return { gpu: true, f16: adapter.features.has('shader-f16'), memoryGB: nav.deviceMemory ?? null, maxBufferMB: Math.round(adapter.limits.maxBufferSize / 2 ** 20), mobile };
}

export function route(d: Device): { tier: 'large' | 'standard' | 'light'; choice: Choice } | null {
  if (!d.gpu) return null;
  const m = MODELS(d.f16);
  const mem = d.memoryGB ?? 8;
  const tier = d.mobile || mem < 4 || d.maxBufferMB < 1024 ? 'light' : mem >= 8 && d.maxBufferMB >= 2048 ? 'large' : 'standard';
  return { tier, choice: m[tier] };
}
