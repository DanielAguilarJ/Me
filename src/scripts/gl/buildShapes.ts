import type { Particles } from './Particles';
import { Shape, type ShapeId } from './shapes/ids';
import { ShapeBuilder, mulberry32 } from './shapes/util';
import { globe } from './shapes/globe';
import { turbine } from './shapes/turbine';
import { network } from './shapes/network';
import { drop } from './shapes/drop';
import { fish } from './shapes/fish';
import { phone } from './shapes/phone';
import { specimen } from './shapes/specimen';
import { terrain } from './shapes/terrain';
import { galaxy, nebula, tunnel } from './shapes/space';
import { textShape, type TextLine, type ViewInfo } from './shapes/text';
import { nextFrame } from '../core/env';

type Generator = (b: ShapeBuilder) => Float32Array;

const CORE: [ShapeId, Generator][] = [
  [Shape.NEBULA, nebula],
  [Shape.GLOBE, globe],
  [Shape.TURBINE, turbine],
  [Shape.NETWORK, network],
  [Shape.DROP, drop],
  [Shape.FISH, fish],
  [Shape.PHONE, phone],
  [Shape.SPECIMEN, specimen],
  [Shape.TERRAIN, terrain],
  [Shape.TUNNEL, tunnel],
  [Shape.GALAXY, galaxy],
];

export const CORE_LAYERS = 12;
export const CAPTURE_LAYERS = 14;

const builder = (count: number, id: number) => new ShapeBuilder(count, mulberry32(1000 + id * 7919));

/** Genera todas las formas por capas, cediendo un frame entre cada una. */
export async function buildShapes(
  particles: Particles,
  opts: { extra: boolean; onProgress: (p: number) => void },
) {
  const list = [...CORE];
  if (opts.extra) {
    const extra = await import('./shapes/extra');
    list.push([Shape.GEARS, extra.gears], [Shape.BARS, extra.bars]);
  }
  for (let i = 0; i < list.length; i++) {
    const [id, gen] = list[i];
    particles.setShape(id, gen(builder(particles.count, id)));
    opts.onProgress((i + 1) / list.length);
    await nextFrame();
  }
}

/** Forma del nombre en partículas (depende de la posición del texto en pantalla). */
export function buildTextShape(particles: Particles, lines: TextLine[], view: ViewInfo) {
  particles.setShape(Shape.TEXT, textShape(builder(particles.count, Shape.TEXT), lines, view));
}
