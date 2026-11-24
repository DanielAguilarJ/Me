/**
 * Modo captura (?capture=<clave>): renderiza una sola forma sin interfaz para
 * generar imágenes con scripts/render-images.mjs (Open Graph, tarjetas, fallback).
 */
import { HALF_H, type Stage } from './gl/Stage';
import { Shape, type ShapeId } from './gl/shapes/ids';
import type { Story } from './story/Story';
import { nextFrame, wait } from './core/env';

interface CaptureDef {
  shape: ShapeId;
  /** Desplazamiento x como fracción del semiancho visible. */
  fx?: number;
  y?: number;
  scale: number;
  rotX?: number;
  rotY?: number;
  time?: number;
  test?: number;
  glow: number;
}

const DEFS: Record<string, CaptureDef> = {
  og: { shape: Shape.GLOBE, fx: 0.42, y: -0.05, scale: 1.12, glow: 0x1f8fff, time: 4 },
  hero: { shape: Shape.GLOBE, fx: 0.36, y: -0.05, scale: 1.0, glow: 0x1f8fff, time: 4 },
  robotics: { shape: Shape.GEARS, scale: 1.05, y: 0.05, glow: 0xffb54a },
  marketing: { shape: Shape.BARS, scale: 1.15, y: 0.15, glow: 0x48a8ff },
  freelance: { shape: Shape.NETWORK, scale: 0.98, glow: 0x9b8cff, time: 2.4 },
  telus: { shape: Shape.TERRAIN, scale: 0.8, y: -0.1, glow: 0x4ff0d8, time: 3.2 },
  aquaguard: { shape: Shape.DROP, scale: 0.95, rotX: 0.25, glow: 0x4ff0d8, time: 3 },
  fins: { shape: Shape.FISH, scale: 1.02, glow: 0xff6f59, time: 1.4 },
  fishapp: { shape: Shape.PHONE, scale: 0.92, glow: 0x48a8ff, time: 1.1 },
  chemnitz: { shape: Shape.SPECIMEN, scale: 0.95, glow: 0xffb54a, test: 0.78, time: 2 },
};

export async function runCapture(
  key: string,
  stage: Stage | null,
  story: Story | null,
  setTime: (t: number) => void,
) {
  const def = DEFS[key] ?? DEFS.hero;
  const done = () => ((window as unknown as { __captureReady: boolean }).__captureReady = true);
  document.documentElement.dataset.capture = key;
  setTime(def.time ?? 5);
  if (!stage || !story) {
    done();
    return;
  }
  // La historia se congela en la escena 0 y sobrescribimos sus uniforms cada frame.
  story.freeze(0);
  story.update = () => {
    const u = stage.particles.uniforms;
    u.uShapeA.value = def.shape;
    u.uShapeB.value = def.shape;
    u.uMorph.value = 0;
    u.uLayoutA.value.set((def.fx ?? 0) * HALF_H * stage.aspect, def.y ?? 0, 0, def.scale);
    u.uOrientA.value.set(def.rotX ?? 0, def.rotY ?? 0, 1, 0);
    u.uIntroMix.value = 1;
    u.uMouseForce.value = 0;
    u.uScatter.value = 0;
    u.uTest.value = def.test ?? 0;
    u.uGlobeAngle.value = 0.76;
    u.uTunnel.value = 0;
    const bg = stage.backdrop.material.uniforms;
    (bg.uGlow.value as { setHex: (h: number) => void }).setHex(def.glow);
    (bg.uCenter.value as { set: (x: number, y: number) => void }).set(0.5 + (def.fx ?? 0) * 0.5, 0.5);
  };
  for (let i = 0; i < 12; i++) await nextFrame();
  await wait(300);
  done();
}
