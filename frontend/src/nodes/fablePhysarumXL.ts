import type { CompoundGeneratorDef } from './generatorGraphFactory'
import type { ParamSchemaDef } from './storage'
import { FABLE_GLSL_LIB, FABLE_EVAL_LIB } from './fableDisplayLib'

// ═══════════════════════════════════════════════════════════════════════════
// FABLE PHYSARUM XL — multi-population slime mold (Jones 2010 model, extended)
//
// Three agent populations, each with its own sensory personality (sensor
// angle/distance, turn/move speed, color) and a 3x3 interaction matrix:
// each population senses a weighted mix of all trails, so populations can
// chase, flee, cooperate, or ignore each other. Trail RGBA = per-population
// densities (r,g,b) + total density (a). Up to ~1M agents.
// Personality banks: trinity, rivals, predator, symbiosis, ghosts.
// ═══════════════════════════════════════════════════════════════════════════

const xlAgentFrag = `precision highp float;
uniform sampler2D agentTex;
uniform sampler2D trailTex;
uniform vec3 sensorAngleV;
uniform vec3 sensorDistV;
uniform vec3 turnSpeedV;
uniform vec3 moveSpeedV;
uniform float senseMatrix[9];
uniform vec2 resolution;
uniform float time;
uniform float randomStrength;
uniform float pulse;
uniform float pulseSpeed;
uniform vec2 mousePos;
uniform float mouseForce;
varying vec2 vUv;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float senseAt(vec2 p, int pop) {
  vec3 t = texture2D(trailTex, fract(p)).rgb;
  // compressed sensing so saturated trails plateau (prevents point-attractor collapse)
  vec3 c = 1.0 - exp(-t * 0.25);
  float m0 = senseMatrix[pop * 3 + 0];
  float m1 = senseMatrix[pop * 3 + 1];
  float m2 = senseMatrix[pop * 3 + 2];
  return c.r * m0 + c.g * m1 + c.b * m2;
}

void main() {
  vec4 agent = texture2D(agentTex, vUv);
  vec2 pos = agent.xy;
  float angle = agent.z;
  int pop = int(floor(agent.w + 0.001));
  float trait = fract(agent.w);

  float sa = pop == 0 ? sensorAngleV.x : (pop == 1 ? sensorAngleV.y : sensorAngleV.z);
  float sd = pop == 0 ? sensorDistV.x : (pop == 1 ? sensorDistV.y : sensorDistV.z);
  float ts = pop == 0 ? turnSpeedV.x : (pop == 1 ? turnSpeedV.y : turnSpeedV.z);
  float ms = pop == 0 ? moveSpeedV.x : (pop == 1 ? moveSpeedV.y : moveSpeedV.z);

  float breathe = 1.0 + pulse * 0.5 * sin(time * pulseSpeed * 2.0 + trait * 6.28318 + float(pop) * 2.1);
  sa *= 0.0174533;
  sd = sd * breathe / resolution.x;
  ts *= 0.0174533;

  float F = senseAt(pos + vec2(cos(angle), sin(angle)) * sd, pop);
  float L = senseAt(pos + vec2(cos(angle + sa), sin(angle + sa)) * sd, pop);
  float R = senseAt(pos + vec2(cos(angle - sa), sin(angle - sa)) * sd, pop);

  float rnd = hash(pos * 913.7 + vUv * 271.3 + fract(time) * 37.1);

  if (F > 0.93 && L > 0.93 && R > 0.93) {
    angle += (rnd - 0.5) * 3.14159 * 0.6;
  } else if (F > L && F > R) {
    angle += (rnd - 0.5) * ts * randomStrength * 0.2;
  } else if (F < L && F < R) {
    angle += (rnd - 0.5) * 2.0 * ts;
  } else if (R > L) {
    angle -= ts * (0.6 + 0.4 * rnd);
  } else {
    angle += ts * (0.6 + 0.4 * rnd);
  }
  angle += (hash(pos.yx * 517.3 + fract(time * 0.7) * 91.7) - 0.5) * randomStrength * ts * 0.5;

  float speed = (0.8 + trait * 0.4) * ms / resolution.x;
  vec2 dir = vec2(cos(angle), sin(angle));

  vec2 toM = mousePos - pos;
  float md = length(toM);
  float mstr = mouseForce * exp(-md * md * 60.0);
  if (abs(mstr) > 0.001) {
    dir = normalize(dir + normalize(toM + vec2(1e-5)) * mstr);
    angle = atan(dir.y, dir.x);
  }

  pos = fract(pos + dir * speed);
  gl_FragColor = vec4(pos, angle, float(pop) + trait * 0.999);
}`

