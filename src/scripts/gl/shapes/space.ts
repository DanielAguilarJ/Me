import { ShapeBuilder, gaussian, onSphere } from './util';

/** Polvo estelar disperso del que nace la intro. */
export function nebula(b: ShapeBuilder) {
  const { rng } = b;
  const n = b.count;
  for (let k = 0; k < n; k++) {
    const d = onSphere(rng);
    const r = 2.6 + Math.pow(rng(), 0.6) * 6.5;
    const swirl = Math.sin(d[1] * 3 + r) * 0.6;
    b.push(d[0] * r + swirl, d[1] * r * 0.7, d[2] * r - 2.5, 0, rng());
  }
  return b.finish();
}

export const TUNNEL_START = -26;
export const TUNNEL_LEN = 34;

/** Túnel del tiempo: partículas (0), chispas (1) y portales (2, param = índice). */
export function tunnel(b: ShapeBuilder) {
  const { rng } = b;
  const nDust = b.quota(0.82);
  for (let k = 0; k < nDust; k++) {
    const a = rng() * Math.PI * 2;
    const r = 2.3 + Math.pow(rng(), 0.7) * 2.8;
    b.push(Math.cos(a) * r, Math.sin(a) * r, TUNNEL_START + rng() * TUNNEL_LEN, 0, rng());
  }
  const nSparks = b.quota(0.1);
  for (let k = 0; k < nSparks; k++) {
    const a = rng() * Math.PI * 2;
    const r = 1.9 + rng() * 3.2;
    b.push(Math.cos(a) * r, Math.sin(a) * r, TUNNEL_START + rng() * TUNNEL_LEN, 1, rng());
  }
  const gates = 12;
  const nGates = b.remaining;
  for (let k = 0; k < nGates; k++) {
    const g = k % gates;
    const a = rng() * Math.PI * 2;
    const r = 1.95 + (rng() - 0.5) * 0.03;
    const z = TUNNEL_START + ((g + 0.5) / gates) * TUNNEL_LEN;
    b.push(Math.cos(a) * r, Math.sin(a) * r, z, 2, g / gates);
  }
  return b.finish();
}

/** Galaxia espiral: brazos (0, param = radio), núcleo (1) y polvo (2). */
export function galaxy(b: ShapeBuilder) {
  const { rng } = b;
  const R = 3.4;
  const arms = 4;
  const nArms = b.quota(0.78);
  for (let k = 0; k < nArms; k++) {
    const r = R * Math.pow(rng(), 1.35);
    const arm = ((k % arms) / arms) * Math.PI * 2;
    const spin = r * 1.25;
    const spread = 0.32 * (0.25 + r / R);
    const rx = Math.pow(rng(), 2.5) * (rng() < 0.5 ? 1 : -1) * spread;
    const ry = Math.pow(rng(), 3) * (rng() < 0.5 ? 1 : -1) * spread * 0.6;
    const rz = Math.pow(rng(), 2.5) * (rng() < 0.5 ? 1 : -1) * spread;
    b.push(Math.cos(arm + spin) * r + rx, ry, Math.sin(arm + spin) * r + rz, 0, r / R);
  }
  const nCore = b.quota(0.12);
  for (let k = 0; k < nCore; k++) {
    b.push(gaussian(rng) * 0.28, gaussian(rng) * 0.12, gaussian(rng) * 0.28, 1, rng());
  }
  const nDust = b.remaining;
  for (let k = 0; k < nDust; k++) {
    const r = 4.6 * Math.sqrt(rng());
    const a = rng() * Math.PI * 2;
    b.push(Math.cos(a) * r, (rng() - 0.5) * 0.4, Math.sin(a) * r, 2, r / 4.6);
  }
  return b.finish();
}
