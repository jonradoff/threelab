import type { CompoundGeneratorDef } from './generatorGraphFactory'
import type { ParamSchemaDef } from './storage'
import { FABLE_GLSL_LIB, FABLE_EVAL_LIB, FABLE_PALETTE_NAMES } from './fableDisplayLib'

// ═══════════════════════════════════════════════════════════════════════════
// FABLE CAUSTICS — sunlight through a simulated water surface
//
// A real 2D wave-equation simulation (height + velocity in a ping-pong
// texture, excited by raindrops and wind ripples) lit from above. The
// display pass treats the surface as a thin lens: caustic brightness is
// the inverse Jacobian of the refraction map, computed per color channel
// at slightly different refraction strengths — so the hot fold lines
// split into prismatic rainbow fringes, like a pool floor at noon.
// ═══════════════════════════════════════════════════════════════════════════

const waveShader = `precision highp float;
uniform sampler2D heightTex;
uniform vec2 resolution;
uniform float uTime;
uniform float waveSpeed;
uniform float damping;
uniform float dropRate;
uniform float dropSize;
uniform float dropStrength;
uniform float windAmp;
uniform float windFreq;
uniform float injectScale; // wall-time normalization: 1.0 at 60fps/2 steps
varying vec2 vUv;

${FABLE_GLSL_LIB}

vec2 dropPos(float id) {
  return vec2(fableHash(vec2(id, 17.7)), fableHash(vec2(id, 91.3)));
}

void main() {
  vec2 px = 1.0 / resolution;
  vec4 s = texture2D(heightTex, vUv);
  float h = s.r, v = s.g;

  float lap = texture2D(heightTex, fract(vUv + vec2(px.x, 0.0))).r
            + texture2D(heightTex, fract(vUv - vec2(px.x, 0.0))).r
            + texture2D(heightTex, fract(vUv + vec2(0.0, px.y))).r
            + texture2D(heightTex, fract(vUv - vec2(0.0, px.y))).r
            - 4.0 * h;
  v += lap * waveSpeed;
  v *= pow(damping, injectScale);

  // raindrops: 4 staggered spawn streams, each an impulse that decays fast
  for (int i = 0; i < 4; i++) {
    float td = uTime * dropRate * 0.25 + float(i) * 0.25;
    float id = floor(td) * 4.0 + float(i);
    float ft = fract(td);
    vec2 dd = vUv - dropPos(id);
    dd -= floor(dd + 0.5); // toroidal distance
    float g = exp(-dot(dd, dd) / (dropSize * dropSize));
    // 0.15: the impulse integrates over ~200 sim steps — larger values put
    // the surface curvature far past the caustic fold regime (verified numerically)
    v -= g * dropStrength * 0.15 * exp(-ft * 12.0) * injectScale;
  }

  // wind: micro-ripples — 8 streams of tiny sign-alternating splashes.
  // Short wavelengths are what fold light into the shimmering web; broad
  // or slow forcing either resonates into stripes or disperses unseen.
  for (int i = 0; i < 8; i++) {
    float td = uTime * windFreq * 2.0 + float(i) * 0.125 + 50.0;
    float id = floor(td) * 8.0 + float(i) + 700.0;
    float ft = fract(td);
    vec2 dd = vUv - dropPos(id);
    dd -= floor(dd + 0.5);
    float g = exp(-dot(dd, dd) / 0.0001);
    float sgn = fableHash(vec2(id, 3.3)) > 0.5 ? 1.0 : -1.0;
    v += g * sgn * windAmp * 0.03 * exp(-ft * 10.0) * injectScale;
  }

  h += v;
  h *= 0.999; // bleed DC offset so the pool stays level

  gl_FragColor = vec4(h, v, 0.0, 1.0);
}`

