import type { CompoundGeneratorDef } from './generatorGraphFactory'
import type { ParamSchemaDef } from './storage'
import { FABLE_GLSL_LIB, FABLE_EVAL_LIB, FABLE_PALETTE_NAMES } from './fableDisplayLib'

// ═══════════════════════════════════════════════════════════════════════════
// FABLE NEURAL — a living neural network
//
// A multi-layer perceptron that visibly computes: forward-pass waves sweep
// left to right as comet pulses racing along curved connections, neurons
// flare and slowly cool as the wave hits them, and edge weights drift over
// time like the net is learning. Positive and negative weights take
// different palette tones; energy shimmers along idle lines.
//
// Per-pixel cost is O(neurons), not O(neurons²): for each left-layer
// neuron the eased edge curve is inverted to find which right-layer
// neurons' edges pass near this pixel — only those two are evaluated.
// ═══════════════════════════════════════════════════════════════════════════

const neuralFrag = `precision highp float;
uniform float uTime;
uniform float uAspect;
uniform vec2 resolution;
uniform float layersF;
uniform float neuronsF;
uniform float irregular;
uniform float passSpeed;
uniform float pulseW;
uniform float pulseIntensity;
uniform float edgeBrightness;
uniform float edgeThickness;
uniform float learnDrift;
uniform float nodeSize;
uniform float glowAmt;
uniform float sparkle;
uniform float wobble;
uniform float spread;
uniform float posTone;
uniform float negTone;
uniform float exposure;
uniform float grain;
uniform float vignette;
uniform vec3 palA;
uniform vec3 palB;
uniform vec3 palC;
uniform vec3 palD;
varying vec2 vUv;

${FABLE_GLSL_LIB}

float layerCount(float l) {
  if (l > layersF - 1.5) return max(2.0, floor(neuronsF * 0.4 + 0.5)); // output funnel
  if (l < 0.5) return neuronsF;                                        // input layer full
  float h = fableHash(vec2(l * 7.31, 11.17));
  return clamp(floor(neuronsF * (1.0 - irregular * 0.55 * h) + 0.5), 2.0, neuronsF);
}

float neuronY(float l, float a, float nl, float netH) {
  float y = ((a + 0.5) / nl - 0.5) * netH;
  y += wobble * 0.02 * sin(uTime * 0.8 + fableHash(vec2(l * 3.7, a * 5.1)) * 6.28318 + l * 1.7);
  return y;
}

float weightOf(float l, float a, float b) {
  float h = fableHash(vec2(l * 131.7 + a * 7.77, b * 13.13));
  return sin(h * 6.28318 + uTime * learnDrift * 0.25 + h * 9.0);
}

float actOf(float l, float a, float passId) {
  return 0.25 + 0.75 * fableHash(vec2(a * 3.17 + l * 57.3, passId * 17.7 + 3.3));
}

void main() {
  vec2 suv = vUv - 0.5;
  vec2 pc = vec2(suv.x * uAspect, suv.y);

  float netW = uAspect * spread * 0.92;
  float netH = spread * 0.9;
  float nLayers = max(layersF, 2.0);
  float segW = netW / (nLayers - 1.0);

  // position in layer space; clamp to the bracketing layer pair
  float lx = (pc.x / netW + 0.5) * (nLayers - 1.0);
  float iPair = clamp(floor(lx), 0.0, nLayers - 2.0);
  float t = clamp(lx - iPair, 0.0, 1.0);
  float s = t * t * (3.0 - 2.0 * t);
  float sc = clamp(s, 0.045, 0.955);

  // forward-pass wave: sweeps past both ends so the net rests between passes
  float passCycle = uTime * passSpeed * 0.55;
  float passId = floor(passCycle);
  float xw = fract(passCycle) * (nLayers + 1.2) - 1.1; // in layer units

  // deep-space backdrop
  vec3 col = fablePal(0.08, palA, palB, palC, palD) * (0.045 + 0.035 * (1.0 - length(suv) * 1.2));

  vec3 posCol = fablePal(posTone, palA, palB, palC, palD);
  vec3 negCol = fablePal(negTone, palA, palB, palC, palD);

  // ── edges of the bracketing layer pair ──
  float nl = layerCount(iPair);
  float nr = layerCount(iPair + 1.0);
  float tp = xw - iPair; // pulse parameter on this pair's edges
  for (int ai = 0; ai < 24; ai++) {
    if (float(ai) >= nl) break;
    float a = float(ai);
    float ya = neuronY(iPair, a, nl, netH);
    // invert the eased curve to find which right neuron's edge is near
    float bGuess = ((pc.y - ya * (1.0 - sc)) / sc / netH + 0.5) * nr - 0.5;
    for (int k = 0; k < 2; k++) {
      float b = clamp(floor(bGuess) + float(k), 0.0, nr - 1.0);
      float yb = neuronY(iPair + 1.0, b, nr, netH);
      float yC = mix(ya, yb, s);
      float slope = (yb - ya) * 6.0 * t * (1.0 - t) / segW;
      float d = abs(pc.y - yC) / sqrt(1.0 + slope * slope);

      float w = weightOf(iPair, a, b);
      float act = actOf(iPair, a, passId);
      vec3 wcol = w > 0.0 ? posCol : negCol;

      float th = 0.0015 * edgeThickness * (0.55 + 0.95 * abs(w));
      float line = exp(-d * d / (th * th * 4.0));
      float skirt = exp(-d / (th * 9.0)) * 0.22 * glowAmt;

      // energy shimmer flowing along idle lines
      float shimmer = 0.75 + 0.3 * sin((iPair + t) * 80.0 + uTime * 5.5 + w * 23.0);
      float idle = edgeBrightness * (0.13 + 0.3 * abs(w)) * shimmer;

      // comet pulse: sharp front, glowing tail, gated by source activation
      float packet = 0.0;
      if (tp > -0.25 && tp < 1.25) {
        float dt = t - tp;
        packet = exp(-abs(dt) * (dt > 0.0 ? 30.0 : 10.0) / max(pulseW, 0.1))
               * act * (0.35 + 0.65 * abs(w));
      }

      col += wcol * (line + skirt) * idle;
      col += mix(wcol, vec3(1.0), 0.45) * (line * 2.2 + skirt * 3.0) * packet * pulseIntensity;
    }
  }

  // ── neurons of the two bracketing layers ──
  for (int li = 0; li < 2; li++) {
    float l = iPair + float(li);
    float xl = (l / (nLayers - 1.0) - 0.5) * netW;
    float nl2 = layerCount(l);
    for (int ai = 0; ai < 24; ai++) {
      if (float(ai) >= nl2) break;
      float a = float(ai);
      float act = actOf(l, a, passId);
      float ya = neuronY(l, a, nl2, netH);
      float d = length(pc - vec2(xl, ya));

      float r = 0.011 * nodeSize * (0.75 + 0.5 * act);
      // flare when the wavefront arrives, slow cool-down after
      float sf = xw - l;
      float flare = act * exp(-abs(sf) * (sf > 0.0 ? 1.9 : 13.0));

      float core = exp(-d * d / (r * r * 0.5));
      float ring = exp(-pow(abs(d - r) / (r * 0.34), 2.0));
      float halo = exp(-d / (r * 3.6));

      vec3 ncol = fablePal(0.45 + 0.35 * act, palA, palB, palC, palD);
      col += ncol * (ring * 0.85 + core * (0.3 + 1.7 * flare));
      col += ncol * halo * flare * glowAmt * 1.1;
      col += vec3(1.0) * core * flare * 1.3;
    }
  }

  // scintillation: sparkle where the image is already bright
  float spk = fableHash(vUv * resolution * 0.5 + floor(uTime * 24.0) * 3.71);
  col += col * step(0.985, spk) * sparkle * 2.5;

  col = fableACES(col * exposure);
  col = fableGrade(col, vUv, suv, resolution, grain, vignette);
  gl_FragColor = vec4(col, 1.0);
}`

