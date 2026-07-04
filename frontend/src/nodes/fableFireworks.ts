import type { CompoundGeneratorDef } from './generatorGraphFactory'
import type { ParamSchemaDef } from './storage'
import { FABLE_GLSL_LIB, FABLE_EVAL_LIB } from './fableDisplayLib'

// ═══════════════════════════════════════════════════════════════════════════
// FABLE FIREWORKS — analytic pyrotechnics over water
//
// Particles are stateless: ballistic motion with air drag has a closed form
//   pos(t) = p0 + v0·(1-e^{-kt})/k − g·(t − (1-e^{-kt})/k)/k
// so the deposit vertex shader computes every star from (shell uniforms,
// particle hash, age). Up to 8 concurrent shells managed in JS (spawn,
// rocket ascent, burst, retire). Shell types follow real pyro effects:
// peony, chrysanthemum, willow, palm, ring, crossette.
// Trails: HDR accumulation buffer with decay + wind/rise drift (smoke feel).
// Display: night-sky gradient, twinkling stars, city skyline, water
// reflection with ripple wobble, ACES grade.
// ═══════════════════════════════════════════════════════════════════════════

const fwDepositVert = `precision highp float;
attribute vec2 agentUV;
uniform float agentRes;
uniform float time;
uniform vec2 shellPos[8];
uniform float shellBirth[8];
uniform float shellType[8];
uniform float shellSize[8];
uniform float shellSeed[8];
uniform vec3 shellColor[8];
uniform float shellLaunchX[8];
uniform float gravity;
uniform float dragK;
uniform float waterY;
varying vec3 vColor;
varying float vBright;

float hash1(float n) { return fract(sin(n) * 43758.5453); }
vec2 hash2(float n) { return fract(sin(vec2(n, n + 1.234)) * vec2(43758.5453, 22578.145)); }

void main() {
  vec2 ij = floor(agentUV * agentRes);
  float pid = ij.y * agentRes + ij.x;
  int s = int(mod(pid, 8.0));
  float subId = floor(pid / 8.0);

  vec2 burstPos = vec2(0.0);
  float birth = -1000.0;
  float type = 0.0;
  float size = 1.0;
  float seed = 0.0;
  vec3 baseCol = vec3(1.0);
  float launchX = 0.5;
  for (int i = 0; i < 8; i++) {
    if (i == s) {
      burstPos = shellPos[i]; birth = shellBirth[i]; type = shellType[i];
      size = shellSize[i]; seed = shellSeed[i]; baseCol = shellColor[i]; launchX = shellLaunchX[i];
    }
  }

  float age = time - birth;
  float h = seed * 137.0 + subId * 0.618;
  vec2 r2 = hash2(h);
  float rr = hash1(h + 7.7);

  vec2 pos;
  float bright = 0.0;
  vec3 col = baseCol;
  float psize = 1.0;

  if (birth < -900.0 || age > 12.0) {
    // dead slot
    pos = vec2(-10.0);
  } else if (age < 0.0) {
    // rocket ascent: bright comet + sputtering tail (first 64 particles only)
    float prog = clamp(1.0 + age / 1.6, 0.0, 1.0);
    float ease = 1.0 - (1.0 - prog) * (1.0 - prog);
    vec2 rocket = vec2(mix(launchX, burstPos.x, ease), mix(waterY + 0.01, burstPos.y, ease));
    if (subId < 64.0) {
      float back = subId / 64.0;
      pos = rocket - vec2((burstPos.x - launchX) * 0.06, 0.028) * back * ease
            + (r2 - 0.5) * 0.006 * back;
      bright = (1.0 - back) * (0.6 + 0.4 * hash1(h + floor(time * 40.0)));
      col = mix(baseCol, vec3(1.0, 0.85, 0.6), 0.7);
      psize = subId < 2.0 ? 2.0 : 1.0;
    } else {
      pos = vec2(-10.0);
    }
  } else {
    // ── burst ──
    float theta = r2.x * 6.28318;
    float speed;
    vec2 dir = vec2(cos(theta), sin(theta));
    float life;
    float g = gravity;
    float k = dragK;

    if (type < 0.5) {
      // peony: projected sphere, clean stars
      speed = (0.35 + 0.1 * rr) * sqrt(r2.y) * size;
      life = 1.5 + 0.4 * rr;
    } else if (type < 1.5) {
      // chrysanthemum: dense, trailing
      speed = (0.32 + 0.08 * rr) * sqrt(r2.y) * size;
      life = 1.9 + 0.5 * rr;
    } else if (type < 2.5) {
      // willow: long-burning gold, heavy droop
      speed = (0.22 + 0.1 * rr) * sqrt(r2.y) * size;
      life = 3.4 + 1.2 * rr;
      g *= 0.55; k *= 0.7;
      col = mix(baseCol, vec3(1.0, 0.78, 0.35), 0.85);
    } else if (type < 3.5) {
      // palm: few thick fronds
      float arm = floor(r2.x * 9.0);
      theta = arm / 9.0 * 6.28318 + seed + (r2.y - 0.5) * 0.25;
      dir = vec2(cos(theta), sin(theta));
      speed = (0.3 + 0.15 * rr) * size;
      life = 2.2 + 0.5 * rr;
      psize = 2.0;
    } else if (type < 4.5) {
      // ring: hollow circle, slightly elliptical
      speed = (0.33 + 0.015 * rr) * size;
      dir.y *= 0.75 + 0.25 * hash1(seed * 3.3);
      life = 1.6 + 0.3 * rr;
    } else {
      // crossette: stars split into 4 after a delay
      speed = (0.24 + 0.06 * rr) * sqrt(r2.y) * size;
      life = 2.3 + 0.4 * rr;
    }

    float tt = min(age, life);
    float ek = (1.0 - exp(-k * tt)) / k;
    pos = burstPos + dir * speed * ek - vec2(0.0, 1.0) * g * (tt - ek) / k;

    if (type > 4.5 && age > 0.55) {
      // crossette split: secondary burst in 4 diagonal directions
      float t2 = min(age, life) - 0.55;
      float splitDir = floor(hash1(h + 3.1) * 4.0) * 1.5708 + 0.7854;
      float ek2 = (1.0 - exp(-k * 2.0 * t2)) / (k * 2.0);
      pos += vec2(cos(splitDir), sin(splitDir)) * 0.12 * size * ek2;
    }

    // brightness: burst flash + exp decay + flicker + end sputter
    float env = exp(-age / (life * 0.45)) * step(age, life);
    float flicker = 0.72 + 0.28 * hash1(h + floor(time * 30.0));
    float sputter = age > life * 0.7 ? step(0.4, hash1(h + floor(time * 16.0))) : 1.0;
    bright = env * flicker * sputter;
    bright += exp(-age * 14.0) * 1.4; // burst flash
    if (subId < 1.0) { psize = 3.0; bright *= 2.0; } // core flash point
    // brief white-hot flash, then vivid shell color
    col = mix(vec3(1.0, 0.97, 0.9), col, clamp(age * 6.0, 0.0, 1.0));
  }

  gl_Position = vec4(pos * 2.0 - 1.0, 0.0, 1.0);
  gl_PointSize = psize;
  vColor = col;
  vBright = bright;
}`

