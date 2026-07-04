import type { CompoundGeneratorDef } from './generatorGraphFactory'
import type { ParamSchemaDef } from './storage'
import { FABLE_EVAL_LIB, FABLE_PALETTE_NAMES, FABLE_FIELD_DISPLAY_FRAG } from './fableDisplayLib'

// ═══════════════════════════════════════════════════════════════════════════
// FABLE CONTINUUM — SmoothLife (continuous cellular automata, Rafler 2011)
//
// Life generalized to continuous space, time, and state: smooth gliding
// organisms instead of blocky cells. Outer-annulus average n and inner-disc
// average m drive a sigmoid birth/survival transition; the state integrates
// smoothly: next = prev + dt * (S(n,m) - prev).
// Known-good ruleset (Chakazul's Lenia-shader): outer r9 / inner r3,
// birth 0.27-0.34, survival 0.52-0.75, alpha_n 0.03, alpha_m 0.15, dt 0.09.
// State texture: r = cell, g = slow EMA, b = activity EMA (shared display).
// ═══════════════════════════════════════════════════════════════════════════

const continuumUpdateFrag = `precision highp float;
uniform sampler2D fieldTex;
uniform vec2 resolution;
uniform float rOuter;
uniform float rInner;
uniform float b1;
uniform float b2;
uniform float d1;
uniform float d2;
uniform float alphaN;
uniform float alphaM;
uniform float dt;
uniform vec2 mousePos;
uniform float mouseDraw;
varying vec2 vUv;

float sigma1(float x, float a, float alpha) {
  return 1.0 / (1.0 + exp(-(x - a) * 4.0 / alpha));
}

void main() {
  vec2 texel = 1.0 / resolution;
  vec4 prev = texture2D(fieldTex, vUv);
  float cur = prev.r;

  // Anti-aliased annulus (n) and disc (m) averages in one sweep
  float sumN = 0.0; float cntN = 0.0;
  float sumM = 0.0; float cntM = 0.0;
  for (int dy = -12; dy <= 12; dy++) {
    for (int dx = -12; dx <= 12; dx++) {
      float d = length(vec2(float(dx), float(dy)));
      if (d > rOuter + 1.0) continue;
      float v = texture2D(fieldTex, fract(vUv + vec2(float(dx), float(dy)) * texel)).r;
      // smooth 1px edge weights
      float wOut = clamp(rOuter + 0.5 - d, 0.0, 1.0);
      float wIn = clamp(rInner + 0.5 - d, 0.0, 1.0);
      float wRing = wOut * (1.0 - wIn);
      sumN += v * wRing; cntN += wRing;
      sumM += v * wIn; cntM += wIn;
    }
  }
  float n = sumN / max(cntN, 1e-4);
  float m = sumM / max(cntM, 1e-4);

  // SmoothLife transition: birth thresholds when dead, survival when alive
  float aliveness = sigma1(m, 0.5, alphaM);
  float t1 = mix(b1, d1, aliveness);
  float t2 = mix(b2, d2, aliveness);
  float S = sigma1(n, t1, alphaN) * (1.0 - sigma1(n, t2, alphaN));

  float res = cur + dt * (S - cur);

  // Mouse drawing / erasing
  float md = distance(vUv, mousePos);
  if (abs(mouseDraw) > 0.01 && md < 0.035) {
    float fall = 1.0 - md / 0.035;
    res = mix(res, mouseDraw > 0.0 ? 0.9 : 0.0, fall * abs(mouseDraw) * 0.4);
  }

  res = clamp(res, 0.0, 1.0);
  float ema = mix(prev.g, res, 0.015);
  float act = mix(prev.b, abs(res - cur) * 12.0, 0.08);
  gl_FragColor = vec4(res, ema, clamp(act, 0.0, 1.0), 1.0);
}`

const continuumParams: ParamSchemaDef[] = [
  { name: 'simResolution', type: 'int', min: 256, max: 1024, default: 512, description: 'Field resolution' },
  { name: 'kernelRadius', type: 'float', min: 5, max: 12, default: 9, description: 'Outer kernel radius (inner = 1/3)' },
  { name: 'birthLo', type: 'float', min: 0.15, max: 0.4, default: 0.27, description: 'Birth interval low' },
  { name: 'birthHi', type: 'float', min: 0.2, max: 0.5, default: 0.34, description: 'Birth interval high' },
  { name: 'surviveLo', type: 'float', min: 0.3, max: 0.65, default: 0.52, description: 'Survival interval low' },
  { name: 'surviveHi', type: 'float', min: 0.5, max: 0.9, default: 0.75, description: 'Survival interval high' },
  { name: 'alphaN', type: 'float', min: 0.005, max: 0.15, default: 0.03, description: 'Transition sharpness (outer)' },
  { name: 'alphaM', type: 'float', min: 0.05, max: 0.4, default: 0.15, description: 'Aliveness sharpness (inner)' },
  { name: 'timeStep', type: 'float', min: 0.02, max: 0.35, default: 0.09, description: 'Integration speed dt' },
  { name: 'stepsPerFrame', type: 'int', min: 1, max: 6, default: 2, description: 'Simulation steps per frame' },
  { name: 'seedDensity', type: 'float', min: 0.1, max: 0.9, default: 0.4, description: 'Initial organism density' },
  { name: 'palette', type: 'enum', default: 'aurora', enumValues: FABLE_PALETTE_NAMES, description: 'Color palette' },
  { name: 'colorHue', type: 'float', min: 0, max: 360, default: 0, description: 'Palette hue shift' },
  { name: 'exposure', type: 'float', min: 0.3, max: 3, default: 1.2, description: 'Brightness' },
  { name: 'relief', type: 'float', min: 0, max: 2, default: 1.1, description: 'Relief lighting strength' },
  { name: 'glow', type: 'float', min: 0, max: 2, default: 1, description: 'Activity glow' },
  { name: 'grain', type: 'float', min: 0, max: 1, default: 0.3, description: 'Film grain' },
  { name: 'vignette', type: 'float', min: 0, max: 1, default: 0.35, description: 'Edge vignette' },
  { name: 'mouseDraw', type: 'float', min: -1, max: 1, default: 0.8, description: 'Mouse feeds (+) or kills (−) organisms' },
]

