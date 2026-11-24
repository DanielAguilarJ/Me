import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

/**
 * Animaciones de entrada ligadas al scroll:
 * - [data-split]: títulos que suben línea por línea con máscara.
 * - [data-reveal]: bloques que aparecen con un leve desplazamiento.
 * - [data-count]: contadores numéricos.
 * - [data-meter]: barras de nivel (idiomas).
 */
export function initReveals(reduced: boolean) {
  const splits = gsap.utils.toArray<HTMLElement>('[data-split]');
  splits.forEach((el) => {
    if (reduced) return;
    SplitText.create(el, {
      type: 'lines,words',
      mask: 'lines',
      linesClass: 'split-line',
      autoSplit: true,
      onSplit(self) {
        return gsap.from(self.lines, {
          yPercent: 115,
          rotate: 2.5,
          duration: 1.15,
          ease: 'expo.out',
          stagger: 0.09,
          scrollTrigger: { trigger: el, start: 'top 88%', once: true },
        });
      },
    });
  });

  if (!reduced) {
    gsap.set('[data-reveal]', { autoAlpha: 0 });
    ScrollTrigger.batch('[data-reveal]', {
      start: 'top 90%',
      once: true,
      onEnter: (batch) => {
        // Tras un salto (barra de scroll, enlace con #) llegan muchos elementos a la vez:
        // solo se animan los visibles; los que ya quedaron atrás aparecen sin esperar.
        const els = batch as HTMLElement[];
        const vh = window.innerHeight;
        const inView = els.filter((el) => {
          const r = el.getBoundingClientRect();
          return r.bottom > 0 && r.top < vh;
        });
        const passed = els.filter((el) => !inView.includes(el));
        if (passed.length) gsap.set(passed, { autoAlpha: 1, y: 0, clearProps: 'filter' });
        if (!inView.length) return;
        gsap.fromTo(
          inView,
          { autoAlpha: 0, y: 46, filter: 'blur(6px)' },
          {
            autoAlpha: 1,
            y: 0,
            filter: 'blur(0px)',
            duration: 1.1,
            ease: 'expo.out',
            stagger: 0.08,
            overwrite: true,
            clearProps: 'filter',
          },
        );
      },
    });
  }

  gsap.utils.toArray<HTMLElement>('[data-count]').forEach((el) => {
    const end = Number(el.dataset.count ?? 0);
    if (reduced) {
      el.textContent = String(end);
      return;
    }
    const state = { v: 0 };
    el.textContent = '0';
    gsap.to(state, {
      v: end,
      duration: 1.8,
      ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 90%', once: true },
      onUpdate: () => (el.textContent = String(Math.round(state.v))),
    });
  });

  gsap.utils.toArray<HTMLElement>('[data-meter]').forEach((el) => {
    const value = Number(el.dataset.meter ?? 1);
    gsap.fromTo(
      el,
      { scaleX: 0 },
      {
        scaleX: value,
        duration: reduced ? 0 : 1.6,
        ease: 'expo.out',
        scrollTrigger: { trigger: el, start: 'top 92%', once: true },
      },
    );
  });
}

/** Revela el bloque del hero después de la intro de partículas. */
export function heroIntro(reduced: boolean) {
  const tl = gsap.timeline();
  const name = gsap.utils.toArray<HTMLElement>('[data-hero-line]');
  if (reduced) {
    gsap.set('[data-hero-fade], [data-hero-line]', { autoAlpha: 1 });
    return tl;
  }
  name.forEach((line) => {
    const split = SplitText.create(line, { type: 'chars', mask: 'chars' });
    tl.from(split.chars, { yPercent: 120, duration: 1.3, ease: 'expo.out', stagger: 0.045 }, 0.05);
  });
  tl.set(name, { autoAlpha: 1 }, 0);
  tl.fromTo(
    '[data-hero-fade]',
    { autoAlpha: 0, y: 28 },
    { autoAlpha: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: 0.08 },
    0.35,
  );
  return tl;
}