const fwDepositFrag = `precision highp float;
varying vec3 vColor;
varying float vBright;
void main() {
  gl_FragColor = vec4(vColor * vBright * 0.95, min(vBright * 0.4, 1.0));
}`

// trail fade with smoke drift (wind + rise) and gentle spread
const fwFadeFrag = `precision highp float;
uniform sampler2D trailTex;
uniform vec2 resolution;
uniform float fade;
uniform float windX;
uniform float rise;
varying vec2 vUv;

void main() {
  vec2 texel = 1.0 / resolution;
  vec2 drift = vec2(windX, -rise) * texel * 1.5;
  vec2 uv = vUv + drift;
  vec4 c = texture2D(trailTex, uv) * 4.0;
  c += texture2D(trailTex, uv + vec2(texel.x, 0.0));
  c += texture2D(trailTex, uv - vec2(texel.x, 0.0));
  c += texture2D(trailTex, uv + vec2(0.0, texel.y));
  c += texture2D(trailTex, uv - vec2(0.0, texel.y));
  c /= 8.0;
  gl_FragColor = c * fade;
}`

const fwDisplayFrag = `precision highp float;
uniform sampler2D trailTex;
uniform vec2 resolution;
uniform float time;
uniform float exposure;
uniform float grain;
uniform float vignette;
uniform float waterY;
uniform float skyline;
uniform float reflection;
uniform float starAmount;
uniform float uAspect;
varying vec2 vUv;

${FABLE_GLSL_LIB}

float skylineH(float x) {
  // blocky city silhouette
  float b1 = fableHash(vec2(floor(x * 22.0), 1.0)) * 0.05;
  float b2 = fableHash(vec2(floor(x * 9.0), 7.0)) * 0.075;
  return waterY + 0.012 + (b1 + b2) * skyline;
}

vec3 fireworksAt(vec2 uv) {
  return texture2D(trailTex, clamp(uv, 0.0, 1.0)).rgb;
}

void main() {
  vec2 suv = vUv - 0.5;
  if (uAspect > 1.0) suv.x *= uAspect;
  else if (uAspect > 0.0) suv.y /= uAspect;
  vec2 w = vec2(suv.x + 0.5, vUv.y); // horizontal aspect-corrected, vertical direct

  // night sky
  float skyT = clamp((w.y - waterY) / (1.0 - waterY), 0.0, 1.0);
  vec3 col = mix(vec3(0.022, 0.028, 0.06), vec3(0.002, 0.003, 0.010), pow(skyT, 0.6));

  // sparse twinkling stars
  vec2 sg = floor(w * 220.0);
  float sh = fableHash(sg);
  float starThresh = 1.0 - starAmount * 0.012;
  if (sh > starThresh && w.y > waterY + 0.02) {
    float tw = 0.35 + 0.65 * sin(time * (1.0 + sh * 5.0) + sh * 40.0);
    col += vec3(0.8, 0.85, 1.0) * tw * (sh - starThresh) * 45.0;
  }

  if (w.y > waterY) {
    // fireworks + glow
    vec3 fw = fireworksAt(w);
    col += fw * exposure;

    // skyline silhouette with warm windows
    float sh2 = skylineH(w.x);
    if (w.y < sh2 && skyline > 0.01) {
      col = vec3(0.008, 0.009, 0.014);
      vec2 wg = floor(w * vec2(320.0, 200.0));
      float wh = fableHash(wg + 3.7);
      if (wh > 0.87 && w.y < sh2 - 0.006) col += vec3(0.35, 0.26, 0.12) * (wh - 0.87) * 8.0;
      // fireworks glow spills onto buildings
      col += fw * exposure * 0.12;
    }
  } else {
    // water: mirrored fireworks + sky with ripple wobble
    float depth = (waterY - w.y) / waterY;
    float wob = sin(w.x * 90.0 + time * 1.3 + depth * 30.0) * 0.004 * (0.3 + depth);
    vec2 muv = vec2(w.x + wob, waterY + (waterY - w.y) * 1.15);
    vec3 rfw = fireworksAt(muv);
    vec3 water = vec3(0.006, 0.010, 0.022) * (1.0 - depth * 0.5);
    col = water + rfw * exposure * reflection * (1.0 - depth * 0.55);
    // faint sky reflection shimmer
    col += vec3(0.01, 0.014, 0.028) * (0.5 + 0.5 * sin(w.x * 140.0 - time * 0.8)) * 0.35 * (1.0 - depth);
  }

  col = fableACES(col);
  col = fableGrade(col, vUv, suv, resolution, grain, vignette);
  gl_FragColor = vec4(col, 1.0);
}`

