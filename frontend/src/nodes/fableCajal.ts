import type { CompoundGeneratorDef } from './generatorGraphFactory'
import type { ParamSchemaDef } from './storage'
import { FABLE_GLSL_LIB, FABLE_EVAL_LIB, FABLE_PALETTE_NAMES } from './fableDisplayLib'

// ═══════════════════════════════════════════════════════════════════════════
// FABLE CAJAL — neurons drawn in ink, after Santiago Ramón y Cajal
//
// Growth tips are GPU agents. Every tip belonging to a neuron follows an
// IDENTICAL turn sequence derived from a hierarchical branch key
// floor(trait · trunks · 2^level) — so hundreds of tips overlap into one
// shared trunk stroke, then split into ever-finer branch pairs as the
// level rises. Ink deposits multiplicatively darken aged sepia paper.
// Neurons grow, rest, fade, and are redrawn elsewhere on the sheet.
// ═══════════════════════════════════════════════════════════════════════════

// shared growth-phase logic, injected into both agent + deposit shaders
const CAJAL_PHASE_GLSL = `
uniform float uTime;
uniform float growthSpeed;
uniform float cycleT;
uniform float branchEvery;
uniform float depth;
uniform float trunks;

// per-neuron growth phase, staggered so the sheet is never blank
float neuronPhase(float neuronId) {
  return mod(uTime * growthSpeed + neuronId * 0.618034 * cycleT, cycleT);
}
float levelOf(float cyclePhase) {
  return min(floor(cyclePhase / branchEvery), depth);
}
float branchKey(float trait, float level) {
  return floor(trait * trunks * exp2(level));
}
vec2 somaPos(float neuronId, float cycIdx) {
  float sx = fract(sin(neuronId * 127.1 + cycIdx * 311.7) * 43758.5453);
  float sy = fract(sin(neuronId * 269.5 + cycIdx * 183.3) * 43758.5453);
  return vec2(0.14 + 0.72 * sx, 0.14 + 0.72 * sy);
}
`

const cajalAgentShader = `precision highp float;
uniform sampler2D agentTex;
uniform vec2 resolution;
uniform float tipSpeed;
uniform float meander;
uniform float branchAngle;
uniform float phaseStep;
varying vec2 vUv;

${FABLE_GLSL_LIB}
${CAJAL_PHASE_GLSL}

void main() {
  vec4 agent = texture2D(agentTex, vUv);
  vec2 pos = agent.xy;
  float angle = agent.z;
  float neuronId = floor(agent.w + 0.001);
  float trait = fract(agent.w);

  float phase = neuronPhase(neuronId);
  float cycIdx = floor((uTime * growthSpeed + neuronId * 0.618034 * cycleT) / cycleT);

  // cycle restart: teleport home and aim along this tip's trunk direction
  if (phase < phaseStep * 1.5) {
    pos = somaPos(neuronId, cycIdx);
    float trunkKey = floor(trait * trunks);
    angle = (trunkKey + 0.5) / trunks * 6.2831853
          + (fableHash(vec2(neuronId * 3.1, cycIdx * 7.7)) - 0.5) * 1.2
          + (trait - 0.5) * 0.04;
  }

  float level = levelOf(phase);
  float key = branchKey(trait, level);

  if (level < depth) {
    // shared meander: every tip with the same key turns identically
    float tick = floor(phase * 9.0);
    float rnd = fableHash(vec2(neuronId * 61.7 + key * 0.173, tick * 0.719 + cycIdx));
    angle += (rnd - 0.5) * meander * phaseStep * 9.0;

    // fork kick: at the start of each level the two children peel apart
    float levelFrac = fract(phase / branchEvery);
    if (level > 0.5 && levelFrac < 0.12) {
      float bit = mod(key, 2.0) - 0.5;
      angle += bit * 2.0 * branchAngle * 0.0174533 * (phaseStep / (0.12 * branchEvery));
    }

    pos += vec2(cos(angle), sin(angle)) * (tipSpeed / resolution.x) * phaseStep;
  }

  gl_FragColor = vec4(pos, angle, neuronId + trait * 0.999);
}`