const xlDepositVert = `attribute vec2 agentUV;
uniform sampler2D agentTex;
uniform float depositAmount;
varying vec3 vColor;
varying float vDeposit;

void main() {
  vec4 agent = texture2D(agentTex, agentUV);
  gl_Position = vec4(agent.xy * 2.0 - 1.0, 0.0, 1.0);
  gl_PointSize = 1.0;
  vDeposit = depositAmount * 0.05;
  float pop = floor(agent.w + 0.001);
  vColor = vec3(pop < 0.5 ? 1.0 : 0.0, (pop > 0.5 && pop < 1.5) ? 1.0 : 0.0, pop > 1.5 ? 1.0 : 0.0);
}`

// additive: rgb += onehot * d (per-population), a += d² (total density)
const xlDepositFrag = `precision highp float;
varying vec3 vColor;
varying float vDeposit;
void main() {
  gl_FragColor = vec4(vColor, vDeposit);
}`

const xlDiffuseFrag = `precision highp float;
uniform sampler2D trailTex;
uniform float decayRate;
uniform float diffuseSpeed;
uniform vec2 resolution;
varying vec2 vUv;

void main() {
  vec2 texel = 1.0 / resolution;
  vec4 center = texture2D(trailTex, vUv);
  vec4 sum = center * 4.0;
  sum += texture2D(trailTex, fract(vUv + vec2(-1.0, 0.0) * texel));
  sum += texture2D(trailTex, fract(vUv + vec2(1.0, 0.0) * texel));
  sum += texture2D(trailTex, fract(vUv + vec2(0.0, -1.0) * texel));
  sum += texture2D(trailTex, fract(vUv + vec2(0.0, 1.0) * texel));
  sum += texture2D(trailTex, fract(vUv + vec2(-1.0, -1.0) * texel)) * 0.5;
  sum += texture2D(trailTex, fract(vUv + vec2(1.0, -1.0) * texel)) * 0.5;
  sum += texture2D(trailTex, fract(vUv + vec2(-1.0, 1.0) * texel)) * 0.5;
  sum += texture2D(trailTex, fract(vUv + vec2(1.0, 1.0) * texel)) * 0.5;
  vec4 diffused = sum / 10.0;
  gl_FragColor = min(mix(center, diffused, diffuseSpeed) * (1.0 - decayRate), vec4(20000.0));
}`

const xlDisplayFrag = `precision highp float;
uniform sampler2D trailTex;
uniform vec2 resolution;
uniform float exposure;
uniform float contrast;
uniform float relief;
uniform float grain;
uniform float vignette;
uniform float densityNorm;
uniform vec3 color0;
uniform vec3 color1;
uniform vec3 color2;
uniform vec3 bgColor;
uniform float uAspect;
varying vec2 vUv;

${FABLE_GLSL_LIB}

float toneT(float d) {
  return pow(1.0 - exp(-d * densityNorm * exposure), max(contrast, 0.05));
}

void main() {
  vec2 suv = vUv - 0.5;
  if (uAspect > 1.0) suv.x *= uAspect;
  else if (uAspect > 0.0) suv.y /= uAspect;
  vec2 tuv = fract(suv + 0.5);

  vec4 trail = texture2D(trailTex, tuv);

  vec3 col = bgColor;
  col += color0 * toneT(trail.r);
  col += color1 * toneT(trail.g);
  col += color2 * toneT(trail.b);

  // relief from total density
  vec2 texel = 1.0 / resolution;
  float aC = toneT(texture2D(trailTex, tuv).a);
  float aR = toneT(texture2D(trailTex, fract(tuv + vec2(texel.x, 0.0))).a);
  float aT = toneT(texture2D(trailTex, fract(tuv + vec2(0.0, texel.y))).a);
  vec3 n = normalize(vec3((aC - aR) * relief * 5.0, (aC - aT) * relief * 5.0, 1.0));
  float light = 0.6 + 0.4 * dot(n, normalize(vec3(-0.45, 0.6, 0.66)));
  col *= mix(1.0, light, clamp(relief, 0.0, 1.0));
  float spec = pow(max(reflect(-normalize(vec3(-0.45, 0.6, 0.66)), n).z, 0.0), 28.0);
  col += (col + 0.1) * spec * relief * 0.3 * smoothstep(0.1, 0.5, aC);

  col = fableACES(col);
  col = fableGrade(col, vUv, suv, resolution, grain, vignette);
  gl_FragColor = vec4(col, 1.0);
}`