const fwParams: ParamSchemaDef[] = [
  { name: 'showStyle', type: 'enum', default: 'classic', enumValues: ['classic', 'finale', 'goldenWillow', 'rainbow'], description: 'Show choreography' },
  { name: 'launchRate', type: 'float', min: 0.2, max: 4, default: 1.5, description: 'Shells launched per second' },
  { name: 'shellSize', type: 'float', min: 0.5, max: 2, default: 1, description: 'Burst size' },
  { name: 'gravity', type: 'float', min: 0.02, max: 0.3, default: 0.11, description: 'Gravity strength' },
  { name: 'drag', type: 'float', min: 0.6, max: 4, default: 1.7, description: 'Air drag — high = tight bursts' },
  { name: 'trailPersistence', type: 'float', min: 0.82, max: 0.985, default: 0.93, description: 'Star trail persistence' },
  { name: 'windX', type: 'float', min: -1, max: 1, default: 0.12, description: 'Wind drift' },
  { name: 'smokeRise', type: 'float', min: 0, max: 1, default: 0.25, description: 'Trail rise (heat lift)' },
  { name: 'particleDensity', type: 'int', min: 96, max: 256, default: 160, description: 'Particle texture side (particles = side²)' },
  { name: 'simResolution', type: 'int', min: 512, max: 2048, default: 1024, description: 'Trail buffer resolution' },
  { name: 'skyline', type: 'float', min: 0, max: 1, default: 0.6, description: 'City skyline height (0 = off)' },
  { name: 'reflection', type: 'float', min: 0, max: 1, default: 0.65, description: 'Water reflection strength' },
  { name: 'starAmount', type: 'float', min: 0, max: 1, default: 0.5, description: 'Background stars' },
  { name: 'colorHue', type: 'float', min: 0, max: 360, default: 0, description: 'Hue shift (rainbow style)' },
  { name: 'exposure', type: 'float', min: 0.3, max: 4, default: 1.6, description: 'Brightness' },
  { name: 'grain', type: 'float', min: 0, max: 1, default: 0.25, description: 'Film grain' },
  { name: 'vignette', type: 'float', min: 0, max: 1, default: 0.35, description: 'Vignette' },
  { name: 'mouseLaunch', type: 'bool', default: true, description: 'Fast mouse moves launch a shell at the cursor' },
]

