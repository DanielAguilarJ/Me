export type Rng = () => number;
export type Vec3 = [number, number, number];

/** PRNG determinista (mulberry32) para que las formas sean siempre iguales. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Acumula puntos (x, y, z, w) en un Float32Array de tamaño fijo.
 * w = tipo + parámetro (0..0.999): el shader lo separa con floor/fract.
 */
export class ShapeBuilder {
  readonly data: Float32Array;
  private n = 0;

  constructor(
    readonly count: number,
    readonly rng: Rng,
  ) {
    this.data = new Float32Array(count * 4);
  }

  get size(): number {
    return this.n;
  }

  get remaining(): number {
    return this.count - this.n;
  }

  quota(fraction: number): number {
    return Math.min(this.remaining, Math.floor(this.count * fraction));
  }

  push(x: number, y: number, z: number, type = 0, param = 0): boolean {
    if (this.n >= this.count) return false;
    const o = this.n * 4;
    this.data[o] = x;
    this.data[o + 1] = y;
    this.data[o + 2] = z;
    this.data[o + 3] = type + clamp(param, 0, 0.999);
    this.n++;
    return true;
  }

  /** Rellena lo que falte duplicando puntos al azar y baraja el resultado. */
  finish(): Float32Array {
    const { data, rng, count } = this;
    const filled = this.n;
    if (filled === 0) return data;
    while (this.n < count) {
      const src = Math.floor(rng() * filled) * 4;
      const dst = this.n * 4;
      data[dst] = data[src] + (rng() - 0.5) * 0.004;
      data[dst + 1] = data[src + 1] + (rng() - 0.5) * 0.004;
      data[dst + 2] = data[src + 2] + (rng() - 0.5) * 0.004;
      data[dst + 3] = data[src + 3];
      this.n++;
    }
    // Barajar para que cualquier prefijo sea una muestra uniforme de la forma.
    for (let i = count - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const a = i * 4;
      const b = j * 4;
      for (let k = 0; k < 4; k++) {
        const tmp = data[a + k];
        data[a + k] = data[b + k];
        data[b + k] = tmp;
      }
    }
    return data;
  }
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

export function gaussian(rng: Rng): number {
  let u = 0;
  while (u === 0) u = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

export function onSphere(rng: Rng): Vec3 {
  const z = rng() * 2 - 1;
  const a = rng() * Math.PI * 2;
  const r = Math.sqrt(1 - z * z);
  return [r * Math.cos(a), r * Math.sin(a), z];
}

export function latLonToVec3(lat: number, lon: number, r: number): Vec3 {
  const la = (lat * Math.PI) / 180;
  const lo = (lon * Math.PI) / 180;
  return [r * Math.cos(la) * Math.sin(lo), r * Math.sin(la), r * Math.cos(la) * Math.cos(lo)];
}

export function normalize(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

/** Interpolación esférica entre dos vectores unitarios. */
export function slerp(a: Vec3, b: Vec3, t: number): Vec3 {
  const dot = clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1, 1);
  const om = Math.acos(dot);
  if (om < 1e-5) return a;
  const s = Math.sin(om);
  const k0 = Math.sin((1 - t) * om) / s;
  const k1 = Math.sin(t * om) / s;
  return [a[0] * k0 + b[0] * k1, a[1] * k0 + b[1] * k1, a[2] * k0 + b[2] * k1];
}

/** Punto aleatorio sobre la superficie de una caja centrada en c con tamaño s. */
export function onBox(rng: Rng, c: Vec3, s: Vec3): Vec3 {
  const [sx, sy, sz] = s;
  const areas = [sy * sz, sy * sz, sx * sz, sx * sz, sx * sy, sx * sy];
  const total = areas.reduce((a, b) => a + b, 0);
  let pick = rng() * total;
  let face = 0;
  while (face < 5 && pick > areas[face]) pick -= areas[face++];
  const u = rng() - 0.5;
  const v = rng() - 0.5;
  let p: Vec3;
  switch (face) {
    case 0: p = [0.5 * sx, u * sy, v * sz]; break;
    case 1: p = [-0.5 * sx, u * sy, v * sz]; break;
    case 2: p = [u * sx, 0.5 * sy, v * sz]; break;
    case 3: p = [u * sx, -0.5 * sy, v * sz]; break;
    case 4: p = [u * sx, v * sy, 0.5 * sz]; break;
    default: p = [u * sx, v * sy, -0.5 * sz];
  }
  return [c[0] + p[0], c[1] + p[1], c[2] + p[2]];
}

/** Punto a lo largo de un segmento con un pequeño grosor aleatorio. */
export function onSegment(rng: Rng, a: Vec3, b: Vec3, t: number, jitter = 0): Vec3 {
  return [
    a[0] + (b[0] - a[0]) * t + (rng() - 0.5) * jitter,
    a[1] + (b[1] - a[1]) * t + (rng() - 0.5) * jitter,
    a[2] + (b[2] - a[2]) * t + (rng() - 0.5) * jitter,
  ];
}

export function bezier3(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, t: number): Vec3 {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return [
    a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
    a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
    a * p0[2] + b * p1[2] + c * p2[2] + d * p3[2],
  ];
}

export function rotateY(p: Vec3, a: number): Vec3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [c * p[0] + s * p[2], p[1], -s * p[0] + c * p[2]];
}

export function rotateX(p: Vec3, a: number): Vec3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [p[0], c * p[1] - s * p[2], s * p[1] + c * p[2]];
}

