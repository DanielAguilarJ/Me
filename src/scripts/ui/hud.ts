import { gsap } from 'gsap';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';
import type Lenis from 'lenis';

gsap.registerPlugin(ScrambleTextPlugin);

/** Reloj local de Aguascalientes (zona horaria del centro de México). */
export function initClock() {
  const els = document.querySelectorAll<HTMLElement>('[data-clock]');
  if (!els.length) return;
  const fmt = new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Mexico_City',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const tick = () => {
    const text = fmt.format(new Date());
    els.forEach((el) => (el.textContent = text));
  };
  tick();
  setInterval(tick, 1000);
}

/** Indicador de capítulo y barra de progreso global. */
export function initHud(chapters: string[], lenis: Lenis | null) {
  const num = document.querySelector<HTMLElement>('[data-hud-num]');
  const name = document.querySelector<HTMLElement>('[data-hud-name]');
  const bar = document.querySelector<HTMLElement>('[data-hud-bar]');
  const total = document.querySelector<HTMLElement>('[data-hud-total]');
  if (total) total.textContent = String(chapters.length - 1).padStart(2, '0');

  const setProgress = (p: number) => {
    if (bar) bar.style.transform = `scaleY(${Math.min(1, Math.max(0, p)).toFixed(4)})`;
  };
  if (lenis) lenis.on('scroll', (l: Lenis) => setProgress(l.progress));
  else
    window.addEventListener(
      'scroll',
      () => setProgress(window.scrollY / Math.max(1, document.documentElement.scrollHeight - window.innerHeight)),
      { passive: true },
    );

  return (index: number) => {
    if (num) num.textContent = String(index).padStart(2, '0');
    if (name) {
      gsap.to(name, {
        duration: 0.8,
        scrambleText: { text: chapters[index] ?? '', chars: '01#%&*<>/\\', speed: 0.6 },
        overwrite: true,
      });
    }
    document.documentElement.dataset.chapter = String(index);
  };
}

/** Efecto "decodificación" al pasar el cursor por enlaces con data-scramble. */
export function initScrambleHover() {
  document.querySelectorAll<HTMLElement>('[data-scramble]').forEach((el) => {
    const text = el.textContent ?? '';
    el.addEventListener('pointerenter', () => {
      gsap.to(el, { duration: 0.6, scrambleText: { text, chars: 'upperAndLowerCase', speed: 0.8 }, overwrite: true });
    });
  });
}