const fwEvaluateSource = FABLE_EVAL_LIB + `
var agentRes = Math.min(256, Math.max(96, Math.round(inputs.particleDensity)));
var simRes = Math.min(2048, Math.max(512, Math.round(inputs.simResolution)));
var styleIdx = Math.round(inputs.showStyle || 0);
var WATER_Y = 0.18;
var t = ctx.elapsed;

var key = nodeId + '_fableFireworks';
var state = ctx.frameState.get(key);
if (!state) {
  state = {
    shells: [], // {slot, burstT, pos:[x,y], type, size, seed, color:[r,g,b], launchX}
    nextSpawn: 0,
    lastMouseLaunch: -10,
    rngState: 12345,
  };
  ctx.frameState.set(key, state);
}
function rnd() { state.rngState = (state.rngState * 1103515245 + 12345) & 0x7fffffff; return state.rngState / 0x7fffffff; }

// Authentic star colors: strontium red, barium green, copper blue,
// sodium gold, magnesium white, strontium+copper purple
var COLORS = [
  [1.0, 0.22, 0.18], [0.25, 1.0, 0.35], [0.3, 0.5, 1.0],
  [1.0, 0.78, 0.3], [0.95, 0.95, 1.0], [0.8, 0.35, 1.0], [0.3, 0.95, 0.9],
];

// showStyle: [rateMult, typeWeights(peony,chrys,willow,palm,ring,crossette), colorPick]
var STYLES = [
  { rate: 1.0, types: [0.3, 0.2, 0.12, 0.13, 0.12, 0.13], gold: 0.15 },   // classic
  { rate: 2.4, types: [0.3, 0.25, 0.1, 0.15, 0.1, 0.1], gold: 0.1 },      // finale
  { rate: 0.7, types: [0.1, 0.15, 0.55, 0.15, 0.0, 0.05], gold: 0.8 },    // goldenWillow
  { rate: 1.2, types: [0.35, 0.25, 0.05, 0.1, 0.15, 0.1], gold: 0.0 },    // rainbow
];
var style = STYLES[Math.min(styleIdx, STYLES.length - 1)];

function pickType() {
  var x = rnd(), acc = 0;
  for (var i = 0; i < 6; i++) { acc += style.types[i]; if (x < acc) return i; }
  return 0;
}
function pickColor() {
  if (rnd() < style.gold) return COLORS[3];
  if (styleIdx === 3) {
    var c = hsvToRgb(inputs.colorHue + rnd() * 360, 0.9, 1.0);
    return c;
  }
  return COLORS[Math.floor(rnd() * COLORS.length)];
}
function spawnShell(bx, by) {
  // find a free slot (dead or oldest)
  var slot = -1, oldest = 1e9, oldestIdx = 0;
  var used = {};
  for (var i = 0; i < state.shells.length; i++) used[state.shells[i].slot] = true;
  for (var s2 = 0; s2 < 8; s2++) { if (!used[s2]) { slot = s2; break; } }
  if (slot < 0) {
    for (var i2 = 0; i2 < state.shells.length; i2++) {
      if (state.shells[i2].burstT < oldest) { oldest = state.shells[i2].burstT; oldestIdx = i2; }
    }
    slot = state.shells[oldestIdx].slot;
    state.shells.splice(oldestIdx, 1);
  }
  state.shells.push({
    slot: slot,
    burstT: t + 1.6, // rocket ascent time
    pos: [bx !== undefined ? bx : (0.18 + rnd() * 0.64), by !== undefined ? by : (0.5 + rnd() * 0.32)],
    type: pickType(),
    size: inputs.shellSize * (0.75 + rnd() * 0.5),
    seed: rnd() * 100,
    color: pickColor(),
    launchX: 0.25 + rnd() * 0.5,
  });
}

// retire dead shells (max life ~ willow 5s + ascent)
state.shells = state.shells.filter(function(sh){ return t - sh.burstT < 7.0; });

// scheduled launches
var rate = inputs.launchRate * style.rate;
if (t >= state.nextSpawn) {
  spawnShell();
  // finale: occasional triple volley
  if (styleIdx === 1 && rnd() < 0.35) { spawnShell(); spawnShell(); }
  state.nextSpawn = t + (0.6 + rnd() * 0.9) / Math.max(rate, 0.1);
}

// mouse launch on fast movement
var mvMag = ctx.mouseVelocity ? Math.hypot(ctx.mouseVelocity.x, ctx.mouseVelocity.y) : 0;
if (inputs.mouseLaunch > 0.5 && ctx.mouse && mvMag > 0.04 && t - state.lastMouseLaunch > 0.7) {
  var mxu = (ctx.mouse.x + 1) * 0.5;
  var myu = (ctx.mouse.y + 1) * 0.5;
  if (myu > WATER_Y + 0.1) { spawnShell(mxu, myu); state.lastMouseLaunch = t; }
}

// pack shell uniforms (8 slots)
var shellPos = [], shellBirth = [], shellType = [], shellSize2 = [], shellSeed = [], shellColor = [], shellLaunchX = [];
for (var s3 = 0; s3 < 8; s3++) {
  shellPos.push([0, 0]); shellBirth.push(-1000); shellType.push(0);
  shellSize2.push(1); shellSeed.push(0); shellColor.push([0, 0, 0]); shellLaunchX.push(0.5);
}
for (var i3 = 0; i3 < state.shells.length; i3++) {
  var sh = state.shells[i3];
  shellPos[sh.slot] = sh.pos;
  shellBirth[sh.slot] = sh.burstT;
  shellType[sh.slot] = sh.type;
  shellSize2[sh.slot] = sh.size;
  shellSeed[sh.slot] = sh.seed;
  shellColor[sh.slot] = sh.color;
  shellLaunchX[sh.slot] = sh.launchX;
}

var res = ctx.resolution || [1, 1];
var aspect = res[1] > 0 ? res[0] / res[1] : 1;

// trailPersistence is defined per 1/60s — convert to this frame's delta so
// trail length is framerate-independent (particle motion is real-time)
var rawDt = ctx.delta ? Math.min(0.05, Math.max(0.004, ctx.delta)) : 0.016;
var fadeThisFrame = Math.pow(inputs.trailPersistence, rawDt * 60);

return { shaderConfig: {
  passes: [
    { name: 'fade', fragmentShader: inputs.fadeShader, target: 'trail',
      readFrom: { trailTex: 'trail' },
      uniforms: { resolution: [simRes, simRes], fade: fadeThisFrame,
        windX: inputs.windX, rise: inputs.smokeRise } },
    { name: 'deposit', mode: 'deposit', agentRes: agentRes,
      vertexShader: inputs.depositVertShader, fragmentShader: inputs.depositFragShader,
      target: 'trail', noClear: true,
      uniforms: {
        agentRes: agentRes, time: t,
        shellPos: shellPos, shellBirth: shellBirth, shellType: shellType,
        shellSize: shellSize2, shellSeed: shellSeed, shellColor: shellColor,
        shellLaunchX: shellLaunchX,
        gravity: inputs.gravity, dragK: inputs.drag, waterY: WATER_Y,
      } },
    { name: 'display', fragmentShader: inputs.displayShader, target: null,
      readFrom: { trailTex: 'trail' },
      uniforms: {
        resolution: [simRes, simRes], time: t,
        exposure: inputs.exposure, grain: inputs.grain, vignette: inputs.vignette,
        waterY: WATER_Y, skyline: inputs.skyline, reflection: inputs.reflection,
        starAmount: inputs.starAmount, uAspect: aspect,
      } },
  ],
  renderTargetDefs: {
    trail: { width: simRes, height: simRes, type: 'float', filter: 'linear', pingPong: true },
  },
  stepsPerFrame: 1,
}};
`

const fableFireworksDef: CompoundGeneratorDef = {
  id: 'builtin_fableFireworks',
  name: 'Fable Fireworks',
  description: 'A pyrotechnic night show over water — peonies, willows, palms, and crossettes with rockets, trails, skyline, and reflections',
  defaultCameraDistance: 0,
  generatorType: 'fableFireworks_generator',
  outputMode: 'shader',
  params: fwParams,
  inputs: fwParams.map(p => ({
    name: p.name,
    type: 'number' as const,
    default: p.type === 'bool' ? (p.default ? 1 : 0) : (p.type === 'enum' ? 0 : (p.default as number)),
  })),
  outputs: [{ name: 'shaderConfig', type: 'array' as const }],
  evaluateSource: fwEvaluateSource,
  shaderSources: {
    depositVert: fwDepositVert,
    depositFrag: fwDepositFrag,
    fade: fwFadeFrag,
    display: fwDisplayFrag,
  },
}

export const FABLE_FIREWORKS_GENERATORS: CompoundGeneratorDef[] = [fableFireworksDef]
