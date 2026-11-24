import * as THREE from 'three';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { SceneId } from '../../data/content';
import type { Stage } from '../gl/Stage';
import { Labels } from './labels';
import { SCENES, resolveLayout, type Layout } from './scenes';

const damp = (a: number, b: number, lambda: number, dt: number) => a + (b - a) * (1 - Math.exp(-lambda * dt));

/**
 * Traduce el scroll en el estado del sistema de partículas:
 * cada sección con data-scene aporta una transición (0..1) y la suma de todas
 * da un índice continuo de escena (p. ej. 3.4 = 40 % entre la escena 3 y la 4).
 */
export class Story {
  readonly ids: SceneId[];
  readonly sections: HTMLElement[];
  layouts: Layout[] = [];
  current = 0;
  chapter = -1;
  test = 0;
  onChapter: ((index: number, id: SceneId) => void) | null = null;

  private progress: number[];
  private testTarget = 0;
  private tunnel = 0;
  private scatter = 0;
  private triggers: ScrollTrigger[] = [];
  private labels: Labels;
  private glowA = new THREE.Color();
  private glowB = new THREE.Color();
  private center = new THREE.Vector3();
  private projected = new THREE.Vector3();
  private frozen: number | null = null;

  constructor(
    private stage: Stage,
    labelsRoot: HTMLElement | null,
  ) {
    this.sections = Array.from(document.querySelectorAll<HTMLElement>('[data-scene]'));
    this.ids = this.sections.map((s) => s.dataset.scene as SceneId).filter((id) => id in SCENES);
    this.progress = this.ids.map(() => 0);
    this.labels = new Labels(labelsRoot, stage);

    this.sections.forEach((section, i) => {
      if (i === 0) return;
      this.triggers.push(
        ScrollTrigger.create({
          trigger: section,
          start: 'top 85%',
          end: 'top 15%',
          onUpdate: (self) => (this.progress[i] = self.progress),
          onRefresh: (self) => (this.progress[i] = self.progress),
        }),
      );
    });

    const materials = document.querySelector<HTMLElement>('[data-scene="materials"]');
    if (materials) {
      this.triggers.push(
        ScrollTrigger.create({
          trigger: materials,
          start: 'top 45%',
          end: 'bottom 55%',
          onUpdate: (self) => (this.testTarget = self.progress),
          onRefresh: (self) => (this.testTarget = self.progress),
        }),
      );
    }
    this.resize();
  }

  resize() {
    const aspect = this.stage.aspect;
    this.layouts = this.ids.map((id) => resolveLayout(SCENES[id], aspect));
    this.labels.resize();
  }

  /** Fija una escena concreta (modo captura de imágenes). */
  freeze(index: number) {
    this.frozen = index;
    this.current = index;
  }

  get target() {
    if (this.frozen !== null) return this.frozen;
    let sum = 0;
    for (const p of this.progress) sum += p || 0;
    return sum;
  }

  update(dt: number, time: number, velocity: number, motion: number) {
    const u = this.stage.particles.uniforms;
    const last = this.ids.length - 1;
    const target = this.target;
    this.current = damp(this.current, target, 6.5, dt);
    if (Math.abs(this.current - target) < 0.0004) this.current = target;

    const s = Math.min(last, Math.max(0, this.current));
    const iA = Math.floor(s);
    const iB = Math.min(iA + 1, last);
    const t = iB === iA ? 0 : s - iA;

    const A = this.layouts[iA];
    const B = this.layouts[iB];
    u.uShapeA.value = SCENES[this.ids[iA]].shape;
    u.uShapeB.value = SCENES[this.ids[iB]].shape;
    u.uMorph.value = t;
    u.uLayoutA.value.set(A.offset[0], A.offset[1], A.offset[2], A.scale);
    u.uLayoutB.value.set(B.offset[0], B.offset[1], B.offset[2], B.scale);
    u.uOrientA.value.set(A.rotX, A.rotY, A.dim, 0);
    u.uOrientB.value.set(B.rotX, B.rotY, B.dim, 0);

    // Estados animados que dependen del tiempo o del scroll.
    const globeAngle = 0.76 + Math.sin(time * 0.09) * 0.5 * motion;
    u.uGlobeAngle.value = globeAngle;
    const speed = Math.min(Math.abs(velocity), 80);
    this.tunnel += dt * (0.9 + speed * 0.09) * motion;
    u.uTunnel.value = this.tunnel;
    this.scatter = damp(this.scatter, Math.min(speed * 0.0045, 0.45) * motion, 5, dt);
    u.uScatter.value = this.scatter;
    this.test = this.frozen !== null ? this.test : damp(this.test, this.testTarget, 5, dt);
    u.uTest.value = this.test;

    // Halo de fondo que sigue a la forma activa.
    this.glowA.setHex(SCENES[this.ids[iA]].glow);
    this.glowB.setHex(SCENES[this.ids[iB]].glow);
    const bg = this.stage.backdrop.material.uniforms;
    (bg.uGlow.value as THREE.Color).copy(this.glowA).lerp(this.glowB, t);
    this.center.set(
      A.offset[0] + (B.offset[0] - A.offset[0]) * t,
      A.offset[1] + (B.offset[1] - A.offset[1]) * t,
      0,
    );
    this.stage.project(this.center, this.projected);
    (bg.uCenter.value as THREE.Vector2).set(
      this.projected.x / this.stage.width,
      1 - this.projected.y / this.stage.height,
    );

    this.labels.update(this.ids, this.layouts, iA, iB, t, { time, motion, globeAngle }, u.uIntroMix.value);

    const chapter = Math.round(s);
    if (chapter !== this.chapter) {
      this.chapter = chapter;
      this.onChapter?.(chapter, this.ids[chapter]);
    }
  }

  destroy() {
    this.triggers.forEach((t) => t.kill());
  }
}
