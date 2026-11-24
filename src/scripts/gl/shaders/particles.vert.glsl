precision highp float;
precision highp int;
precision highp sampler2DArray;

uniform sampler2DArray uShapes;
uniform int uTexW;

uniform int uShapeA;
uniform int uShapeB;
uniform float uMorph;
uniform vec4 uLayoutA; // offset.xyz, scale
uniform vec4 uLayoutB;
uniform vec4 uOrientA; // rotX, rotY, dim, -
uniform vec4 uOrientB;

uniform int uIntroFrom;
uniform int uIntroTo;
uniform float uIntroT;
uniform float uIntroMix;

uniform float uTime;
uniform float uMotion;
uniform float uSize;
uniform float uViewH;
uniform float uFovScale;
uniform float uAspect;
uniform float uBright;

uniform vec2 uMouse;
uniform float uMouseForce;
uniform vec3 uClick;
uniform float uScatter;

uniform float uGlobeAngle;
uniform float uTunnel;
uniform float uTest;

varying vec3 vColor;
varying float vAlpha;

#define PI 3.14159265
#define TAU 6.28318531

// Paleta en espacio lineal (aqua #4ff0d8, sky #48a8ff, solar #ffb54a, coral #ff6f59, violet #9b8cff, ice #eaf6ff)
const vec3 AQUA = vec3(0.078, 0.871, 0.687);
const vec3 SKY = vec3(0.065, 0.392, 1.0);
const vec3 SOLAR = vec3(1.0, 0.462, 0.064);
const vec3 CORAL = vec3(1.0, 0.159, 0.1);
const vec3 VIOLET = vec3(0.328, 0.262, 1.0);
const vec3 ICE = vec3(0.823, 0.922, 1.0);
const vec3 DEEP = vec3(0.011, 0.042, 0.147);

#include <noise>

vec3 rotX(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(p.x, c * p.y - s * p.z, s * p.y + c * p.z); }
vec3 rotY(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z); }
vec3 rotZ(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(c * p.x - s * p.y, s * p.x + c * p.y, p.z); }

vec3 heat(float t) {
  vec3 c = mix(SKY, AQUA, smoothstep(0.0, 0.35, t));
  c = mix(c, SOLAR, smoothstep(0.35, 0.7, t));
  return mix(c, CORAL, smoothstep(0.7, 1.0, t));
}

vec4 fetchShape(int layer, int id) {
  return texelFetch(uShapes, ivec3(id % uTexW, id / uTexW, layer), 0);
}

vec3 applyLayout(vec3 p, vec4 lay, vec4 orient) {
  p = rotX(p, orient.x);
  p = rotY(p, orient.y);
  return p * lay.w + lay.xyz;
}

struct Sample {
  vec3 pos;
  vec3 col;
  float a;
  float s;
};

