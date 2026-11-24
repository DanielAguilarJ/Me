import { ShapeBuilder } from './util';

export interface TextLine {
  text: string;
  /** Rectángulo del elemento en pantalla (px CSS). */
  rect: { left: number; top: number; width: number; height: number };
  /** Fuente CSS completa, p. ej. `700 180px "Unbounded Variable"`. */
  font: string;
  letterSpacing?: string;
}

export interface ViewInfo {
  width: number;
  height: number;
  halfW: number;
  halfH: number;
}

/**
 * Convierte líneas de texto (posicionadas como en el DOM) en una nube de puntos
 * en el plano z = 0, para que las partículas formen el nombre justo donde
 * aparecerá el texto real.
 */
export function textShape(b: ShapeBuilder, lines: TextLine[], view: ViewInfo) {
  const { rng } = b;
  const scale = Math.min(1, 1100 / Math.max(view.width, 1));
  const cw = Math.max(2, Math.round(view.width * scale));
  const ch = Math.max(2, Math.round(view.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return b.finish();

  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  for (const line of lines) {
    const size = parseFloat(line.font.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? '100') * scale;
    ctx.font = line.font.replace(/(\d+(?:\.\d+)?)px/, `${size}px`);
    const anyCtx = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
    if (line.letterSpacing && line.letterSpacing !== 'normal' && 'letterSpacing' in anyCtx) {
      const v = parseFloat(line.letterSpacing);
      if (Number.isFinite(v)) {
        anyCtx.letterSpacing = line.letterSpacing.endsWith('em') ? `${v * size}px` : `${v * scale}px`;
      }
    }
    ctx.fillText(line.text, line.rect.left * scale, (line.rect.top + line.rect.height / 2) * scale);
  }

  const img = ctx.getImageData(0, 0, cw, ch).data;
  const filled: number[] = [];
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      if (img[(y * cw + x) * 4 + 3] > 120) filled.push(x, y);
    }
  }
  const count = filled.length / 2;
  if (count === 0) return b.finish();

  const n = b.count;
  for (let k = 0; k < n; k++) {
    const i = Math.floor(rng() * count);
    const px = (filled[i * 2] + rng()) / scale;
    const py = (filled[i * 2 + 1] + rng()) / scale;
    const ndcX = (px / view.width) * 2 - 1;
    const ndcY = 1 - (py / view.height) * 2;
    b.push(ndcX * view.halfW, ndcY * view.halfH, (rng() - 0.5) * 0.1, 0, rng());
  }
  return b.finish();
}
