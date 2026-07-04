import type { CompoundGeneratorDef } from './generatorGraphFactory'
import type { ParamSchemaDef } from './storage'
import { FABLE_GLSL_LIB, FABLE_EVAL_LIB, FABLE_PALETTE_NAMES } from './fableDisplayLib'

// ═══════════════════════════════════════════════════════════════════════════
// FABLE DREAMSCAPE — SDF raymarching (sphere tracing, Quilez-style)
//
// A full procedural 3D world in one fragment shader: smooth-min blended
// organic forms repeated to infinity, marched with soft shadows, ambient
// occlusion, emissive cores that accumulate glow along the ray, height fog,
// and a slow drifting flythrough camera. Single-pass — no state textures.
// ═══════════════════════════════════════════════════════════════════════════

const dreamscapeFrag = `precision highp float;
uniform float uTime;
uniform float uAspect;
uniform vec2 resolution;
uniform float structure;   // 0 blobs, 1 columns, 2 arches, 3 crystals
uniform float repetition;
uniform float shapeMorph;
uniform float warp;
uniform float cameraSpeed;
uniform float cameraHeight;
uniform float swayAmount;
uniform float fogDensity;
uniform float lightAngle;
uniform float emberGlow;
uniform float quality;     // raymarch step budget scale 0..1
uniform float exposure;
uniform float grain;
uniform float vignette;
uniform vec3 palA;
uniform vec3 palB;
uniform vec3 palC;
uniform vec3 palD;
varying vec2 vUv;

${FABLE_GLSL_LIB}

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

float hash3(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}

// Per-cell feature: organic form inside a repeated cell
float feature(vec3 q, vec3 cellId, out float emis) {
  float h = hash3(cellId);
  float phase = uTime * 0.4 + h * 6.28318;
  float morph = shapeMorph * (0.5 + 0.5 * sin(phase));
  emis = 0.0;
  float d;

  if (structure < 0.5) {
    // blobs: two spheres breathing into each other
    vec3 o = vec3(sin(phase) * 0.4, 0.9 + 0.35 * sin(phase * 0.7), cos(phase * 0.8) * 0.4) * (0.5 + h);
    float s1 = length(q - o) - (0.55 + morph * 0.4);
    float s2 = length(q + o * 0.6 - vec3(0.0, 0.7, 0.0)) - (0.4 + morph * 0.25);
    d = smin(s1, s2, 0.6);
    emis = smoothstep(0.5, 0.0, length(q - o)) * 0.6;
  } else if (structure < 1.5) {
    // columns: capped vertical capsules of varying height
    float ht = 0.8 + h * 2.2 + morph;
    vec3 pa = vec3(0.0, 0.0, 0.0);
    vec3 pb = vec3(0.0, ht, 0.0);
    vec3 qa = q - pa;
    vec3 ba = pb - pa;
    float t2 = clamp(dot(qa, ba) / dot(ba, ba), 0.0, 1.0);
    d = length(qa - ba * t2) - (0.28 + 0.18 * sin(q.y * 3.0 + phase) * morph);
    emis = smoothstep(0.4, 0.0, abs(q.y - ht)) * 0.8;
  } else if (structure < 2.5) {
    // arches: torus halves rising from the ground
    vec3 qq = q - vec3(0.0, 0.35 + morph * 0.4, 0.0);
    vec2 tor = vec2(length(qq.xz) - (0.9 + h * 0.5), qq.y);
    d = length(tor) - (0.16 + morph * 0.12);
    emis = smoothstep(0.35, 0.0, abs(qq.y)) * 0.4;
  } else {
    // crystals: octahedra spinning slowly
    float c = cos(phase * 0.3), s = sin(phase * 0.3);
    vec3 qq = q - vec3(0.0, 1.0 + 0.3 * sin(phase), 0.0);
    qq.xz = mat2(c, -s, s, c) * qq.xz;
    qq = abs(qq);
    d = (qq.x + qq.y + qq.z - (0.8 + morph * 0.5)) * 0.57735;
    emis = smoothstep(0.9, 0.0, d + 0.4) * 0.9;
  }
  return d;
}

float map(vec3 p, out float emis) {
  // gentle domain warp for dream distortion
  p.xy += sin(p.zx * 0.35 + uTime * 0.15) * warp;

  // undulating ground
  float ground = p.y + 1.0 + sin(p.x * 0.4) * sin(p.z * 0.4) * 0.35;

  // infinite repetition of features
  vec2 rep2 = vec2(repetition);
  vec2 cell = floor((p.xz + rep2 * 0.5) / rep2);
  vec3 q = vec3(mod(p.x + rep2.x * 0.5, rep2.x) - rep2.x * 0.5,
                p.y + 1.0,
                mod(p.z + rep2.y * 0.5, rep2.y) - rep2.y * 0.5);
  float fe;
  float f = feature(q, vec3(cell.x, 0.0, cell.y), fe);
  emis = fe;
  return smin(ground, f, 0.9);
}

float mapD(vec3 p) { float e; return map(p, e); }

vec3 calcNormal(vec3 p) {
  vec2 e = vec2(0.002, 0.0);
  return normalize(vec3(
    mapD(p + e.xyy) - mapD(p - e.xyy),
    mapD(p + e.yxy) - mapD(p - e.yxy),
    mapD(p + e.yyx) - mapD(p - e.yyx)));
}

float softShadow(vec3 ro, vec3 rd) {
  float res = 1.0;
  float t = 0.08;
  for (int i = 0; i < 32; i++) {
    float h = mapD(ro + rd * t);
    res = min(res, 9.0 * h / t);
    t += clamp(h, 0.03, 0.5);
    if (res < 0.005 || t > 12.0) break;
  }
  return clamp(res, 0.0, 1.0);
}

float calcAO(vec3 p, vec3 n) {
  float occ = 0.0, sca = 1.0;
  for (int i = 1; i <= 4; i++) {
    float hd = 0.09 * float(i);
    occ += (hd - mapD(p + n * hd)) * sca;
    sca *= 0.65;
  }
  return clamp(1.0 - 2.2 * occ, 0.0, 1.0);
}

void main() {
  vec2 suv = vUv - 0.5;
  if (uAspect > 1.0) suv.x *= uAspect;
  else if (uAspect > 0.0) suv.y /= uAspect;

  // drifting camera
  float ct = uTime * cameraSpeed;
  vec3 ro = vec3(sin(ct * 0.21) * swayAmount, cameraHeight + sin(ct * 0.16) * 0.25, ct);
  vec3 ta = ro + vec3(sin(ct * 0.13) * 0.6, -0.12, 1.0);
  vec3 fw = normalize(ta - ro);
  vec3 rt = normalize(cross(fw, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(rt, fw);
  vec3 rd = normalize(suv.x * rt * 1.6 + suv.y * up * 1.6 + fw);

  float la = lightAngle * 0.0174533;
  vec3 sunDir = normalize(vec3(cos(la), 0.55, sin(la)));
  vec3 skyTop = fablePal(0.85, palA, palB, palC, palD) * 0.35;
  vec3 skyHor = fablePal(0.15, palA, palB, palC, palD) * 0.55;
  vec3 sky = mix(skyHor, skyTop, clamp(rd.y * 1.6 + 0.35, 0.0, 1.0));
  sky += pow(max(dot(rd, sunDir), 0.0), 24.0) * fablePal(0.6, palA, palB, palC, palD) * 1.2;

  // sphere trace with emissive accumulation
  float maxSteps = mix(48.0, 128.0, quality);
  float t = 0.02;
  float glowAcc = 0.0;
  float hitEmis = 0.0;
  bool hit = false;
  for (int i = 0; i < 128; i++) {
    if (float(i) >= maxSteps) break;
    vec3 pos = ro + rd * t;
    float em;
    float d = map(pos, em);
    glowAcc += em * exp(-d * 5.0) * 0.05;
    if (d < 0.0015 * t + 0.0008) { hit = true; hitEmis = em; break; }
    t += d * 0.9;
    if (t > 40.0) break;
  }

  vec3 col;
  if (hit) {
    vec3 pos = ro + rd * t;
    vec3 n = calcNormal(pos);
    float sh = softShadow(pos + n * 0.02, sunDir);
    float ao = calcAO(pos, n);
    float diff = max(dot(n, sunDir), 0.0) * sh;
    float bounce = max(dot(n, -sunDir * vec3(1.0, 0.0, 1.0)), 0.0) * 0.15;
    float skyAmb = 0.35 + 0.35 * n.y;

    // material color: palette by height + cell variation
    float matT = clamp(pos.y * 0.25 + 0.45, 0.0, 1.0);
    vec3 alb = fablePal(matT * 0.7 + 0.05, palA, palB, palC, palD);

    col = alb * (diff * 1.25 + skyAmb * ao * 0.6 + bounce);
    // specular sun glint
    vec3 h = normalize(sunDir - rd);
    col += pow(max(dot(n, h), 0.0), 48.0) * sh * 0.6;
    // fresnel rim from sky
    float fres = pow(1.0 - max(dot(n, -rd), 0.0), 4.0);
    col += sky * fres * 0.35;
    // emissive material
    col += fablePal(0.9, palA, palB, palC, palD) * hitEmis * emberGlow;

    // height fog
    float fogAmt = 1.0 - exp(-t * fogDensity * (1.0 - clamp(pos.y * 0.1, 0.0, 0.5)));
    col = mix(col, sky, fogAmt);
  } else {
    col = sky;
  }

  // accumulated ember glow along the ray
  col += fablePal(0.92, palA, palB, palC, palD) * glowAcc * emberGlow;

  col = fableACES(col * exposure);
  col = fableGrade(col, vUv, suv, resolution, grain, vignette);
  gl_FragColor = vec4(col, 1.0);
}`

