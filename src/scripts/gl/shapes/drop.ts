import { ShapeBuilder } from './util';

const DROP_SCALE = 1.25;
const DROP_Y = 0.35;
export const RIPPLE_Y = -1.45;
export const RIPPLE_MAX = 2.6;
export const RIPPLE_SPACING = 0.28;

/** Perfil de gota: radio en función del ángulo polar (punta arriba). */
function dropProfile(theta: number) {
  return Math.sin(theta) * Math.sin(theta / 2);
}

/**
 * Gota de agua (AquaGuard): superficie (0), interior (1), ondas concéntricas (2)
 * y órbita de sensores IoT (3, param = ángulo).
 */
export function drop(b: ShapeBuilder) {
  const { rng } = b;

  const nSurface = b.quota(0.5);
  let made = 0;
  while (made < nSurface) {
    const theta = rng() * Math.PI;
    const rho = dropProfile(theta);
    if (rng() > rho / 0.78) continue;
    const phi = rng() * Math.PI * 2;
    const x = rho * Math.cos(phi) * DROP_SCALE;
    const z = rho * Math.sin(phi) * DROP_SCALE;
    const y = Math.cos(theta) * DROP_SCALE * 1.05 + DROP_Y;
    b.push(x, y, z, 0, (Math.cos(theta) + 1) / 2);
    made++;
  }

  const nInterior = b.quota(0.1);
  made = 0;
  while (made < nInterior) {
    const theta = rng() * Math.PI;
    const rho = dropProfile(theta) * Math.sqrt(rng()) * 0.92;
    const phi = rng() * Math.PI * 2;
    b.push(
      rho * Math.cos(phi) * DROP_SCALE,
      Math.cos(theta) * DROP_SCALE * 1.0 + DROP_Y,
      rho * Math.sin(phi) * DROP_SCALE,
      1,
      rng(),
    );
    made++;
  }

  const nRipples = b.quota(0.35);
  const rings = Math.floor(RIPPLE_MAX / RIPPLE_SPACING);
  const radii = Array.from({ length: rings }, (_, k) => 0.3 + k * RIPPLE_SPACING);
  const totalLen = radii.reduce((s, r) => s + r, 0);
  for (let k = 0; k < nRipples; k++) {
    let pick = rng() * totalLen;
    let i = 0;
    while (i < radii.length - 1 && pick > radii[i]) pick -= radii[i++];
    const r = radii[i] + (rng() - 0.5) * 0.015;
    const a = rng() * Math.PI * 2;
    b.push(Math.cos(a) * r, RIPPLE_Y, Math.sin(a) * r, 2, r / RIPPLE_MAX);
  }

  const nOrbit = b.remaining;
  for (let k = 0; k < nOrbit; k++) {
    b.push(0, 0, 0, 3, rng());
  }

  return b.finish();
}