const xlParams: ParamSchemaDef[] = [
  { name: 'agentCount', type: 'int', min: 30000, max: 1048576, default: 600000, description: 'Total agents across populations' },
  { name: 'simResolution', type: 'int', min: 256, max: 2048, default: 1024, description: 'Trail field resolution' },
  { name: 'personality', type: 'enum', default: 'trinity', enumValues: ['trinity', 'rivals', 'predator', 'symbiosis', 'ghosts'], description: 'Population behavior bank' },
  { name: 'sensorScale', type: 'float', min: 0.4, max: 2.5, default: 1, description: 'Sensor distance scale (all populations)' },
  { name: 'speedScale', type: 'float', min: 0.4, max: 2.5, default: 1, description: 'Move speed scale' },
  { name: 'turnScale', type: 'float', min: 0.4, max: 2.5, default: 1, description: 'Turn speed scale' },
  { name: 'interaction', type: 'float', min: 0, max: 2, default: 1, description: 'Cross-population interaction strength' },
  { name: 'randomStrength', type: 'float', min: 0, max: 2, default: 0.35, description: 'Random steering jitter' },
  { name: 'pulse', type: 'float', min: 0, max: 1, default: 0.2, description: 'Sensor breathing' },
  { name: 'pulseSpeed', type: 'float', min: 0, max: 3, default: 0.5, description: 'Breathing speed' },
  { name: 'decayRate', type: 'float', min: 0.005, max: 0.15, default: 0.04, description: 'Trail decay' },
  { name: 'diffuseSpeed', type: 'float', min: 0, max: 1, default: 0.4, description: 'Trail diffusion' },
  { name: 'depositAmount', type: 'float', min: 0.5, max: 20, default: 4, description: 'Deposit strength' },
  { name: 'stepsPerFrame', type: 'int', min: 1, max: 6, default: 2, description: 'Steps per frame' },
  { name: 'spawnPattern', type: 'enum', default: 'mixed', enumValues: ['mixed', 'zones', 'rings'], description: 'mixed = interleaved, zones = territories, rings = concentric' },
  { name: 'colorHue', type: 'float', min: 0, max: 360, default: 140, description: 'Population 1 hue' },
  { name: 'hueSpread', type: 'float', min: 30, max: 180, default: 120, description: 'Hue separation between populations' },
  { name: 'saturation', type: 'float', min: 0, max: 1, default: 0.85, description: 'Color saturation' },
  { name: 'exposure', type: 'float', min: 0.2, max: 6, default: 1.5, description: 'HDR exposure' },
  { name: 'contrast', type: 'float', min: 0.5, max: 2.5, default: 1.25, description: 'Tone contrast' },
  { name: 'relief', type: 'float', min: 0, max: 2, default: 0.8, description: 'Relief lighting' },
  { name: 'grain', type: 'float', min: 0, max: 1, default: 0.25, description: 'Film grain' },
  { name: 'vignette', type: 'float', min: 0, max: 1, default: 0.35, description: 'Vignette' },
  { name: 'mouseForce', type: 'float', min: -2, max: 2, default: 0.8, description: 'Mouse attract (+) / repel (−)' },
]

