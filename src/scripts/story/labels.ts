import * as THREE from 'three';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { SceneId } from '../../data/content';
import { GEO } from '../gl/shapes/ids';
import { cityPosition, type CityId } from '../gl/shapes/globe';
import { FIN_BOXES, FISH_BOX } from '../gl/shapes/fish';
import { PHONE_ANCHORS } from '../gl/shapes/phone';
import { SPECIMEN_ANCHORS } from '../gl/shapes/specimen';
import { terrainAnchors } from '../gl/shapes/terrain';
import { rotateX, rotateY, rotateZ, type Vec3 } from '../gl/shapes/util';
import type { Stage } from '../gl/Stage';
import { isPortrait, type Layout } from './scenes';

export interface AnchorCtx {
  time: number;
  motion: number;
  globeAngle: number;
}

interface LabelDef {
  key: string;
  scenes: SceneId[];
  /** Escenas en las que se muestra en vertical (por defecto, las mismas que `scenes`). */
  portrait?: SceneId[];
  /**
   * Las etiquetas normales van al lado del ancla que fija el CSS, cambian de lado si no caben
   * o si taparían un texto marcado con `data-gl-avoid`, y se separan si se enciman.
   * Las `fixed` (marcas pegadas a la forma, como las cajas de detección) nunca se mueven.
   */
  fixed?: boolean;
  anchor: (c: AnchorCtx) => Vec3 | null;
}

// Las transformaciones replican las del vertex shader para que las etiquetas
// queden pegadas a las partículas.
const globeT = (p: Vec3, c: AnchorCtx) => rotateX(rotateY(p, c.globeAngle), GEO.globeTilt);
const city = (id: CityId) => (c: AnchorCtx) => {
  const p = globeT(cityPosition(id, GEO.globeRadius * 1.02), c);
  return p[2] / Math.hypot(p[0], p[1], p[2]) > 0.12 ? p : null;
};
const turbineT = (p: Vec3, c: AnchorCtx) => rotateY(p, -0.35 + Math.sin(c.time * 0.2) * 0.12 * c.motion);
const fishT = (p: Vec3, c: AnchorCtx) => rotateY(p, Math.sin(c.time * 0.6) * 0.18 * c.motion);
const specimenT = (p: Vec3, c: AnchorCtx) => rotateY(p, -0.28 + Math.sin(c.time * 0.3) * 0.06 * c.motion);

// En vertical, el globo del inicio queda detrás de la cabecera y el del contacto es más
// ancho que la pantalla (las ciudades caen fuera o encima de los botones).
const CITY = { scenes: ['hero', 'contact'] as SceneId[], portrait: [] as SceneId[] };

const DEFS: LabelDef[] = [
  { key: 'ags', ...CITY, anchor: city('ags') },
  { key: 'chemnitz', ...CITY, anchor: city('chemnitz') },
  { key: 'novehrady', ...CITY, anchor: city('novehrady') },
  { key: 'ostrava', ...CITY, anchor: city('ostrava') },
  {
    key: 'power',
    scenes: ['about'],
    // En vertical la turbina es solo fondo atenuado detrás del texto.
    portrait: [],
    anchor: (c) => turbineT([GEO.hub[0] + 0.2, GEO.hub[1] + 0.14, GEO.hub[2]], c),
  },
  {
    key: 'sensor',
    scenes: ['aquaguard'],
    anchor: (c) => {
      const ang = c.time * 0.55 * c.motion;
      const q = rotateZ(rotateX([Math.cos(ang) * 1.45, 0, Math.sin(ang) * 1.45], 0.35), 0.2);
      return [q[0], q[1] + 0.25, q[2]];
    },
  },
  {
    key: 'fish',
    scenes: ['fins'],
    fixed: true,
    anchor: (c) => fishT([FISH_BOX.min[0], FISH_BOX.max[1], FISH_BOX.max[2]], c),
  },
  {
    key: 'dorsal',
    scenes: ['fins'],
    fixed: true,
    anchor: (c) => fishT([FIN_BOXES.dorsal.min[0], FIN_BOXES.dorsal.max[1], FIN_BOXES.dorsal.max[2]], c),
  },
  {
    // Abajo de su caja: arriba coincidiría con la etiqueta del pez completo.
    key: 'caudal',
    scenes: ['fins'],
    fixed: true,
    anchor: (c) => fishT([FIN_BOXES.caudal.min[0], FIN_BOXES.caudal.min[1], FIN_BOXES.caudal.max[2]], c),
  },
  {
    key: 'pectoral',
    scenes: ['fins'],
    fixed: true,
    anchor: (c) => fishT([FIN_BOXES.pectoral.min[0], FIN_BOXES.pectoral.min[1], FIN_BOXES.pectoral.max[2]], c),
  },
  { key: 'upload', scenes: ['fishapp'], anchor: () => PHONE_ANCHORS.upload },
  { key: 'match', scenes: ['fishapp'], anchor: () => PHONE_ANCHORS.match },
  { key: 'stressFormula', scenes: ['materials'], anchor: (c) => specimenT(SPECIMEN_ANCHORS.formula, c) },
  { key: 'strainAxis', scenes: ['materials'], anchor: (c) => specimenT(SPECIMEN_ANCHORS.strain, c) },
  { key: 'stressAxis', scenes: ['materials'], fixed: true, anchor: (c) => specimenT(SPECIMEN_ANCHORS.stress, c) },
  { key: 'poi', scenes: ['geospatial'], anchor: () => terrainAnchors().poi },
  {
    key: 'satellite',
    scenes: ['geospatial'],
    anchor: (c) => {
      const s = terrainAnchors().satellite;
      return [s[0] + Math.sin(c.time * 0.32 * c.motion) * 2.1, s[1], s[2]];
    },
  },
];