const cajalDepositVert = `attribute vec2 agentUV;
uniform sampler2D agentTex;
uniform float inkFlow;
uniform float phaseStep;
varying float vDeposit;

${CAJAL_PHASE_GLSL}

void main() {
  vec4 agent = texture2D(agentTex, agentUV);
  float neuronId = floor(agent.w + 0.001);
  float trait = fract(agent.w);
  float phase = neuronPhase(neuronId);
  float level = levelOf(phase);

  gl_Position = vec4(agent.xy * 2.0 - 1.0, 0.0, 1.0);
  gl_PointSize = level < 1.5 ? 2.0 : 1.0;
  // ink per unit path length is constant: deposit scales with step length.
  // Higher levels taper — fine distal branches are drawn with a drier pen.
  float taper = pow(0.8, level);
  vDeposit = level < depth ? inkFlow * 1.4 * phaseStep * taper : 0.0;
}`

const cajalDepositFrag = `precision highp float;
varying float vDeposit;
void main() {
  gl_FragColor = vec4(vDeposit, 0.0, 0.0, 1.0);
}`

const cajalFadeShader = `precision highp float;
uniform sampler2D trailTex;
uniform vec2 resolution;
uniform float inkFade;
uniform float bleed;
varying vec2 vUv;

void main() {
  vec2 px = 1.0 / resolution;
  vec4 c = texture2D(trailTex, vUv);
  vec4 b = (texture2D(trailTex, vUv + vec2(px.x, 0.0))
          + texture2D(trailTex, vUv - vec2(px.x, 0.0))
          + texture2D(trailTex, vUv + vec2(0.0, px.y))
          + texture2D(trailTex, vUv - vec2(0.0, px.y))) * 0.25;
  vec4 outC = mix(c, b, bleed * 0.22) * inkFade;
  gl_FragColor = outC;
}`

const cajalDisplayShader = `precision highp float;
uniform sampler2D trailTex;
uniform vec2 resolution;
uniform float uTime;
uniform float uAspect;
uniform float inkStrength;
uniform float exposure;
uniform float grain;
uniform float vignette;
uniform vec3 palA;
uniform vec3 palB;
uniform vec3 palC;
uniform vec3 palD;
varying vec2 vUv;

${FABLE_GLSL_LIB}

void main() {
  vec2 suv = vUv - 0.5;
  vec2 pc = vec2(suv.x * uAspect, suv.y);
  float cover = max(uAspect, 1.0);
  vec2 tuv = pc / cover + 0.5;

  // aged paper: warm cream, directional fibers, soft blotches
  vec3 paper = vec3(0.82, 0.74, 0.55);
  float f1 = fableHash(floor(tuv * vec2(900.0, 130.0)));
  float f2 = fableHash(floor(tuv * vec2(140.0, 850.0)));
  paper *= 0.94 + 0.06 * (f1 * 0.6 + f2 * 0.4);
  float blotch = sin(tuv.x * 13.1 + sin(tuv.y * 9.7) * 2.0)
               * sin(tuv.y * 11.3 + sin(tuv.x * 7.3) * 1.7);
  paper *= 0.97 + 0.03 * blotch;

  // ink darkens the paper multiplicatively (Beer–Lambert absorption);
  // the palette tints the ink — ember reads as classic sepia-brown
  float d = texture2D(trailTex, tuv).r * inkStrength;
  vec3 inkTint = fablePal(0.15, palA, palB, palC, palD);
  // blend palette ink with a fixed sepia bias so it always reads as drawn ink
  vec3 absorb = mix(vec3(0.6, 1.1, 1.7), vec3(1.05) - inkTint * 0.75, 0.45);
  vec3 col = paper * exp(-d * absorb * 2.4);

  col = fableACES(col * exposure);
  col = fableGrade(col, vUv, suv, resolution, grain, vignette);
  gl_FragColor = vec4(col, 1.0);
}`

