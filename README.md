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
public/            Archivos que se copian tal cual (CV, imágenes, CNAME)
```

## Accesibilidad y rendimiento

- Con "reducir movimiento" activado no hay scroll suave, intro animada ni efecto
  del puntero, y las partículas casi no se mueven solas. El cambio de figura sigue
  al scroll.
- Sin WebGL se muestra una imagen fija de fondo y el contenido sigue completo.
- La calidad de la escena baja sola si los fotogramas tardan demasiado.
  `?hq` en la URL desactiva ese ajuste (útil para pruebas).

## Publicar

El resultado de `npm run build` (`dist/`) es estático y funciona en cualquier
hosting. En GitHub Pages publicado con GitHub Actions, el dominio se configura en
Settings → Pages: ahí se ignora `public/CNAME`, que solo cuenta si se publica
desde una rama.