export function rotateZ(p: Vec3, a: number): Vec3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [c * p[0] - s * p[1], s * p[0] + c * p[1], p[2]];
}

/**
 * Esquinas tipo "detección" (brackets) de una caja 3D o de un rectángulo (dz = 0).
 * Devuelve una lista de segmentos [a, b].
 */
export function bracketSegments(min: Vec3, max: Vec3, frac = 0.2): [Vec3, Vec3][] {
  const segs: [Vec3, Vec3][] = [];
  const size: Vec3 = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  const flat = size[2] === 0;
  const zs = flat ? [min[2]] : [min[2], max[2]];
  for (const x of [min[0], max[0]]) {
    for (const y of [min[1], max[1]]) {
      for (const z of zs) {
        const corner: Vec3 = [x, y, z];
        const dx = x === min[0] ? 1 : -1;
        const dy = y === min[1] ? 1 : -1;
        const dz = z === min[2] ? 1 : -1;
        segs.push([corner, [x + dx * size[0] * frac, y, z]]);
        segs.push([corner, [x, y + dy * size[1] * frac, z]]);
        if (!flat) segs.push([corner, [x, y, z + dz * size[2] * frac]]);
      }
    }
  }
  return segs;
}

/** Reparte `n` puntos sobre una lista de segmentos proporcional a su longitud. */
export function fillSegments(
  b: ShapeBuilder,
  segs: [Vec3, Vec3][],
  n: number,
  type: number,
  param: number | ((t: number, i: number) => number) = 0,
  jitter = 0.004,
) {
  const lens = segs.map(([a, c]) => Math.hypot(c[0] - a[0], c[1] - a[1], c[2] - a[2]));
  const total = lens.reduce((s, l) => s + l, 0) || 1;
  const { rng } = b;
  for (let k = 0; k < n; k++) {
    let pick = rng() * total;
    let i = 0;
    while (i < segs.length - 1 && pick > lens[i]) pick -= lens[i++];
    const t = rng();
    const p = onSegment(rng, segs[i][0], segs[i][1], t, jitter);
    b.push(p[0], p[1], p[2], type, typeof param === 'function' ? param(t, i) : param);
  }
}

/** Ruido de valor 2D con fbm, suficiente para un terreno procedimental. */
export function makeNoise2D(seed: number) {
  const perm = new Uint8Array(512);
  const r = mulberry32(seed);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const val = (x: number, y: number) => perm[(perm[x & 255] + y) & 511] / 255;
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const noise = (x: number, y: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = fade(xf);
    const v = fade(yf);
    const a = lerp(val(xi, yi), val(xi + 1, yi), u);
    const c = lerp(val(xi, yi + 1), val(xi + 1, yi + 1), u);
    return lerp(a, c, v);
  };
  return (x: number, y: number, octaves = 4) => {
    let amp = 0.5;
    let freq = 1;
    let sum = 0;
    let norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += amp * noise(x * freq + o * 17.3, y * freq - o * 9.1);
      norm += amp;
      amp *= 0.5;
      freq *= 2.03;
    }
    return sum / norm;
  };
}
