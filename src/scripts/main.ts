import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';
import { env, detectTier, hasWebGL2, wait } from './core/env';
import { HALF_H, Stage, TIERS } from './gl/Stage';
import { Pointer } from './gl/pointer';
import { CAPTURE_LAYERS, CORE_LAYERS, buildShapes, buildTextShape } from './gl/buildShapes';
import { Shape } from './gl/shapes/ids';
import type { TextLine } from './gl/shapes/text';
import { Story } from './story/Story';
import { Preloader } from './ui/preloader';
import { heroIntro, initReveals } from './ui/reveal';
import { initCursor, initMagnetic, initTilt } from './ui/pointer-fx';
import { initTagSphere } from './ui/tagsphere';
import { initClock, initHud, initScrambleHover } from './ui/hud';
import { initNav } from './ui/nav';
import { initJourney } from './ui/journey';
import { initContact, initMarquee, initSensor, initTestReadout } from './ui/widgets';

gsap.registerPlugin(ScrollTrigger, SplitText);
(window as unknown as { __booted: boolean }).__booted = true;

const html = document.documentElement;

/** Lee la posición y tipografía de las líneas del nombre para formarlas con partículas. */
function heroTextLines(): TextLine[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-hero-line]')).map((el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    let text = (el.textContent ?? '').trim();
    if (cs.textTransform === 'uppercase') text = text.toUpperCase();
    return {
      text,
      rect: { left: r.left, top: r.top, width: r.width, height: r.height },
      // El estilo va primero: «Ing.» es cursiva y el canvas debe dibujarla igual.
      font: `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`,
      letterSpacing: cs.letterSpacing,
    };
  });
}

