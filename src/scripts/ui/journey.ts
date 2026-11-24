import { gsap } from 'gsap';

/**
 * Línea de tiempo horizontal: en escritorio la sección se fija y las tarjetas
 * se desplazan de lado con el scroll; en móvil queda como lista vertical.
 */
export function initJourney(reduced: boolean) {
  const section = document.querySelector<HTMLElement>('[data-journey]');
  const track = section?.querySelector<HTMLElement>('[data-journey-track]');
  const fill = section?.querySelector<HTMLElement>('[data-journey-fill]');
  if (!section || !track) return;

  const mm = gsap.matchMedia();
  mm.add('(min-width: 900px) and (min-aspect-ratio: 1/1)', () => {
    const distance = () => Math.max(0, track.scrollWidth - window.innerWidth + 80);
    const tween = gsap.to(track, {
      x: () => -distance(),
      ease: 'none',
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: () => `+=${distance()}`,
        pin: true,
        scrub: reduced ? true : 0.8,
        invalidateOnRefresh: true,
        anticipatePin: 1,
        onUpdate: (self) => {
          if (fill) fill.style.transform = `scaleX(${self.progress.toFixed(4)})`;
        },
      },
    });

    const cards = gsap.utils.toArray<HTMLElement>('[data-journey-card]', track);
    cards.forEach((card) => {
      gsap.fromTo(
        card,
        { rotateY: -18, z: -120, autoAlpha: 0.25 },
        {
          rotateY: 0,
          z: 0,
          autoAlpha: 1,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: card,
            containerAnimation: tween,
            start: 'left 95%',
            end: 'left 55%',
            scrub: true,
          },
        },
      );
    });
    return () => gsap.set(track, { clearProps: 'transform' });
  });
}
