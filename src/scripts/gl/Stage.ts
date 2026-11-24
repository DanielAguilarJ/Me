import * as THREE from 'three';
import {
  BloomEffect,
  EffectComposer,
  EffectPass,
  RenderPass,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from 'postprocessing';
import { Particles } from './Particles';

export type TierName = 'high' | 'medium' | 'mobile' | 'capture';

export interface Tier {
  name: TierName;
  texW: number;
  texH: number;
  dpr: number;
  bloom: boolean;
  bloomScale: number;
  size: number;
}

export const TIERS: Record<TierName, Tier> = {
  high: { name: 'high', texW: 256, texH: 256, dpr: 1.75, bloom: true, bloomScale: 0.6, size: 0.0155 },
  medium: { name: 'medium', texW: 256, texH: 160, dpr: 1.5, bloom: true, bloomScale: 0.5, size: 0.018 },
  mobile: { name: 'mobile', texW: 128, texH: 160, dpr: 1.5, bloom: true, bloomScale: 0.5, size: 0.022 },
  // Captura: hasta 2× para supermuestreo (scripts/render-images.mjs reduce después).
  capture: { name: 'capture', texW: 256, texH: 256, dpr: 2, bloom: true, bloomScale: 0.5, size: 0.0155 },
};

export const CAMERA_Z = 7;
export const FOV = 40;
export const HALF_H = Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * CAMERA_Z;

const backdropVert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const backdropFrag = /* glsl */ `
uniform vec3 uBase;
uniform vec3 uGlow;
uniform vec2 uCenter;
uniform float uAspect;
uniform float uStrength;
uniform float uTime;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 d = (vUv - uCenter) * vec2(uAspect, 1.0);
  float g = exp(-dot(d, d) * 3.2) * uStrength;
  vec3 c = uBase + uGlow * g;
  c += (hash(vUv * 731.0 + fract(uTime)) - 0.5) * 0.006;
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;

export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
  readonly group = new THREE.Group();
  readonly particles: Particles;
  readonly backdrop: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  composer: EffectComposer | null = null;
  bloom: BloomEffect | null = null;
  width = 1;
  height = 1;
  dpr = 1;
  private quality = 2;
  private frameTimes: number[] = [];
  private monitorFrom = 0;

  constructor(
    readonly canvas: HTMLCanvasElement,
    readonly tier: Tier,
    layers: number,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setClearColor(0x04060b, 1);
    this.renderer.toneMapping = THREE.NoToneMapping;

    this.camera.position.set(0, 0, CAMERA_Z);
    this.camera.lookAt(0, 0, 0);

    const bgGeo = new THREE.BufferGeometry();
    bgGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    this.backdrop = new THREE.Mesh(
      bgGeo,
      new THREE.ShaderMaterial({
        vertexShader: backdropVert,
        fragmentShader: backdropFrag,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          uBase: { value: new THREE.Color(0x04060b) },
          uGlow: { value: new THREE.Color(0x1f8fff) },
          uCenter: { value: new THREE.Vector2(0.65, 0.5) },
          uAspect: { value: 1 },
          uStrength: { value: 0.035 },
          uTime: { value: 0 },
        },
      }),
    );
    this.backdrop.frustumCulled = false;
    this.backdrop.renderOrder = -1;
    this.scene.add(this.backdrop);

    this.particles = new Particles({ texW: tier.texW, texH: tier.texH, layers, size: tier.size });
    this.group.add(this.particles.points);
    this.scene.add(this.group);

    if (tier.bloom) this.setupComposer();
    this.resize();
  }

  private setupComposer() {
    try {
      const composer = new EffectComposer(this.renderer, {
        frameBufferType: THREE.HalfFloatType,
        depthBuffer: false,
        stencilBuffer: false,
        multisampling: 0,
      });
      composer.addPass(new RenderPass(this.scene, this.camera));
      const bloom = new BloomEffect({
        intensity: 0.95,
        luminanceThreshold: 0.18,
        luminanceSmoothing: 0.3,
        mipmapBlur: true,
        radius: 0.62,
        levels: 6,
      });
      bloom.resolution.scale = this.tier.bloomScale;
      const tone = new ToneMappingEffect({ mode: ToneMappingMode.AGX });
      const vignette = new VignetteEffect({ darkness: 0.55, offset: 0.3 });
      composer.addPass(new EffectPass(this.camera, bloom, tone, vignette));
      this.composer = composer;
      this.bloom = bloom;
    } catch (err) {
      console.warn('[stage] postprocessing desactivado', err);
      this.composer = null;
      this.bloom = null;
    }
  }

  get aspect() {
    return this.width / Math.max(1, this.height);
  }

  get halfW() {
    return HALF_H * this.aspect;
  }

  resize() {
    const w = Math.max(1, this.canvas.clientWidth || window.innerWidth);
    const h = Math.max(1, this.canvas.clientHeight || window.innerHeight);
    this.width = w;
    this.height = h;
    const maxDpr = this.quality >= 2 ? this.tier.dpr : this.quality === 1 ? Math.min(1.25, this.tier.dpr) : 1;
    this.dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(w, h, false);
    this.composer?.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const u = this.particles.uniforms;
    u.uViewH.value = h * this.dpr;
    u.uAspect.value = w / h;
    this.backdrop.material.uniforms.uAspect.value = w / h;
  }

  /** Empieza a medir FPS (p. ej. al terminar la intro). */
  startMonitor(now: number, enabled = true) {
    if (!enabled) return;
    this.monitorFrom = now + 1500;
    this.frameTimes.length = 0;
  }

  private monitor(dt: number, now: number) {
    if (this.tier.name === 'capture' || this.monitorFrom === 0 || now < this.monitorFrom || this.quality === 0) return;
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 120) return;
    const sorted = [...this.frameTimes].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    this.frameTimes.length = 0;
    if (median > 1 / 42) this.degrade();
  }

  private degrade() {
    this.quality--;
    if (this.quality === 1) {
      if (this.bloom) this.bloom.resolution.scale = 0.4;
    } else if (this.quality === 0) {
      this.composer?.dispose();
      this.composer = null;
      this.bloom = null;
      this.renderer.toneMapping = THREE.AgXToneMapping;
      this.particles.material.needsUpdate = true;
      this.particles.setDrawFraction(0.7);
    }
    this.resize();
    console.info(`[stage] calidad reducida a ${this.quality}`);
  }

  render(dt: number, now: number) {
    this.monitor(dt, now);
    this.backdrop.material.uniforms.uTime.value = now;
    if (this.composer) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);
  }

  /** Convierte un punto local del grupo de partículas a píxeles CSS. */
  project(local: THREE.Vector3, out: THREE.Vector3) {
    out.copy(local).applyMatrix4(this.group.matrixWorld).project(this.camera);
    const visible = out.z < 1;
    out.x = (out.x * 0.5 + 0.5) * this.width;
    out.y = (-out.y * 0.5 + 0.5) * this.height;
    return visible;
  }
}
