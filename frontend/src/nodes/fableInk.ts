import type { CompoundGeneratorDef } from './generatorGraphFactory'
import type { ParamSchemaDef } from './storage'
import { FABLE_GLSL_LIB, FABLE_EVAL_LIB, FABLE_PALETTE_NAMES } from './fableDisplayLib'

// ═══════════════════════════════════════════════════════════════════════════
// FABLE INK — stable-fluids Navier-Stokes ink (GPU Gems ch. 38, Harris/Stam)
//
// Semi-Lagrangian advection (unconditionally stable), vorticity confinement,
// Jacobi pressure solve, gradient subtraction — all fragment-shader passes on
// a torus (repeat-wrapped textures, so the display tiles seamlessly).
// Dual resolution: velocity/pressure at simResolution, dye at dyeResolution.
// Orbiting emitters inject swirling colored dye so the fluid is alive idle;
// the mouse throws force + ink with its velocity.
//
// Per step: advectVel(+forces) → curl → vorticity → divergence →
//           pressure ×N (Jacobi, warm-started) → gradSub → advectDye → display
// ═══════════════════════════════════════════════════════════════════════════

const advectVelFrag = `precision highp float;
uniform sampler2D velTex;
uniform vec2 simTexel;
uniform float dt;
uniform float dissipation;
uniform vec2 emitterPos[5];
uniform vec2 emitterVel[5];
uniform float emitterCount;
uniform float emitterRadius;
uniform vec2 mousePos;
uniform vec2 mouseVel;
uniform float mouseForce;
varying vec2 vUv;

void main() {
  vec2 vel = texture2D(velTex, vUv).xy;
  // semi-Lagrangian: trace back and sample
  vec2 coord = fract(vUv - dt * vel);
  vec2 newVel = texture2D(velTex, coord).xy * dissipation;

  // emitter forces (gaussian splats)
  for (int i = 0; i < 5; i++) {
    if (float(i) >= emitterCount) break;
    vec2 d = vUv - emitterPos[i];
    d.x = d.x - floor(d.x + 0.5); // torus distance
    d.y = d.y - floor(d.y + 0.5);
    // force splat much wider than the ink splat — stirs a whole region
    newVel += emitterVel[i] * exp(-dot(d, d) / (emitterRadius * 12.0));
  }

  // mouse force
  vec2 md = vUv - mousePos;
  md.x = md.x - floor(md.x + 0.5);
  md.y = md.y - floor(md.y + 0.5);
  newVel += mouseVel * mouseForce * exp(-dot(md, md) / (emitterRadius * 8.0));

  gl_FragColor = vec4(newVel, 0.0, 1.0);
}`

const curlFrag = `precision highp float;
uniform sampler2D velTex;
uniform vec2 simTexel;
varying vec2 vUv;

void main() {
  float L = texture2D(velTex, fract(vUv - vec2(simTexel.x, 0.0))).y;
  float R = texture2D(velTex, fract(vUv + vec2(simTexel.x, 0.0))).y;
  float B = texture2D(velTex, fract(vUv - vec2(0.0, simTexel.y))).x;
  float T = texture2D(velTex, fract(vUv + vec2(0.0, simTexel.y))).x;
  gl_FragColor = vec4(0.5 * ((R - L) - (T - B)), 0.0, 0.0, 1.0);
}`

const vorticityFrag = `precision highp float;
uniform sampler2D velTex;
uniform sampler2D curlTex;
uniform vec2 simTexel;
uniform float curlStrength;
uniform float dt;
varying vec2 vUv;

void main() {
  float L = texture2D(curlTex, fract(vUv - vec2(simTexel.x, 0.0))).x;
  float R = texture2D(curlTex, fract(vUv + vec2(simTexel.x, 0.0))).x;
  float B = texture2D(curlTex, fract(vUv - vec2(0.0, simTexel.y))).x;
  float T = texture2D(curlTex, fract(vUv + vec2(0.0, simTexel.y))).x;
  float C = texture2D(curlTex, vUv).x;

  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(L) - abs(R));
  force /= length(force) + 1e-4;
  force *= curlStrength * C;
  force.y *= -1.0;

  vec2 vel = texture2D(velTex, vUv).xy + force * dt;
  gl_FragColor = vec4(clamp(vel, -1000.0, 1000.0), 0.0, 1.0);
}`

