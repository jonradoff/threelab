import type { CompoundGeneratorDef } from './generatorGraphFactory'
import type { ParamSchemaDef } from './storage'
import { FABLE_GLSL_LIB, FABLE_EVAL_LIB, FABLE_PALETTE_NAMES } from './fableDisplayLib'

// ═══════════════════════════════════════════════════════════════════════════
// FABLE HYPERSPACE — raymarched fractal solids (Mandelbox / KIFS / Menger)
//
// Distance-estimated 3D fractals marched with sphere tracing. Unlike
// Dreamscape's smooth-min organics, these are hard self-similar geometry:
// infinite recursive temples, alien machine-cathedrals, box-fold tunnels.
// Orbit-trap coloring drives an iridescent palette; glow accumulates along
// the ray for that demoscene "impossible light" feel. Single fullscreen pass.
// ═══════════════════════════════════════════════════════════════════════════

const hyperspaceFrag = `precision highp float;
uniform float uTime;
uniform float uAspect;
uniform vec2 resolution;
uniform float fractalType;   // 0 mandelbox, 1 kifs, 2 menger
uniform float iterations;
uniform float scaleParam;
uniform float foldParam;
uniform float minRadius;
uniform float morph;
uniform float cameraSpeed;
uniform float pathTwist;
uniform float fov;
uniform float glowStrength;
uniform float orbitColor;
uniform float lightAngle;
uniform float quality;
uniform float exposure;
uniform float grain;
uniform float vignette;
uniform vec3 palA;
uniform vec3 palB;
uniform vec3 palC;
uniform vec3 palD;
varying vec2 vUv;

${FABLE_GLSL_LIB}

// running orbit trap for coloring, written by the DE
float gTrap;

float deMandelbox(vec3 p) {
  vec3 offset = p;
  float dr = 1.0;
  float trap = 1e9;
  int iters = int(iterations);
  for (int i = 0; i < 20; i++) {
    if (i >= iters) break;
    // box fold
    p = clamp(p, -foldParam, foldParam) * 2.0 - p;
    // sphere fold
    float r2 = dot(p, p);
    float mr2 = minRadius * minRadius;
    if (r2 < mr2) {
      float t = (1.0) / mr2;
      p *= t; dr *= t;
    } else if (r2 < 1.0) {
      float t = 1.0 / r2;
      p *= t; dr *= t;
    }
    p = scaleParam * p + offset;
    dr = dr * abs(scaleParam) + 1.0;
    trap = min(trap, length(p));
  }
  gTrap = trap;
  return length(p) / abs(dr);
}

float deKifs(vec3 p) {
  // Kaleidoscopic IFS (Sierpinski-style): needs a positive scale near 2.
  // Remap the shared scaleParam so the mandelbox default (-1.8) lands on ~2.0.
  float ks = clamp(2.0 + (abs(scaleParam) - 1.8) * 0.5, 1.4, 2.7);
  vec3 off = vec3(foldParam);
  float trap = 1e9;
  int iters = int(iterations);
  int n = 0;
  // The sign-fold attractor only survives small per-iteration twists:
  // past ~25 degrees the set degenerates and rays never hit. Map morph 0..1
  // to 0..~20 degrees.
  float a = morph * 0.35;
  float ca = cos(a), sa = sin(a);
  mat2 rot = mat2(ca, -sa, sa, ca);
  for (int i = 0; i < 20; i++) {
    if (i >= iters) break;
    // canonical Sierpinski sign-folds
    if (p.x + p.y < 0.0) p.xy = -p.yx;
    if (p.x + p.z < 0.0) p.xz = -p.zx;
    if (p.y + p.z < 0.0) p.yz = -p.zy;
    p.xy = rot * p.xy;
    p = p * ks - off * (ks - 1.0);
    trap = min(trap, length(p));
    n++;
  }
  gTrap = trap * 1.5;
  // 0.85: rotation makes the plain KIFS estimate overshoot thin features
  return length(p) * pow(ks, -float(n)) * 0.85;
}

float deMenger(vec3 p) {
  float d = max(abs(p.x), max(abs(p.y), abs(p.z))) - 1.6;
  float s = 1.0;
  float trap = 1e9;
  int iters = int(iterations);
  float tw = morph;
  for (int i = 0; i < 12; i++) {
    if (i >= iters) break;
    vec3 a = mod(p * s, 2.0) - 1.0;
    s *= 3.0;
    vec3 r = abs(1.0 - 3.0 * abs(a));
    // slight rotation between levels for organic twist
    float ca = cos(tw), sa = sin(tw);
    r.xz = mat2(ca, -sa, sa, ca) * r.xz;
    float da = max(r.x, r.y);
    float db = max(r.y, r.z);
    float dc = max(r.z, r.x);
    float c = (min(da, min(db, dc)) - 1.0) / s;
    d = max(d, c);
    trap = min(trap, length(a));
  }
  gTrap = trap;
  return d;
}

float map(vec3 p) {
  if (fractalType < 0.5) return deMandelbox(p);
  if (fractalType < 1.5) return deKifs(p);
  return deMenger(p);
}

vec3 calcNormal(vec3 p) {
  vec2 e = vec2(0.0008, 0.0);
  return normalize(vec3(
    map(p + e.xyy) - map(p - e.xyy),
    map(p + e.yxy) - map(p - e.yxy),
    map(p + e.yyx) - map(p - e.yyx)));
}

void main() {
  vec2 suv = vUv - 0.5;
  if (uAspect > 1.0) suv.x *= uAspect;
  else if (uAspect > 0.0) suv.y /= uAspect;

  // camera orbits the fractal, slowly breathing in and out so structure
  // always fills the frame (flythrough starts in empty pockets)
  float ct = uTime * cameraSpeed;
  float dist = 3.6 + pathTwist * (0.5 + 0.5 * sin(ct * 0.23));
  vec3 ro = vec3(sin(ct * 0.4), 0.55 * sin(ct * 0.31), cos(ct * 0.4)) * dist;
  vec3 ta = vec3(sin(ct * 0.17) * 0.4, sin(ct * 0.13) * 0.3, 0.0); // look near center
  vec3 fw = normalize(ta - ro);
  vec3 rt = normalize(cross(fw, vec3(sin(ct * 0.05), 1.0, 0.0)));
  vec3 up = cross(rt, fw);
  vec3 rd = normalize(suv.x * rt * fov + suv.y * up * fov + fw);

  float la = lightAngle * 0.0174533;
  vec3 sunDir = normalize(vec3(cos(la), 0.6, sin(la)));

  float maxSteps = mix(56.0, 160.0, quality);
  float t = 0.01;
  float glow = 0.0;
  float minDist = 1e9;
  float colorTrap = 0.0;
  bool hit = false;
  for (int i = 0; i < 160; i++) {
    if (float(i) >= maxSteps) break;
    vec3 pos = ro + rd * t;
    float d = map(pos);
    // glow near surfaces (proximity accumulation)
    glow += exp(-d * 90.0) * 0.014;
    if (d < minDist) minDist = d;
    if (d < 0.0006 * t + 0.0004) { hit = true; colorTrap = gTrap; break; }
    t += d * 0.85;
    if (t > 24.0) break;
  }

  vec3 bg = mix(fablePal(0.1, palA, palB, palC, palD) * 0.15,
                fablePal(0.7, palA, palB, palC, palD) * 0.05, clamp(rd.y + 0.5, 0.0, 1.0));
  vec3 col;
  if (hit) {
    vec3 pos = ro + rd * t;
    vec3 n = calcNormal(pos);
    float diff = max(dot(n, sunDir), 0.0);
    float amb = 0.3 + 0.3 * n.y;
    // ambient occlusion approx from step count
    float ao = clamp(1.0 - t * 0.03, 0.25, 1.0);

    float ct2 = fract(colorTrap * orbitColor + uTime * 0.02);
    vec3 alb = fablePal(ct2, palA, palB, palC, palD);
    col = alb * (diff * 1.1 + amb * ao * 0.7);
    // spec
    vec3 h = normalize(sunDir - rd);
    col += pow(max(dot(n, h), 0.0), 40.0) * 0.6;
    float fres = pow(1.0 - max(dot(n, -rd), 0.0), 4.0);
    col += alb * fres * 0.5;
    // distance fog into bg
    col = mix(col, bg, 1.0 - exp(-t * 0.08));
  } else {
    col = bg;
  }

  // accumulated fractal glow — the psychedelic haze
  col += fablePal(fract(colorTrap * orbitColor * 0.5 + 0.3), palA, palB, palC, palD) * glow * glowStrength;

  col = fableACES(col * exposure);
  col = fableGrade(col, vUv, suv, resolution, grain, vignette);
  gl_FragColor = vec4(col, 1.0);
}`