const displayShader = `precision highp float;
uniform sampler2D heightTex;
uniform vec2 resolution;
uniform vec2 simResVec;
uniform float uTime;
uniform float uAspect;
uniform float focus;
uniform float dispersion;
uniform float sparkle;
uniform float exposure;
uniform float grain;
uniform float vignette;
uniform vec3 palA;
uniform vec3 palB;
uniform vec3 palC;
uniform vec3 palD;
varying vec2 vUv;

${FABLE_GLSL_LIB}

float H(vec2 uv) { return texture2D(heightTex, fract(uv)).r; }

void main() {
  vec2 suv = vUv - 0.5;
  vec2 pc = vec2(suv.x * uAspect, suv.y);
  float cover = max(uAspect, 1.0);
  vec2 tuv = pc / cover + 0.5;

  vec2 px = 1.0 / simResVec;
  float hC = H(tuv);
  float hR = H(tuv + vec2(px.x, 0.0));
  float hL = H(tuv - vec2(px.x, 0.0));
  float hU = H(tuv + vec2(0.0, px.y));
  float hD = H(tuv - vec2(0.0, px.y));
  float hRU = H(tuv + px);
  float hLD = H(tuv - px);
  float hRD = H(tuv + vec2(px.x, -px.y));
  float hLU = H(tuv + vec2(-px.x, px.y));

  // unnormalized second derivatives (per texel²) — the lens curvature
  float hxx = hR + hL - 2.0 * hC;
  float hyy = hU + hD - 2.0 * hC;
  float hxy = (hRU + hLD - hRD - hLU) * 0.25;

  // thin-lens caustic: brightness = 1/|det J| of the refraction map,
  // evaluated at three refraction strengths for prismatic dispersion
  vec3 caus;
  for (int ch = 0; ch < 3; ch++) {
    float k = focus * (1.0 + dispersion * 0.09 * (float(ch) - 1.0));
    float det = (1.0 - k * hxx) * (1.0 - k * hyy) - (k * hxy) * (k * hxy);
    // smooth bounded response: 1 exactly on fold lines, falls off with |det|
    caus[ch] = pow(0.12 / (0.12 + abs(det)), 1.6);
  }

  // water body color: palette gradient with depth-ish drift
  float tint = 0.22 + 0.1 * sin(length(pc) * 2.2 - uTime * 0.13);
  vec3 water = fablePal(tint, palA, palB, palC, palD);
  vec3 col = water * (0.16 + caus * 0.95);

  // surface sparkle where the water is steepest
  vec2 g = vec2(hR - hL, hU - hD);
  col += vec3(1.0) * sparkle * pow(clamp(length(g) * 60.0, 0.0, 1.0), 6.0) * 0.6;

  col = fableACES(col * exposure);
  col = fableGrade(col, vUv, suv, resolution, grain, vignette);
  gl_FragColor = vec4(col, 1.0);
}`

const causticsParams: ParamSchemaDef[] = [
  { name: 'waveSpeed', type: 'float', min: 0.05, max: 0.45, default: 0.3, description: 'Wave propagation speed' },
  { name: 'damping', type: 'float', min: 0.97, max: 0.9995, default: 0.991, description: 'Ripple persistence' },
  { name: 'dropRate', type: 'float', min: 0, max: 8, default: 2, description: 'Raindrops per second' },
  { name: 'dropSize', type: 'float', min: 0.005, max: 0.06, default: 0.018, description: 'Raindrop size' },
  { name: 'dropStrength', type: 'float', min: 0, max: 1.5, default: 0.35, description: 'Raindrop splash strength' },
  { name: 'windAmp', type: 'float', min: 0, max: 1, default: 0.3, description: 'Wind ripple strength' },
  { name: 'windFreq', type: 'float', min: 0.2, max: 3, default: 1, description: 'Wind ripple frequency' },
  { name: 'focus', type: 'float', min: 40, max: 400, default: 180, description: 'Lens focus (caustic sharpness)' },
  { name: 'dispersion', type: 'float', min: 0, max: 1, default: 0.4, description: 'Prismatic color splitting' },
  { name: 'sparkle', type: 'float', min: 0, max: 1, default: 0.35, description: 'Surface glints' },
  { name: 'stepsPerFrame', type: 'int', min: 1, max: 6, default: 2, description: 'Sim speed (steps/frame at 60fps)' },
  { name: 'simResolution', type: 'int', min: 256, max: 1024, default: 512, description: 'Simulation resolution' },
  { name: 'palette', type: 'enum', default: 'abyss', enumValues: FABLE_PALETTE_NAMES, description: 'Palette' },
  { name: 'colorHue', type: 'float', min: 0, max: 360, default: 0, description: 'Palette hue shift' },
  { name: 'exposure', type: 'float', min: 0.3, max: 3, default: 1.1, description: 'Exposure' },
  { name: 'grain', type: 'float', min: 0, max: 1, default: 0.25, description: 'Film grain' },
  { name: 'vignette', type: 'float', min: 0, max: 1, default: 0.4, description: 'Vignette' },
]