interface Rect {
  l: number;
  t: number;
  r: number;
  b: number;
}

/** Caja de la etiqueta respecto a su ancla, en el lado que fija el CSS (sin `.is-flip`). */
interface Box {
  dx: number;
  dy: number;
  w: number;
  h: number;
}

interface LabelItem {
  def: LabelDef;
  el: HTMLElement;
  shown: boolean;
  flipped: boolean;
  /** null = medir de nuevo (tras un cambio de tamaño). */
  box: Box | null;
  /** Última posición escrita en el transform; con ella se deduce la caja al medir. */
  tx: number;
  ty: number;
  // Estado del fotograma en curso.
  x: number;
  y: number;
  flip: boolean;
  nudge: number;
  alpha: number;
}

/** Margen con el borde, separación entre etiquetas apiladas e histéresis al cambiar de lado (px). */
const EDGE = 10;
const STACK = 4;
const HYST = 6;

const overlaps = (a: Rect, b: Rect, pad: number) =>
  a.l < b.r + pad && a.r > b.l - pad && a.t < b.b + pad && a.b > b.t - pad;

/** Etiquetas HTML ancladas a puntos 3D de cada escena. */
export class Labels {
  private items: LabelItem[] = [];
  private active: LabelItem[] = [];
  private movable: LabelItem[] = [];
  private v = new THREE.Vector3();
  private out = new THREE.Vector3();
  /**
   * Textos que las etiquetas no deben tapar, en coordenadas de documento (null = medir).
   * Solo sirve para elementos que se desplazan con la página, no para capas fijas.
   */
  private avoidEls: HTMLElement[];
  private avoid: Rect[] | null = null;
  private scrollY = 0;

  constructor(
    root: HTMLElement | null,
    private stage: Stage,
  ) {
    this.avoidEls = Array.from(document.querySelectorAll<HTMLElement>('[data-gl-avoid]'));
    if (!root) return;
    for (const def of DEFS) {
      const el = root.querySelector<HTMLElement>(`[data-gl-label="${def.key}"]`);
      if (!el) continue;
      this.items.push({ def, el, shown: false, flipped: false, box: null, tx: 0, ty: 0, x: 0, y: 0, flip: false, nudge: 0, alpha: 0 });
    }
    // Los textos cambian de sitio si el layout se recalcula o si una fuente llega tarde.
    ScrollTrigger.addEventListener('refresh', () => (this.avoid = null));
    document.fonts.ready.then(() => this.resize());
  }

  /** Tras un cambio de tamaño, las etiquetas y los textos se vuelven a medir. */
  resize() {
    for (const item of this.items) item.box = null;
    this.avoid = null;
  }

  /** Mide la caja de la etiqueta. Fuerza un cálculo de layout, así que solo se hace tras resize. */
  private measure(item: LabelItem): Box {
    const r = item.el.getBoundingClientRect();
    const dx = r.left - item.tx;
    // Al voltear, el CSS refleja la caja respecto al ancla: dx' = -dx - w.
    return { dx: item.flipped ? -dx - r.width : dx, dy: r.top - item.ty, w: r.width, h: r.height };
  }

