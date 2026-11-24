import {
  ShapeBuilder,
  bezier3,
  bracketSegments,
  fillSegments,
  gaussian,
  onBox,
  rotateY,
  type Vec3,
} from './util';

const PHONE_C: Vec3 = [-0.95, 0.05, 0];
const PHONE_W = 1.25;
const PHONE_H = 2.5;
const PHONE_D = 0.12;
const PHONE_R = 0.17;
const PHONE_YAW = 0.35;
const SERVER_C: Vec3 = [1.55, -0.4, -0.1];
const SERVER_YAW = -0.35;

/** Punto sobre el contorno de un rectángulo redondeado (s en [0,1)). */
function roundedRect(w: number, h: number, r: number, s: number): [number, number] {
  const sw = w - 2 * r;
  const sh = h - 2 * r;
  const arc = (Math.PI * r) / 2;
  const total = 2 * sw + 2 * sh + 4 * arc;
  let d = s * total;
  const segs: [number, (t: number) => [number, number]][] = [
    [sw, (t) => [-sw / 2 + t * sw, h / 2]],
    [arc, (t) => { const a = Math.PI / 2 - t * (Math.PI / 2); return [sw / 2 + r * Math.cos(a), sh / 2 + r * Math.sin(a)]; }],
    [sh, (t) => [w / 2, sh / 2 - t * sh]],
    [arc, (t) => { const a = -t * (Math.PI / 2); return [sw / 2 + r * Math.cos(a), -sh / 2 + r * Math.sin(a)]; }],
    [sw, (t) => [sw / 2 - t * sw, -h / 2]],
    [arc, (t) => { const a = -Math.PI / 2 - t * (Math.PI / 2); return [-sw / 2 + r * Math.cos(a), -sh / 2 + r * Math.sin(a)]; }],
    [sh, (t) => [-w / 2, -sh / 2 + t * sh]],
    [arc, (t) => { const a = Math.PI - t * (Math.PI / 2); return [-sw / 2 + r * Math.cos(a), sh / 2 + r * Math.sin(a)]; }],
  ];
  for (const [len, fn] of segs) {
    if (d <= len) return fn(len > 0 ? d / len : 0);
    d -= len;
  }
  return segs[0][1](0);
}

/** Silueta 2D de pez (vista lateral) para la pantalla del teléfono. */
function fishInside(x: number, y: number) {
  // cuerpo: elipse en x ∈ [-0.3, 0.42]
  const bx = (x - 0.06) / 0.36;
  const by = y / 0.17;
  if (bx * bx + by * by <= 1) return true;
  // cola triangular
  if (x < -0.26 && x > -0.46) {
    const t = (-0.26 - x) / 0.2;
    return Math.abs(y) < 0.04 + t * 0.16;
  }
  return false;
}

/**
 * App de identificación de peces: marco del teléfono (0), malla de pantalla (1),
 * pez en pantalla (2), interfaz (3), servidor (4), LEDs (5),
 * flujo de video hacia el servidor (6) y respuesta de vuelta (7).
 */