const neuralParams: ParamSchemaDef[] = [
  { name: 'layers', type: 'int', min: 3, max: 8, default: 5, description: 'Network layers' },
  { name: 'neurons', type: 'int', min: 4, max: 24, default: 11, description: 'Max neurons per layer' },
  { name: 'irregular', type: 'float', min: 0, max: 1, default: 0.5, description: 'Layer size variation' },
  { name: 'passSpeed', type: 'float', min: 0.1, max: 3, default: 0.9, description: 'Forward-pass rate' },
  { name: 'pulseWidth', type: 'float', min: 0.1, max: 2, default: 0.8, description: 'Pulse packet length' },
  { name: 'pulseIntensity', type: 'float', min: 0, max: 3, default: 1.3, description: 'Pulse brightness' },
  { name: 'edgeBrightness', type: 'float', min: 0, max: 2, default: 0.8, description: 'Idle connection brightness' },
  { name: 'edgeThickness', type: 'float', min: 0.5, max: 3, default: 1, description: 'Connection thickness' },
  { name: 'learnDrift', type: 'float', min: 0, max: 2, default: 0.5, description: 'Weight drift (learning)' },
  { name: 'nodeSize', type: 'float', min: 0.5, max: 2, default: 1, description: 'Neuron size' },
  { name: 'glow', type: 'float', min: 0, max: 2, default: 1, description: 'Glow bloom' },
  { name: 'sparkle', type: 'float', min: 0, max: 1, default: 0.45, description: 'Scintillation' },
  { name: 'wobble', type: 'float', min: 0, max: 1, default: 0.35, description: 'Organic node drift' },
  { name: 'spread', type: 'float', min: 0.5, max: 1, default: 0.85, description: 'Network screen coverage' },
  { name: 'posTone', type: 'float', min: 0, max: 1, default: 0.62, description: 'Positive-weight tone' },
  { name: 'negTone', type: 'float', min: 0, max: 1, default: 0.16, description: 'Negative-weight tone' },
  { name: 'palette', type: 'enum', default: 'aurora', enumValues: FABLE_PALETTE_NAMES, description: 'Palette' },
  { name: 'colorHue', type: 'float', min: 0, max: 360, default: 0, description: 'Palette hue shift' },
  { name: 'exposure', type: 'float', min: 0.3, max: 3, default: 1.15, description: 'Exposure' },
  { name: 'grain', type: 'float', min: 0, max: 1, default: 0.25, description: 'Film grain' },
  { name: 'vignette', type: 'float', min: 0, max: 1, default: 0.45, description: 'Vignette' },
]