  private measureAvoid(): Rect[] {
    const range = document.createRange();
    const sy = window.scrollY;
    const rects: Rect[] = [];
    for (const el of this.avoidEls) {
      // El contenido y no la caja: un bloque ocupa todo el ancho aunque su texto sea corto.
      range.selectNodeContents(el);
      const r = range.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) rects.push({ l: r.left, t: r.top + sy, r: r.right, b: r.bottom + sy });
    }
    return rects;
  }

  private rect(item: LabelItem, flip: boolean, nudge: number): Rect {
    const b = item.box!;
    const l = item.x + (flip ? -b.dx - b.w : b.dx);
    const t = item.y + b.dy + nudge;
    return { l, t, r: l + b.w, b: t + b.h };
  }

  private blocked(r: Rect, pad: number) {
    for (const a of this.avoid!) {
      const top = a.t - this.scrollY;
      const bottom = a.b - this.scrollY;
      if (r.l < a.r + pad && r.r > a.l - pad && r.t < bottom + pad && r.b > top - pad) return true;
    }
    return false;
  }

  /** ¿Cabe la etiqueta en ese lado sin tapar texto? Cambiar de lado exige un margen extra. */
  private free(item: LabelItem, flip: boolean) {
    const pad = flip === item.flipped ? 0 : HYST;
    const r = this.rect(item, flip, 0);
    return r.l >= EDGE + pad && r.r <= this.stage.width - EDGE - pad && !this.blocked(r, pad);
  }

  /** Empuja hacia abajo las etiquetas que se enciman (p. ej. las tres ciudades de Europa). */
  private unstack() {
    const list = this.movable;
    list.sort((a, b) => a.y + a.box!.dy - (b.y + b.box!.dy));
    for (let i = 1; i < list.length; i++) {
      const a = list[i];
      for (let pass = 0; pass < list.length; pass++) {
        const ra = this.rect(a, a.flip, a.nudge);
        let moved = false;
        for (let j = 0; j < i && !moved; j++) {
          const b = list[j];
          const rb = this.rect(b, b.flip, b.nudge);
          if (overlaps(ra, rb, STACK)) {
            a.nudge += rb.b + STACK - ra.t;
            moved = true;
          }
        }
        if (!moved) break;
      }
      if (a.nudge > 0 && this.blocked(this.rect(a, a.flip, a.nudge), 0)) a.alpha = 0;
    }
  }

  update(ids: SceneId[], layouts: Layout[], iA: number, iB: number, t: number, ctx: AnchorCtx, introMix: number) {
    const portrait = isPortrait(this.stage.aspect);
    this.active.length = 0;
    this.movable.length = 0;
    this.scrollY = window.scrollY;

    // 1. Lecturas: posición de cada ancla en pantalla y lado de cada etiqueta.
    for (const item of this.items) {
      let weight = 0;
      let layoutIndex = -1;
      const scenes = portrait ? (item.def.portrait ?? item.def.scenes) : item.def.scenes;
      for (const scene of scenes) {
        const idx = ids.indexOf(scene);
        if (idx < 0) continue;
        const w = idx === iA ? 1 - t : idx === iB ? t : 0;
        if (w > weight) {
          weight = w;
          layoutIndex = idx;
        }
      }
      weight *= Math.max(0, (introMix - 0.85) / 0.15);
      const visible = weight > 0.55 && layoutIndex >= 0;
      const p = visible ? item.def.anchor(ctx) : null;
      if (!p) {
        if (item.shown) {
          item.el.style.opacity = '0';
          item.shown = false;
        }
        continue;
      }
      const L = layouts[layoutIndex];
      let q = rotateX(p, L.rotX);
      q = rotateY(q, L.rotY);
      this.v.set(q[0] * L.scale + L.offset[0], q[1] * L.scale + L.offset[1], q[2] * L.scale + L.offset[2]);
      const onScreen = this.stage.project(this.v, this.out);
      const x = this.out.x;
      const y = this.out.y;
      // El ancla debe estar en pantalla: una etiqueta que apunta fuera no tiene sentido.
      const inside = onScreen && x >= EDGE && y >= EDGE && x <= this.stage.width - EDGE && y <= this.stage.height - EDGE;
      item.x = x;
      item.y = y;
      item.nudge = 0;
      item.flip = item.flipped;
      item.alpha = inside ? Math.min(1, (weight - 0.55) / 0.3) : 0;
      this.active.push(item);
      if (item.def.fixed || item.alpha === 0) continue;

      item.box ??= this.measure(item);
      this.avoid ??= this.measureAvoid();
      if (this.free(item, false)) item.flip = false;
      else if (this.free(item, true)) item.flip = true;
      // Ningún lado está libre: se desvanece donde está.
      else item.alpha = 0;
      if (item.alpha > 0) this.movable.push(item);
    }

    this.unstack();

    // 2. Escrituras.
    for (const item of this.active) {
      if (item.flip !== item.flipped) {
        item.el.classList.toggle('is-flip', item.flip);
        item.flipped = item.flip;
      }
      item.tx = Math.round(item.x * 10) / 10;
      item.ty = Math.round((item.y + item.nudge) * 10) / 10;
      item.el.style.transform = `translate3d(${item.tx}px, ${item.ty}px, 0)`;
      item.el.style.opacity = String(item.alpha);
      item.shown = true;
    }
  }
}
