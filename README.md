# danieljunco.com

Portafolio de Kevin Daniel Aguilar Junco. Un solo sistema de partículas en 3D se
transforma en una figura distinta por cada capítulo de la historia (globo,
turbina, gota, pez, teléfono...). Español en `/`, inglés en `/en/`.

Astro 7 (sitio estático) · Three.js + postprocessing · GSAP (ScrollTrigger,
SplitText, ScrambleText) · Lenis.

## Requisitos

- Node 22 (`.nvmrc`)
- Opcional: Chromium de Playwright para regenerar imágenes
  (`npx playwright install chromium`)

## Comandos

| Comando                 | Qué hace                                            |
| ----------------------- | --------------------------------------------------- |
| `npm install`           | Instala dependencias                                |
| `npm run dev`           | Servidor local en `http://localhost:4321`           |
| `npm run build`         | Compila el sitio en `dist/`                         |
| `npm run check`         | Revisa tipos de TypeScript y Astro                  |
| `npm run render:images` | Regenera las imágenes a partir de la escena 3D      |
| `npm run gen:globe`     | Regenera la máscara de continentes del globo        |

## Editar el contenido

Todos los textos están en `src/data/content.ts`:

- `profile`: nombre, correo, LinkedIn y rutas de los CV.
- `es` y `en`: textos de cada idioma, con la misma estructura. Si cambias uno,
  cambia el otro.
- `apps` (dentro de cada idioma): los productos propios, con sus enlaces. La
  imagen de cada uno es `public/images/renders/<key>.webp` y se genera con la
  clave del mismo nombre en `src/scripts/capture.ts`.

El correo se arma en el navegador a partir de `profile.email` para que no
aparezca completo en el HTML.

## CV en PDF

Las fuentes están en `scripts/cv/cv-es.tex` y `scripts/cv/cv-en.tex`. Compila con
[Tectonic](https://tectonic-typesetting.github.io/) (o pdfLaTeX en Overleaf) y
copia el resultado con el nombre que usa el sitio:

```sh
tectonic scripts/cv/cv-es.tex --outdir .tmp
cp .tmp/cv-es.pdf public/cv/Kevin-Daniel-Aguilar-Junco-CV-ES.pdf
tectonic scripts/cv/cv-en.tex --outdir .tmp
cp .tmp/cv-en.pdf public/cv/Kevin-Daniel-Aguilar-Junco-CV-EN.pdf
```

Los PDF de `public/cv/` se pueden descargar desde el sitio: todo lo que contengan
será público.

## Imágenes

Las imágenes de las tarjetas, la vista previa para redes (`public/og/`) y los
iconos se generan renderizando la propia escena (`?capture=<clave>`):

```sh
npm run render:images                       # compila primero si no existe dist/
npm run render:images -- --only=og-es,fins  # solo algunas
```

## Fuente con contorno

`src/assets/fonts/unbounded-outline-700.woff2` es Unbounded 700 con los contornos
unidos, para que los textos con contorno (JUNCO, los años, la marquesina) no
muestren líneas internas. Solo hay que regenerarla si se actualiza
`@fontsource-variable/unbounded`:

```sh
pip install fonttools brotli skia-pathops
python3 scripts/fonts/build-outline-font.py
```

Licencia: SIL Open Font License 1.1 (`src/assets/fonts/OFL.txt`).

## Estructura

```
src/
  components/      Secciones de la página (.astro)
  data/content.ts  Textos en español e inglés
  layouts/         <head>, metadatos y fuentes
  pages/           /, /en/ y 404
  scripts/
    gl/            Escena Three.js: partículas, figuras y shaders
    story/         Scroll → capítulo → figura, y etiquetas sobre la escena
    ui/            Precarga, navegación, HUD, animaciones de entrada y widgets
  styles/          global.css
scripts/           Generadores (imágenes, globo, fuente) y CV en LaTeX
public/            Archivos que se copian tal cual (CV, imágenes, iconos)
```

## Accesibilidad y rendimiento

- Con "reducir movimiento" activado no hay scroll suave, intro animada ni efecto
  del puntero, y las partículas casi no se mueven solas. El cambio de figura sigue
  al scroll.
- Sin WebGL se muestra una imagen fija de fondo y el contenido sigue completo.
- La calidad de la escena baja sola si los fotogramas tardan demasiado.
  `?hq` en la URL desactiva ese ajuste (útil para pruebas).

## Publicar en Vercel

El sitio es estático: `npm run build` genera `dist/` y no hace falta adaptador.

1. Importa el repositorio en Vercel. Detecta Astro solo (`npm run build`,
   carpeta `dist`) y publica de nuevo con cada push a `main`.
2. En **Settings → Domains** agrega `danieljunco.com` y `www.danieljunco.com`,
   con una redirección de uno al otro.
3. En el DNS de Hostinger crea los registros que muestra Vercel: un registro A
   para `@` y un CNAME para `www`. Antes borra los registros del dominio
   estacionado, incluido cualquier AAAA.

`vercel.json` le indica al navegador que guarde por un año los archivos de
`/_astro/`, que llevan un hash en el nombre y cambian de nombre en cada versión.
