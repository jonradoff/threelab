import type { CompoundGeneratorDef } from './generatorGraphFactory'
import type { ParamSchemaDef } from './storage'
import { FABLE_GLSL_LIB, FABLE_EVAL_LIB, FABLE_PALETTE_NAMES } from './fableDisplayLib'

// ═══════════════════════════════════════════════════════════════════════════
// FABLE CYMATICS — Chladni figures: sand on a singing plate
//
// Standing-wave eigenmodes of a vibrating plate. Sand collects where the
// displacement is zero (nodal lines) and dances as speckle at the antinodes.
// The plate sweeps through resonances like a rising tone — each mode pair
// crossfades into the next, redrawing the figure. Square plates use
// cos·cos mode combinations; round plates use radial/angular modes.
// ═══════════════════════════════════════════════════════════════════════════

const cymaticsFrag = `precision highp float;
uniform float uTime;
uniform float uAspect;
uniform vec2 resolution;
uniform float plateShape;   // 0 square, 1 round
uniform float baseFreq;
uniform float freqRange;
uniform float sweepSpeed;
uniform float holdTime;
uniform float lineSharp;
uniform float sandGlow;
uniform float sparkle;
uniform float vibrance;
uniform float exposure;
uniform float grain;
uniform float vignette;
uniform vec3 palA;
uniform vec3 palB;
uniform vec3 palC;
uniform vec3 palD;
varying vec2 vUv;

${FABLE_GLSL_LIB}

// square-plate Chladni mode: antisymmetric cos combination
float modeSquare(vec2 p, float n, float m, float sgn) {
  const float PI = 3.14159265;
  return cos(n * PI * p.x) * cos(m * PI * p.y)
       + sgn * cos(m * PI * p.x) * cos(n * PI * p.y);
}

// round-plate mode: k nodal diameters, radial standing wave (Bessel-ish)
float modeRound(vec2 p, float n, float k, float rot) {
  float r = length(p) * 2.0;
  float th = atan(p.y, p.x);
  float radial = sin(n * 3.14159265 * r) / (1.0 + 1.2 * r);
  return cos(k * th + rot) * radial;
}

float plateAt(vec2 p, float idx) {
  // each resonance picks its mode numbers from the index
  float h1 = fableHash(vec2(idx, 3.7));
  float h2 = fableHash(vec2(idx, 8.1));
  float h3 = fableHash(vec2(idx, 5.9));
  float n = floor(baseFreq + h1 * freqRange);
  float m = floor(baseFreq * 0.5 + h2 * freqRange);
  if (abs(n - m) < 0.5) m += 1.0; // degenerate pairs draw nothing
  if (plateShape < 0.5) {
    float sgn = h3 > 0.5 ? 1.0 : -1.0;
    return modeSquare(p, n, m, sgn);
  }
  float k = floor(1.0 + h3 * 7.0);
  return modeRound(p, max(n * 0.6, 2.0), k, idx * 1.7);
}

void main() {
  vec2 suv = vUv - 0.5;
  vec2 pc = vec2(suv.x * uAspect, suv.y);
  float cover = max(uAspect, 1.0);
  vec2 p = pc / cover * 2.0; // plate coords roughly [-1,1]

  // resonance sweep: hold each figure, then crossfade to the next
  float t = uTime * sweepSpeed / max(holdTime, 0.2);
  float idx = floor(t);
  float ft = fract(t);
  float fade = smoothstep(0.72, 1.0, ft); // last quarter of the hold morphs

  float s1 = plateAt(p, idx);
  float s2 = plateAt(p, idx + 1.0);
  float s = mix(s1, s2, fade);

  // sand collects on nodal lines |s| ~ 0
  float sand = exp(-abs(s) * lineSharp);
  sand = pow(sand, 2.0);

  // during a transition the sand is airborne — lines soften and scatter
  float agitation = 4.0 * fade * (1.0 - fade);

  // antinode speckle: grains dancing hardest where the plate moves most
  float amp = abs(s);
  float sp = fableHash(vUv * resolution * 0.5 + floor(uTime * 24.0) * 7.3);
  float dance = sparkle * amp * (0.35 + 0.65 * agitation) * step(0.82, sp);

  // plate: dark brushed metal, breathing faintly with the drive amplitude
  float sheen = 0.5 + 0.5 * sin((p.x + p.y) * 3.0 + uTime * 0.2);
  vec3 plate = fablePal(0.08 + 0.05 * sheen, palA, palB, palC, palD) * 0.10;
  plate *= 1.0 + vibrance * 0.25 * sin(uTime * 6.0) * amp * 0.3;

  // sand color from the palette, hot where dense
  vec3 sandCol = fablePal(0.55 + 0.25 * sand, palA, palB, palC, palD);
  vec3 col = plate
           + sandCol * sand * sandGlow * (1.0 - 0.45 * agitation)
           + sandCol * dance * 0.8;

  // round plates get a rim
  if (plateShape > 0.5) {
    float r = length(p) * 2.0;
    col *= smoothstep(2.05, 1.95, r);
    col += fablePal(0.3, palA, palB, palC, palD) * 0.15 * smoothstep(0.06, 0.0, abs(r - 1.98));
  }

  col = fableACES(col * exposure);
  col = fableGrade(col, vUv, suv, resolution, grain, vignette);
  gl_FragColor = vec4(col, 1.0);
}`