Sample evalShape(int id, vec4 d, vec3 rnd) {
  vec3 p = d.xyz;
  float type = floor(d.w + 0.0005);
  float prm = clamp(d.w - type, 0.0, 1.0);
  float T = uTime;
  float M = uMotion;
  float tw = 0.72 + 0.28 * sin(T * (0.8 + rnd.y * 2.2) + rnd.z * TAU);
  vec3 col = ICE;
  float a = 1.0;
  float s = 1.0;

  if (id == S_NEBULA) {
    p += 0.18 * M * vec3(sin(T * 0.21 + rnd.x * TAU), cos(T * 0.17 + rnd.y * TAU), sin(T * 0.13 + rnd.z * TAU));
    col = mix(VIOLET, SKY, rnd.x) * 0.7;
    a = 0.45 * tw;
    s = 1.1;
  } else if (id == S_TEXT) {
    col = mix(ICE, AQUA, rnd.x * 0.7);
    a = 0.85;
    s = 0.72;
  } else if (id == S_GLOBE) {
    if (type < 0.5) {
      col = mix(AQUA, ICE, prm * 0.55);
      a = 0.8 * tw;
      s = 0.9;
    } else if (type < 1.5) {
      col = mix(DEEP * 3.0, SKY * 0.35, prm);
      a = 0.45;
      s = 0.7;
    } else if (type < 2.5) {
      col = SKY * 0.6;
      a = 0.3 * (1.0 - prm) * tw;
      s = 0.75;
    } else if (type < 5.5) {
      float k = type - 3.0;
      float head = fract(T * 0.2 * M + k * 0.31);
      float dt = head - prm;
      float comet = dt >= 0.0 ? exp(-dt * 9.0) : 0.0;
      col = mix(SOLAR, ICE, comet * 0.6);
      a = 0.22 + 1.3 * comet;
      s = 0.8 + comet * 0.9;
    } else if (type < 6.5) {
      col = SOLAR;
      a = 1.0;
      s = 1.4;
    } else {
      vec3 n = normalize(p);
      vec3 t1 = normalize(cross(n, vec3(0.0, 1.0, 0.0)));
      vec3 t2 = cross(n, t1);
      float ang = prm * TAU;
      float ph = fract(T * 0.45 + step(0.5, rnd.z) * 0.5);
      p += (cos(ang) * t1 + sin(ang) * t2) * (0.025 + ph * 0.17);
      col = SOLAR;
      a = (1.0 - ph) * 0.95;
      s = 0.85;
    }
    p = rotY(p, uGlobeAngle);
    p = rotX(p, GLOBE_TILT);
    float facing = p.z / max(length(p), 0.0001);
    a *= mix(0.25, 1.0, smoothstep(-0.55, 0.35, facing));
  } else if (id == S_TURBINE) {
    if (type < 0.5) {
      col = mix(ICE * 0.75, SKY, 0.25 + prm * 0.3);
      a = 0.7;
      s = 0.8;
    } else if (type < 1.5) {
      col = ICE;
      a = 1.0;
      s = 1.0;
    } else if (type < 2.5) {
      vec3 rel = rotZ(p - HUB, -T * 0.9 * M);
      p = HUB + rel;
      col = mix(ICE, SOLAR, smoothstep(0.1, 1.0, prm));
      a = 0.85;
      s = 0.85;
    } else if (type < 3.5) {
      float speed = 0.55 + rnd.x * 0.5;
      p.x = mod(p.x + 2.4 + T * speed * M, 4.8) - 2.4;
      p.y += sin(p.x * 1.4 + T * 0.8 + p.z * 2.0) * 0.07;
      float edge = smoothstep(2.4, 1.4, abs(p.x));
      col = mix(AQUA, SKY, rnd.y);
      a = 0.32 * edge * tw;
      s = 0.7;
    } else {
      col = SKY * 0.7;
      a = 0.35 * (1.0 - prm * 0.6);
      s = 0.7;
    }
    p = rotY(p, -0.35 + sin(T * 0.2) * 0.12 * M);
  } else if (id == S_NETWORK) {
    float front = mod(T * 0.9 * M, 6.4) - 3.2;
    float pulse = exp(-pow((p.x - front) * 2.2, 2.0));
    if (type < 0.5) {
      col = mix(VIOLET, AQUA, prm);
      a = 0.75 + pulse * 0.8;
      s = 1.0 + pulse * 0.5;
    } else {
      col = mix(VIOLET * 0.85, ICE, pulse);
      a = 0.14 + pulse * 0.85;
      s = 0.7;
    }
    p = rotY(p, sin(T * 0.25) * 0.5 * M);
  } else if (id == S_DROP) {
    if (type < 0.5) {
      p *= 1.0 + 0.012 * sin(T * 2.0 + p.y * 4.0) * M;
      col = mix(SKY, AQUA, smoothstep(0.0, 1.0, prm));
      a = 0.75 * tw;
      s = 0.85;
    } else if (type < 1.5) {
      col = AQUA * 0.55;
      a = 0.3 * tw;
      s = 0.7;
    } else if (type < 2.5) {
      float r = prm * RIPPLE_MAX + fract(T * 0.22 * M) * RIPPLE_SPACING;
      float ang = atan(p.z, p.x);
      p.x = cos(ang) * r;
      p.z = sin(ang) * r;
      p.y += sin(r * 5.0 - T * 2.2) * 0.05 * exp(-r * 0.6) * M;
      float fade = smoothstep(RIPPLE_MAX + 0.1, RIPPLE_MAX - 0.9, r) * smoothstep(0.2, 0.55, r);
      col = mix(AQUA, SKY, r / RIPPLE_MAX);
      a = 0.55 * fade;
      s = 0.75;
    } else {
      float ang = prm * TAU + T * 0.55 * M;
      vec3 q = vec3(cos(ang) * 1.45, 0.0, sin(ang) * 1.45);
      q = rotZ(rotX(q, 0.35), 0.2);
      p = q + vec3(0.0, 0.25, 0.0) + (rnd - 0.5) * 0.02;
      float node = pow(0.5 + 0.5 * cos(prm * TAU * 3.0), 60.0);
      col = mix(SKY, SOLAR, node);
      a = 0.22 + node * 1.2;
      s = 0.7 + node * 1.6;
    }
  } else if (id == S_FISH) {
    if (type < 5.5) {
      float amp = 0.11 * smoothstep(0.9, -2.0, p.x) * M;
      p.z += sin(p.x * 2.3 - T * 4.2) * amp;
      p.y += sin(T * 1.3) * 0.03 * M;
      float sweep = exp(-pow((p.x - (mod(T * 1.1, 6.0) - 3.0)) * 3.0, 2.0));
      a = 1.0 + sweep * 0.45;
    }
    if (type < 0.5) {
      col = mix(AQUA, SKY, rnd.x * 0.45);
      a *= 0.55 * tw;
      s = 0.8;
    } else if (type < 1.5) {
      col = SOLAR;
      a *= 0.75;
      s = 0.85;
    } else if (type < 2.5) {
      col = CORAL;
      a *= 0.75;
      s = 0.85;
    } else if (type < 3.5) {
      col = VIOLET;
      a *= 0.85;
      s = 0.85;
    } else if (type < 4.5) {
      col = SKY;
      a *= 0.8;
      s = 0.85;
    } else if (type < 5.5) {
      col = ICE;
      s = 1.0;
    } else if (type < 6.5) {
      col = ICE;
      a = 0.9;
      s = 0.8;
    } else if (type < 7.5) {
      col = ICE;
      a = 0.13;
      s = 0.6;
    } else {
      col = prm < 0.2 ? SOLAR : (prm < 0.6 ? CORAL : VIOLET);
      a = 0.85;
      s = 0.75;
    }
    p = rotY(p, sin(T * 0.6) * 0.18 * M);
  } else if (id == S_PHONE) {
    float scanY = sin(T * 1.1) * 1.05 + 0.05;
    float scan = exp(-pow((p.y - scanY) * 9.0, 2.0));
    if (type < 0.5) {
      col = ICE * 0.85;
      a = 0.65;
      s = 0.8;
    } else if (type < 1.5) {
      col = SKY * 0.55;
      a = 0.2 + scan * 0.9;
      s = 0.6;
    } else if (type < 2.5) {
      col = mix(AQUA, ICE, scan);
      a = 0.8 + scan * 0.8;
      s = 0.85;
    } else if (type < 3.5) {
      col = mix(AQUA, ICE, 0.45);
      a = 0.7;
      s = 0.7;
    } else if (type < 4.5) {
      col = mix(SKY, VIOLET, 0.5) * 0.85;
      a = 0.42;
      s = 0.75;
    } else if (type < 5.5) {
      float blink = step(0.45, fract(T * (0.6 + rnd.x * 1.4) + prm * 3.7));
      col = mix(AQUA, SOLAR, step(0.66, prm));
      a = 0.25 + blink * 1.1;
      s = 1.05;
    } else {
      float pk = pow(fract(prm * 3.0 - T * 0.55 * M), 10.0);
      col = type < 6.5 ? mix(AQUA, ICE, pk) : mix(SOLAR, ICE, pk);
      a = 0.18 + pk * 1.3;
      s = 0.7 + pk * 0.9;
    }
  } else if (id == S_SPECIMEN) {
    float strain = uTest * 0.22;
    if (type < 1.5) {
      float yy = p.y;
      p.y = yy + clamp(yy, -0.7, 0.7) * strain;
      if (type < 0.5) {
        p.x = SPEC_X + (p.x - SPEC_X) * (1.0 - 0.45 * strain * exp(-yy * yy * 5.0));
        col = heat(clamp(prm * (0.3 + uTest * 0.85), 0.0, 1.0));
        a = 0.75;
        s = 0.8;
      } else {
        col = ICE * 0.55;
        a = 0.42;
        s = 0.75;
      }
    } else if (type < 2.5) {
      col = ICE * 0.4;
      a = 0.28;
      s = 0.65;
    } else if (type < 3.5) {
      float vis = 1.0 - smoothstep(uTest - 0.01, uTest + 0.004, prm);
      float head = exp(-pow((prm - uTest) * 45.0, 2.0)) * step(0.005, uTest);
      col = mix(SOLAR, ICE, head);
      a = 0.05 + vis * 0.85 + head * 1.2;
      s = 0.8 + head;
    } else {
      col = ICE * 0.65;
      a = 0.35;
      s = 0.6;
    }
    p = rotY(p, -0.28 + sin(T * 0.3) * 0.06 * M);
  } else if (id == S_TERRAIN) {
    float satX = sin(T * 0.32 * M) * 2.1;
    if (type < 0.5) {
      float f = fract(prm * 9.0);
      float line = 1.0 - smoothstep(0.0, 0.09, min(f, 1.0 - f));
      float band = exp(-pow((p.x - satX) / 0.5, 2.0));
      col = mix(SKY * 0.35, AQUA, smoothstep(0.15, 0.95, prm));
      col = mix(col, ICE, line * 0.55 + band * 0.35);
      a = 0.3 + line * 0.45 + band * 0.45;
      s = 0.72;
    } else if (type < 1.5) {
      col = SOLAR * 0.85;
      a = 0.55;
      s = 0.6;
    } else if (type < 2.5) {
      col = SOLAR;
      a = 1.0;
      s = 1.15;
    } else if (type < 3.5) {
      col = SOLAR * 0.7;
      a = 0.5;
      s = 0.6;
    } else if (type < 4.5) {
      p.x += satX;
      col = ICE;
      a = 0.95;
      s = 0.9;
    } else {
      p.x += satX;
      col = AQUA;
      a = 0.1 + 0.12 * (0.5 + 0.5 * sin(prm * 30.0 - T * 6.0));
      s = 0.6;
    }
  } else if (id == S_TUNNEL) {
    p.z = mod(p.z - TUNNEL_START + uTunnel, TUNNEL_LEN) + TUNNEL_START;
    float near = smoothstep(6.6, 3.5, p.z) * smoothstep(TUNNEL_START, TUNNEL_START + 8.0, p.z);
    if (type < 0.5) {
      col = mix(SKY, VIOLET, rnd.x);
      a = 0.5 * near * tw;
      s = 0.8;
    } else if (type < 1.5) {
      col = mix(SOLAR, CORAL, rnd.y);
      a = 0.85 * near;
      s = 1.0;
    } else {
      col = mix(AQUA, ICE, 0.3);
      a = 0.45 * near;
      s = 0.75;
    }
    p = rotZ(p, p.z * 0.03 + T * 0.05 * M);
  } else if (id == S_GALAXY) {
    float r = length(p.xz);
    p = rotY(p, T * 0.06 * M / (0.25 + r * 0.35));
    if (type < 0.5) {
      col = mix(mix(SOLAR, AQUA, smoothstep(0.0, 0.35, prm)), VIOLET, smoothstep(0.35, 1.0, prm));
      a = 0.65 * tw;
      s = 0.8;
    } else if (type < 1.5) {
      col = mix(ICE, SOLAR, rnd.x * 0.6);
      a = 0.75;
      s = 0.9;
    } else {
      col = SKY * 0.55;
      a = 0.22 * tw;
      s = 0.6;
    }
    p = rotZ(rotX(p, 0.95), 0.25);
  } else if (id == S_GEARS) {
    col = type < 0.5 ? SOLAR : (type < 1.5 ? AQUA : VIOLET);
    a = 0.7;
    s = 0.8;
  } else if (id >= S_SOLAR) {
    // Imágenes de los productos: el tipo elige el color y prm el brillo (6 = mapa de calor).
    float lit = 0.35 + 0.9 * prm;
    if (type < 0.5) {
      col = ICE * 0.8;
      a = 0.5 * lit;
      s = 0.7;
    } else if (type < 1.5) {
      col = AQUA;
      a = 0.8 * lit;
      s = 0.85;
    } else if (type < 2.5) {
      col = SKY;
      a = 0.75 * lit;
      s = 0.8;
    } else if (type < 3.5) {
      col = SOLAR;
      a = 0.9 * lit;
      s = 0.75 + 0.35 * prm;
    } else if (type < 4.5) {
      col = CORAL;
      a = 0.85 * lit;
      s = 0.85;
    } else if (type < 5.5) {
      col = VIOLET;
      a = 0.8 * lit;
      s = 0.85;
    } else if (type < 6.5) {
      col = heat(prm);
      a = 0.28 + 0.7 * prm;
      s = 0.72 + 0.2 * prm;
    } else {
      col = mix(SKY, VIOLET, prm) * 0.4;
      a = 0.2 * tw;
      s = 0.6;
    }
  } else {
    if (type < 0.5) {
      col = mix(SKY, AQUA, prm);
      a = 0.7;
      s = 0.8;
    } else if (type < 1.5) {
      col = SOLAR;
      a = 0.9;
      s = 0.8;
    } else {
      col = SKY * 0.45;
      a = 0.25;
      s = 0.6;
    }
  }

  Sample o;
  o.pos = p;
  o.col = col;
  o.a = a;
  o.s = s;
  return o;
}

