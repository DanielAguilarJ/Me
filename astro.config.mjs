// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://danieljunco.com',
  trailingSlash: 'ignore',
  // Astro 7 usa compresión estilo JSX por defecto; mantenemos la de HTML
  // para no perder espacios entre elementos en línea.
  compressHTML: true,
  integrations: [
    sitemap({
      i18n: {
        defaultLocale: 'es',
        locales: { es: 'es-MX', en: 'en' },
      },
    }),
  ],
  build: {
    inlineStylesheets: 'auto',
  },
  vite: {
    build: {
      chunkSizeWarningLimit: 900,
    },
  },
});