const hyperspaceParams: ParamSchemaDef[] = [
  { name: 'fractalType', type: 'enum', default: 'mandelbox', enumValues: ['mandelbox', 'kifs', 'menger'], description: 'Fractal formula' },
  { name: 'iterations', type: 'int', min: 4, max: 18, default: 12, description: 'Fractal detail iterations' },
  { name: 'scaleParam', type: 'float', min: -3, max: 3, default: -1.8, description: 'Fractal scale (shape driver)' },
  { name: 'foldParam', type: 'float', min: 0.4, max: 2, default: 1, description: 'Fold amount' },
  { name: 'minRadius', type: 'float', min: 0.2, max: 1, default: 0.5, description: 'Sphere-fold radius (mandelbox)' },
  { name: 'morph', type: 'float', min: 0, max: 1, default: 0.2, description: 'Rotation/twist between levels' },
  { name: 'cameraSpeed', type: 'float', min: 0, max: 2.5, default: 0.7, description: 'Flythrough speed' },
  { name: 'pathTwist', type: 'float', min: 0, max: 2.5, default: 1, description: 'Camera helix radius' },
  { name: 'fov', type: 'float', min: 0.8, max: 2.5, default: 1.5, description: 'Field of view' },
  { name: 'glowStrength', type: 'float', min: 0, max: 3, default: 1, description: 'Fractal haze glow' },
  { name: 'orbitColor', type: 'float', min: 0.1, max: 4, default: 1, description: 'Orbit-trap color frequency' },
  { name: 'lightAngle', type: 'float', min: 0, max: 360, default: 40, description: 'Light direction' },
  { name: 'quality', type: 'float', min: 0, max: 1, default: 0.6, description: 'Raymarch quality (steps)' },
  { name: 'palette', type: 'enum', default: 'ultraviolet', enumValues: FABLE_PALETTE_NAMES, description: 'Palette' },
  { name: 'colorHue', type: 'float', min: 0, max: 360, default: 0, description: 'Palette hue shift' },
  { name: 'exposure', type: 'float', min: 0.3, max: 3, default: 1.1, description: 'Exposure' },
  { name: 'grain', type: 'float', min: 0, max: 1, default: 0.3, description: 'Film grain' },
  { name: 'vignette', type: 'float', min: 0, max: 1, default: 0.4, description: 'Vignette' },
]