const neuralEvaluateSource = FABLE_EVAL_LIB + `
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
    layersF: Math.round(inputs.layers),
    neuronsF: Math.round(inputs.neurons),
    irregular: inputs.irregular,
    passSpeed: inputs.passSpeed,
    pulseW: inputs.pulseWidth,
    pulseIntensity: inputs.pulseIntensity,
    edgeBrightness: inputs.edgeBrightness,
    edgeThickness: inputs.edgeThickness,
    learnDrift: inputs.learnDrift,
    nodeSize: inputs.nodeSize,
    glowAmt: inputs.glow,
    sparkle: inputs.sparkle,
    wobble: inputs.wobble,
    spread: inputs.spread,
    posTone: inputs.posTone,
    negTone: inputs.negTone,
    exposure: inputs.exposure,
    grain: inputs.grain,
    vignette: inputs.vignette,
    palA: pal.a, palB: pal.b, palC: pal.c, palD: pal.d,
  },
}};
`

const fableNeuralDef: CompoundGeneratorDef = {
  id: 'builtin_fableNeural',
  name: 'Fable Neural',
  description: 'A living neural network — forward-pass pulses race along glowing connections, neurons flare as the wave arrives, weights drift as it learns',
  defaultCameraDistance: 0,
  generatorType: 'fableNeural_generator',
  outputMode: 'shader',
  params: neuralParams,
  inputs: neuralParams.map(p => ({
    name: p.name,
    type: 'number' as const,
    default: p.type === 'bool' ? (p.default ? 1 : 0) : (p.type === 'enum' ? 0 : (p.default as number)),
  })),
  outputs: [{ name: 'shaderConfig', type: 'array' as const }],
  evaluateSource: neuralEvaluateSource,
  fragmentShader: neuralFrag,
}

export const FABLE_NEURAL_GENERATORS: CompoundGeneratorDef[] = [fableNeuralDef]
