import { gsap } from 'gsap';

/** Pantalla de carga con contador y pasos "técnicos". */
export class Preloader {
  private el = document.querySelector<HTMLElement>('[data-preloader]');
  private num = this.el?.querySelector<HTMLElement>('[data-preloader-num]') ?? null;
  private bar = this.el?.querySelector<HTMLElement>('[data-preloader-bar]') ?? null;
  private steps = Array.from(this.el?.querySelectorAll<HTMLElement>('[data-preloader-step]') ?? []);
  private target = 0;
  private shown = 0;
  private raf = 0;

  constructor() {
    if (!this.el) return;
    const tick = () => {
      this.shown += (this.target - this.shown) * 0.12;
      if (this.target - this.shown < 0.002) this.shown = this.target;
      const pct = Math.round(this.shown * 100);
      if (this.num) this.num.textContent = String(pct).padStart(3, '0');
      if (this.bar) this.bar.style.transform = `scaleX(${this.shown})`;
      this.steps.forEach((s, i) => {
        const at = (i + 1) / (this.steps.length + 1);
        s.classList.toggle('is-active', this.shown >= at - 0.25 && this.shown < at + 0.2);
        s.classList.toggle('is-done', this.shown >= at + 0.2);
      });
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  set(p: number) {
    this.target = Math.max(this.target, Math.min(1, p));
  }

  async hide(fast = false) {
    this.set(1);
    if (!this.el) return;
    await new Promise<void>((resolve) => {
      const check = () => (this.shown >= 0.999 || fast ? resolve() : requestAnimationFrame(check));
      check();
    });
    cancelAnimationFrame(this.raf);
    this.steps.forEach((s) => s.classList.add('is-done'));
    await gsap.to(this.el, {
      autoAlpha: 0,
      duration: fast ? 0.2 : 0.9,
      ease: 'power2.inOut',
      delay: fast ? 0 : 0.15,
    });
    this.el.remove();
  }
}