const divergenceFrag = `precision highp float;
uniform sampler2D velTex;
uniform vec2 simTexel;
varying vec2 vUv;

void main() {
  float L = texture2D(velTex, fract(vUv - vec2(simTexel.x, 0.0))).x;
  float R = texture2D(velTex, fract(vUv + vec2(simTexel.x, 0.0))).x;
  float B = texture2D(velTex, fract(vUv - vec2(0.0, simTexel.y))).y;
  float T = texture2D(velTex, fract(vUv + vec2(0.0, simTexel.y))).y;
  gl_FragColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}`

const pressureFrag = `precision highp float;
uniform sampler2D pressureTex;
uniform sampler2D divTex;
uniform vec2 simTexel;
varying vec2 vUv;

void main() {
  float L = texture2D(pressureTex, fract(vUv - vec2(simTexel.x, 0.0))).x;
  float R = texture2D(pressureTex, fract(vUv + vec2(simTexel.x, 0.0))).x;
  float B = texture2D(pressureTex, fract(vUv - vec2(0.0, simTexel.y))).x;
  float T = texture2D(pressureTex, fract(vUv + vec2(0.0, simTexel.y))).x;
  float div = texture2D(divTex, vUv).x;
  gl_FragColor = vec4((L + R + B + T - div) * 0.25, 0.0, 0.0, 1.0);
}`

const gradSubFrag = `precision highp float;
uniform sampler2D velTex;
uniform sampler2D pressureTex;
uniform vec2 simTexel;
varying vec2 vUv;

void main() {
  float L = texture2D(pressureTex, fract(vUv - vec2(simTexel.x, 0.0))).x;
  float R = texture2D(pressureTex, fract(vUv + vec2(simTexel.x, 0.0))).x;
  float B = texture2D(pressureTex, fract(vUv - vec2(0.0, simTexel.y))).x;
  float T = texture2D(pressureTex, fract(vUv + vec2(0.0, simTexel.y))).x;
  vec2 vel = texture2D(velTex, vUv).xy - 0.5 * vec2(R - L, T - B);
  gl_FragColor = vec4(vel, 0.0, 1.0);
}`

const advectDyeFrag = `precision highp float;
uniform sampler2D dyeTex;
uniform sampler2D velTex;
uniform float dt;
uniform float dissipation;
uniform vec2 emitterPos[5];
uniform vec3 emitterColor[5];
uniform float emitterCount;
uniform float emitterRadius;
uniform vec2 mousePos;
uniform vec3 mouseColor;
uniform float mouseInk;
varying vec2 vUv;

void main() {
  vec2 vel = texture2D(velTex, vUv).xy;
  vec2 coord = fract(vUv - dt * vel);
  vec3 dye = texture2D(dyeTex, coord).rgb * dissipation;

  for (int i = 0; i < 5; i++) {
    if (float(i) >= emitterCount) break;
    vec2 d = vUv - emitterPos[i];
    d.x = d.x - floor(d.x + 0.5);
    d.y = d.y - floor(d.y + 0.5);
    dye += emitterColor[i] * exp(-dot(d, d) / (emitterRadius * 0.35));
  }

  vec2 md = vUv - mousePos;
  md.x = md.x - floor(md.x + 0.5);
  md.y = md.y - floor(md.y + 0.5);
  dye += mouseColor * mouseInk * exp(-dot(md, md) / (emitterRadius * 0.25));

  gl_FragColor = vec4(min(dye, vec3(60.0)), 1.0);
}`