const cymaticsParams: ParamSchemaDef[] = [
  { name: 'plateShape', type: 'enum', default: 'square', enumValues: ['square', 'round'], description: 'Plate shape' },
  { name: 'baseFreq', type: 'float', min: 1, max: 10, default: 3, description: 'Lowest mode number' },
  { name: 'freqRange', type: 'float', min: 2, max: 14, default: 8, description: 'Mode number spread' },
  { name: 'sweepSpeed', type: 'float', min: 0, max: 3, default: 1, description: 'Resonance sweep speed' },
  { name: 'holdTime', type: 'float', min: 0.5, max: 12, default: 5, description: 'Seconds per figure' },
  { name: 'lineSharp', type: 'float', min: 2, max: 30, default: 15, description: 'Sand line sharpness' },
  { name: 'sandGlow', type: 'float', min: 0.2, max: 3, default: 1.3, description: 'Sand brightness' },
  { name: 'sparkle', type: 'float', min: 0, max: 2, default: 0.7, description: 'Dancing grain speckle' },
  { name: 'vibrance', type: 'float', min: 0, max: 1, default: 0.5, description: 'Plate vibration shimmer' },
  { name: 'palette', type: 'enum', default: 'ember', enumValues: FABLE_PALETTE_NAMES, description: 'Palette' },
  { name: 'colorHue', type: 'float', min: 0, max: 360, default: 0, description: 'Palette hue shift' },
  { name: 'exposure', type: 'float', min: 0.3, max: 3, default: 1.15, description: 'Exposure' },
  { name: 'grain', type: 'float', min: 0, max: 1, default: 0.3, description: 'Film grain' },
  { name: 'vignette', type: 'float', min: 0, max: 1, default: 0.45, description: 'Vignette' },
]

const cymaticsEvaluateSource = FABLE_EVAL_LIB + `
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
    plateShape: Math.round(inputs.plateShape || 0),
    baseFreq: inputs.baseFreq,
    freqRange: inputs.freqRange,
    sweepSpeed: inputs.sweepSpeed,
    holdTime: inputs.holdTime,
    lineSharp: inputs.lineSharp,
    sandGlow: inputs.sandGlow,
    sparkle: inputs.sparkle,
    vibrance: inputs.vibrance,
    exposure: inputs.exposure,
    grain: inputs.grain,
    vignette: inputs.vignette,
    palA: pal.a, palB: pal.b, palC: pal.c, palD: pal.d,
  },
}};
`

const fableCymaticsDef: CompoundGeneratorDef = {
  id: 'builtin_fableCymatics',
  name: 'Fable Cymatics',
  description: 'Chladni figures — sand gathering on the nodal lines of a singing plate, sweeping through resonances',
  defaultCameraDistance: 0,
  generatorType: 'fableCymatics_generator',
  outputMode: 'shader',
  params: cymaticsParams,
  inputs: cymaticsParams.map(p => ({
    name: p.name,
    type: 'number' as const,
    default: p.type === 'bool' ? (p.default ? 1 : 0) : (p.type === 'enum' ? 0 : (p.default as number)),
  })),
  outputs: [{ name: 'shaderConfig', type: 'array' as const }],
  evaluateSource: cymaticsEvaluateSource,
  fragmentShader: cymaticsFrag,
}

export const FABLE_CYMATICS_GENERATORS: CompoundGeneratorDef[] = [fableCymaticsDef]
