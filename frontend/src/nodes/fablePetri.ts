import type { CompoundGeneratorDef } from './generatorGraphFactory'
import type { ParamSchemaDef } from './storage'
import { FABLE_EVAL_LIB, FABLE_PALETTE_NAMES, FABLE_FIELD_DISPLAY_FRAG } from './fableDisplayLib'

// ═══════════════════════════════════════════════════════════════════════════
// FABLE PETRI — Multiple Neighborhood Cellular Automata (MNCA)
//
// Slackermanz-style MNCA: each cell evaluates several ring/disc neighborhoods,
// each neighborhood contributes sequential interval-threshold rules (later
// rules overwrite earlier ones). Produces writhing amoebas, membranes, and
// mitosis-like blobs. State texture: r = cell, g = slow EMA, b = activity EMA.
// Base ruleset is the verified "Example 0" (ring r7-r4 + disc r3, six rules);
// species presets are curated transforms of it (radius/threshold/strength).
// ═══════════════════════════════════════════════════════════════════════════

const petriUpdateFrag = `precision highp float;
uniform sampler2D fieldTex;
uniform vec2 resolution;
uniform float rIn0;
uniform float rOut0;
uniform float rDisc;
uniform float rIn2;
uniform float rOut2;
uniform float ruleNH[8];
uniform float ruleLo[8];
uniform float ruleHi[8];
uniform float ruleVal[8];
uniform float ruleCount;
uniform float ruleStrength;
uniform float biome;
uniform float time;
uniform vec2 mousePos;
uniform float mouseDraw;
varying vec2 vUv;

// cheap smooth value noise for biome threshold modulation
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5453);
  float b = fract(sin(dot(i + vec2(1.0, 0.0), vec2(127.1, 311.7))) * 43758.5453);
  float c = fract(sin(dot(i + vec2(0.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
  float d = fract(sin(dot(i + vec2(1.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

void main() {
  vec2 texel = 1.0 / resolution;
  vec4 prev = texture2D(fieldTex, vUv);
  float cur = prev.r;

  // Accumulate three neighborhoods in one constant-bound sweep
  float sum0 = 0.0; float cnt0 = 0.0;
  float sum1 = 0.0; float cnt1 = 0.0;
  float sum2 = 0.0; float cnt2 = 0.0;
  float maxR = max(max(rOut0, rDisc), rOut2);

  for (int dy = -12; dy <= 12; dy++) {
    for (int dx = -12; dx <= 12; dx++) {
      float d = length(vec2(float(dx), float(dy)));
      if (d > maxR + 0.5) continue;
      float v = texture2D(fieldTex, fract(vUv + vec2(float(dx), float(dy)) * texel)).r;
      if (d <= rOut0 + 0.5 && d > rIn0 + 0.5) { sum0 += v; cnt0 += 1.0; }
      if (d <= rDisc + 0.5) { sum1 += v; cnt1 += 1.0; }
      if (d <= rOut2 + 0.5 && d > rIn2 + 0.5) { sum2 += v; cnt2 += 1.0; }
    }
  }
  float nh0 = sum0 / max(cnt0, 1.0);
  float nh1 = sum1 / max(cnt1, 1.0);
  float nh2 = sum2 / max(cnt2, 1.0);

  // Regional threshold drift ("biomes")
  float shift = (vnoise(vUv * 3.0 + time * 0.01) - 0.5) * biome * 0.06;

  // Sequential interval rules — later rules overwrite earlier ones
  float res = cur;
  for (int i = 0; i < 8; i++) {
    if (float(i) >= ruleCount) break;
    float nh = ruleNH[i] < 0.5 ? nh0 : (ruleNH[i] < 1.5 ? nh1 : nh2);
    if (nh >= ruleLo[i] + shift && nh <= ruleHi[i] + shift) {
      res = mix(res, ruleVal[i], ruleStrength);
    }
  }

  // Mouse drawing (draw > 0) or erasing (draw < 0)
  float md = distance(vUv, mousePos);
  if (abs(mouseDraw) > 0.01 && md < 0.03) {
    float fall = 1.0 - md / 0.03;
    res = mix(res, mouseDraw > 0.0 ? 1.0 : 0.0, fall * abs(mouseDraw));
  }

  res = clamp(res, 0.0, 1.0);
  float ema = mix(prev.g, res, 0.015);
  float act = mix(prev.b, abs(res - cur) * 4.0, 0.08);
  gl_FragColor = vec4(res, ema, clamp(act, 0.0, 1.0), 1.0);
}`

