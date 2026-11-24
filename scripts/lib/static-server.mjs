/**
 * Servidor estático mínimo para `dist/` (sin dependencias), usado por los
 * scripts que abren el sitio en un navegador headless.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.pdf': 'application/pdf',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
};

export async function serveStatic(rootDir) {
  const root = resolve(rootDir);
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      let file = resolve(root, `.${normalize(decodeURIComponent(url.pathname))}`);
      if (file !== root && !file.startsWith(root + sep)) {
        res.writeHead(403).end();
        return;
      }
      let info = await stat(file).catch(() => null);
      if (info?.isDirectory()) {
        file = join(file, 'index.html');
        info = await stat(file).catch(() => null);
      }
      if (!info) {
        file = join(root, '404.html');
        res.statusCode = 404;
      }
      const body = await readFile(file);
      res.setHeader('Content-Type', MIME[extname(file).toLowerCase()] ?? 'application/octet-stream');
      res.end(body);
    } catch {
      res.writeHead(500).end();
    }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  return { url: `http://127.0.0.1:${port}`, close: () => new Promise((r) => server.close(r)) };
}