const dreamscapeParams: ParamSchemaDef[] = [
  { name: 'structure', type: 'enum', default: 'blobs', enumValues: ['blobs', 'columns', 'arches', 'crystals'], description: 'World structure' },
  { name: 'repetition', type: 'float', min: 2.5, max: 10, default: 4.5, description: 'Feature spacing' },
  { name: 'shapeMorph', type: 'float', min: 0, max: 1, default: 0.5, description: 'Shape morphing amount' },
  { name: 'warp', type: 'float', min: 0, max: 0.6, default: 0.12, description: 'Dream distortion (domain warp)' },
  { name: 'cameraSpeed', type: 'float', min: 0, max: 3, default: 0.7, description: 'Flythrough speed' },
  { name: 'cameraHeight', type: 'float', min: 0.2, max: 4, default: 1.1, description: 'Camera height' },
  { name: 'swayAmount', type: 'float', min: 0, max: 2, default: 0.8, description: 'Camera sway' },
  { name: 'fogDensity', type: 'float', min: 0.01, max: 0.3, default: 0.07, description: 'Fog density' },
  { name: 'lightAngle', type: 'float', min: 0, max: 360, default: 35, description: 'Sun direction (degrees)' },
  { name: 'emberGlow', type: 'float', min: 0, max: 2.5, default: 1, description: 'Emissive core glow' },
  { name: 'quality', type: 'float', min: 0, max: 1, default: 0.7, description: 'Raymarch quality (steps)' },
  { name: 'palette', type: 'enum', default: 'ember', enumValues: FABLE_PALETTE_NAMES, description: 'World palette' },
  { name: 'colorHue', type: 'float', min: 0, max: 360, default: 0, description: 'Palette hue shift' },
  { name: 'exposure', type: 'float', min: 0.3, max: 3, default: 1.05, description: 'Exposure' },
  { name: 'grain', type: 'float', min: 0, max: 1, default: 0.35, description: 'Film grain' },
  { name: 'vignette', type: 'float', min: 0, max: 1, default: 0.4, description: 'Vignette' },
]

