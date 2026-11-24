import { GEO } from './ids';
import { ShapeBuilder, lerp, onBox, onSphere } from './util';

/**
 * Aerogenerador: torre/góndola (0), buje (1), aspas que giran en el shader (2),
 * corrientes de viento (3) y base (4).
 */
export function turbine(b: ShapeBuilder) {
  const { rng } = b;
  const [hx, hy, hz] = GEO.hub;

  const nTower = b.quota(0.15);
  for (let k = 0; k < nTower; k++) {
    const v = rng();
    const y = -2.05 + v * 2.75;
    const r = lerp(0.12, 0.05, v);
    const a = rng() * Math.PI * 2;
    b.push(r * Math.cos(a), y, r * Math.sin(a), 0, v);
  }

  const nNacelle = b.quota(0.04);
  for (let k = 0; k < nNacelle; k++) {
    const p = onBox(rng, [0, hy, -0.1], [0.2, 0.2, 0.52]);
    b.push(p[0], p[1], p[2], 0, 1);
  }

  const nHub = b.quota(0.025);
  for (let k = 0; k < nHub; k++) {
    const d = onSphere(rng);
    b.push(hx + d[0] * 0.085, hy + d[1] * 0.085, hz + Math.abs(d[2]) * 0.13, 1, 0);
  }

  const nBlades = b.quota(0.42);
  const L = 1.38;
  for (let k = 0; k < nBlades; k++) {
    const blade = k % 3;
    const theta = (blade * Math.PI * 2) / 3 + Math.PI / 2;
    const rr = 0.09 + (L - 0.09) * Math.pow(rng(), 0.85);
    const chord = 0.17 * Math.pow(1 - rr / (L + 0.1), 0.7) + 0.025;
    const c = (rng() - 0.5) * chord;
    const dx = Math.cos(theta);
    const dy = Math.sin(theta);
    const x = hx + dx * rr - dy * c;
    const y = hy + dy * rr + dx * c;
    const z = hz + 0.03 + c * 0.35 + (rng() - 0.5) * 0.015;
    b.push(x, y, z, 2, rr / L);
  }

  const nWind = b.quota(0.3);
  const streams = 28;
  const lanes = Array.from({ length: streams }, () => [-1.75 + rng() * 3.9, (rng() - 0.5) * 1.8]);
  for (let k = 0; k < nWind; k++) {
    const [y0, z0] = lanes[k % streams];
    b.push(-2.4 + rng() * 4.8, y0 + (rng() - 0.5) * 0.02, z0, 3, rng());
  }

  const nGround = b.quota(0.04);
  for (let k = 0; k < nGround; k++) {
    const r = 0.8 * Math.sqrt(rng());
    const a = rng() * Math.PI * 2;
    b.push(r * Math.cos(a), -2.08, r * Math.sin(a), 4, r / 0.8);
  }

  return b.finish();
}
