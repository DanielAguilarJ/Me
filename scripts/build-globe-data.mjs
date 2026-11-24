/**
 * Genera la máscara de tierra firme para el globo de partículas.
 *
 * Recorre una malla de puntos lat/lon (filas de latitud con un número de
 * puntos proporcional a cos(lat)) y marca con 1 bit los que caen sobre tierra
 * según Natural Earth (world-atlas). El resultado se guarda como base64 en
 * src/scripts/gl/data/land-mask.ts. La malla debe coincidir exactamente con
 * `forEachGridPoint` de src/scripts/gl/shapes/globe.ts.
 *
 * Uso: npm run gen:globe
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { geoContains } from 'd3-geo';
import { feature } from 'topojson-client';

const STEP = 0.8; // grados entre filas y entre puntos en el ecuador
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'src/scripts/gl/data/land-mask.ts');

const topo = JSON.parse(
  await readFile(resolve(ROOT, 'node_modules/world-atlas/land-50m.json'), 'utf8'),
);
const land = feature(topo, topo.objects.land);

function forEachGridPoint(step, cb) {
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
  return i;
}

const total = forEachGridPoint(STEP, () => {});
const bytes = new Uint8Array(Math.ceil(total / 8));
let landCount = 0;
const t0 = performance.now();

forEachGridPoint(STEP, (lat, lon, i) => {
  if (geoContains(land, [lon, lat])) {
    bytes[i >> 3] |= 1 << (i & 7);
    landCount++;
  }
});

const b64 = Buffer.from(bytes).toString('base64');
await mkdir(dirname(OUT), { recursive: true });
await writeFile(
  OUT,
  `// Archivo generado por scripts/build-globe-data.mjs — no editar a mano.\n` +
    `// Fuente: Natural Earth 1:50m (world-atlas). ${landCount} de ${total} puntos son tierra.\n` +
    `export const LAND_STEP = ${STEP};\n` +
    `export const LAND_TOTAL = ${total};\n` +
    `export const LAND_COUNT = ${landCount};\n` +
    `export const LAND_MASK_B64 =\n  '${b64}';\n`,
);

console.log(
  `Máscara generada: ${landCount}/${total} puntos de tierra, ${bytes.length} bytes, ` +
    `${Math.round(performance.now() - t0)} ms → ${OUT}`,
);