const inkDisplayFrag = `precision highp float;
uniform sampler2D dyeTex;
uniform sampler2D velTex;
uniform vec2 resolution;
uniform float exposure;
uniform float shading;
uniform float grain;
uniform float vignette;
uniform float inkMode;
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

  vec3 dye = texture2D(dyeTex, tuv).rgb;
  float lum = dot(dye, vec3(0.299, 0.587, 0.114));

  vec3 col;
  if (inkMode < 0.5) {
    col = dye * exposure;
  } else {
    // Palette remap of ink luminance
    float t = 1.0 - exp(-lum * exposure * 0.8);
    col = fablePal(t * 0.9, palA, palB, palC, palD) * t * 1.6;
  }

  // Dye-gradient shading — gives the ink volumetric depth
  vec2 texel = 1.0 / resolution;
  float lumR = dot(texture2D(dyeTex, fract(tuv + vec2(texel.x, 0.0))).rgb, vec3(0.299, 0.587, 0.114));
  float lumT = dot(texture2D(dyeTex, fract(tuv + vec2(0.0, texel.y))).rgb, vec3(0.299, 0.587, 0.114));
  vec3 n = normalize(vec3((lumR - lum) * shading * 4.0, (lumT - lum) * shading * 4.0, 1.0));
  float light = 0.65 + 0.35 * dot(n, normalize(vec3(-0.4, 0.55, 0.75)));
  col *= mix(1.0, light, clamp(shading, 0.0, 1.0));

  col = fableACES(col);
  col = fableGrade(col, vUv, suv, resolution, grain, vignette);
  gl_FragColor = vec4(col, 1.0);
}`

const inkParams: ParamSchemaDef[] = [
  { name: 'dyeResolution', type: 'int', min: 256, max: 2048, default: 1024, description: 'Dye texture resolution' },
  { name: 'simResolution', type: 'int', min: 64, max: 512, default: 256, description: 'Velocity field resolution' },
  { name: 'pressureIterations', type: 'int', min: 10, max: 50, default: 24, description: 'Jacobi pressure solve iterations' },
  { name: 'curlStrength', type: 'float', min: 0, max: 60, default: 28, description: 'Vorticity confinement — swirl intensity' },
  { name: 'simSpeed', type: 'float', min: 0.3, max: 3, default: 1, description: 'Simulation speed' },
  { name: 'velocityFade', type: 'float', min: 0, max: 0.5, default: 0.08, description: 'Velocity dissipation per second' },
  { name: 'inkFade', type: 'float', min: 0.02, max: 1.5, default: 0.35, description: 'Ink dissipation per second' },
  { name: 'emitters', type: 'int', min: 0, max: 5, default: 3, description: 'Orbiting ink emitters' },
  { name: 'emitterOrbit', type: 'float', min: 0.05, max: 0.45, default: 0.28, description: 'Emitter orbit radius' },
  { name: 'emitterSpeed', type: 'float', min: 0, max: 2, default: 0.55, description: 'Emitter orbit speed' },
  { name: 'emitterPower', type: 'float', min: 0, max: 3, default: 1, description: 'Emitter force strength' },
  { name: 'splatRadius', type: 'float', min: 0.002, max: 0.05, default: 0.012, description: 'Splat gaussian radius' },
  { name: 'inkMode', type: 'enum', default: 'dye', enumValues: ['dye', 'palette'], description: 'Show raw ink colors or palette remap' },
  { name: 'palette', type: 'enum', default: 'abyss', enumValues: FABLE_PALETTE_NAMES, description: 'Palette (palette mode + mouse ink)' },
  { name: 'colorHue', type: 'float', min: 0, max: 360, default: 0, description: 'Hue shift for emitter inks' },
  { name: 'hueCycle', type: 'float', min: 0, max: 0.5, default: 0.08, description: 'Emitter hue drift over time' },
  { name: 'exposure', type: 'float', min: 0.3, max: 4, default: 1.3, description: 'Brightness' },
  { name: 'shading', type: 'float', min: 0, max: 2, default: 1, description: 'Volumetric ink shading' },
  { name: 'grain', type: 'float', min: 0, max: 1, default: 0.25, description: 'Film grain' },
  { name: 'vignette', type: 'float', min: 0, max: 1, default: 0.3, description: 'Edge vignette' },
  { name: 'mouseForce', type: 'float', min: 0, max: 4, default: 1.5, description: 'Mouse stirring force' },
]

