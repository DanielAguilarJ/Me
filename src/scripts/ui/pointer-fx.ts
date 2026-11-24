import { gsap } from 'gsap';

/** Cursor personalizado (punto + anillo) para punteros finos. */
export function initCursor() {
  const dot = document.querySelector<HTMLElement>('[data-cursor-dot]');
  const ring = document.querySelector<HTMLElement>('[data-cursor-ring]');
  const label = ring?.querySelector<HTMLElement>('[data-cursor-label]');
  if (!dot || !ring) return;
  document.documentElement.classList.add('has-cursor');

  const dx = gsap.quickTo(dot, 'x', { duration: 0.08, ease: 'power3' });
  const dy = gsap.quickTo(dot, 'y', { duration: 0.08, ease: 'power3' });
  const rx = gsap.quickTo(ring, 'x', { duration: 0.45, ease: 'power3' });
  const ry = gsap.quickTo(ring, 'y', { duration: 0.45, ease: 'power3' });

  window.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'mouse') return;
      dx(e.clientX);
      dy(e.clientY);
      rx(e.clientX);
      ry(e.clientY);
      document.documentElement.classList.add('cursor-visible');
    },
    { passive: true },
  );
  document.addEventListener('pointerleave', () => document.documentElement.classList.remove('cursor-visible'));

  const hoverables = 'a, button, [data-cursor]';
  document.addEventListener('pointerover', (e) => {
    const t = (e.target as Element | null)?.closest<HTMLElement>(hoverables);
    if (!t) return;
    ring.classList.add('is-hover');
    const text = t.dataset.cursor;
    if (label) label.textContent = text ?? '';
    ring.classList.toggle('has-label', !!text);
  });
  document.addEventListener('pointerout', (e) => {
    const t = (e.target as Element | null)?.closest(hoverables);
    const to = (e.relatedTarget as Element | null)?.closest(hoverables);
    if (t && t !== to) {
      ring.classList.remove('is-hover', 'has-label');
      if (label) label.textContent = '';
    }
  });
  window.addEventListener('pointerdown', () => ring.classList.add('is-down'));
  window.addEventListener('pointerup', () => ring.classList.remove('is-down'));
}

/** Botones magnéticos: se desplazan hacia el puntero. */
export function initMagnetic() {
  document.querySelectorAll<HTMLElement>('[data-magnetic]').forEach((el) => {
    const strength = Number(el.dataset.magnetic || 0.35);
    const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const r = el.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * strength);
      yTo((e.clientY - (r.top + r.height / 2)) * strength);
    });
    el.addEventListener('pointerleave', () => {
      xTo(0);
      yTo(0);
    });
  });
}

/** Tarjetas con inclinación 3D y brillo que sigue al puntero. */
export function initTilt() {
  document.querySelectorAll<HTMLElement>('[data-tilt]').forEach((el) => {
    const max = Number(el.dataset.tilt || 10);
    const rxTo = gsap.quickTo(el, 'rotationX', { duration: 0.6, ease: 'power3' });
    const ryTo = gsap.quickTo(el, 'rotationY', { duration: 0.6, ease: 'power3' });
    gsap.set(el, { transformPerspective: 900 });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      ryTo((px - 0.5) * max * 2);
      rxTo(-(py - 0.5) * max * 2);
      el.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
      el.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);
    });
    el.addEventListener('pointerleave', () => {
      rxTo(0);
      ryTo(0);
    });
  });
}
