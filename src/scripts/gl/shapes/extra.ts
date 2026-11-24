/**
 * Formas que solo se usan para generar imágenes (modo captura):
 * engranes (robótica) y gráfica de barras (marketing / Big Data).
 */
import { ShapeBuilder, fillSegments, onBox, onSphere, rotateX, rotateY, type Rng, type Vec3 } from './util';

function gearRadius(theta: number, R: number, teeth: number) {
  const f = ((theta / (Math.PI * 2)) * teeth) % 1;
  const tooth = f < 0.5 ? 1 : 0;
  const soft = Math.min(1, Math.min(Math.abs(f - 0.0), Math.abs(f - 0.5), Math.abs(f - 1)) * 12);
  return R + 0.12 * (tooth * soft + (1 - soft) * 0.5);
}

/** Engranes: tres engranes acoplados (tipo = engrane). */
export function gears(b: ShapeBuilder) {
  const { rng } = b;
  const list: { c: Vec3; R: number; teeth: number; type: number; share: number }[] = [
    { c: [-0.55, 0.3, 0], R: 1.0, teeth: 16, type: 0, share: 0.5 },
    { c: [0.9, -0.54, 0.0], R: 0.62, teeth: 10, type: 1, share: 0.3 },
    { c: [0.53, 1.3, 0.0], R: 0.4, teeth: 7, type: 2, share: 0.2 },
  ];
  for (const g of list) {
    const n = b.quota(g.share);
    for (let k = 0; k < n; k++) {
      const theta = rng() * Math.PI * 2;
      const outer = gearRadius(theta, g.R, g.teeth);
      const pick = rng();
      let r: number;
      let z: number;
      if (pick < 0.3) {
        r = outer;
        z = (rng() - 0.5) * 0.24;
      } else if (pick < 0.75) {
        r = g.R * 0.62 + (outer - g.R * 0.62) * Math.sqrt(rng());
        z = rng() < 0.5 ? 0.12 : -0.12;
      } else if (pick < 0.88) {
        r = g.R * 0.22 * Math.sqrt(rng());
        z = rng() < 0.5 ? 0.12 : -0.12;
      } else {
        const spoke = Math.floor(rng() * 5);
        const a = (spoke / 5) * Math.PI * 2 + (rng() - 0.5) * 0.12;
        r = g.R * (0.22 + rng() * 0.4);
        const p = rotateX(rotateY([g.c[0] + Math.cos(a) * r, g.c[1] + Math.sin(a) * r, (rng() - 0.5) * 0.2], -0.35), 0.2);
        b.push(p[0], p[1], p[2], g.type, 0);
        continue;
      }
      const p = rotateX(rotateY([g.c[0] + Math.cos(theta) * r, g.c[1] + Math.sin(theta) * r, z], -0.35), 0.2);
      b.push(p[0], p[1], p[2], g.type, 0);
    }
  }
  return b.finish();
}

/** Punto sobre una de las 12 aristas de una caja (las aristas largas reciben más puntos). */
function onBoxEdge(rng: Rng, c: Vec3, s: Vec3): Vec3 {
  const pick = rng() * (s[0] + s[1] + s[2]);
  const axis = pick < s[0] ? 0 : pick < s[0] + s[1] ? 1 : 2;
  const p: Vec3 = [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    p[k] = k === axis ? (rng() - 0.5) * s[k] : (rng() < 0.5 ? -0.5 : 0.5) * s[k];
  }
  return [c[0] + p[0], c[1] + p[1], c[2] + p[2]];
}

/**
 * Gráfica de barras 3D en dos filas, con línea de tendencia que crece sobre la
 * fila frontal (0 barras, 1 tendencia, 2 rejilla de la base).
 */
export function bars(b: ShapeBuilder) {
  const { rng } = b;
  const gap = 0.62;
  const width = 0.36;
  const floor = -1.05;
  const rows = [
    [0.55, 0.82, 0.7, 1.12, 1.42, 1.86],
    [0.38, 0.58, 0.74, 0.66, 0.98, 1.24],
  ];
  const maxH = 1.86;
  const cols = rows[0].length;
  const x0 = -((cols - 1) * gap) / 2;
  const place = (p: Vec3): Vec3 => rotateX(rotateY(p, -0.42), 0.3);

  const boxes = rows.flatMap((hs, r) => hs.map((h, c) => ({ h, x: x0 + c * gap, z: (0.5 - r) * gap * 1.05 })));
  // Puntos proporcionales a la superficie de cada barra.
  const weights = boxes.map((bx) => 4 * bx.h * width + 2 * width * width);
  const totalW = weights.reduce((a, w) => a + w, 0);
  const nBars = b.quota(0.66);
  for (let k = 0; k < nBars; k++) {
    let pick = rng() * totalW;
    let i = 0;
    while (i < boxes.length - 1 && pick > weights[i]) pick -= weights[i++];
    const bx = boxes[i];
    const c: Vec3 = [bx.x, floor + bx.h / 2, bx.z];
    const s: Vec3 = [width, bx.h, width];
    // Un 35 % en las aristas para que cada barra se lea con nitidez.
    const p = rng() < 0.35 ? onBoxEdge(rng, c, s) : onBox(rng, c, s);
    const q = place(p);
    b.push(q[0], q[1], q[2], 0, (p[1] - floor) / maxH);
  }

  // Tendencia: polilínea sobre la fila frontal, nodos en cada vértice y punta de flecha.
  const zFront = boxes[0].z;
  const pts: Vec3[] = rows[0].map((h, c) => place([x0 + c * gap, floor + h + 0.32, zFront]));
  const segs: [Vec3, Vec3][] = [];
  for (let i = 0; i < pts.length - 1; i++) segs.push([pts[i], pts[i + 1]]);
  const tip = pts[pts.length - 1];
  const prev = pts[pts.length - 2];
  const dir = [tip[0] - prev[0], tip[1] - prev[1]];
  const len = Math.hypot(dir[0], dir[1]) || 1;
  for (const turn of [2.55, -2.55]) {
    const cs = Math.cos(turn);
    const sn = Math.sin(turn);
    const dx = ((dir[0] * cs - dir[1] * sn) / len) * 0.2;
    const dy = ((dir[0] * sn + dir[1] * cs) / len) * 0.2;
    segs.push([tip, [tip[0] + dx, tip[1] + dy, tip[2]]]);
  }
  const nTrend = b.quota(0.1);
  fillSegments(b, segs, nTrend, 1, (t) => t, 0.012);
  const nNodes = b.quota(0.03);
  for (let k = 0; k < nNodes; k++) {
    const p = pts[k % pts.length];
    const d = onSphere(rng);
    const r = 0.05 * Math.cbrt(rng());
    b.push(p[0] + d[0] * r, p[1] + d[1] * r, p[2] + d[2] * r, 1, 1);
  }

  // Base: rejilla punteada sobre el piso.
  const grid: [Vec3, Vec3][] = [];
  const hx = 2.1;
  const hz = 1.0;
  for (let x = -hx; x <= hx + 1e-6; x += gap / 2) grid.push([place([x, floor, -hz]), place([x, floor, hz])]);
  for (let z = -hz; z <= hz + 1e-6; z += gap / 2) grid.push([place([-hx, floor, z]), place([hx, floor, z])]);
  fillSegments(b, grid, b.remaining, 2, 0, 0.006);
  return b.finish();
}
