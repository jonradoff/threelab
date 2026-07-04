import type { CompoundGeneratorDef } from './generatorGraphFactory'
import type { ParamSchemaDef } from './storage'
import { FABLE_GLSL_LIB, FABLE_EVAL_LIB, FABLE_PALETTE_NAMES } from './fableDisplayLib'
import { FABLE_TEXT_EVAL_LIB, FABLE_TEXT_GLSL, FABLE_FONT_NAMES } from './fableTextLib'

// ═══════════════════════════════════════════════════════════════════════════
// FABLE NEON SIGN — flickering neon-tube text
//
// The SDF's iso-band around the glyph edge becomes the glass tube: a hot
// white core inside a colored gas ring with wide bloom. Segments of the
// sign buzz and drop out like failing transformers. Alpha overlay.
// ═══════════════════════════════════════════════════════════════════════════

const neonShader = `precision highp float;
uniform sampler2D textTex;
uniform vec2 resolution;
uniform float uTime;
uniform float uAspect;
uniform float texAspect;
uniform float aa;
uniform float posX;
uniform float posY;
uniform float sizeParam;
uniform float rotation;
uniform float tubeWidth;
uniform float tubeTone;
uniform float glowSize;
uniform float flickerAmt;
uniform float buzzSpeed;
uniform float fillMode;   // 0 tube outline, 1 filled neon
uniform float backboard;
uniform float opacityParam;
uniform float exposure;
uniform float grain;
uniform float vignette;
uniform vec3 palA;
uniform vec3 palB;
uniform vec3 palC;
uniform vec3 palD;
varying vec2 vUv;

${FABLE_GLSL_LIB}
${FABLE_TEXT_GLSL}

void main() {
  vec2 suv = vUv - 0.5;
  vec2 pc = vec2(suv.x * uAspect, suv.y);
  vec2 anchor = vec2(posX * 0.5 * uAspect, posY * 0.5);
  vec2 p = pc - anchor;
  float ang = rotation * 0.0174533;
  float ca = cos(ang), sa = sin(ang);
  p = mat2(ca, sa, -sa, ca) * p;

  float scl = max(sizeParam, 0.01);
  vec2 tuv = vec2(p.x / (scl * texAspect), p.y / scl) + 0.5;
  float inBox = step(0.0, tuv.x) * step(tuv.x, 1.0) * step(0.0, tuv.y) * step(tuv.y, 1.0);
  float sdf = texture2D(textTex, clamp(tuv, 0.0, 1.0)).r * inBox;

  // buzz + flicker: whole-sign shimmer, plus per-segment dropouts
  float buzz = 1.0 - 0.06 * flickerAmt * fableHash(vec2(floor(uTime * 60.0 * buzzSpeed), 3.3));
  float seg = floor(tuv.x * 5.0);
  float slot = floor(uTime * buzzSpeed * 0.6);
  float dropRnd = fableHash(vec2(slot * 5.0 + seg, 17.9));
  float segOn = dropRnd < flickerAmt * 0.22
    ? 0.15 + 0.5 * fableHash(vec2(floor(uTime * 28.0 * buzzSpeed), seg))
    : 1.0;
  float power = buzz * segOn;

  // tube band: iso-contour around the glyph edge
  float tubeCenter = 0.5;
  float band = abs(sdf - tubeCenter);
  float tube = 1.0 - smoothstep(tubeWidth * 0.5 - aa, tubeWidth * 0.5 + aa, band);
  float core = 1.0 - smoothstep(tubeWidth * 0.18 - aa, tubeWidth * 0.18 + aa, band);
  if (fillMode > 0.5) {
    float fillIn = fableSdfMask(sdf, 0.5, aa);
    tube = max(tube, fillIn * 0.85);
    core = max(core, fableSdfMask(sdf, 0.62, aa));
  }

  vec3 gas = fablePal(tubeTone, palA, palB, palC, palD);
  // wide bloom from the tube
  float bloom = exp(-band * (14.0 / max(glowSize, 0.05))) * inBox;

  vec3 rgb = gas * tube * 1.7 + mix(gas, vec3(1.0, 1.0, 0.95), 0.7) * core * 1.1 + gas * bloom * 0.85;
  rgb *= power;
  float a = clamp(tube * 1.2 + core + bloom * 0.75 * power, 0.0, 1.0);

  // backboard panel
  vec2 q = abs(p) / vec2(scl * texAspect * 0.5 + scl * 0.28, scl * 0.5 + scl * 0.22);
  float box = max(q.x, q.y);
  float backA = backboard * smoothstep(1.06, 0.94, box) * 0.85;
  float aOut = clamp(a + backA * (1.0 - a), 0.0, 1.0) * opacityParam;
  vec3 backCol = vec3(0.015, 0.014, 0.02) + gas * 0.015;
  rgb = mix(backCol, rgb / max(a, 1e-4), a / max(a + backA * (1.0 - a), 1e-4));

  rgb = fableACES(rgb * exposure);
  rgb = fableGrade(rgb, vUv, suv, resolution, grain, vignette);
  gl_FragColor = vec4(rgb, aOut);
}`

