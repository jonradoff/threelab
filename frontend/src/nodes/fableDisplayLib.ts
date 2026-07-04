// ═══════════════════════════════════════════════════════════════════════════
// FABLE DISPLAY LIB — shared GLSL + JS snippets for the Fable pattern family
//
// GLSL: cinematic display helpers (ACES tone mapping, film grain, vignette,
// chromatic aberration offsets, IQ cosine palettes, hash).
// JS: palette table + hsv conversion source, concatenated into evaluateSource
// strings (evaluate functions are compiled from source and cannot import).
// ═══════════════════════════════════════════════════════════════════════════

/** GLSL helper functions — prepend inside display fragment shaders (after uniforms). */
export const FABLE_GLSL_LIB = `
float fableHash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

// ACES filmic tone mapping (Narkowicz approximation)
vec3 fableACES(vec3 x) {
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

// IQ cosine palette
vec3 fablePal(float t, vec3 pa, vec3 pb, vec3 pc, vec3 pd) {
  return pa + pb * cos(6.28318 * (pc * t + pd));
}

// Film grain + vignette + subtle lift, applied as the final grade.
// suv: centered aspect-corrected coords, grain/vig: strengths 0..1
vec3 fableGrade(vec3 col, vec2 uv, vec2 suv, vec2 res, float grain, float vig) {
  col *= 1.0 - vig * smoothstep(0.35, 0.9, length(suv));
  float g = fableHash(uv * res + fract(col.rg * 917.0) * 13.7) - 0.5;
  col += g * grain * 0.04;
  col += (fableHash(uv * res) - 0.5) / 255.0; // dither
  return col;
}
`

/** JS helpers — prepend to evaluateSource strings. Provides hsvToRgb() and FABLE_PALETTES. */
export const FABLE_EVAL_LIB = `
function hsvToRgb(h,s,v){h=((h%360)+360)%360/360;var i=Math.floor(h*6),f=h*6-i,p=v*(1-s),q=v*(1-f*s),t=v*(1-(1-f)*s);var m=i%6;if(m===0)return[v,t,p];if(m===1)return[q,v,p];if(m===2)return[p,v,t];if(m===3)return[p,q,v];if(m===4)return[t,p,v];return[v,p,q];}
var FABLE_PALETTES = [
  { a:[0.08,0.22,0.25], b:[0.35,0.55,0.50], c:[1.1,1.0,0.9], d:[0.35,0.12,0.45] }, // aurora
  { a:[0.45,0.16,0.06], b:[0.55,0.40,0.25], c:[1.2,1.0,0.8], d:[0.02,0.12,0.25] }, // ember
  { a:[0.06,0.14,0.28], b:[0.25,0.40,0.55], c:[1.0,1.0,1.1], d:[0.55,0.42,0.25] }, // abyss
  { a:[0.28,0.10,0.40], b:[0.50,0.35,0.50], c:[1.0,1.0,0.9], d:[0.65,0.40,0.15] }, // ultraviolet
  { a:[0.22,0.25,0.30], b:[0.50,0.53,0.58], c:[1.0,1.0,1.0], d:[0.08,0.10,0.14] }, // chrome
  { a:[0.50,0.30,0.40], b:[0.45,0.40,0.35], c:[1.0,1.0,0.8], d:[0.85,0.25,0.40] }, // candy
];
function fablePalette(idx, hueShift) {
  var p = FABLE_PALETTES[Math.max(0, Math.min(idx, FABLE_PALETTES.length - 1))];
  var d = [p.d[0] + hueShift, p.d[1] + hueShift, p.d[2] + hueShift];
  return { a: p.a, b: p.b, c: p.c, d: d };
}
`

/** Enum values matching FABLE_PALETTES order — reuse in param schemas. */
export const FABLE_PALETTE_NAMES = ['aurora', 'ember', 'abyss', 'ultraviolet', 'chrome', 'candy']

/**
 * Shared display shader for scalar-field sims (Petri, Continuum).
 * Expects fieldTex with r = cell state, g = slow EMA, b = activity EMA.
 * Uniforms: resolution, exposure, relief, glow, grain, vignette, palA-D, uAspect.
 */
export const FABLE_FIELD_DISPLAY_FRAG = `precision highp float;
uniform sampler2D fieldTex;
uniform vec2 resolution;
uniform float exposure;
uniform float relief;
uniform float glow;
uniform float grain;
uniform float vignette;
uniform vec3 palA;
uniform vec3 palB;
uniform vec3 palC;
uniform vec3 palD;
uniform float uAspect;
varying vec2 vUv;

${FABLE_GLSL_LIB}

void main() {
  vec2 suv = vUv - 0.5;
  if (uAspect > 1.0) suv.x *= uAspect;
  else if (uAspect > 0.0) suv.y /= uAspect;
  vec2 tuv = fract(suv + 0.5);

  vec4 s = texture2D(fieldTex, tuv);
  float cell = s.r;
  float ema = s.g;
  float act = s.b;

  // Base color: palette indexed by a blend of state and slow memory
  float t = clamp(cell * 0.72 + ema * 0.28, 0.0, 1.0);
  vec3 col = fablePal(t * 0.85, palA, palB, palC, palD) * (0.06 + 0.94 * cell) * exposure;

  // Activity glow — recently-changed regions burn hot
  col += fablePal(0.9, palA, palB, palC, palD) * act * glow * 1.6;

  // Relief lighting from the cell gradient
  vec2 texel = 1.0 / resolution;
  float gx = texture2D(fieldTex, fract(tuv + vec2(texel.x, 0.0))).r - texture2D(fieldTex, fract(tuv - vec2(texel.x, 0.0))).r;
  float gy = texture2D(fieldTex, fract(tuv + vec2(0.0, texel.y))).r - texture2D(fieldTex, fract(tuv - vec2(0.0, texel.y))).r;
  vec3 n = normalize(vec3(-gx * relief * 4.0, -gy * relief * 4.0, 1.0));
  vec3 Ld = normalize(vec3(-0.5, 0.6, 0.65));
  float diff = max(dot(n, Ld), 0.0);
  float spec = pow(max(reflect(-Ld, n).z, 0.0), 24.0);
  col *= mix(1.0, 0.45 + 0.75 * diff, clamp(relief, 0.0, 1.0) * smoothstep(0.02, 0.25, cell));
  col += (col + 0.1) * spec * relief * 0.35 * smoothstep(0.1, 0.5, cell);

  col = fableACES(col);
  col = fableGrade(col, vUv, suv, resolution, grain, vignette);
  gl_FragColor = vec4(col, 1.0);
}`