const continuumEvaluateSource = FABLE_EVAL_LIB + `
var simRes = Math.min(1024, Math.max(256, Math.round(inputs.simResolution)));
var paletteIdx = Math.round(inputs.palette || 0);
var rOuter = Math.min(12, Math.max(5, inputs.kernelRadius));
var rInner = rOuter / 3;

var key = nodeId + '_fableContinuum';
var state = ctx.frameState.get(key);
if (!state || state.simRes !== simRes || state.seedDensity !== inputs.seedDensity) {
  var data = new Float32Array(simRes * simRes * 4);
  var rng = (function(s){return function(){s=(s*1103515245+12345)&0x7fffffff;return s/0x7fffffff;}})(4242);
  // Seed with organism-scale blobs: soft discs about the kernel size
  var blobCount = Math.round(simRes * simRes * inputs.seedDensity / 2200);
  var blobs = [];
  for (var b = 0; b < blobCount; b++) blobs.push([rng() * simRes, rng() * simRes, (0.8 + rng() * 1.2) * rOuter]);
  for (var y = 0; y < simRes; y++) {
    for (var x = 0; x < simRes; x++) {
      var v = 0;
      for (var b2i = 0; b2i < blobs.length; b2i++) {
        var dx = Math.min(Math.abs(x - blobs[b2i][0]), simRes - Math.abs(x - blobs[b2i][0]));
        var dy = Math.min(Math.abs(y - blobs[b2i][1]), simRes - Math.abs(y - blobs[b2i][1]));
        var dd = Math.hypot(dx, dy);
        if (dd < blobs[b2i][2]) { v = Math.max(v, 1.0 - dd / blobs[b2i][2]); }
      }
      var idx4 = (y * simRes + x) * 4;
      data[idx4] = Math.min(1, v * 1.4); data[idx4 + 1] = v; data[idx4 + 2] = 0; data[idx4 + 3] = 1;
    }
  }
  state = { simRes: simRes, seedDensity: inputs.seedDensity, data: data, gen: (state ? state.gen + 1 : 0) };
  ctx.frameState.set(key, state);
}

var pal = fablePalette(paletteIdx, inputs.colorHue / 360);
var res = ctx.resolution || [1, 1];
var aspect = res[1] > 0 ? res[0] / res[1] : 1;
var mx = ctx.mouse ? (ctx.mouse.x + 1) * 0.5 : -10;
var my = ctx.mouse ? (ctx.mouse.y + 1) * 0.5 : -10;

return { shaderConfig: {
  passes: [
    { name: 'update', fragmentShader: inputs.updateShader, target: 'field',
      readFrom: { fieldTex: 'field' },
      uniforms: {
        resolution: [simRes, simRes],
        rOuter: rOuter, rInner: rInner,
        b1: inputs.birthLo, b2: inputs.birthHi,
        d1: inputs.surviveLo, d2: inputs.surviveHi,
        alphaN: inputs.alphaN, alphaM: inputs.alphaM,
        dt: inputs.timeStep,
        mousePos: [mx, my],
        mouseDraw: inputs.mouseDraw,
      } },
    { name: 'display', fragmentShader: inputs.displayShader, target: null,
      readFrom: { fieldTex: 'field' },
      uniforms: {
        resolution: [simRes, simRes],
        exposure: inputs.exposure,
        relief: inputs.relief,
        glow: inputs.glow,
        grain: inputs.grain,
        vignette: inputs.vignette,
        palA: pal.a, palB: pal.b, palC: pal.c, palD: pal.d,
        uAspect: aspect,
      } },
  ],
  renderTargetDefs: {
    field: { width: simRes, height: simRes, type: 'float', filter: 'linear', wrap: 'repeat', pingPong: true, _gen: state.gen },
  },
  initData: { field: state.data },
  stepsPerFrame: Math.min(6, Math.max(1, Math.round(inputs.stepsPerFrame))),
}};
`

const fableContinuumDef: CompoundGeneratorDef = {
  id: 'builtin_fableContinuum',
  name: 'Fable Continuum',
  description: 'SmoothLife — continuous artificial life with smooth gliding organisms, blooming colonies, and living membranes',
  defaultCameraDistance: 0,
  generatorType: 'fableContinuum_generator',
  outputMode: 'shader',
  params: continuumParams,
  inputs: continuumParams.map(p => ({
    name: p.name,
    type: 'number' as const,
    default: p.type === 'bool' ? (p.default ? 1 : 0) : (p.type === 'enum' ? 0 : (p.default as number)),
  })),
  outputs: [{ name: 'shaderConfig', type: 'array' as const }],
  evaluateSource: continuumEvaluateSource,
  shaderSources: {
    update: continuumUpdateFrag,
    display: FABLE_FIELD_DISPLAY_FRAG,
  },
}

export const FABLE_CONTINUUM_GENERATORS: CompoundGeneratorDef[] = [fableContinuumDef]