const xlEvaluateSource = FABLE_EVAL_LIB + `
var agentCount = Math.min(1048576, Math.max(30000, Math.round(inputs.agentCount)));
var agentSide = Math.min(1024, Math.ceil(Math.sqrt(agentCount)));
var simRes = Math.min(2048, Math.max(256, Math.round(inputs.simResolution)));
var personalityIdx = Math.round(inputs.personality || 0);
var spawnIdx = Math.round(inputs.spawnPattern || 0);

// Personality banks: per-population [sensorAngle, sensorDist, turnSpeed, moveSpeed]
// and 3x3 sense matrix rows [own weight applied at interaction=1]
var BANKS = [
  { // trinity — three cooperative builders at different scales
    pops: [[24, 26, 32, 1.2], [42, 44, 48, 1.6], [58, 14, 68, 0.85]],
    M: [[1.0, 0.25, 0.25], [0.25, 1.0, 0.25], [0.25, 0.25, 1.0]] },
  { // rivals — mutual avoidance, territorial cells
    pops: [[28, 30, 36, 1.25], [34, 34, 42, 1.35], [24, 24, 30, 1.1]],
    M: [[1.0, -0.85, -0.85], [-0.85, 1.0, -0.85], [-0.85, -0.85, 1.0]] },
  { // predator — pop0 hunts the trails of pop1/2, which flee it
    pops: [[36, 46, 55, 1.7], [26, 26, 34, 1.25], [22, 20, 30, 1.05]],
    M: [[0.35, 1.6, 1.6], [-1.3, 1.0, 0.15], [-1.3, 0.15, 1.0]] },
  { // symbiosis — 0 and 1 entwine, both shun loner 2
    pops: [[26, 30, 36, 1.3], [30, 34, 40, 1.3], [45, 18, 60, 0.9]],
    M: [[1.0, 0.9, -0.6], [0.9, 1.0, -0.6], [-0.5, -0.5, 1.0]] },
  { // ghosts — populations pass through each other, layered worlds
    pops: [[24, 28, 34, 1.2], [40, 40, 50, 1.5], [55, 15, 65, 0.9]],
    M: [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]] },
];
var bank = BANKS[Math.min(personalityIdx, BANKS.length - 1)];
var sensorAngle = [], sensorDist = [], turnSpeed = [], moveSpeed = [];
for (var i = 0; i < 3; i++) {
  sensorAngle.push(bank.pops[i][0]);
  sensorDist.push(bank.pops[i][1] * inputs.sensorScale);
  turnSpeed.push(bank.pops[i][2] * inputs.turnScale);
  moveSpeed.push(bank.pops[i][3] * inputs.speedScale);
}
// interaction knob scales OFF-diagonal weights only
var M = [];
for (var r = 0; r < 3; r++) for (var c2 = 0; c2 < 3; c2++) {
  M.push(r === c2 ? bank.M[r][c2] : bank.M[r][c2] * inputs.interaction);
}

var key = nodeId + '_fablePhysarumXL';
var state = ctx.frameState.get(key);
if (!state || state.agentSide !== agentSide || state.spawnIdx !== spawnIdx) {
  var data = new Float32Array(agentSide * agentSide * 4);
  var rng = (function(s){return function(){s=(s*1103515245+12345)&0x7fffffff;return s/0x7fffffff;}})(2718);
  var total = agentSide * agentSide;
  for (var i2 = 0; i2 < total; i2++) {
    var pop = i2 % 3;
    var px, py, angle;
    if (spawnIdx === 1) {
      // zones: each population starts in its own third
      var cx = [0.25, 0.75, 0.5][pop];
      var cy = [0.3, 0.3, 0.75][pop];
      var th = rng() * Math.PI * 2;
      var r = Math.pow(rng(), 0.5) * 0.18;
      px = cx + Math.cos(th) * r;
      py = cy + Math.sin(th) * r;
      angle = rng() * Math.PI * 2;
    } else if (spawnIdx === 2) {
      // rings: concentric rings per population
      var th = rng() * Math.PI * 2;
      var rr = 0.12 + pop * 0.13 + (rng() - 0.5) * 0.06;
      px = 0.5 + Math.cos(th) * rr;
      py = 0.5 + Math.sin(th) * rr;
      angle = th + Math.PI + (rng() - 0.5) * 1.0;
    } else {
      px = rng(); py = rng();
      angle = rng() * Math.PI * 2;
    }
    data[i2*4] = px;
    data[i2*4+1] = py;
    data[i2*4+2] = angle;
    data[i2*4+3] = pop + rng() * 0.999;
  }
  state = { agentSide: agentSide, spawnIdx: spawnIdx, data: data, gen: (state ? state.gen + 1 : 0) };
  ctx.frameState.set(key, state);
}

var c0 = hsvToRgb(inputs.colorHue, inputs.saturation, 1.0);
var c1 = hsvToRgb(inputs.colorHue + inputs.hueSpread, inputs.saturation, 1.0);
var c2v = hsvToRgb(inputs.colorHue - inputs.hueSpread, inputs.saturation, 1.0);

var d = inputs.depositAmount * 0.05;
var occupancy = agentCount / 3 / (simRes * simRes);
var densityNorm = inputs.decayRate / Math.max(occupancy * d, 1e-6) * 0.03;

var res = ctx.resolution || [1, 1];
var aspect = res[1] > 0 ? res[0] / res[1] : 1;
var mx = ctx.mouse ? (ctx.mouse.x + 1) * 0.5 : -10;
var my = ctx.mouse ? (ctx.mouse.y + 1) * 0.5 : -10;

return { shaderConfig: {
  passes: [
    { name: 'agents', fragmentShader: inputs.agentsShader, target: 'agentState',
      readFrom: { agentTex: 'agentState', trailTex: 'trail' },
      uniforms: {
        sensorAngleV: sensorAngle, sensorDistV: sensorDist,
        turnSpeedV: turnSpeed, moveSpeedV: moveSpeed,
        senseMatrix: M,
        randomStrength: inputs.randomStrength,
        pulse: inputs.pulse, pulseSpeed: inputs.pulseSpeed,
        mousePos: [mx, my], mouseForce: inputs.mouseForce,
        resolution: [simRes, simRes],
        time: ctx.elapsed,
      } },
    { name: 'diffuse', fragmentShader: inputs.diffuseShader, target: 'trail',
      readFrom: { trailTex: 'trail' },
      uniforms: { decayRate: inputs.decayRate, diffuseSpeed: inputs.diffuseSpeed, resolution: [simRes, simRes] } },
    { name: 'deposit', mode: 'deposit', agentTarget: 'agentState', agentRes: state.agentSide,
      vertexShader: inputs.depositVertShader, fragmentShader: inputs.depositFragShader,
      target: 'trail', noClear: true,
      uniforms: { depositAmount: inputs.depositAmount } },
    { name: 'display', fragmentShader: inputs.displayShader, target: null,
      readFrom: { trailTex: 'trail' },
      uniforms: {
        resolution: [simRes, simRes],
        exposure: inputs.exposure, contrast: inputs.contrast,
        relief: inputs.relief, grain: inputs.grain, vignette: inputs.vignette,
        densityNorm: densityNorm,
        color0: c0, color1: c1, color2: c2v,
        bgColor: [0.004, 0.005, 0.012],
        uAspect: aspect,
      } },
  ],
  renderTargetDefs: {
    agentState: { width: state.agentSide, height: state.agentSide, type: 'float', filter: 'nearest', pingPong: true, _gen: state.gen },
    trail: { width: simRes, height: simRes, type: 'float', filter: 'linear', wrap: 'repeat', pingPong: true, _gen: state.gen },
  },
  initData: { agentState: state.data },
  stepsPerFrame: Math.min(6, Math.max(1, Math.round(inputs.stepsPerFrame))),
}};
`

const fablePhysarumXLDef: CompoundGeneratorDef = {
  id: 'builtin_fablePhysarumXL',
  name: 'Fable Physarum XL',
  description: 'Three slime mold populations that chase, flee, or entwine — dueling colored networks with emergent territories',
  defaultCameraDistance: 0,
  generatorType: 'fablePhysarumXL_generator',
  outputMode: 'shader',
  params: xlParams,
  inputs: xlParams.map(p => ({
    name: p.name,
    type: 'number' as const,
    default: p.type === 'bool' ? (p.default ? 1 : 0) : (p.type === 'enum' ? 0 : (p.default as number)),
  })),
  outputs: [{ name: 'shaderConfig', type: 'array' as const }],
  evaluateSource: xlEvaluateSource,
  shaderSources: {
    agents: xlAgentFrag,
    depositVert: xlDepositVert,
    depositFrag: xlDepositFrag,
    diffuse: xlDiffuseFrag,
    display: xlDisplayFrag,
  },
}

export const FABLE_PHYSARUM_XL_GENERATORS: CompoundGeneratorDef[] = [fablePhysarumXLDef]
