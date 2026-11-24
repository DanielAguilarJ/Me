import type Lenis from 'lenis';

/** Navegación: scroll suave a las secciones, menú móvil y ocultar al bajar. */
export function initNav(lenis: Lenis | null) {
  const header = document.querySelector<HTMLElement>('[data-header]');
  const toggle = document.querySelector<HTMLButtonElement>('[data-menu-toggle]');
  const menu = document.querySelector<HTMLElement>('[data-menu]');

  const go = (hash: string) => {
    const target = document.querySelector<HTMLElement>(hash);
    if (!target) return;
    if (lenis) lenis.scrollTo(target, { duration: 1.8, offset: 0 });
    else target.scrollIntoView({ behavior: 'smooth' });
    history.replaceState(null, '', hash);
  };

  document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const hash = a.getAttribute('href');
      if (!hash || hash === '#') return;
      e.preventDefault();
      closeMenu();
      go(hash);
    });
  });

  const openMenu = () => {
    if (!menu || !toggle) return;
    menu.classList.add('is-open');
    toggle.setAttribute('aria-expanded', 'true');
    document.documentElement.classList.add('menu-open');
    lenis?.stop();
  };
  const closeMenu = () => {
    if (!menu || !toggle) return;
    menu.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    document.documentElement.classList.remove('menu-open');
    lenis?.start();
  };
  toggle?.addEventListener('click', () => (menu?.classList.contains('is-open') ? closeMenu() : openMenu()));
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });

  // Ocultar la barra al bajar y mostrarla al subir.
  let lastY = 0;
  const onScroll = (y: number) => {
    if (!header) return;
    const down = y > lastY && y > 160;
    header.classList.toggle('is-hidden', down && !document.documentElement.classList.contains('menu-open'));
    header.classList.toggle('is-scrolled', y > 40);
    lastY = y;
  };
  if (lenis) lenis.on('scroll', (l: Lenis) => onScroll(l.scroll));
  else window.addEventListener('scroll', () => onScroll(window.scrollY), { passive: true });

  // Marcar el enlace activo según la sección visible.
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-nav-link]'));
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const id = `#${entry.target.id}`;
        links.forEach((l) => l.classList.toggle('is-active', l.getAttribute('href') === id));
      });
    },
    { rootMargin: '-45% 0px -50% 0px' },
  );
  links.forEach((l) => {
    const target = document.querySelector(l.getAttribute('href') ?? '');
    if (target) observer.observe(target);
  });

  return { go };
}