export function phone(b: ShapeBuilder) {
  const { rng } = b;
  const placePhone = (x: number, y: number, z: number): Vec3 => {
    const p = rotateY([x, y, z], PHONE_YAW);
    return [p[0] + PHONE_C[0], p[1] + PHONE_C[1], p[2] + PHONE_C[2]];
  };
  const placeServer = (p: Vec3): Vec3 => {
    const q = rotateY(p, SERVER_YAW);
    return [q[0] + SERVER_C[0], q[1] + SERVER_C[1], q[2] + SERVER_C[2]];
  };

  const nFrame = b.quota(0.16);
  for (let k = 0; k < nFrame; k++) {
    const pick = rng();
    if (pick < 0.75) {
      const [x, y] = roundedRect(PHONE_W, PHONE_H, PHONE_R, rng());
      const z = pick < 0.4 ? PHONE_D / 2 : pick < 0.6 ? -PHONE_D / 2 : (rng() - 0.5) * PHONE_D;
      const p = placePhone(x, y, z);
      b.push(p[0], p[1], p[2], 0, 0);
    } else {
      const [x, y] = roundedRect(PHONE_W - 0.14, PHONE_H - 0.14, PHONE_R * 0.6, rng());
      const p = placePhone(x, y, PHONE_D / 2 + 0.002);
      b.push(p[0], p[1], p[2], 0, 1);
    }
  }

  const nScreen = b.quota(0.22);
  const sw = PHONE_W - 0.2;
  const sh = PHONE_H - 0.3;
  const cols = Math.max(4, Math.round(Math.sqrt((nScreen * sw) / sh)));
  const rows = Math.max(4, Math.ceil(nScreen / cols));
  for (let r = 0; r < rows && b.size < b.count; r++) {
    for (let c = 0; c < cols; c++) {
      const x = -sw / 2 + ((c + 0.5) / cols) * sw;
      const y = -sh / 2 + ((r + 0.5) / rows) * sh;
      const p = placePhone(x, y, PHONE_D / 2 + 0.004);
      b.push(p[0], p[1], p[2], 1, (y + sh / 2) / sh);
    }
  }

  const nFish = b.quota(0.14);
  let made = 0;
  while (made < nFish) {
    const x = -0.48 + rng() * 0.92;
    const y = -0.22 + rng() * 0.44;
    if (!fishInside(x, y)) continue;
    const p = placePhone(x * 1.15, y * 1.15 + 0.3, PHONE_D / 2 + 0.008);
    b.push(p[0], p[1], p[2], 2, rng());
    made++;
  }

  // Interfaz: barra superior, líneas de "resultado", botón de captura y brackets.
  const ui: [Vec3, Vec3][] = [];
  const line = (x0: number, x1: number, y: number) =>
    ui.push([placePhone(x0, y, PHONE_D / 2 + 0.006), placePhone(x1, y, PHONE_D / 2 + 0.006)]);
  line(-0.18, 0.18, PHONE_H / 2 - 0.12);
  line(-0.4, 0.3, -0.42);
  line(-0.4, 0.1, -0.54);
  line(-0.4, 0.22, -0.66);
  for (let i = 0; i < 24; i++) {
    const a0 = (i / 24) * Math.PI * 2;
    const a1 = ((i + 1) / 24) * Math.PI * 2;
    ui.push([
      placePhone(Math.cos(a0) * 0.12, -0.98 + Math.sin(a0) * 0.12, PHONE_D / 2 + 0.006),
      placePhone(Math.cos(a1) * 0.12, -0.98 + Math.sin(a1) * 0.12, PHONE_D / 2 + 0.006),
    ]);
  }
  for (const [a, c] of bracketSegments([-0.52, 0.02, 0], [0.5, 0.58, 0], 0.22)) {
    ui.push([placePhone(a[0], a[1], PHONE_D / 2 + 0.01), placePhone(c[0], c[1], PHONE_D / 2 + 0.01)]);
  }
  fillSegments(b, ui, b.quota(0.08), 3, 0, 0.006);

  const nServer = b.quota(0.15);
  for (let k = 0; k < nServer; k++) {
    const unit = k % 3;
    const p = onBox(rng, [0, unit * 0.44, 0], [0.95, 0.34, 0.75]);
    const q = placeServer(p);
    b.push(q[0], q[1], q[2], 4, unit / 3);
  }

  const nLeds = b.quota(0.02);
  for (let k = 0; k < nLeds; k++) {
    const unit = k % 3;
    const led = Math.floor(rng() * 4);
    const p: Vec3 = [0.18 + led * 0.06 + (rng() - 0.5) * 0.012, unit * 0.44 + (rng() - 0.5) * 0.012, 0.376];
    const q = placeServer(p);
    b.push(q[0], q[1], q[2], 5, (unit * 4 + led) / 12);
  }

  const up: Vec3[] = [
    placePhone(0.45, PHONE_H / 2 - 0.2, 0.1),
    [0.0, 1.95, 0.45],
    [1.15, 1.7, 0.3],
    placeServer([0, 0.95, 0]),
  ];
  const nUp = b.quota(0.17);
  for (let k = 0; k < nUp; k++) {
    const t = rng();
    const p = bezier3(up[0], up[1], up[2], up[3], t);
    b.push(p[0] + gaussian(rng) * 0.03, p[1] + gaussian(rng) * 0.03, p[2] + gaussian(rng) * 0.03, 6, t);
  }

  const down: Vec3[] = [
    placeServer([-0.5, -0.05, 0.2]),
    [0.75, -1.45, 0.6],
    [0.05, -1.3, 0.5],
    placePhone(0.55, -0.7, 0.08),
  ];
  const nDown = b.remaining;
  for (let k = 0; k < nDown; k++) {
    const t = rng();
    const p = bezier3(down[0], down[1], down[2], down[3], t);
    b.push(p[0] + gaussian(rng) * 0.025, p[1] + gaussian(rng) * 0.025, p[2] + gaussian(rng) * 0.025, 7, t);
  }

  return b.finish();
}

export const PHONE_ANCHORS = {
  upload: [0.35, 1.95, 0.4] as Vec3,
  match: [-0.95 + 0.62, 0.05 + 0.62, 0.2] as Vec3,
};