const hyperspaceEvaluateSource = FABLE_EVAL_LIB + `
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
    fractalType: Math.round(inputs.fractalType || 0),
    iterations: Math.round(inputs.iterations),
    scaleParam: inputs.scaleParam,
    foldParam: inputs.foldParam,
    minRadius: inputs.minRadius,
    morph: inputs.morph,
    cameraSpeed: inputs.cameraSpeed,
    pathTwist: inputs.pathTwist,
    fov: inputs.fov,
    glowStrength: inputs.glowStrength,
    orbitColor: inputs.orbitColor,
    lightAngle: inputs.lightAngle,
    quality: inputs.quality,
    exposure: inputs.exposure,
    grain: inputs.grain,
    vignette: inputs.vignette,
    palA: pal.a, palB: pal.b, palC: pal.c, palD: pal.d,
  },
}};
`

const fableHyperspaceDef: CompoundGeneratorDef = {
  id: 'builtin_fableHyperspace',
  name: 'Fable Hyperspace',
  description: 'Raymarched 3D fractals — infinite Mandelbox temples and kaleidoscopic machine-cathedrals you fly through',
  defaultCameraDistance: 0,
  generatorType: 'fableHyperspace_generator',
  outputMode: 'shader',
  params: hyperspaceParams,
  inputs: hyperspaceParams.map(p => ({
    name: p.name,
    type: 'number' as const,
    default: p.type === 'bool' ? (p.default ? 1 : 0) : (p.type === 'enum' ? 0 : (p.default as number)),
  })),
  outputs: [{ name: 'shaderConfig', type: 'array' as const }],
  evaluateSource: hyperspaceEvaluateSource,
  fragmentShader: hyperspaceFrag,
}

export const FABLE_HYPERSPACE_GENERATORS: CompoundGeneratorDef[] = [fableHyperspaceDef]
