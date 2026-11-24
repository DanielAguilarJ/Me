import { LAND_MASK_B64, LAND_STEP } from '../data/land-mask';
import { GEO } from './ids';
import { ShapeBuilder, latLonToVec3, normalize, onSphere, slerp, type Vec3 } from './util';

export const CITIES = {
  ags: { lat: 21.8853, lon: -102.2916 },
  chemnitz: { lat: 50.8278, lon: 12.9214 },
  novehrady: { lat: 48.7898, lon: 14.7783 },
  ostrava: { lat: 49.8209, lon: 18.2625 },
} as const;
export type CityId = keyof typeof CITIES;

/** Debe coincidir con scripts/build-globe-data.mjs */
function forEachGridPoint(step: number, cb: (lat: number, lon: number, i: number) => void) {
  const rows = Math.round(180 / step);
  let i = 0;
  for (let r = 0; r < rows; r++) {
    const lat = -90 + (r + 0.5) * step;
    const n = Math.max(1, Math.round((360 / step) * Math.cos((lat * Math.PI) / 180)));
    for (let c = 0; c < n; c++) {
      const lon = -180 + ((c + 0.5) * 360) / n;
      cb(lat, lon, i++);
    }
  }
}

let cachedGrid: { land: Float32Array; ocean: Float32Array } | null = null;

function grid() {
  if (cachedGrid) return cachedGrid;
  const bin = atob(LAND_MASK_B64);
  const mask = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) mask[i] = bin.charCodeAt(i);
  const land: number[] = [];
  const ocean: number[] = [];
  forEachGridPoint(LAND_STEP, (lat, lon, i) => {
    const isLand = (mask[i >> 3] >> (i & 7)) & 1;
    (isLand ? land : ocean).push(lat, lon);
  });
  cachedGrid = { land: new Float32Array(land), ocean: new Float32Array(ocean) };
  return cachedGrid;
}

export function cityPosition(id: CityId, r = GEO.globeRadius): Vec3 {
  const c = CITIES[id];
  return latLonToVec3(c.lat, c.lon, r);
}

/**
 * Globo de puntos: tierra (tipo 0), océano (1), halo (2), arcos AGS→Europa (3..5),
 * marcadores (6) y anillos de pulso (7, guardan el centro y el ángulo).
 */
export function globe(b: ShapeBuilder) {
  const { rng } = b;
  const R = GEO.globeRadius;
  const { land, ocean } = grid();
  const landCount = land.length / 2;
  const oceanCount = ocean.length / 2;

  const nLand = b.quota(0.5);
  const order = Array.from({ length: landCount }, (_, i) => i);
  for (let i = landCount - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  for (let k = 0; k < nLand; k++) {
    const idx = order[k % landCount];
    const layer = Math.floor(k / landCount);
    const p = latLonToVec3(land[idx * 2], land[idx * 2 + 1], R * (1 + layer * 0.014));
    b.push(p[0], p[1], p[2], 0, rng());
  }

  const nOcean = b.quota(0.2);
  for (let k = 0; k < nOcean; k++) {
    const idx = Math.floor(rng() * oceanCount);
    const p = latLonToVec3(ocean[idx * 2], ocean[idx * 2 + 1], R * 0.996);
    b.push(p[0], p[1], p[2], 1, rng());
  }

  const nHalo = b.quota(0.08);
  for (let k = 0; k < nHalo; k++) {
    const d = onSphere(rng);
    const h = Math.pow(rng(), 2.2);
    const r = R * (1.03 + 0.38 * h);
    b.push(d[0] * r, d[1] * r, d[2] * r, 2, h);
  }

  const arcs: [CityId, CityId, number][] = [
    ['ags', 'chemnitz', 0.42],
    ['ags', 'novehrady', 0.34],
    ['ags', 'ostrava', 0.52],
  ];
  const nArcs = b.quota(0.15);
  arcs.forEach(([from, to, lift], ai) => {
    const a = normalize(cityPosition(from, 1));
    const c = normalize(cityPosition(to, 1));
    const per = Math.floor(nArcs / arcs.length);
    for (let k = 0; k < per; k++) {
      const t = rng();
      const d = slerp(a, c, t);
      const r = R * (1.005 + lift * Math.sin(Math.PI * t));
      const j = 0.006;
      b.push(
        d[0] * r + (rng() - 0.5) * j,
        d[1] * r + (rng() - 0.5) * j,
        d[2] * r + (rng() - 0.5) * j,
        3 + ai,
        t,
      );
    }
  });

  const cityIds = Object.keys(CITIES) as CityId[];
  const nMarkers = b.quota(0.05);
  const perCity = Math.floor(nMarkers / cityIds.length);
  for (const id of cityIds) {
    const center = cityPosition(id, R * 1.01);
    const core = Math.floor(perCity * 0.4);
    for (let k = 0; k < core; k++) {
      const d = onSphere(rng);
      const r = 0.028 * Math.cbrt(rng());
      b.push(center[0] + d[0] * r, center[1] + d[1] * r, center[2] + d[2] * r, 6, rng());
    }
    for (let k = core; k < perCity; k++) {
      b.push(center[0], center[1], center[2], 7, rng());
    }
  }

  return b.finish();
}
