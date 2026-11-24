import type { Stage } from './Stage';

const damp = (a: number, b: number, lambda: number, dt: number) => a + (b - a) * (1 - Math.exp(-lambda * dt));
const INTERACTIVE = 'a, button, input, textarea, select, label, [data-no-shock], .tagsphere';

/**
 * Interacción con el puntero: repulsión de partículas alrededor del cursor,
 * onda expansiva al hacer clic y un ligero paralaje del grupo 3D.
 */
export class Pointer {
  private x = 9;
  private y = 9;
  private tx = 9;
  private ty = 9;
  private force = 0;
  private lastMove = -10;
  private now = 0;
  private parallaxX = 0;
  private parallaxY = 0;

  constructor(
    private stage: Stage,
    private enabled: boolean,
  ) {
    if (!enabled) return;
    window.addEventListener('pointermove', this.onMove, { passive: true });
    window.addEventListener('pointerdown', this.onDown, { passive: true });
    document.addEventListener('pointerleave', () => (this.lastMove = -10));
  }

  private toNdc(e: PointerEvent): [number, number] {
    return [(e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1];
  }

  private onMove = (e: PointerEvent) => {
    const [x, y] = this.toNdc(e);
    if (this.x > 5) {
      this.x = x;
      this.y = y;
    }
    this.tx = x;
    this.ty = y;
    this.lastMove = this.now;
  };

  private onDown = (e: PointerEvent) => {
    const target = e.target as Element | null;
    if (target?.closest(INTERACTIVE)) return;
    const [x, y] = this.toNdc(e);
    this.stage.particles.uniforms.uClick.value.set(x, y, this.stage.particles.uniforms.uTime.value);
  };

  update(dt: number, time: number) {
    this.now = time;
    const u = this.stage.particles.uniforms;
    if (!this.enabled) {
      u.uMouseForce.value = 0;
      return;
    }
    this.x = damp(this.x, this.tx, 10, dt);
    this.y = damp(this.y, this.ty, 10, dt);
    const active = time - this.lastMove < 1.2 ? 1 : 0;
    this.force = damp(this.force, active, active ? 4 : 1.5, dt);
    u.uMouse.value.set(this.x, this.y);
    u.uMouseForce.value = this.force;

    const px = this.tx > 5 ? 0 : this.tx;
    const py = this.ty > 5 ? 0 : this.ty;
    this.parallaxX = damp(this.parallaxX, px, 2.5, dt);
    this.parallaxY = damp(this.parallaxY, py, 2.5, dt);
    this.stage.group.rotation.y = this.parallaxX * 0.12;
    this.stage.group.rotation.x = -this.parallaxY * 0.07;
  }
}