const petriDisplayFrag = FABLE_FIELD_DISPLAY_FRAG

const petriParams: ParamSchemaDef[] = [
  { name: 'simResolution', type: 'int', min: 256, max: 1024, default: 512, description: 'Field resolution' },
  { name: 'species', type: 'enum', default: 'primordial', enumValues: ['primordial', 'mitosis', 'labyrinth', 'tides', 'storms'], description: 'MNCA rule species' },
  { name: 'radiusScale', type: 'float', min: 0.5, max: 1.7, default: 1, description: 'Neighborhood radius scale' },
  { name: 'ruleStrength', type: 'float', min: 0.1, max: 1, default: 1, description: 'Rule blend (1 = discrete MNCA, lower = fluid)' },
  { name: 'thresholdShift', type: 'float', min: -0.05, max: 0.05, default: 0, description: 'Global rule threshold shift' },
  { name: 'biome', type: 'float', min: 0, max: 1, default: 0.25, description: 'Regional threshold drift — spatial variety' },
  { name: 'stepsPerFrame', type: 'int', min: 1, max: 4, default: 1, description: 'Simulation steps per frame' },
  { name: 'seedPattern', type: 'enum', default: 'soup', enumValues: ['soup', 'islands', 'dots', 'fine'], description: 'Initial seeding' },
  { name: 'seedDensity', type: 'float', min: 0.1, max: 0.9, default: 0.5, description: 'Initial fill density' },
  { name: 'palette', type: 'enum', default: 'abyss', enumValues: FABLE_PALETTE_NAMES, description: 'Color palette' },
  { name: 'colorHue', type: 'float', min: 0, max: 360, default: 0, description: 'Palette hue shift' },
  { name: 'exposure', type: 'float', min: 0.3, max: 3, default: 1.1, description: 'Brightness' },
  { name: 'relief', type: 'float', min: 0, max: 2, default: 1, description: 'Relief lighting strength' },
  { name: 'glow', type: 'float', min: 0, max: 2, default: 0.8, description: 'Activity glow' },
  { name: 'grain', type: 'float', min: 0, max: 1, default: 0.3, description: 'Film grain' },
  { name: 'vignette', type: 'float', min: 0, max: 1, default: 0.35, description: 'Edge vignette' },
  { name: 'mouseDraw', type: 'float', min: -1, max: 1, default: 0.8, description: 'Mouse draws (+) or erases (−) cells' },
]

