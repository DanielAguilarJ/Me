import { gsap } from 'gsap';
import { stressStrain } from '../gl/shapes/specimen';

/** Telemetría simulada de AquaGuard (valores ilustrativos que oscilan). */
export function initSensor(reduced: boolean) {
  const root = document.querySelector<HTMLElement>('[data-sensor]');
  if (!root) return;
  const ph = root.querySelector<HTMLElement>('[data-sensor-ph]');
  const turb = root.querySelector<HTMLElement>('[data-sensor-turb]');
  const flow = root.querySelector<HTMLElement>('[data-sensor-flow]');
  const spark = root.querySelector<SVGPolylineElement>('[data-sensor-spark]');
  const history: number[] = Array.from({ length: 40 }, (_, i) => 0.5 + Math.sin(i * 0.4) * 0.2);
  let visible = false;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(root);

  let t = 0;
  const update = () => {
    if (!visible) return;
    t += 0.35;
    const vPh = 7.2 + Math.sin(t * 0.7) * 0.08 + (Math.random() - 0.5) * 0.03;
    const vTurb = 1.8 + Math.sin(t * 0.45 + 1) * 0.25 + (Math.random() - 0.5) * 0.06;
    const vFlow = 3.4 + Math.sin(t * 0.3 + 2) * 0.35 + (Math.random() - 0.5) * 0.05;
    if (ph) ph.textContent = vPh.toFixed(2);
    if (turb) turb.textContent = vTurb.toFixed(2);
    if (flow) flow.textContent = vFlow.toFixed(2);
    history.push((vFlow - 2.9) / 1.0);
    history.shift();
    if (spark) {
      spark.setAttribute(
        'points',
        history.map((v, i) => `${((i / (history.length - 1)) * 100).toFixed(1)},${(28 - v * 24).toFixed(1)}`).join(' '),
      );
    }
  };
  update();
  if (!reduced) setInterval(update, 700);
  else visible = true;
}

/** Lectura del ensayo de tracción ligada al scroll de la sección de materiales. */
export function initTestReadout(getProgress: () => number) {
  const root = document.querySelector<HTMLElement>('[data-test]');
  if (!root) return;
  const strain = root.querySelector<HTMLElement>('[data-test-strain]');
  const stress = root.querySelector<HTMLElement>('[data-test-stress]');
  const bar = root.querySelector<HTMLElement>('[data-test-bar]');
  let last = -1;
  gsap.ticker.add(() => {
    const p = getProgress();
    if (Math.abs(p - last) < 0.001) return;
    last = p;
    if (strain) strain.textContent = `${(p * 22).toFixed(1)} %`;
    if (stress) stress.textContent = stressStrain(p).toFixed(2);
    if (bar) bar.style.transform = `scaleX(${p.toFixed(3)})`;
  });
}

/** Marquesina que acelera y cambia de dirección con el scroll. */
export function initMarquee(getVelocity: () => number, reduced: boolean) {
  document.querySelectorAll<HTMLElement>('[data-marquee]').forEach((el) => {
    const track = el.querySelector<HTMLElement>('[data-marquee-track]');
    if (!track || reduced) return;
    let x = 0;
    let dir = 1;
    gsap.ticker.add((_, delta) => {
      const v = getVelocity();
      if (Math.abs(v) > 0.5) dir = Math.sign(v);
      const speed = (40 + Math.min(Math.abs(v) * 14, 900)) * dir;
      x -= (speed * delta) / 1000;
      const w = track.scrollWidth / 2;
      if (w > 0) {
        if (x <= -w) x += w;
        if (x > 0) x -= w;
      }
      track.style.transform = `translate3d(${x.toFixed(2)}px, 0, 0)`;
    });
  });
}

/** Correo armado en el cliente (dificulta el scraping) y botón para copiarlo. */
export function initContact() {
  document.querySelectorAll<HTMLAnchorElement>('[data-email]').forEach((a) => {
    const user = a.dataset.user ?? '';
    const domain = a.dataset.domain ?? '';
    const email = `${user}@${domain}`;
    a.href = `mailto:${email}`;
    const label = a.querySelector<HTMLElement>('[data-email-text]');
    if (label) label.textContent = email;
  });
  document.querySelectorAll<HTMLButtonElement>('[data-copy-email]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const email = `${btn.dataset.user}@${btn.dataset.domain}`;
      try {
        await navigator.clipboard.writeText(email);
      } catch {
        const input = document.createElement('input');
        input.value = email;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        input.remove();
      }
      const toast = document.querySelector<HTMLElement>('[data-toast]');
      if (toast) {
        toast.textContent = btn.dataset.copied ?? 'OK';
        gsap.fromTo(toast, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.4, ease: 'back.out(2)' });
        gsap.to(toast, { autoAlpha: 0, y: 10, delay: 2.2, duration: 0.4 });
      }
    });
  });
}
