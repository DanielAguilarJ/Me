import { GEO } from './ids';
import { ShapeBuilder, clamp, fillSegments, onBox, smoothstep, type Vec3 } from './util';

const CX = GEO.specimenX;
const HALF_LEN = 1.8;
const T = 0.08;

export const PLOT = { x0: 0.85, y0: -1.25, w: 1.6, h: 2.1 };

/** Semiancho de la probeta tipo "hueso de perro" en función de y. */
function halfWidth(y: number) {
  return 0.19 + (0.4 - 0.19) * smoothstep(0.7, 1.15, Math.abs(y));
}

/** Curva esfuerzo-deformación ilustrativa (ε y σ normalizados a 0..1). */
export function stressStrain(e: number) {
  if (e < 0.12) return (e / 0.12) * 0.62;
  const hard = 0.62 + 0.34 * (1 - Math.exp(-(e - 0.12) * 4.5));
  return hard - 1.4 * Math.pow(Math.max(0, e - 0.78), 2);
}

/**
 * Ensayo de tracción (TU Chemnitz): probeta con mapa de esfuerzos (0, param = σ),
 * mordazas y cabezales (1), columnas (2), curva σ-ε (3, param = ε) y ejes (4).
 */
export function specimen(b: ShapeBuilder) {
  const { rng } = b;

  const nSpec = b.quota(0.4);
  let made = 0;
  while (made < nSpec) {
    const y = (rng() * 2 - 1) * HALF_LEN;
    const hw = halfWidth(y);
    const pick = rng();
    let x: number;
    let z: number;
    if (pick < 0.7) {
      if (rng() > hw / 0.4) continue;
      x = (rng() * 2 - 1) * hw;
      z = rng() < 0.5 ? T : -T;
    } else if (pick < 0.95) {
      x = rng() < 0.5 ? hw : -hw;
      z = (rng() * 2 - 1) * T;
    } else {
      x = (rng() * 2 - 1) * hw;
      z = (rng() * 2 - 1) * T;
    }
    let s = 0.19 / hw;
    s *= 1 + 0.15 * Math.exp(-y * y * 8);
    b.push(CX + x, y, z, 0, clamp((s - 0.45) / 0.75, 0, 0.999));
    made++;
  }

  const nJaws = b.quota(0.14);
  for (let k = 0; k < nJaws; k++) {
    const top = k % 2 === 0 ? 1 : -1;
    const isBeam = rng() < 0.35;
    const p = isBeam
      ? onBox(rng, [CX, top * 2.0, 0], [2.15, 0.16, 0.3])
      : onBox(rng, [CX, top * 1.58, 0], [1.1, 0.5, 0.42]);
    b.push(p[0], p[1], p[2], 1, 0);
  }

  const nCols = b.quota(0.08);
  for (let k = 0; k < nCols; k++) {
    const side = k % 2 === 0 ? 1 : -1;
    const a = rng() * Math.PI * 2;
    b.push(CX + side * 1.0 + Math.cos(a) * 0.05, -2.3 + rng() * 4.6, Math.sin(a) * 0.05, 2, 0);
  }

  // Curva σ-ε muestreada por longitud de arco.
  const { x0, y0, w, h } = PLOT;
  const steps = 400;
  const pts: Vec3[] = [];
  const cum: number[] = [0];
  for (let i = 0; i <= steps; i++) {
    const e = i / steps;
    pts.push([x0 + e * w, y0 + stressStrain(e) * h, 0]);
    if (i > 0) {
      const a = pts[i - 1];
      const c = pts[i];
      cum.push(cum[i - 1] + Math.hypot(c[0] - a[0], c[1] - a[1]));
    }
  }
  const total = cum[steps];
  const nCurve = b.quota(0.2);
  for (let k = 0; k < nCurve; k++) {
    const d = rng() * total;
    let lo = 0;
    let hi = steps;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] < d) lo = mid;
      else hi = mid;
    }
    const f = (d - cum[lo]) / (cum[hi] - cum[lo] || 1);
    const e = (lo + f) / steps;
    const p = pts[lo];
    const q = pts[hi];
    b.push(
      p[0] + (q[0] - p[0]) * f + (rng() - 0.5) * 0.014,
      p[1] + (q[1] - p[1]) * f + (rng() - 0.5) * 0.014,
      (rng() - 0.5) * 0.02,
      3,
      e,
    );
  }

  const axes: [Vec3, Vec3][] = [
    [[x0, y0, 0], [x0 + w + 0.12, y0, 0]],
    [[x0, y0, 0], [x0, y0 + h + 0.12, 0]],
  ];
  for (let i = 1; i <= 5; i++) {
    axes.push([[x0 + (i / 5) * w, y0 - 0.05, 0], [x0 + (i / 5) * w, y0 + 0.05, 0]]);
    axes.push([[x0 - 0.05, y0 + (i / 5) * h, 0], [x0 + 0.05, y0 + (i / 5) * h, 0]]);
  }
  fillSegments(b, axes, b.remaining, 4, 0, 0.006);

  return b.finish();
}

export const SPECIMEN_ANCHORS = {
  formula: [PLOT.x0 + 0.1, PLOT.y0 + PLOT.h + 0.35, 0] as Vec3,
  strain: [PLOT.x0 + PLOT.w + 0.2, PLOT.y0 - 0.02, 0] as Vec3,
  stress: [PLOT.x0 - 0.02, PLOT.y0 + PLOT.h + 0.2, 0] as Vec3,
};
