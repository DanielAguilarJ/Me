import { ShapeBuilder, onSphere, type Vec3 } from './util';

export const NETWORK_LAYERS = [4, 7, 9, 7, 3];
export const NETWORK_X = [-2.2, -1.1, 0, 1.1, 2.2];
const SPACING = 0.44;

/** Posiciones de los nodos (deterministas, sin depender del RNG) para las etiquetas. */
export function networkNodes(): Vec3[][] {
  return NETWORK_LAYERS.map((n, li) =>
    Array.from({ length: n }, (_, j): Vec3 => [
      NETWORK_X[li],
      (j - (n - 1) / 2) * SPACING,
      Math.sin(j * 1.7 + li * 2.3) * 0.25,
    ]),
  );
}

/** Red neuronal: nodos (tipo 0, param = capa) y conexiones (tipo 1, param = posición). */
export function network(b: ShapeBuilder) {
  const { rng } = b;
  const nodes = networkNodes();
  const all = nodes.flat();
  const layerOf = nodes.flatMap((layer, li) => layer.map(() => li / (nodes.length - 1)));

  const nNodes = b.quota(0.36);
  for (let k = 0; k < nNodes; k++) {
    const i = k % all.length;
    const c = all[i];
    const d = onSphere(rng);
    const r = rng() < 0.7 ? 0.08 : 0.08 * Math.cbrt(rng());
    b.push(c[0] + d[0] * r, c[1] + d[1] * r, c[2] + d[2] * r, 0, layerOf[i]);
  }

  const edges: [Vec3, Vec3][] = [];
  for (let li = 0; li < nodes.length - 1; li++) {
    for (const a of nodes[li]) for (const c of nodes[li + 1]) edges.push([a, c]);
  }
  const nEdges = b.remaining;
  for (let k = 0; k < nEdges; k++) {
    const [a, c] = edges[k % edges.length];
    const t = rng();
    b.push(
      a[0] + (c[0] - a[0]) * t + (rng() - 0.5) * 0.008,
      a[1] + (c[1] - a[1]) * t + (rng() - 0.5) * 0.008,
      a[2] + (c[2] - a[2]) * t + (rng() - 0.5) * 0.008,
      1,
      t,
    );
  }

  return b.finish();
}
