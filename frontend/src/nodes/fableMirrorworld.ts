import type { CompoundGeneratorDef } from './generatorGraphFactory'
import type { ParamSchemaDef } from './storage'
import { FABLE_GLSL_LIB, FABLE_EVAL_LIB, FABLE_PALETTE_NAMES } from './fableDisplayLib'

// ═══════════════════════════════════════════════════════════════════════════
// FABLE MIRRORWORLD — analog video feedback in a kaleidoscope
//
// A camera pointed at its own monitor: each frame the previous image is
// folded through N-way mirror symmetry, zoomed, rotated, hue-drifted and
// decayed, while glowing seed orbs paint fresh light into the loop. The
// display pass adds prismatic chromatic aberration. Ping-pong feedback
// texture — the whole image IS the state.
// ═══════════════════════════════════════════════════════════════════════════

const feedbackShader = `precision highp float;
uniform sampler2D frameTex;
uniform vec2 resolution;
uniform float uTime;
uniform float segments;
uniform float zoomRate;
uniform float rotSpeed;
uniform float decay;
uniform float hueDrift;
uniform float warp;
uniform float kaleidMix;
uniform float seedCount;
uniform float seedSize;
uniform float seedGlow;
uniform float seedSpeed;
uniform vec3 palA;
uniform vec3 palB;
uniform vec3 palC;
uniform vec3 palD;
varying vec2 vUv;

${FABLE_GLSL_LIB}

vec3 hueRotate(vec3 c, float a) {
  const vec3 k = vec3(0.57735026919);
  float ca = cos(a), sa = sin(a);
  return c * ca + cross(k, c) * sa + k * dot(k, c) * (1.0 - ca);
}

void main() {
  vec2 c = vUv - 0.5;
  float r = length(c);
  float ang = atan(c.y, c.x);

  // N-way mirror fold (kaleidoscope), blended with the unfolded angle
  float n = max(segments, 1.0);
  float seg = 6.28318530718 / n;
  float folded = abs(mod(ang, seg) - seg * 0.5);
  ang = mix(ang, folded, kaleidMix);

  // rotate + zoom the sampling frame — the feedback tunnel
  ang += rotSpeed * 0.02;
  float rr = r * zoomRate;
  // radial ripple warp for liquid glass distortion
  rr += warp * 0.015 * sin(r * 28.0 - uTime * 1.5);
  vec2 sc = vec2(cos(ang), sin(ang)) * rr;

  vec2 tuv = clamp(sc + 0.5, 0.0, 1.0);
  vec3 prev = texture2D(frameTex, tuv).rgb;
  // unsharp mask fights the blur that linear resampling adds every frame
  vec2 px = 1.5 / resolution;
  vec3 blur = (texture2D(frameTex, tuv + vec2(px.x, 0.0)).rgb
             + texture2D(frameTex, tuv - vec2(px.x, 0.0)).rgb
             + texture2D(frameTex, tuv + vec2(0.0, px.y)).rgb
             + texture2D(frameTex, tuv - vec2(0.0, px.y)).rgb) * 0.25;
  prev += (prev - blur) * 0.6;
  prev = max(hueRotate(prev, hueDrift * 0.06), 0.0);
  // decay + DC subtract: dim resample smear dies out, bright cores persist
  prev = max(prev * decay - 0.004, 0.0);
  // soft knee keeps the loop from blowing out to white
  prev = prev / (1.0 + max(prev - vec3(1.8), vec3(0.0)) * 0.6);

  // seed light: a thin flower-ring glyph at center — the fold + zoom copy it
  // outward into mandala tunnels. Angle-rainbow color keeps the loop vivid.
  vec3 inject = vec3(0.0);
  float t = uTime * seedSpeed;
  float ang0 = atan(c.y, c.x);
  float ringR = (0.15 + 0.06 * sin(uTime * 0.8)) * (0.82 + 0.22 * cos(ang0 * n + uTime * 1.7));
  float dRing = abs(r - ringR);
  float ringG = exp(-dRing * dRing / (seedSize * seedSize * 0.2));
  vec3 ringCol = fablePal(fract(ang0 * 0.159155 + uTime * 0.07), palA, palB, palC, palD);
  inject += ringCol * ringG * 0.9;
  int nSeeds = int(seedCount);
  for (int i = 0; i < 8; i++) {
    if (i >= nSeeds) break;
    float fi = float(i);
    float w1 = 0.7 + fableHash(vec2(fi, 1.3)) * 0.9;
    float w2 = 0.5 + fableHash(vec2(fi, 7.1)) * 1.1;
    float ph = fi * 2.399963;
    // each seed gets its own orbit radius so the center isn't left empty
    float orbitR = 0.10 + 0.28 * fableHash(vec2(fi, 3.7));
    vec2 pos = orbitR * vec2(sin(t * w1 + ph), cos(t * w2 + ph * 1.7));
    float d = length(c - pos);
    float g = exp(-d * d / (seedSize * seedSize));
    // rhythmic pulse writes rings into the tunnel instead of a solid smear
    g *= 0.5 + 0.5 * sin(uTime * 5.0 + fi * 1.9);
    vec3 sc2 = fablePal(fract(fi * 0.37 + uTime * 0.11), palA, palB, palC, palD);
    inject += sc2 * g;
  }

  vec3 col = prev + inject * seedGlow * 0.35;
  gl_FragColor = vec4(col, 1.0);
}`

