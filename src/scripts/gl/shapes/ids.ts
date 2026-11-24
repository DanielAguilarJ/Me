/** Índice de cada forma dentro de la textura de formas (capa del DataArrayTexture). */
export const Shape = {
  NEBULA: 0,
  TEXT: 1,
  GLOBE: 2,
  TURBINE: 3,
  NETWORK: 4,
  DROP: 5,
  FISH: 6,
  PHONE: 7,
  SPECIMEN: 8,
  TERRAIN: 9,
  TUNNEL: 10,
  GALAXY: 11,
  GEARS: 12,
  BARS: 13,
  // Solo para las imágenes de los productos (shapes/products.ts). Deben quedar al final.
  SOLAR: 14,
  SHAFT: 15,
  WEEKS: 16,
  BRAIN: 17,
  CITYMAP: 18,
} as const;

export type ShapeId = (typeof Shape)[keyof typeof Shape];

/** Constantes geométricas compartidas entre los generadores, el shader y las etiquetas. */
export const GEO = {
  globeRadius: 1.75,
  globeTilt: 0.38,
  hub: [0, 0.78, 0.16] as [number, number, number],
  specimenX: -0.6,
};

export function shaderDefines(): Record<string, string | number> {
  const defs: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(Shape)) defs[`S_${k}`] = v;
  defs.GLOBE_TILT = GEO.globeTilt.toFixed(4);
  defs.HUB = `vec3(${GEO.hub.map((n) => n.toFixed(4)).join(',')})`;
  defs.SPEC_X = GEO.specimenX.toFixed(4);
  return defs;
}