const causticsEvaluateSource = FABLE_EVAL_LIB + `
var simRes = Math.min(1024, Math.max(256, Math.round(inputs.simResolution)));
var paletteIdx = Math.round(inputs.palette || 0);
var pal = fablePalette(paletteIdx, inputs.colorHue / 360);
var res = ctx.resolution || [1, 1];
var aspect = res[1] > 0 ? res[0] / res[1] : 1;

// wall-time normalization: measure frame dt so injection/damping are
// per-second, not per-step — the sim behaves the same at 5fps and 60fps
var key = nodeId + '_fableCaustics';
var st = ctx.frameState.get(key) || { lastT: ctx.elapsed };
var dt = Math.min(0.25, Math.max(1/240, ctx.elapsed - st.lastT || 1/60));
st.lastT = ctx.elapsed;
ctx.frameState.set(key, st);
var targetStepsPerSec = 60 * inputs.stepsPerFrame;
var steps = Math.min(6, Math.max(1, Math.round(dt * targetStepsPerSec)));
var injectScale = (dt * 120) / steps;

return { shaderConfig: {
  passes: [
    { name: 'wave', fragmentShader: inputs.waveShader, target: 'height',
      readFrom: { heightTex: 'height' },
      uniforms: {
        resolution: [simRes, simRes],
        uTime: ctx.elapsed,
        waveSpeed: inputs.waveSpeed,
        damping: inputs.damping,
        dropRate: inputs.dropRate,
        dropSize: inputs.dropSize,
        dropStrength: inputs.dropStrength,
        windAmp: inputs.windAmp,
        windFreq: inputs.windFreq,
        injectScale: injectScale,
      } },
    { name: 'display', fragmentShader: inputs.displayShader, target: null,
      readFrom: { heightTex: 'height' },
      uniforms: {
        resolution: res,
        simResVec: [simRes, simRes],
        uTime: ctx.elapsed,
        uAspect: aspect,
        focus: inputs.focus,
        dispersion: inputs.dispersion,
        sparkle: inputs.sparkle,
        exposure: inputs.exposure,
        grain: inputs.grain,
        vignette: inputs.vignette,
        palA: pal.a, palB: pal.b, palC: pal.c, palD: pal.d,
      } },
  ],
  renderTargetDefs: {
    height: { width: simRes, height: simRes, type: 'float', filter: 'linear', wrap: 'repeat', pingPong: true },
  },
  stepsPerFrame: steps,
}};
`

const fableCausticsDef: CompoundGeneratorDef = {
  id: 'builtin_fableCaustics',
  name: 'Fable Caustics',
  description: 'Sunlight refracted through simulated water — dancing caustic webs with prismatic rainbow fringes',
  defaultCameraDistance: 0,
  generatorType: 'fableCaustics_generator',
  outputMode: 'shader',
  params: causticsParams,
  inputs: causticsParams.map(p => ({
    name: p.name,
    type: 'number' as const,
    default: p.type === 'bool' ? (p.default ? 1 : 0) : (p.type === 'enum' ? 0 : (p.default as number)),
  })),
  outputs: [{ name: 'shaderConfig', type: 'array' as const }],
  evaluateSource: causticsEvaluateSource,
  shaderSources: {
    wave: waveShader,
    display: displayShader,
  },
}

export const FABLE_CAUSTICS_GENERATORS: CompoundGeneratorDef[] = [fableCausticsDef]