const cajalParams: ParamSchemaDef[] = [
  { name: 'neurons', type: 'int', min: 3, max: 24, default: 9, description: 'Neurons on the sheet' },
  { name: 'trunks', type: 'int', min: 2, max: 8, default: 5, description: 'Primary dendrites per neuron' },
  { name: 'depth', type: 'int', min: 3, max: 9, default: 6, description: 'Branching depth' },
  { name: 'branchEvery', type: 'float', min: 0.5, max: 4, default: 1.4, description: 'Seconds between branchings' },
  { name: 'branchAngle', type: 'float', min: 5, max: 60, default: 26, description: 'Fork angle (degrees)' },
  { name: 'meander', type: 'float', min: 0, max: 2, default: 0.6, description: 'Dendrite wiggle' },
  { name: 'tipSpeed', type: 'float', min: 20, max: 160, default: 52, description: 'Growth speed' },
  { name: 'growthSpeed', type: 'float', min: 0.2, max: 2, default: 0.8, description: 'Overall drawing tempo' },
  { name: 'restHold', type: 'float', min: 0, max: 6, default: 2.5, description: 'Rest before redraw (s)' },
  { name: 'inkFlow', type: 'float', min: 0, max: 2, default: 1, description: 'Ink flow' },
  { name: 'fading', type: 'float', min: 0, max: 1, default: 0.15, description: 'Old ink fading rate' },
  { name: 'bleed', type: 'float', min: 0, max: 1, default: 0.16, description: 'Ink bleed into paper' },
  { name: 'inkStrength', type: 'float', min: 0.5, max: 4, default: 2, description: 'Ink darkness' },
  { name: 'simResolution', type: 'int', min: 512, max: 2048, default: 1024, description: 'Canvas resolution' },
  { name: 'palette', type: 'enum', default: 'ember', enumValues: FABLE_PALETTE_NAMES, description: 'Ink tint palette' },
  { name: 'colorHue', type: 'float', min: 0, max: 360, default: 0, description: 'Ink hue shift' },
  { name: 'exposure', type: 'float', min: 0.3, max: 3, default: 0.95, description: 'Exposure' },
  { name: 'grain', type: 'float', min: 0, max: 1, default: 0.2, description: 'Film grain' },
  { name: 'vignette', type: 'float', min: 0, max: 1, default: 0.45, description: 'Vignette' },
]