const dreamscapeEvaluateSource = FABLE_EVAL_LIB + `
var paletteIdx = Math.round(inputs.palette || 0);
var pal = fablePalette(paletteIdx, inputs.colorHue / 360);
var res = ctx.resolution || [1, 1];
var aspect = res[1] > 0 ? res[0] / res[1] : 1;

return { shaderConfig: {
  fragmentShader: inputs.fragmentShader,
  uniforms: {
    uTime: ctx.elapsed,
    uAspect: aspect,
    resolution: res,
    structure: Math.round(inputs.structure || 0),
    repetition: inputs.repetition,
    shapeMorph: inputs.shapeMorph,
    warp: inputs.warp,
    cameraSpeed: inputs.cameraSpeed,
    cameraHeight: inputs.cameraHeight,
    swayAmount: inputs.swayAmount,
    fogDensity: inputs.fogDensity,
    lightAngle: inputs.lightAngle,
    emberGlow: inputs.emberGlow,
    quality: inputs.quality,
    exposure: inputs.exposure,
    grain: inputs.grain,
    vignette: inputs.vignette,
    palA: pal.a, palB: pal.b, palC: pal.c, palD: pal.d,
  },
}};
`

const fableDreamscapeDef: CompoundGeneratorDef = {
  id: 'builtin_fableDreamscape',
  name: 'Fable Dreamscape',
  description: 'Raymarched procedural 3D dreamworld — smooth organic forms to infinity with soft shadows, glowing cores, and fog',
  defaultCameraDistance: 0,
  generatorType: 'fableDreamscape_generator',
  outputMode: 'shader',
  params: dreamscapeParams,
  inputs: dreamscapeParams.map(p => ({
    name: p.name,
    type: 'number' as const,
    default: p.type === 'bool' ? (p.default ? 1 : 0) : (p.type === 'enum' ? 0 : (p.default as number)),
  })),
  outputs: [{ name: 'shaderConfig', type: 'array' as const }],
  evaluateSource: dreamscapeEvaluateSource,
  fragmentShader: dreamscapeFrag,
}

export const FABLE_DREAMSCAPE_GENERATORS: CompoundGeneratorDef[] = [fableDreamscapeDef]
