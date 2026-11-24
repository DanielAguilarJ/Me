/**
 * Genera las imágenes del sitio renderizando la propia escena de partículas
 * (modo `?capture=<clave>`) en Chromium headless:
 *
 *   public/images/renders/<clave>.webp  Tarjetas de la trayectoria (900×600)
 *   public/images/renders/hero.webp     Fondo para navegadores sin WebGL (1920×1080)
 *   public/og/og-es.jpg, og-en.jpg      Vista previa al compartir el enlace (1200×630)
 *   public/favicon-32.png               Favicon PNG (desde public/favicon.svg)
 *   public/apple-touch-icon.png         Icono de iOS (180×180)
 *
 * Uso:
 *   npm run render:images                      Compila primero si no existe dist/
 *   npm run render:images -- --build           Fuerza una compilación previa
 *   npm run render:images -- --only=og-es,fins Solo las imágenes indicadas
 *
 * Las imágenes se escriben en public/ (fuente) y se copian a dist/, así que no
 * hace falta volver a compilar para verlas en la vista previa.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { serveStatic } from './lib/static-server.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value = 'true'] = arg.replace(/^--/, '').split('=');
    return [key, value];
  }),
);
const only = args.has('only') ? new Set(args.get('only').split(',')) : null;
const wanted = (name) => !only || only.has(name);

const CARDS = ['robotics', 'marketing', 'freelance', 'telus', 'aquaguard', 'fins', 'fishapp', 'chemnitz'];

/**
 * `viewport` es el tamaño CSS de la página; se renderiza a `scale`× y se reduce
 * a `size` con Lanczos para suavizar las partículas (supermuestreo).
 */
const SHOTS = [
  ...CARDS.map((key) => ({
    name: key,
    path: '/',
    capture: key,
    viewport: [900, 600],
    scale: 2,
    size: [900, 600],
    out: `images/renders/${key}.webp`,
  })),
  { name: 'hero', path: '/', capture: 'hero', viewport: [1600, 900], scale: 2, size: [1920, 1080], out: 'images/renders/hero.webp' },
  { name: 'og-es', path: '/', capture: 'og', viewport: [1200, 630], scale: 2, size: [1200, 630], out: 'og/og-es.jpg' },
  { name: 'og-en', path: '/en/', capture: 'og', viewport: [1200, 630], scale: 2, size: [1200, 630], out: 'og/og-en.jpg' },
];

async function save(rel, buf) {
  for (const base of ['public', 'dist']) {
    if (base === 'dist' && !existsSync(join(root, 'dist'))) continue;
    const file = join(root, base, rel);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, buf);
  }
  console.log(`  ok  ${rel.padEnd(32)} ${(buf.length / 1024).toFixed(0).padStart(4)} KB`);
}

function encode(png, shot) {
  const [w, h] = shot.size;
  const img = sharp(png).resize(w, h, { fit: 'cover', kernel: 'lanczos3' });
  if (shot.out.endsWith('.jpg')) return img.jpeg({ quality: 86, mozjpeg: true, chromaSubsampling: '4:4:4' }).toBuffer();
  return img.webp({ quality: 82, effort: 6, smartSubsample: true }).toBuffer();
}

async function renderShots(shots) {
  const server = await serveStatic(join(root, 'dist'));
  // SwiftShader da un WebGL por software estable en cualquier máquina (con o sin GPU).
  const browser = await chromium.launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  try {
    for (const shot of shots) {
      const [width, height] = shot.viewport;
      const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: shot.scale });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (err) => errors.push(err.message));
      page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));
      await page.goto(`${server.url}${shot.path}?capture=${shot.capture}`, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__captureReady === true, null, { timeout: 180_000 });
      const failed = await page.evaluate(() => {
        const cl = document.documentElement.classList;
        return cl.contains('no-webgl') || cl.contains('app-failed');
      });
      if (failed) throw new Error(`"${shot.name}": WebGL no disponible o error al iniciar.\n${errors.join('\n')}`);
      const png = await page.screenshot({ type: 'png' });
      await context.close();
      await save(shot.out, await encode(png, shot));
    }
  } finally {
    await browser.close();
    await server.close();
  }
}

async function renderIcons() {
  const svg = await readFile(join(root, 'public/favicon.svg'), 'utf8');
  if (wanted('favicon')) {
    const png = await sharp(Buffer.from(svg), { density: 384 }).resize(32, 32).png({ compressionLevel: 9 }).toBuffer();
    await save('favicon-32.png', png);
  }
  if (wanted('apple-touch-icon')) {
    // iOS aplica su propia máscara redondeada: el icono va a sangre completa.
    const square = svg.replace(/(<rect[^>]*?)\s+rx="[\d.]+"/, '$1');
    const png = await sharp(Buffer.from(square), { density: 1024 }).resize(180, 180).png({ compressionLevel: 9 }).toBuffer();
    await save('apple-touch-icon.png', png);
  }
}

if (args.has('build') || !existsSync(join(root, 'dist/index.html'))) {
  console.log('Compilando el sitio…');
  const result = spawnSync('npx', ['astro', 'build'], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const started = Date.now();
console.log('Generando imágenes…');
await renderIcons();
await renderShots(SHOTS.filter((shot) => wanted(shot.name)));
console.log(`Listo en ${((Date.now() - started) / 1000).toFixed(0)} s.`);