async function boot() {
  const reduced = env.reduced;
  const capture = env.capture;
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  const hash = window.location.hash && document.querySelector(window.location.hash) ? window.location.hash : '';
  if (!hash) window.scrollTo(0, 0);
  if (capture) html.classList.add('is-capture');

  const preloader = capture ? null : new Preloader();

  let lenis: Lenis | null = null;
  if (!reduced && !capture) {
    lenis = new Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 0.95, touchMultiplier: 1.4 });
    lenis.on('scroll', ScrollTrigger.update);
    lenis.stop();
  }
  gsap.ticker.lagSmoothing(0);
  ScrollTrigger.config({ ignoreMobileResize: true });

  await Promise.race([
    Promise.all([
      document.fonts.load('700 100px "Unbounded Variable"'),
      document.fonts.load('700 100px "Unbounded Outline"'),
      document.fonts.load('italic 400 100px "Instrument Serif"'),
      document.fonts.ready,
    ]),
    wait(3000),
  ]);
  preloader?.set(0.15);

  // La sección fijada (pin) se crea antes que los triggers de la historia.
  initJourney(reduced);

  const canvas = document.querySelector<HTMLCanvasElement>('#gl');
  let stage: Stage | null = null;
  let story: Story | null = null;
  let pointer: Pointer | null = null;
  if (canvas && hasWebGL2()) {
    try {
      const tier = TIERS[detectTier()];
      stage = new Stage(canvas, tier, capture ? CAPTURE_LAYERS : CORE_LAYERS);
      await buildShapes(stage.particles, {
        extra: !!capture,
        onProgress: (p) => preloader?.set(0.15 + p * 0.6),
      });
      buildTextShape(stage.particles, heroTextLines(), {
        width: stage.width,
        height: stage.height,
        halfW: stage.halfW,
        halfH: HALF_H,
      });
      stage.particles.commit();
      story = new Story(stage, document.querySelector('[data-gl-labels]'));
      pointer = new Pointer(stage, !reduced && !capture);
      stage.particles.uniforms.uMotion.value = reduced ? 0.15 : 1;
      await stage.renderer.compileAsync(stage.scene, stage.camera).catch(() => undefined);
      stage.render(0, 0);
      preloader?.set(0.92);
    } catch (err) {
      console.error('[gl] no se pudo iniciar WebGL', err);
      stage?.renderer.dispose();
      stage = null;
      story = null;
      html.classList.add('no-webgl');
    }
  } else {
    html.classList.add('no-webgl');
  }

  // Interfaz
  const nav = initNav(lenis);
  initClock();
  const hudEl = document.querySelector<HTMLElement>('[data-hud]');
  const chapters: string[] = JSON.parse(hudEl?.dataset.chapters ?? '[]');
  const setChapter = initHud(chapters, lenis);
  if (story) story.onChapter = (i) => setChapter(i);
  initReveals(reduced);
  initTagSphere(reduced);
  initSensor(reduced);
  let fallbackTest = 0;
  if (!story) {
    ScrollTrigger.create({
      trigger: '[data-scene="materials"]',
      start: 'top 45%',
      end: 'bottom 55%',
      onUpdate: (self) => (fallbackTest = self.progress),
    });
    // Sin Story (no hay WebGL) el HUD cambia de capítulo en el mismo punto: a mitad de la
    // transición de cada sección (top 85% → top 15%), es decir, con su borde a media pantalla.
    document.querySelectorAll<HTMLElement>('[data-scene]').forEach((section, i) => {
      if (i === 0) return;
      ScrollTrigger.create({
        trigger: section,
        start: 'top 50%',
        onEnter: () => setChapter(i),
        onLeaveBack: () => setChapter(i - 1),
      });
    });
  }
  initTestReadout(() => story?.test ?? fallbackTest);
  initMarquee(() => lenis?.velocity ?? 0, reduced);
  initContact();
  if (!env.coarse) {
    initCursor();
    initMagnetic();
    initTilt();
  }
  initScrambleHover();

  // Bucle principal: un único requestAnimationFrame (el ticker de GSAP).
  let elapsed = 0;
  let fixedTime: number | null = null;
  gsap.ticker.add((time, deltaMs) => {
    lenis?.raf(time * 1000);
    if (!stage || !story) return;
    const dt = Math.min(deltaMs / 1000, 1 / 20);
    elapsed += dt;
    const t = fixedTime ?? elapsed;
    const u = stage.particles.uniforms;
    u.uTime.value = t;
    pointer?.update(dt, t);
    stage.group.updateMatrixWorld();
    story.update(dt, t, lenis?.velocity ?? 0, u.uMotion.value);
    stage.render(dt, t);
  });

  let resizeRaf = 0;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => {
      stage?.resize();
      story?.resize();
    });
  });

  if (capture) {
    const { runCapture } = await import('./capture');
    await runCapture(capture, stage, story, (t) => (fixedTime = t));
    return;
  }

  ScrollTrigger.refresh();

  // Intro: polvo estelar → nombre en partículas → globo.
  const u = stage?.particles.uniforms;
  const skipIntro = reduced || !!hash || !u;
  if (u) {
    u.uIntroFrom.value = Shape.NEBULA;
    u.uIntroTo.value = Shape.TEXT;
    u.uIntroT.value = 0;
    u.uIntroMix.value = skipIntro ? 1 : 0;
  }
  await preloader?.hide(skipIntro);

  if (skipIntro || !u) {
    heroIntro(reduced);
    lenis?.start();
    if (hash) nav.go(hash);
    stage?.startMonitor(elapsed, !env.fixedQuality);
    return;
  }

  const tl = gsap.timeline({
    onComplete: () => stage?.startMonitor(elapsed, !env.fixedQuality),
  });
  tl.to(u.uIntroT, { value: 1, duration: 2.3, ease: 'power2.inOut' })
    .add('release', '+=0.35')
    .to(u.uIntroMix, { value: 1, duration: 2.4, ease: 'power2.inOut' }, 'release')
    .add(heroIntro(false), 'release+=0.1')
    .add(() => lenis?.start(), 'release+=0.5');

  const hurry = () => {
    tl.timeScale(3.5);
    window.removeEventListener('wheel', hurry);
    window.removeEventListener('touchstart', hurry);
    window.removeEventListener('keydown', hurry);
  };
  window.addEventListener('wheel', hurry, { passive: true });
  window.addEventListener('touchstart', hurry, { passive: true });
  window.addEventListener('keydown', hurry);
}

boot().catch((err) => {
  console.error('[boot]', err);
  html.classList.add('app-failed');
});