const petriEvaluateSource = FABLE_EVAL_LIB + `
var simRes = Math.min(1024, Math.max(256, Math.round(inputs.simResolution)));
var speciesIdx = Math.round(inputs.species || 0);
var seedIdx = Math.round(inputs.seedPattern || 0);
var paletteIdx = Math.round(inputs.palette || 0);

// Species: transforms of the verified Slackermanz Example-0 ruleset.
// base radii: ring(4,7), disc(3), ring2 unused (rIn2=rOut2=0)
// base rules: [nh, lo, hi, val] applied sequentially
var SPECIES = [
  { rs: 1.0,  shift: 0.0,    strength: 1.0,  extraRing: false }, // primordial
  { rs: 1.5,  shift: 0.010,  strength: 1.0,  extraRing: false }, // mitosis
  { rs: 0.65, shift: -0.015, strength: 1.0,  extraRing: false }, // labyrinth
  { rs: 1.0,  shift: 0.0,    strength: 0.32, extraRing: false }, // tides
  { rs: 1.7,  shift: 0.005,  strength: 0.55, extraRing: true  }, // storms
];
var sp = SPECIES[Math.min(speciesIdx, SPECIES.length - 1)];
var rs = sp.rs * inputs.radiusScale;
var rIn0 = Math.min(11, 4 * rs), rOut0 = Math.min(12, 7 * rs), rDisc = Math.min(12, 3 * rs);
var rIn2 = sp.extraRing ? Math.min(11, 8 * rs) : 0;
var rOut2 = sp.extraRing ? Math.min(12, 11 * rs) : 0;

var shift = sp.shift + inputs.thresholdShift;
var BASE_RULES = [
  [0, 0.210, 0.220, 1.0],
  [0, 0.350, 0.500, 0.0],
  [0, 0.750, 0.850, 0.0],
  [1, 0.100, 0.280, 0.0],
  [1, 0.430, 0.550, 1.0],
  [0, 0.120, 0.150, 0.0],
];
var rules = BASE_RULES.map(function(r){ return [r[0], r[1] + shift, r[2] + shift, r[3]]; });
if (sp.extraRing) {
  rules.push([2, 0.15, 0.30, 1.0]);
  rules.push([2, 0.55, 0.80, 0.0]);
}
var ruleNH = [0,0,0,0,0,0,0,0], ruleLo = [0,0,0,0,0,0,0,0], ruleHi = [0,0,0,0,0,0,0,0], ruleVal = [0,0,0,0,0,0,0,0];
for (var i = 0; i < rules.length; i++) { ruleNH[i]=rules[i][0]; ruleLo[i]=rules[i][1]; ruleHi[i]=rules[i][2]; ruleVal[i]=rules[i][3]; }

var key = nodeId + '_fablePetri';
var state = ctx.frameState.get(key);
if (!state || state.simRes !== simRes || state.seedIdx !== seedIdx || state.seedDensity !== inputs.seedDensity) {
  var data = new Float32Array(simRes * simRes * 4);
  var rng = (function(s){return function(){s=(s*1103515245+12345)&0x7fffffff;return s/0x7fffffff;}})(777);
  var dens = inputs.seedDensity;
  for (var y = 0; y < simRes; y++) {
    for (var x = 0; x < simRes; x++) {
      var idx4 = (y * simRes + x) * 4;
      var v = 0;
      if (seedIdx === 0) {
        // soup: coarse random patches
        var cx2 = Math.floor(x / 24), cy2 = Math.floor(y / 24);
        var h = Math.abs(Math.sin(cx2 * 127.1 + cy2 * 311.7) * 43758.5453) % 1;
        v = h < dens ? rng() : 0;
      } else if (seedIdx === 1) {
        // islands: several filled discs
        var best = 0;
        for (var c = 0; c < 7; c++) {
          var ix = (Math.abs(Math.sin(c * 12.9898) * 43758.5453) % 1) * simRes;
          var iy = (Math.abs(Math.sin(c * 78.233) * 43758.5453) % 1) * simRes;
          var dd = Math.hypot(x - ix, y - iy);
          if (dd < simRes * 0.06 * (0.5 + dens)) best = 1;
        }
        v = best;
      } else if (seedIdx === 2) {
        // dots: sparse grid of small squares
        v = (x % 32 < 5 && y % 32 < 5 && rng() < dens + 0.3) ? 1 : 0;
      } else {
        v = rng() < dens * 0.6 ? rng() : 0;
      }
      data[idx4] = v; data[idx4 + 1] = v; data[idx4 + 2] = 0; data[idx4 + 3] = 1;
    }
  }
  state = { simRes: simRes, seedIdx: seedIdx, seedDensity: inputs.seedDensity, data: data, gen: (state ? state.gen + 1 : 0) };
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
        rIn0: rIn0, rOut0: rOut0, rDisc: rDisc, rIn2: rIn2, rOut2: rOut2,
        ruleNH: ruleNH, ruleLo: ruleLo, ruleHi: ruleHi, ruleVal: ruleVal,
        ruleCount: rules.length,
        ruleStrength: sp.strength * inputs.ruleStrength,
        biome: inputs.biome,
        time: ctx.elapsed,
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
  stepsPerFrame: Math.min(4, Math.max(1, Math.round(inputs.stepsPerFrame))),
}};
`

const fablePetriDef: CompoundGeneratorDef = {
  id: 'builtin_fablePetri',
  name: 'Fable Petri',
  description: 'Multiple-neighborhood cellular automata — writhing amoebas, membranes, and mitosis in a living petri dish',
  defaultCameraDistance: 0,
  generatorType: 'fablePetri_generator',
  outputMode: 'shader',
  params: petriParams,
  inputs: petriParams.map(p => ({
    name: p.name,
    type: 'number' as const,
    default: p.type === 'bool' ? (p.default ? 1 : 0) : (p.type === 'enum' ? 0 : (p.default as number)),
  })),
  outputs: [{ name: 'shaderConfig', type: 'array' as const }],
  evaluateSource: petriEvaluateSource,
  shaderSources: {
    update: petriUpdateFrag,
    display: petriDisplayFrag,
  },
}

export const FABLE_PETRI_GENERATORS: CompoundGeneratorDef[] = [fablePetriDef]