const displayShader = `precision highp float;
uniform sampler2D frameTex;
uniform vec2 resolution;
uniform float uTime;
uniform float uAspect;
uniform float chromatic;
uniform float exposure;
uniform float grain;
uniform float vignette;
varying vec2 vUv;

${FABLE_GLSL_LIB}

void main() {
  vec2 suv = vUv - 0.5;
  // physical (height-unit) coords, then "cover" map into the square texture
  vec2 pc = vec2(suv.x * uAspect, suv.y);
  float cover = max(uAspect, 1.0);
  float r2 = dot(pc, pc);

  // prismatic dispersion: each channel samples at a slightly different zoom
  float ca = chromatic * 0.03 * r2;
  vec3 col;
  col.r = texture2D(frameTex, pc * (1.0 + ca) / cover + 0.5).r;
  col.g = texture2D(frameTex, pc / cover + 0.5).g;
  col.b = texture2D(frameTex, pc * (1.0 - ca) / cover + 0.5).b;

  col = fableACES(col * exposure);
  col = fableGrade(col, vUv, suv, resolution, grain, vignette);
  gl_FragColor = vec4(col, 1.0);
}`

const mirrorworldParams: ParamSchemaDef[] = [
  { name: 'segments', type: 'int', min: 1, max: 16, default: 6, description: 'Mirror symmetry segments' },
  { name: 'kaleidMix', type: 'float', min: 0, max: 1, default: 1, description: 'Kaleidoscope fold amount' },
  { name: 'zoomRate', type: 'float', min: 0.9, max: 1.1, default: 0.96, description: 'Feedback zoom (<1 tunnels outward)' },
  { name: 'rotSpeed', type: 'float', min: -3, max: 3, default: 1.3, description: 'Feedback rotation' },
  { name: 'decay', type: 'float', min: 0.8, max: 0.99, default: 0.94, description: 'Trail persistence' },
  { name: 'hueDrift', type: 'float', min: -2, max: 2, default: 0.5, description: 'Hue rotation per frame' },
  { name: 'warp', type: 'float', min: 0, max: 1, default: 0.25, description: 'Liquid ripple distortion' },
  { name: 'seedCount', type: 'int', min: 1, max: 8, default: 3, description: 'Light seed orbs' },
  { name: 'seedSize', type: 'float', min: 0.008, max: 0.09, default: 0.03, description: 'Seed orb size' },
  { name: 'seedGlow', type: 'float', min: 0, max: 3, default: 1.2, description: 'Seed brightness' },
  { name: 'seedSpeed', type: 'float', min: 0, max: 2, default: 0.5, description: 'Seed orbit speed' },
  { name: 'chromatic', type: 'float', min: 0, max: 1, default: 0.35, description: 'Chromatic aberration' },
  { name: 'simResolution', type: 'int', min: 512, max: 2048, default: 1024, description: 'Feedback resolution' },
  { name: 'palette', type: 'enum', default: 'aurora', enumValues: FABLE_PALETTE_NAMES, description: 'Palette' },
  { name: 'colorHue', type: 'float', min: 0, max: 360, default: 0, description: 'Palette hue shift' },
  { name: 'exposure', type: 'float', min: 0.3, max: 3, default: 1.1, description: 'Exposure' },
  { name: 'grain', type: 'float', min: 0, max: 1, default: 0.25, description: 'Film grain' },
  { name: 'vignette', type: 'float', min: 0, max: 1, default: 0.4, description: 'Vignette' },
]

