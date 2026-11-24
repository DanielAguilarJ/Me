import { ShapeBuilder, makeNoise2D, onBox, rotateX, smoothstep, type Vec3 } from './util';

const TILT = 0.55;
const W = 5.4;
const D = 3.8;
export const SAT_BASE: Vec3 = [0, 1.75, -0.3];

const noise = makeNoise2D(1337);

function heightAt(x: number, z: number) {
  let h = noise(x * 0.55 + 3.1, z * 0.55 - 1.7, 5);
  const river = 0.6 * Math.sin(x * 0.8 + 0.4);
  const valley = smoothstep(0.0, 0.55, Math.abs(z - river));
  h = h * (0.35 + 0.65 * valley);
  return h;
}

const tilt = (p: Vec3) => rotateX(p, TILT);

/**
 * Terreno geoespacial: malla topográfica (0, param = altura), postes POI (1),
 * cabezas POI (2), anillos base (3), satélite (4) y cono de escaneo (5).
 * El terreno se inclina hacia la cámara; el shader mueve el satélite en x.
 */
export function terrain(b: ShapeBuilder) {
  const { rng } = b;

  const nGrid = b.quota(0.7);
  const cols = Math.max(8, Math.round(Math.sqrt((nGrid * W) / D)));
  const rows = Math.max(8, Math.floor(nGrid / cols));
  let hmin = Infinity;
  let hmax = -Infinity;
  const hs = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = -W / 2 + ((c + 0.5) / cols) * W;
      const z = -D / 2 + ((r + 0.5) / rows) * D;
      const h = heightAt(x, z);
      hs[r * cols + c] = h;
      hmin = Math.min(hmin, h);
      hmax = Math.max(hmax, h);
    }
  }
  const norm = (h: number) => (h - hmin) / (hmax - hmin || 1);
  const yOf = (h: number) => (norm(h) - 0.3) * 0.95;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = -W / 2 + ((c + 0.5) / cols) * W;
      const z = -D / 2 + ((r + 0.5) / rows) * D;
      const h = hs[r * cols + c];
      const p = tilt([x, yOf(h), z]);
      b.push(p[0], p[1], p[2], 0, norm(h));
    }
  }

  const pins: Vec3[] = [];
  let guard = 0;
  while (pins.length < 14 && guard++ < 500) {
    const x = (rng() - 0.5) * W * 0.85;
    const z = (rng() - 0.5) * D * 0.8;
    const h = heightAt(x, z);
    if (norm(h) < 0.25) continue;
    if (pins.some((p) => Math.hypot(p[0] - x, p[2] - z) < 0.6)) continue;
    pins.push([x, yOf(h), z]);
  }
  const pinLen = pins.map(() => 0.4 + rng() * 0.35);
  pinTops = pins.map((p, i) => tilt([p[0], p[1] + pinLen[i] + 0.08, p[2]]));

  const nSticks = b.quota(0.09);
  for (let k = 0; k < nSticks; k++) {
    const i = k % pins.length;
    const t = rng();
    const base = pins[i];
    const p = tilt([base[0] + (rng() - 0.5) * 0.008, base[1] + t * pinLen[i], base[2] + (rng() - 0.5) * 0.008]);
    b.push(p[0], p[1], p[2], 1, t);
  }

  const nHeads = b.quota(0.05);
  for (let k = 0; k < nHeads; k++) {
    const i = k % pins.length;
    const base = pins[i];
    const u = rng() * 2 - 1;
    const a = rng() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const r = 0.05 * Math.cbrt(rng());
    const p = tilt([base[0] + s * Math.cos(a) * r, base[1] + pinLen[i] + u * r, base[2] + s * Math.sin(a) * r]);
    b.push(p[0], p[1], p[2], 2, i / pins.length);
  }

  const nRings = b.quota(0.04);
  for (let k = 0; k < nRings; k++) {
    const i = k % pins.length;
    const base = pins[i];
    const a = rng() * Math.PI * 2;
    const p = tilt([base[0] + Math.cos(a) * 0.1, base[1] + 0.01, base[2] + Math.sin(a) * 0.1]);
    b.push(p[0], p[1], p[2], 3, i / pins.length);
  }

  const nSat = b.quota(0.035);
  for (let k = 0; k < nSat; k++) {
    const part = rng();
    let p: Vec3;
    if (part < 0.4) p = onBox(rng, SAT_BASE, [0.14, 0.1, 0.1]);
    else {
      const side = part < 0.7 ? 1 : -1;
      p = onBox(rng, [SAT_BASE[0] + side * 0.27, SAT_BASE[1], SAT_BASE[2]], [0.34, 0.012, 0.13]);
    }
    const q = tilt(p);
    b.push(q[0], q[1], q[2], 4, 0);
  }

  const nCone = b.remaining;
  for (let k = 0; k < nCone; k++) {
    const t = Math.sqrt(rng());
    const a = rng() * Math.PI * 2;
    const r = t * 0.5;
    const p = tilt([
      SAT_BASE[0] + Math.cos(a) * r,
      SAT_BASE[1] - t * (SAT_BASE[1] - 0.05),
      SAT_BASE[2] + Math.sin(a) * r,
    ]);
    b.push(p[0], p[1], p[2], 5, t);
  }

  return b.finish();
}

let pinTops: Vec3[] = [];

export function terrainAnchors() {
  // Etiqueta POI en el poste más cercano a la esquina superior derecha.
  let poi: Vec3 = tilt([1.4, 0.8, -0.4]);
  let best = -Infinity;
  for (const p of pinTops) {
    const score = p[0] + p[1] * 0.6;
    if (score > best) {
      best = score;
      poi = p;
    }
  }
  return {
    satellite: tilt([SAT_BASE[0] + 0.45, SAT_BASE[1] + 0.12, SAT_BASE[2]]),
    poi,
  };
}