void main() {
  int vid = gl_VertexID;
  vec3 rnd = position;
  float delay = rnd.x * 0.4;

  Sample A = evalShape(uShapeA, fetchShape(uShapeA, vid), rnd);
  vec3 pos = applyLayout(A.pos, uLayoutA, uOrientA);
  vec3 col = A.col;
  float alpha = A.a * uOrientA.z;
  float size = A.s;
  float trans = 0.0;

  if (uMorph > 0.0005) {
    Sample B = evalShape(uShapeB, fetchShape(uShapeB, vid), rnd);
    vec3 posB = applyLayout(B.pos, uLayoutB, uOrientB);
    float t = smoothstep(delay, delay + 0.6, uMorph);
    pos = mix(pos, posB, t);
    col = mix(col, B.col, t);
    alpha = mix(alpha, B.a * uOrientB.z, t);
    size = mix(size, B.s, t);
    trans = sin(t * PI);
  }

  if (uIntroMix < 0.9995) {
    Sample I0 = evalShape(uIntroFrom, fetchShape(uIntroFrom, vid), rnd);
    Sample I1 = evalShape(uIntroTo, fetchShape(uIntroTo, vid), rnd);
    float ti = smoothstep(delay, delay + 0.6, uIntroT);
    float tm = smoothstep(delay, delay + 0.6, uIntroMix);
    pos = mix(mix(I0.pos, I1.pos, ti), pos, tm);
    col = mix(mix(I0.col, I1.col, ti), col, tm);
    alpha = mix(mix(I0.a, I1.a, ti), alpha, tm);
    size = mix(mix(I0.s, I1.s, ti), size, tm);
    trans = max(trans, max(sin(ti * PI) * (1.0 - tm), sin(tm * PI)));
  }

  if (trans > 0.001) {
    vec3 q = pos * 0.42 + vec3(0.0, uTime * 0.12, 0.0);
    vec3 n = vec3(snoise(q), snoise(q + vec3(31.4, 0.0, 0.0)), snoise(q + vec3(0.0, 0.0, 17.7)));
    pos += n * trans * 0.85 * uMotion;
  }

  pos += (rnd - 0.5) * uScatter;
  pos += 0.012 * uMotion * vec3(
    sin(uTime * 0.9 + rnd.x * TAU),
    cos(uTime * 0.8 + rnd.y * TAU),
    sin(uTime * 0.7 + rnd.z * TAU)
  );

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  float depth = -mv.z;
  vec4 clip = projectionMatrix * mv;
  vec2 ndc = clip.xy / max(clip.w, 0.0001);
  vec2 diff = (ndc - uMouse) * vec2(uAspect, 1.0);
  float dist = length(diff);
  vec2 dir = diff / max(dist, 0.0001);
  float force = (1.0 - smoothstep(0.0, 0.32, dist)) * uMouseForce;
  mv.xy += dir * force * 0.38 * (depth / 7.0);
  float glow = force * 0.6;

  float ct = uTime - uClick.z;
  if (ct > 0.0 && ct < 2.2) {
    float ring = ct * 1.35;
    float sw = (1.0 - smoothstep(0.0, 0.14, abs(dist - ring))) * (1.0 - ct / 2.2);
    mv.xy += dir * sw * 0.32 * (depth / 7.0);
    glow += sw * 1.2;
  }

  gl_Position = projectionMatrix * mv;
  float px = uSize * size * (0.55 + rnd.y * 0.9) * uViewH / (uFovScale * max(depth, 0.3));
  gl_PointSize = clamp(px, 0.0, 48.0);
  vColor = col * (1.0 + glow) * uBright;
  vAlpha = clamp(alpha, 0.0, 2.0);

  if (vAlpha < 0.002 || depth < 0.05) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
  }
}
