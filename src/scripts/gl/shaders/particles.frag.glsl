precision highp float;

varying vec3 vColor;
varying float vAlpha;

void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  float soft = 1.0 - smoothstep(0.0, 0.5, d);
  float core = 1.0 - smoothstep(0.0, 0.18, d);
  float a = (soft * soft * 0.85 + core * 0.45) * vAlpha;
  gl_FragColor = vec4(vColor, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