const inkEvaluateSource = FABLE_EVAL_LIB + `
var dyeRes = Math.min(2048, Math.max(256, Math.round(inputs.dyeResolution)));
var simRes = Math.min(512, Math.max(64, Math.round(inputs.simResolution)));
var iters = Math.min(50, Math.max(10, Math.round(inputs.pressureIterations)));
var emitterCount = Math.min(5, Math.max(0, Math.round(inputs.emitters)));
var paletteIdx = Math.round(inputs.palette || 0);
var inkModeIdx = Math.round(inputs.inkMode || 0);

// Framerate-independent physics: dt from real frame delta (clamped),
// injections scale with dt so per-second rates stay constant
var rawDt = ctx.delta ? Math.min(0.05, Math.max(0.004, ctx.delta)) : 0.016;
var dt = rawDt * inputs.simSpeed;
var velDiss = Math.exp(-inputs.velocityFade * dt);
var dyeDiss = Math.exp(-inputs.inkFade * dt);

// Orbiting emitters: positions, tangential force, cycling colors
var t = ctx.elapsed;
var emitterPos = [], emitterVel = [], emitterColor = [];
for (var i = 0; i < 5; i++) {
  var phase = t * inputs.emitterSpeed + i * Math.PI * 2 / Math.max(emitterCount, 1);
  var wobble = 1.0 + 0.25 * Math.sin(t * 0.31 + i * 2.1);
  var r = inputs.emitterOrbit * wobble;
  var px = 0.5 + Math.cos(phase) * r;
  var py = 0.5 + Math.sin(phase) * r;
  // tangential direction; per-frame injection so equilibrium speed stays ~0.4 uv/s
  var tx = -Math.sin(phase), ty = Math.cos(phase);
  var f = inputs.emitterPower * 0.32 * dt;
  emitterPos.push([px, py]);
  emitterVel.push([tx * f, ty * f]);
  var hue = inputs.colorHue + i * 360 / Math.max(emitterCount, 1) + t * inputs.hueCycle * 60;
  var c = hsvToRgb(hue, 0.85, 1.0);
  var inkAmt = 6.0 * inputs.inkFade * dt;
  emitterColor.push([c[0] * inkAmt, c[1] * inkAmt, c[2] * inkAmt]);
}

var res = ctx.resolution || [1, 1];
var aspect = res[1] > 0 ? res[0] / res[1] : 1;
var mx = ctx.mouse ? (ctx.mouse.x + 1) * 0.5 : -10;
var my = ctx.mouse ? (ctx.mouse.y + 1) * 0.5 : -10;
var mvx = ctx.mouseVelocity ? ctx.mouseVelocity.x * 15 * dt : 0;
var mvy = ctx.mouseVelocity ? ctx.mouseVelocity.y * 15 * dt : 0;
var mouseSpeed = Math.hypot(mvx, mvy);
var mouseHue = inputs.colorHue + t * 60;
var mc = hsvToRgb(mouseHue, 0.9, 1.0);
var mouseInk = Math.min(0.5, mouseSpeed * 6.0) * (inputs.mouseForce > 0 ? 1 : 0);

var pal = fablePalette(paletteIdx, inputs.colorHue / 360);
var simTexel = [1 / simRes, 1 / simRes];
var radius = inputs.splatRadius * inputs.splatRadius * 4.0;

var passes = [
  { name: 'advectVel', fragmentShader: inputs.advectVelShader, target: 'velocity',
    readFrom: { velTex: 'velocity' },
    uniforms: { simTexel: simTexel, dt: dt, dissipation: velDiss,
      emitterPos: emitterPos, emitterVel: emitterVel, emitterCount: emitterCount,
      emitterRadius: radius, mousePos: [mx, my], mouseVel: [mvx, mvy], mouseForce: inputs.mouseForce } },
  { name: 'curl', fragmentShader: inputs.curlShader, target: 'curl',
    readFrom: { velTex: 'velocity' },
    uniforms: { simTexel: simTexel } },
  { name: 'vorticity', fragmentShader: inputs.vorticityShader, target: 'velocity',
    readFrom: { velTex: 'velocity', curlTex: 'curl' },
    uniforms: { simTexel: simTexel, curlStrength: inputs.curlStrength, dt: dt } },
  { name: 'divergence', fragmentShader: inputs.divergenceShader, target: 'divergence',
    readFrom: { velTex: 'velocity' },
    uniforms: { simTexel: simTexel } },
];
for (var p = 0; p < iters; p++) {
  passes.push({ name: 'pressure', fragmentShader: inputs.pressureShader, target: 'pressure',
    readFrom: { pressureTex: 'pressure', divTex: 'divergence' },
    uniforms: { simTexel: simTexel } });
}
passes.push({ name: 'gradSub', fragmentShader: inputs.gradSubShader, target: 'velocity',
  readFrom: { velTex: 'velocity', pressureTex: 'pressure' },
  uniforms: { simTexel: simTexel } });
passes.push({ name: 'advectDye', fragmentShader: inputs.advectDyeShader, target: 'dye',
  readFrom: { dyeTex: 'dye', velTex: 'velocity' },
  uniforms: { dt: dt, dissipation: dyeDiss,
    emitterPos: emitterPos, emitterColor: emitterColor, emitterCount: emitterCount,
    emitterRadius: radius, mousePos: [mx, my], mouseColor: mc, mouseInk: mouseInk } });
passes.push({ name: 'display', fragmentShader: inputs.displayShader, target: null,
  readFrom: { dyeTex: 'dye', velTex: 'velocity' },
  uniforms: { resolution: [dyeRes, dyeRes], exposure: inputs.exposure, shading: inputs.shading,
    grain: inputs.grain, vignette: inputs.vignette, inkMode: inkModeIdx,
    palA: pal.a, palB: pal.b, palC: pal.c, palD: pal.d, uAspect: aspect } });

return { shaderConfig: {
  passes: passes,
  renderTargetDefs: {
    velocity: { width: simRes, height: simRes, type: 'float', filter: 'linear', wrap: 'repeat', pingPong: true },
    curl: { width: simRes, height: simRes, type: 'float', filter: 'linear', wrap: 'repeat', pingPong: true },
    divergence: { width: simRes, height: simRes, type: 'float', filter: 'linear', wrap: 'repeat', pingPong: true },
    pressure: { width: simRes, height: simRes, type: 'float', filter: 'linear', wrap: 'repeat', pingPong: true },
    dye: { width: dyeRes, height: dyeRes, type: 'float', filter: 'linear', wrap: 'repeat', pingPong: true },
  },
  stepsPerFrame: 1,
}};
`

const fableInkDef: CompoundGeneratorDef = {
  id: 'builtin_fableInk',
  name: 'Fable Ink',
  description: 'Navier-Stokes fluid ink — swirling turbulent dye you can stir with the mouse, fed by orbiting emitters',
  defaultCameraDistance: 0,
  generatorType: 'fableInk_generator',
  outputMode: 'shader',
  params: inkParams,
  inputs: inkParams.map(p => ({
    name: p.name,
    type: 'number' as const,
    default: p.type === 'bool' ? (p.default ? 1 : 0) : (p.type === 'enum' ? 0 : (p.default as number)),
  })),
  outputs: [{ name: 'shaderConfig', type: 'array' as const }],
  evaluateSource: inkEvaluateSource,
  shaderSources: {
    advectVel: advectVelFrag,
    curl: curlFrag,
    vorticity: vorticityFrag,
    divergence: divergenceFrag,
    pressure: pressureFrag,
    gradSub: gradSubFrag,
    advectDye: advectDyeFrag,
    display: inkDisplayFrag,
  },
}

export const FABLE_INK_GENERATORS: CompoundGeneratorDef[] = [fableInkDef]