const neonParams: ParamSchemaDef[] = [
  { name: 'text', type: 'text', default: 'Enter text here', description: 'Sign text' },
  { name: 'font', type: 'enum', default: 'script', enumValues: FABLE_FONT_NAMES, description: 'Font family' },
  { name: 'posX', type: 'float', min: -1, max: 1, default: 0, description: 'Horizontal position' },
  { name: 'posY', type: 'float', min: -1, max: 1, default: 0, description: 'Vertical position' },
  { name: 'size', type: 'float', min: 0.05, max: 1.5, default: 0.32, description: 'Sign size' },
  { name: 'rotation', type: 'float', min: -180, max: 180, default: -4, description: 'Rotation (degrees)' },
  { name: 'tubeWidth', type: 'float', min: 0.02, max: 0.2, default: 0.07, description: 'Tube thickness' },
  { name: 'tubeTone', type: 'float', min: 0, max: 1, default: 0.85, description: 'Gas color (palette tone)' },
  { name: 'glowSize', type: 'float', min: 0.05, max: 2, default: 0.8, description: 'Bloom size' },
  { name: 'flicker', type: 'float', min: 0, max: 1, default: 0.45, description: 'Flicker + dropout amount' },
  { name: 'buzzSpeed', type: 'float', min: 0.2, max: 3, default: 1, description: 'Buzz speed' },
  { name: 'fillMode', type: 'enum', default: 'tube', enumValues: ['tube', 'filled'], description: 'Tube outline or filled glow' },
  { name: 'backboard', type: 'float', min: 0, max: 1, default: 0.35, description: 'Dark backboard panel' },
  { name: 'opacity', type: 'float', min: 0, max: 1, default: 1, description: 'Overall opacity' },
  { name: 'palette', type: 'enum', default: 'candy', enumValues: FABLE_PALETTE_NAMES, description: 'Palette' },
  { name: 'colorHue', type: 'float', min: 0, max: 360, default: 0, description: 'Palette hue shift' },
  { name: 'exposure', type: 'float', min: 0.3, max: 3, default: 1.2, description: 'Exposure' },
  { name: 'grain', type: 'float', min: 0, max: 1, default: 0, description: 'Film grain' },
  { name: 'vignette', type: 'float', min: 0, max: 1, default: 0, description: 'Vignette' },
]

const neonEvaluateSource = FABLE_EVAL_LIB + FABLE_TEXT_EVAL_LIB + `
var text = (typeof inputs.text === 'string' && inputs.text.length > 0) ? inputs.text : 'Enter text here';
var fontIdx = Math.round(inputs.font || 0);
var paletteIdx = Math.round(inputs.palette || 0);
var pal = fablePalette(paletteIdx, inputs.colorHue / 360);
var res = ctx.resolution || [1, 1];
var aspect = res[1] > 0 ? res[0] / res[1] : 1;

var TEXW = 2048, TEXH = 512, SPREAD = 40;
var cacheKey = [text, fontIdx].join('|');
var st = fableTextState(ctx, nodeId, cacheKey, function () {
  var raster = fableRasterText(
    [{ text: text, size: 1, weight: '700' }],
    { width: TEXW, height: TEXH, font: fontIdx, pad: 0.12 });
  return fableTextSDF(raster, SPREAD);
});

var textHeightPx = Math.max(inputs.size * res[1], 8);
var aa = Math.min(0.25, TEXH / (2 * SPREAD * textHeightPx));

return { shaderConfig: {
  passes: [
    { name: 'display', fragmentShader: inputs.displayShader, target: null,
      readFrom: { textTex: 'texttex' },
      uniforms: {
        resolution: res,
        uTime: ctx.elapsed,
        uAspect: aspect,
        texAspect: TEXW / TEXH,
        aa: aa,
        posX: inputs.posX,
        posY: inputs.posY,
        sizeParam: inputs.size,
        rotation: inputs.rotation,
        tubeWidth: inputs.tubeWidth,
        tubeTone: inputs.tubeTone,
        glowSize: inputs.glowSize,
        flickerAmt: inputs.flicker,
        buzzSpeed: inputs.buzzSpeed,
        fillMode: Math.round(inputs.fillMode || 0),
        backboard: inputs.backboard,
        opacityParam: inputs.opacity,
        exposure: inputs.exposure,
        grain: inputs.grain,
        vignette: inputs.vignette,
        palA: pal.a, palB: pal.b, palC: pal.c, palD: pal.d,
      } },
  ],
  renderTargetDefs: {
    texttex: { width: TEXW, height: TEXH, type: 'float', filter: 'linear', _gen: st.gen },
  },
  initData: { texttex: st.tex.data },
  stepsPerFrame: 1,
}};
`

const fableNeonSignDef: CompoundGeneratorDef = {
  id: 'builtin_fableNeonSign',
  name: 'Fable Neon Sign',
  description: 'Flickering neon-tube text — hot white cores in colored glass tubes with wide bloom, buzzing segments dropping out',
  defaultCameraDistance: 0,
  generatorType: 'fableNeonSign_generator',
  outputMode: 'shader',
  params: neonParams,
  inputs: neonParams.map(p => ({
    name: p.name,
    type: (p.type === 'text' ? 'string' : 'number') as 'string' | 'number',
    default: p.type === 'text' ? (p.default as string) : (p.type === 'bool' ? (p.default ? 1 : 0) : (p.type === 'enum' ? 0 : (p.default as number))),
  })),
  outputs: [{ name: 'shaderConfig', type: 'array' as const }],
  evaluateSource: neonEvaluateSource,
  shaderSources: {
    display: neonShader,
  },
}

export const FABLE_NEON_SIGN_GENERATORS: CompoundGeneratorDef[] = [fableNeonSignDef]