const mirrorworldEvaluateSource = FABLE_EVAL_LIB + `
var simRes = Math.min(2048, Math.max(512, Math.round(inputs.simResolution)));
var paletteIdx = Math.round(inputs.palette || 0);
var pal = fablePalette(paletteIdx, inputs.colorHue / 360);
var res = ctx.resolution || [1, 1];
var aspect = res[1] > 0 ? res[0] / res[1] : 1;

return { shaderConfig: {
  passes: [
    { name: 'feedback', fragmentShader: inputs.feedbackShader, target: 'frame',
      readFrom: { frameTex: 'frame' },
      uniforms: {
        resolution: [simRes, simRes],
        uTime: ctx.elapsed,
        segments: Math.round(inputs.segments),
        zoomRate: inputs.zoomRate,
        rotSpeed: inputs.rotSpeed,
        decay: inputs.decay,
        hueDrift: inputs.hueDrift,
        warp: inputs.warp,
        kaleidMix: inputs.kaleidMix,
        seedCount: Math.round(inputs.seedCount),
        seedSize: inputs.seedSize,
        seedGlow: inputs.seedGlow,
        seedSpeed: inputs.seedSpeed,
        palA: pal.a, palB: pal.b, palC: pal.c, palD: pal.d,
      } },
    { name: 'display', fragmentShader: inputs.displayShader, target: null,
      readFrom: { frameTex: 'frame' },
      uniforms: {
        resolution: res,
        uTime: ctx.elapsed,
        uAspect: aspect,
        chromatic: inputs.chromatic,
        exposure: inputs.exposure,
        grain: inputs.grain,
        vignette: inputs.vignette,
      } },
  ],
  renderTargetDefs: {
    frame: { width: simRes, height: simRes, type: 'float', filter: 'linear', pingPong: true },
  },
  stepsPerFrame: 1,
}};
`

const fableMirrorworldDef: CompoundGeneratorDef = {
  id: 'builtin_fableMirrorworld',
  name: 'Fable Mirrorworld',
  description: 'Analog video feedback folded through a kaleidoscope — infinite mirrored tunnels of drifting neon light',
  defaultCameraDistance: 0,
  generatorType: 'fableMirrorworld_generator',
  outputMode: 'shader',
  params: mirrorworldParams,
  inputs: mirrorworldParams.map(p => ({
    name: p.name,
    type: 'number' as const,
    default: p.type === 'bool' ? (p.default ? 1 : 0) : (p.type === 'enum' ? 0 : (p.default as number)),
  })),
  outputs: [{ name: 'shaderConfig', type: 'array' as const }],
  evaluateSource: mirrorworldEvaluateSource,
  shaderSources: {
    feedback: feedbackShader,
    display: displayShader,
  },
}

export const FABLE_MIRRORWORLD_GENERATORS: CompoundGeneratorDef[] = [fableMirrorworldDef]