const cajalEvaluateSource = FABLE_EVAL_LIB + `
var simRes = Math.min(2048, Math.max(512, Math.round(inputs.simResolution)));
var paletteIdx = Math.round(inputs.palette || 0);
var pal = fablePalette(paletteIdx, inputs.colorHue / 360);
var res = ctx.resolution || [1, 1];
var aspect = res[1] > 0 ? res[0] / res[1] : 1;

var neurons = Math.max(3, Math.round(inputs.neurons));
var agentSide = 128; // 16384 growth tips shared across neurons

var key = nodeId + '_fableCajal';
var state = ctx.frameState.get(key);
if (!state || state.neurons !== neurons) {
  var data = new Float32Array(agentSide * agentSide * 4);
  var count = agentSide * agentSide;
  for (var i = 0; i < count; i++) {
    var neuronId = i % neurons;
    var trait = (i / count + (i % 977) / 977) % 1;
    data[i*4] = -1; data[i*4+1] = -1; // offscreen until first cycle reset
    data[i*4+2] = 0;
    data[i*4+3] = neuronId + trait * 0.999;
  }
  state = { neurons: neurons, data: data, gen: (state ? state.gen + 1 : 0), lastT: ctx.elapsed };
  ctx.frameState.set(key, state);
}

// wall-time normalization (same scheme as Fable Caustics)
var dt = Math.min(0.25, Math.max(1/240, ctx.elapsed - (state.lastT || ctx.elapsed - 1/60)));
state.lastT = ctx.elapsed;
var steps = Math.min(4, Math.max(1, Math.round(dt * 120)));
var phaseStep = inputs.growthSpeed * dt / steps;

var cycleT = inputs.branchEvery * (Math.round(inputs.depth) + 0.0) + inputs.restHold;

var phaseUniforms = {
  uTime: ctx.elapsed,
  growthSpeed: inputs.growthSpeed,
  cycleT: cycleT,
  branchEvery: inputs.branchEvery,
  depth: Math.round(inputs.depth),
  trunks: Math.round(inputs.trunks),
};

return { shaderConfig: {
  passes: [
    { name: 'agents', fragmentShader: inputs.agentsShader, target: 'agentState',
      readFrom: { agentTex: 'agentState' },
      uniforms: Object.assign({
        resolution: [simRes, simRes],
        tipSpeed: inputs.tipSpeed,
        meander: inputs.meander,
        branchAngle: inputs.branchAngle,
        phaseStep: phaseStep,
      }, phaseUniforms) },
    { name: 'fade', fragmentShader: inputs.fadeShader, target: 'trail',
      readFrom: { trailTex: 'trail' },
      uniforms: {
        resolution: [simRes, simRes],
        inkFade: 1.0 - inputs.fading * 0.004 * phaseStep * 120,
        bleed: inputs.bleed,
      } },
    { name: 'deposit', mode: 'deposit', agentTarget: 'agentState', agentRes: agentSide,
      vertexShader: inputs.depositVertShader, fragmentShader: inputs.depositFragShader,
      target: 'trail', noClear: true,
      uniforms: Object.assign({
        inkFlow: inputs.inkFlow,
        phaseStep: phaseStep,
      }, phaseUniforms) },
    { name: 'display', fragmentShader: inputs.displayShader, target: null,
      readFrom: { trailTex: 'trail' },
      uniforms: {
        resolution: res,
        uTime: ctx.elapsed,
        uAspect: aspect,
        inkStrength: inputs.inkStrength,
        exposure: inputs.exposure,
        grain: inputs.grain,
        vignette: inputs.vignette,
        palA: pal.a, palB: pal.b, palC: pal.c, palD: pal.d,
      } },
  ],
  renderTargetDefs: {
    agentState: { width: agentSide, height: agentSide, type: 'float', filter: 'nearest', pingPong: true, _gen: state.gen },
    trail: { width: simRes, height: simRes, type: 'float', filter: 'linear', pingPong: true, _gen: state.gen },
  },
  initData: { agentState: state.data },
  stepsPerFrame: steps,
}};
`

const fableCajalDef: CompoundGeneratorDef = {
  id: 'builtin_fableCajal',
  name: 'Fable Cajal',
  description: 'Neurons drawn in ink on aged paper — branching dendrites grow, rest, fade and are redrawn, after Ramón y Cajal',
  defaultCameraDistance: 0,
  generatorType: 'fableCajal_generator',
  outputMode: 'shader',
  params: cajalParams,
  inputs: cajalParams.map(p => ({
    name: p.name,
    type: 'number' as const,
    default: p.type === 'bool' ? (p.default ? 1 : 0) : (p.type === 'enum' ? 0 : (p.default as number)),
  })),
  outputs: [{ name: 'shaderConfig', type: 'array' as const }],
  evaluateSource: cajalEvaluateSource,
  shaderSources: {
    agents: cajalAgentShader,
    fade: cajalFadeShader,
    depositVert: cajalDepositVert,
    depositFrag: cajalDepositFrag,
    display: cajalDisplayShader,
  },
}

export const FABLE_CAJAL_GENERATORS: CompoundGeneratorDef[] = [fableCajalDef]
