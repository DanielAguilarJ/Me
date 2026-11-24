import {
  ShapeBuilder,
  bracketSegments,
  fillSegments,
  onSphere,
  type Rng,
  type Vec3,
} from './util';

/** Desplazamiento para centrar el pez (y su caja) en el origen. */
const SHIFT_X = 0.42;
const SNOUT = 1.45;
const PEDUNCLE = -1.5;
const LEN = SNOUT - PEDUNCLE;

/** Altura relativa del cuerpo (0 en el hocico, ~1 en el punto más alto). */
function bodyH(x: number) {
  const u = Math.min(1, Math.max(0, (SNOUT - x) / LEN));
  const base = (Math.sqrt(u) * Math.pow(1 - u, 0.62)) / 0.463;
  return base * 0.82 + 0.18 * u;
}
const ry = (x: number) => 0.6 * bodyH(x);
const rz = (x: number) => 0.27 * bodyH(x);
const yc = (x: number) => -0.04 * bodyH(x);

export const FISH_BOX = { min: [-2.45 + SHIFT_X, -0.84, -0.42] as Vec3, max: [1.6 + SHIFT_X, 0.98, 0.42] as Vec3 };
export const FIN_BOXES = {
  dorsal: { min: [-0.62 + SHIFT_X, 0.5, 0.43] as Vec3, max: [0.42 + SHIFT_X, 0.98, 0.43] as Vec3 },
  caudal: { min: [-2.42 + SHIFT_X, -0.8, 0.43] as Vec3, max: [-1.4 + SHIFT_X, 0.8, 0.43] as Vec3 },
  pectoral: { min: [0.32 + SHIFT_X, -0.48, 0.43] as Vec3, max: [0.88 + SHIFT_X, -0.04, 0.43] as Vec3 },
};

function finPoint(rng: Rng, base: Vec3, dir: Vec3, perp: Vec3, length: number, width: number): Vec3 {
  const l = Math.sqrt(rng());
  const w = width * Math.sin(Math.PI * Math.pow(l, 0.7)) * (rng() - 0.5);
  return [
    base[0] + dir[0] * l * length + perp[0] * w,
    base[1] + dir[1] * l * length + perp[1] * w,
    base[2] + dir[2] * l * length + perp[2] * w + (rng() - 0.5) * 0.01,
  ];
}

/**
 * Pez con máscaras de segmentación por aleta y cajas de detección:
 * cuerpo (0), dorsal (1), caudal (2), pectorales (3), pélvica/anal (4), ojos (5),
 * caja principal (6), aristas tenues (7), cajas de aletas (8, param = clase).
 */
export function fish(b: ShapeBuilder) {
  const { rng } = b;
  const push = (p: Vec3, type: number, param = 0) => b.push(p[0] + SHIFT_X, p[1], p[2], type, param);

  const nBody = b.quota(0.44);
  let made = 0;
  while (made < nBody) {
    const x = PEDUNCLE + rng() * LEN;
    const h = bodyH(x);
    if (rng() > h) continue;
    const phi = rng() * Math.PI * 2;
    push([x, yc(x) + ry(x) * Math.cos(phi), rz(x) * Math.sin(phi)], 0, rng());
    made++;
  }

  const nDorsal = b.quota(0.1);
  made = 0;
  while (made < nDorsal) {
    const s = rng();
    const finH = 0.52 * Math.pow(s, 0.7) * (1 - Math.pow(s, 8));
    if (rng() > finH / 0.39) continue;
    const x = -0.55 + s * 0.93;
    const top = yc(x) + ry(x);
    push([x, top - 0.02 + rng() * finH, (rng() - 0.5) * 0.02], 1, s);
    made++;
  }

  const nCaudal = b.quota(0.16);
  made = 0;
  while (made < nCaudal) {
    const v = rng();
    const y = (rng() * 2 - 1) * 0.76;
    const hh = 0.13 + 0.62 * Math.pow(v, 0.9);
    const fork = v > 0.5 ? ((v - 0.5) / 0.5) * 0.42 : 0;
    const ay = Math.abs(y);
    if (ay > hh || ay < fork) continue;
    push([PEDUNCLE + 0.05 - v * 0.9, y, (rng() - 0.5) * 0.02], 2, v);
    made++;
  }

  const nPect = b.quota(0.06);
  for (let k = 0; k < nPect; k++) {
    const side = k % 2 === 0 ? 1 : -1;
    const x0 = 0.78;
    const base: Vec3 = [x0, yc(x0) - 0.12, side * (rz(x0) + 0.01)];
    push(finPoint(rng, base, [-0.86, -0.42, side * 0.28], [-0.42, 0.86, 0], 0.52, 0.26), 3, rng());
  }

  const nLower = b.quota(0.07);
  for (let k = 0; k < nLower; k++) {
    const anal = k % 2 === 0;
    const x0 = anal ? -0.62 : 0.32;
    const base: Vec3 = [x0, yc(x0) - ry(x0) + 0.02, 0];
    push(finPoint(rng, base, [-0.75, -0.66, 0], [0.66, -0.75, 0], anal ? 0.32 : 0.26, anal ? 0.3 : 0.18), 4, rng());
  }

  const nEyes = b.quota(0.02);
  for (let k = 0; k < nEyes; k++) {
    const side = k % 2 === 0 ? 1 : -1;
    const x0 = 1.08;
    const d = onSphere(rng);
    const r = 0.055 * Math.cbrt(rng());
    push([x0 + d[0] * r, 0.13 + d[1] * r, side * (rz(x0) - 0.005) + d[2] * r * 0.5], 5, 0);
  }

  // Cajas de detección (ya en coordenadas centradas, sin SHIFT adicional).
  const nBox = b.quota(0.08);
  fillSegments(b, bracketSegments(FISH_BOX.min, FISH_BOX.max, 0.2), nBox, 6, 0, 0.004);

  const nEdges = b.quota(0.03);
  fillSegments(b, bracketSegments(FISH_BOX.min, FISH_BOX.max, 1), nEdges, 7, 0, 0.003);

  const finBoxes: [keyof typeof FIN_BOXES, number][] = [
    ['dorsal', 0.0],
    ['caudal', 0.4],
    ['pectoral', 0.8],
  ];
  const nFinBoxes = b.remaining;
  const perFin = Math.floor(nFinBoxes / finBoxes.length);
  for (const [key, cls] of finBoxes) {
    const box = FIN_BOXES[key];
    fillSegments(b, bracketSegments(box.min, box.max, 0.25), perFin, 8, cls, 0.003);
  }

  return b.finish();
}
