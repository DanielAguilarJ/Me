import type { TierName } from '../gl/Stage';

const params = new URLSearchParams(window.location.search);

export const env = {
  reduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  coarse: window.matchMedia('(pointer: coarse)').matches,
  capture: params.get('capture'),
  /** ?hq desactiva la reducción automática de calidad (útil para depurar). */
  fixedQuality: params.has('hq'),
};

export function detectTier(): TierName {
  if (env.capture) return 'capture';
  const nav = navigator as Navigator & { deviceMemory?: number };
  const small = Math.min(window.innerWidth, window.innerHeight) < 600 || window.innerWidth < 760;
  if (env.coarse && small) return 'mobile';
  const memory = nav.deviceMemory ?? 8;
  const cores = nav.hardwareConcurrency ?? 8;
  if (memory <= 4 || cores <= 4 || env.coarse) return 'medium';
  return 'high';
}

export function hasWebGL2(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!canvas.getContext('webgl2');
  } catch {
    return false;
  }
}

export const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
