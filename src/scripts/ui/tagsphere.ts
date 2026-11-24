import { gsap } from 'gsap';

/**
 * Esfera 3D de habilidades hecha con elementos HTML (accesibles y seleccionables).
 * Gira sola, se puede arrastrar con inercia y se pausa fuera de pantalla.
 */
export function initTagSphere(reduced: boolean) {
  const root = document.querySelector<HTMLElement>('[data-tagsphere]');
  if (!root) return;
  const items = Array.from(root.querySelectorAll<HTMLElement>('[data-tag]'));
  const n = items.length;
  if (!n) return;

  // Distribución de Fibonacci sobre la esfera.
  const base = items.map((_, i) => {
    const y = 1 - ((i + 0.5) / n) * 2;
    const r = Math.sqrt(1 - y * y);
    const phi = i * Math.PI * (3 - Math.sqrt(5));
    return [Math.cos(phi) * r, y, Math.sin(phi) * r] as const;
  });

  let radius = 200;
  // Distancia libre del centro de la esfera al borde más cercano de la ventana. En
  // móvil la esfera ocupa todo el ancho y las etiquetas largas de los lados se cortaban.
  let room = Infinity;
  let widths: number[] = [];
  let rotX = 0.3;
  let rotY = 0;
  let velX = 0;
  let velY = reduced ? 0 : 0.0035;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let visible = false;
  let hovering = false;

  const measure = () => {
    radius = Math.min(root.clientWidth, root.clientHeight) * 0.42;
    const rect = root.getBoundingClientRect();
    const center = rect.left + rect.width / 2;
    room = Math.min(center, document.documentElement.clientWidth - center) - 8;
    widths = items.map((el) => el.offsetWidth);
  };
  measure();
  new ResizeObserver(measure).observe(root);
  window.addEventListener('resize', measure);
  new IntersectionObserver(([e]) => (visible = e.isIntersecting), { rootMargin: '100px' }).observe(root);

  root.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    root.setPointerCapture(e.pointerId);
    root.classList.add('is-dragging');
  });
  root.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    velY = dx * 0.0045;
    velX = -dy * 0.0045;
  });
  const end = () => {
    dragging = false;
    root.classList.remove('is-dragging');
  };
  root.addEventListener('pointerup', end);
  root.addEventListener('pointercancel', end);
  root.addEventListener('pointerenter', () => (hovering = true));
  root.addEventListener('pointerleave', () => (hovering = false));

  const render = () => {
    if (!visible) return;
    if (!dragging) {
      velX *= 0.95;
      const idle = reduced ? 0 : hovering ? 0.0012 : 0.0035;
      velY += (idle * Math.sign(velY || 1) - velY) * 0.02;
    }
    rotX += velX;
    rotY += velY;
    rotX = Math.max(-1.2, Math.min(1.2, rotX));
    const cx = Math.cos(rotX);
    const sx = Math.sin(rotX);
    const cy = Math.cos(rotY);
    const sy = Math.sin(rotY);
    for (let i = 0; i < n; i++) {
      const [x0, y0, z0] = base[i];
      const x1 = cy * x0 + sy * z0;
      const z1 = -sy * x0 + cy * z0;
      const y2 = cx * y0 - sx * z1;
      const z2 = sx * y0 + cx * z1;
      const depth = (z2 + 1) / 2;
      const scale = 0.55 + depth * 0.65;
      const el = items[i];
      const limit = Math.max(0, room - (widths[i] * scale) / 2);
      const x = Math.max(-limit, Math.min(limit, x1 * radius));
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${(y2 * radius).toFixed(1)}px, 0) translate(-50%, -50%) scale(${scale.toFixed(3)})`;
      el.style.opacity = (0.18 + depth * 0.82).toFixed(3);
      el.style.zIndex = String(Math.round(depth * 100));
    }
  };
  gsap.ticker.add(render);
}
