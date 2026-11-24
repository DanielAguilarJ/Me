import { Shape, type ShapeId } from '../gl/shapes/ids';
import { HALF_H } from '../gl/Stage';
import type { SceneId } from '../../data/content';

export interface Layout {
  offset: [number, number, number];
  scale: number;
  rotX: number;
  rotY: number;
  dim: number;
}

interface Placement {
  /** Desplazamiento en x como fracción del semiancho visible. */
  fx: number;
  y: number;
  z: number;
  scale: number;
  dim: number;
}

export interface SceneConfig {
  shape: ShapeId;
  glow: number;
  /** Radio aproximado de la forma, para que quepa en pantalla. */
  radius: number;
  rotX?: number;
  rotY?: number;
  /** Si es false, la forma puede salirse de la pantalla (p. ej. el planeta final). */
  fit?: boolean;
  desktop: Placement;
  portrait: Partial<Placement>;
}

const P = (fx: number, y: number, z: number, scale: number, dim = 1): Placement => ({ fx, y, z, scale, dim });

export const SCENES: Record<SceneId, SceneConfig> = {
  hero: { shape: Shape.GLOBE, glow: 0x1f8fff, radius: 2.0, desktop: P(0.36, -0.05, 0, 1.0), portrait: { fx: 0, y: 1.5, scale: 0.52, dim: 0.85 } },
  about: { shape: Shape.TURBINE, glow: 0xffb54a, radius: 2.1, desktop: P(0.48, -0.05, 0, 1.0), portrait: { fx: 0.18, y: 0.2, z: -0.8, scale: 0.75, dim: 0.42 } },
  services: { shape: Shape.NETWORK, glow: 0x9b8cff, radius: 2.4, desktop: P(0, 0.2, -0.9, 1.15, 0.55), portrait: { y: 0, z: -1.2, scale: 0.6, dim: 0.38 } },
  aquaguard: { shape: Shape.DROP, glow: 0x4ff0d8, radius: 1.9, rotX: 0.25, desktop: P(0.46, 0.05, 0, 0.95), portrait: { fx: 0, y: 1.05, z: -0.8, scale: 0.6, dim: 0.5 } },
  fins: { shape: Shape.FISH, glow: 0xff6f59, radius: 2.15, desktop: P(0.46, 0.1, 0, 0.9), portrait: { fx: 0, y: 1.1, z: -0.8, scale: 0.55, dim: 0.5 } },
  fishapp: { shape: Shape.PHONE, glow: 0x48a8ff, radius: 2.4, desktop: P(0.45, 0, 0, 0.92), portrait: { fx: 0, y: 1.0, z: -0.8, scale: 0.55, dim: 0.5 } },
  materials: { shape: Shape.SPECIMEN, glow: 0xffb54a, radius: 2.1, desktop: P(0.44, -0.05, 0, 0.92), portrait: { fx: 0, y: 0.9, z: -0.8, scale: 0.55, dim: 0.5 } },
  geospatial: { shape: Shape.TERRAIN, glow: 0x4ff0d8, radius: 2.8, desktop: P(0.42, -0.1, 0, 0.85), portrait: { fx: 0, y: 1.0, z: -0.8, scale: 0.5, dim: 0.5 } },
  journey: { shape: Shape.TUNNEL, glow: 0x9b8cff, radius: 99, fit: false, desktop: P(0, 0, 0, 1), portrait: { dim: 0.75 } },
  skills: { shape: Shape.GALAXY, glow: 0x9b8cff, radius: 3.6, fit: false, desktop: P(0, 0, -1.4, 1.1, 0.75), portrait: { scale: 0.85, dim: 0.6 } },
  contact: { shape: Shape.GLOBE, glow: 0x1f8fff, radius: 3.0, fit: false, desktop: P(0, -3.05, 0, 1.65), portrait: { y: -2.2, scale: 1.05 } },
};

/** Móviles y tabletas en vertical: la forma va arriba y el texto debajo. */
export const isPortrait = (aspect: number) => aspect < 0.95;

export function resolveLayout(cfg: SceneConfig, aspect: number): Layout {
  const halfW = HALF_H * aspect;
  const portrait = isPortrait(aspect);
  const p: Placement = portrait ? { ...cfg.desktop, ...cfg.portrait } : { ...cfg.desktop };
  let scale = p.scale;
  if (cfg.fit !== false) {
    const room = portrait ? halfW * 0.98 : halfW * (1 - p.fx) * 1.06;
    if (cfg.radius * scale > room) scale = Math.max(p.scale * (portrait ? 0.45 : 0.7), room / cfg.radius);
  }
  // En pantallas medianas acercamos la forma al centro para no cortar el texto.
  const fx = portrait ? p.fx : p.fx * (aspect < 1.4 ? 0.92 : 1);
  return {
    offset: [halfW * fx, p.y, p.z],
    scale,
    rotX: cfg.rotX ?? 0,
    rotY: cfg.rotY ?? 0,
    dim: p.dim,
  };
}
