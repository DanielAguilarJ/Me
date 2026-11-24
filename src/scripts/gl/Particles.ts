import * as THREE from 'three';
import vertexSrc from './shaders/particles.vert.glsl?raw';
import fragmentSrc from './shaders/particles.frag.glsl?raw';
import noiseSrc from './shaders/noise.glsl?raw';
import { shaderDefines, type ShapeId } from './shapes/ids';
import { RIPPLE_MAX, RIPPLE_SPACING } from './shapes/drop';
import { TUNNEL_LEN, TUNNEL_START } from './shapes/space';
import { mulberry32 } from './shapes/util';

export interface ParticlesOptions {
  texW: number;
  texH: number;
  layers: number;
  size: number;
}

export type ParticleUniforms = {
  uShapes: { value: THREE.DataArrayTexture };
  uTexW: { value: number };
  uShapeA: { value: number };
  uShapeB: { value: number };
  uMorph: { value: number };
  uLayoutA: { value: THREE.Vector4 };
  uLayoutB: { value: THREE.Vector4 };
  uOrientA: { value: THREE.Vector4 };
  uOrientB: { value: THREE.Vector4 };
  uIntroFrom: { value: number };
  uIntroTo: { value: number };
  uIntroT: { value: number };
  uIntroMix: { value: number };
  uTime: { value: number };
  uMotion: { value: number };
  uSize: { value: number };
  uViewH: { value: number };
  uFovScale: { value: number };
  uAspect: { value: number };
  uBright: { value: number };
  uMouse: { value: THREE.Vector2 };
  uMouseForce: { value: number };
  uClick: { value: THREE.Vector3 };
  uScatter: { value: number };
  uGlobeAngle: { value: number };
  uTunnel: { value: number };
  uTest: { value: number };
};

/**
 * Sistema de partículas único: todas las formas viven en un DataArrayTexture
 * (una capa por forma) y el vertex shader interpola entre dos de ellas.
 */
export class Particles {
  readonly count: number;
  readonly texture: THREE.DataArrayTexture;
  readonly material: THREE.ShaderMaterial;
  readonly points: THREE.Points;
  readonly uniforms: ParticleUniforms;
  private readonly data: Float32Array;

  constructor(opts: ParticlesOptions) {
    this.count = opts.texW * opts.texH;
    this.data = new Float32Array(this.count * 4 * opts.layers);

    const tex = new THREE.DataArrayTexture(this.data, opts.texW, opts.texH, opts.layers);
    tex.format = THREE.RGBAFormat;
    tex.type = THREE.FloatType;
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.unpackAlignment = 1;
    this.texture = tex;

    const rng = mulberry32(42);
    const seeds = new Float32Array(this.count * 3);
    for (let i = 0; i < seeds.length; i++) seeds[i] = rng();
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(seeds, 3));

    this.uniforms = {
      uShapes: { value: tex },
      uTexW: { value: opts.texW },
      uShapeA: { value: 0 },
      uShapeB: { value: 0 },
      uMorph: { value: 0 },
      uLayoutA: { value: new THREE.Vector4(0, 0, 0, 1) },
      uLayoutB: { value: new THREE.Vector4(0, 0, 0, 1) },
      uOrientA: { value: new THREE.Vector4(0, 0, 1, 0) },
      uOrientB: { value: new THREE.Vector4(0, 0, 1, 0) },
      uIntroFrom: { value: 0 },
      uIntroTo: { value: 0 },
      uIntroT: { value: 0 },
      uIntroMix: { value: 1 },
      uTime: { value: 0 },
      uMotion: { value: 1 },
      uSize: { value: opts.size },
      uViewH: { value: 1000 },
      uFovScale: { value: 2 * Math.tan(THREE.MathUtils.degToRad(20)) },
      uAspect: { value: 1 },
      uBright: { value: 1 },
      uMouse: { value: new THREE.Vector2(9, 9) },
      uMouseForce: { value: 0 },
      uClick: { value: new THREE.Vector3(0, 0, -100) },
      uScatter: { value: 0 },
      uGlobeAngle: { value: 0.76 },
      uTunnel: { value: 0 },
      uTest: { value: 0 },
    };

    const defines = {
      ...shaderDefines(),
      RIPPLE_MAX: RIPPLE_MAX.toFixed(4),
      RIPPLE_SPACING: RIPPLE_SPACING.toFixed(4),
      TUNNEL_START: TUNNEL_START.toFixed(4),
      TUNNEL_LEN: TUNNEL_LEN.toFixed(4),
    };

    // three.js compila ShaderMaterial como GLSL ES 3.0 en WebGL2, así que
    // texelFetch, sampler2DArray y gl_VertexID están disponibles.
    this.material = new THREE.ShaderMaterial({
      vertexShader: vertexSrc.replace('#include <noise>', noiseSrc),
      fragmentShader: fragmentSrc,
      uniforms: this.uniforms as unknown as Record<string, THREE.IUniform>,
      defines,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(geometry, this.material);
    this.points.frustumCulled = false;
  }

  setShape(layer: ShapeId, shape: Float32Array) {
    this.data.set(shape.subarray(0, this.count * 4), layer * this.count * 4);
  }

  /** Sube la textura completa (antes del primer render). */
  commit() {
    this.texture.needsUpdate = true;
  }

  /** Actualiza una sola capa después de la subida inicial. */
  updateLayer(layer: ShapeId) {
    this.texture.addLayerUpdate(layer);
    this.texture.needsUpdate = true;
  }

  setDrawFraction(f: number) {
    this.points.geometry.setDrawRange(0, Math.floor(this.count * Math.min(1, Math.max(0.1, f))));
  }

  dispose() {
    this.points.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
  }
}
