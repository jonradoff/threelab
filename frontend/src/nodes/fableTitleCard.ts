import type { CompoundGeneratorDef } from './generatorGraphFactory'
import type { ParamSchemaDef } from './storage'
import { FABLE_GLSL_LIB, FABLE_EVAL_LIB, FABLE_PALETTE_NAMES } from './fableDisplayLib'
import { FABLE_TEXT_EVAL_LIB, FABLE_TEXT_GLSL, FABLE_FONT_NAMES } from './fableTextLib'

// ═══════════════════════════════════════════════════════════════════════════
// FABLE TITLE CARD — cinematic centered title
//
// Title + subtitle with a divider, fading and slowly pushing in, cycling
// or held. Optional letterbox bars and a background dim that darkens the
// generative pattern underneath for the reveal. Alpha overlay.
// ═══════════════════════════════════════════════════════════════════════════

const titleCardShader = `precision highp float;
uniform sampler2D textTex;
uniform vec2 resolution;
uniform float uTime;
uniform float uAspect;
uniform float texAspect;
uniform float aa;
uniform float animMode;   // 0 cycle, 1 always
uniform float holdTime;
uniform float speed;
uniform float posX;
uniform float posY;
uniform float sizeParam;
uniform float zoomDrift;
uniform float titleTone;
uniform float divider;
uniform float letterbox;
uniform float dimAmt;
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

  float presence = 1.0;
  float phase = 0.5;
  if (animMode < 0.5) {
    float cycleT = 1.2 + holdTime + 1.2 + 1.6;
    float ct = mod(uTime * speed, cycleT);
    presence = smoothstep(0.0, 1.2, ct) - smoothstep(holdTime + 1.2, holdTime + 2.4, ct);
    phase = clamp(ct / cycleT, 0.0, 1.0);
  } else {
    phase = fract(uTime * speed * 0.02);
  }
  float e = presence * presence * (3.0 - 2.0 * presence);

  // slow cinematic push-in across the cycle
  float scl = max(sizeParam, 0.02) * (1.0 + zoomDrift * 0.1 * (phase - 0.5));

  vec2 anchor = vec2(posX * 0.5 * uAspect, posY * 0.5);
  vec2 p = pc - anchor;
  vec2 tuv = vec2(p.x / (scl * texAspect), p.y / scl) + 0.5;
  float inBox = step(0.0, tuv.x) * step(tuv.x, 1.0) * step(0.0, tuv.y) * step(tuv.y, 1.0);
  float sdf = texture2D(textTex, clamp(tuv, 0.0, 1.0)).r * inBox;
  float mask = fableSdfMask(sdf, 0.5, aa) * e;

  vec3 titleCol = fablePal(titleTone, palA, palB, palC, palD);
  float lineMix = smoothstep(0.4, 0.48, tuv.y);
  vec3 textCol = mix(vec3(0.75), mix(vec3(0.97), titleCol, 0.55), lineMix);

  // divider line between title and subtitle, wiping open from the center
  float wipe = smoothstep(0.15, 0.85, e);
  float dLine = 0.0;
  if (divider > 0.001) {
    float lineW = scl * texAspect * 0.24 * wipe;
    float dy = abs(p.y - scl * -0.02);
    dLine = smoothstep(scl * 0.012, scl * 0.006, dy) * step(abs(p.x), lineW) * divider * e;
  }

  // letterbox bars
  float bars = letterbox * (smoothstep(0.5 - 0.11, 0.5 - 0.105, abs(suv.y))) * 0.95;
  // background dim for the reveal
  float dim = dimAmt * e * 0.55;

  float textA = clamp(mask + dLine, 0.0, 1.0);
  float baseA = max(bars, dim);
  float a = clamp(textA + baseA * (1.0 - textA), 0.0, 1.0) * opacityParam;
  vec3 rgb = mix(vec3(0.0), mix(textCol, titleCol, dLine * (1.0 - mask)), textA / max(textA + baseA * (1.0 - textA), 1e-4));

  rgb = fableACES(rgb * exposure);
  rgb = fableGrade(rgb, vUv, suv, resolution, grain, vignette);
  gl_FragColor = vec4(rgb, a);
}`

const titleCardParams: ParamSchemaDef[] = [
  { name: 'title', type: 'text', default: 'Enter text here', description: 'Title' },
  { name: 'subtitle', type: 'text', default: 'Enter text here', description: 'Subtitle' },
  { name: 'font', type: 'enum', default: 'serif', enumValues: FABLE_FONT_NAMES, description: 'Font family' },
  { name: 'mode', type: 'enum', default: 'cycle', enumValues: ['cycle', 'always'], description: 'Fade cycle or stay on' },
  { name: 'holdTime', type: 'float', min: 1, max: 15, default: 5, description: 'Hold seconds (cycle mode)' },
  { name: 'speed', type: 'float', min: 0.3, max: 3, default: 1, description: 'Animation speed' },
  { name: 'posX', type: 'float', min: -1, max: 1, default: 0, description: 'Horizontal position' },
  { name: 'posY', type: 'float', min: -1, max: 1, default: 0, description: 'Vertical position' },
  { name: 'size', type: 'float', min: 0.1, max: 1.5, default: 0.36, description: 'Card size' },
  { name: 'zoomDrift', type: 'float', min: 0, max: 1, default: 0.4, description: 'Cinematic push-in' },
  { name: 'titleTone', type: 'float', min: 0, max: 1, default: 0.62, description: 'Accent palette tone' },
  { name: 'divider', type: 'float', min: 0, max: 1, default: 0.7, description: 'Divider line' },
  { name: 'letterbox', type: 'float', min: 0, max: 1, default: 0.5, description: 'Letterbox bars' },
  { name: 'dim', type: 'float', min: 0, max: 1, default: 0.5, description: 'Dim background during reveal' },
  { name: 'opacity', type: 'float', min: 0, max: 1, default: 1, description: 'Overall opacity' },
  { name: 'palette', type: 'enum', default: 'aurora', enumValues: FABLE_PALETTE_NAMES, description: 'Palette' },
  { name: 'colorHue', type: 'float', min: 0, max: 360, default: 0, description: 'Palette hue shift' },
  { name: 'exposure', type: 'float', min: 0.3, max: 3, default: 1.1, description: 'Exposure' },
  { name: 'grain', type: 'float', min: 0, max: 1, default: 0, description: 'Film grain' },
  { name: 'vignette', type: 'float', min: 0, max: 1, default: 0, description: 'Vignette' },
]

const titleCardEvaluateSource = FABLE_EVAL_LIB + FABLE_TEXT_EVAL_LIB + `
var title = (typeof inputs.title === 'string' && inputs.title.length > 0) ? inputs.title : 'Enter text here';
var subtitle = (typeof inputs.subtitle === 'string') ? inputs.subtitle : '';
var fontIdx = Math.round(inputs.font || 0);
var paletteIdx = Math.round(inputs.palette || 0);
var pal = fablePalette(paletteIdx, inputs.colorHue / 360);
var res = ctx.resolution || [1, 1];
var aspect = res[1] > 0 ? res[0] / res[1] : 1;

var TEXW = 2048, TEXH = 512, SPREAD = 24;
var cacheKey = [title, subtitle, fontIdx].join('|');
var st = fableTextState(ctx, nodeId, cacheKey, function () {
  var raster = fableRasterText(
    [
      { text: title, size: 1, weight: '700' },
      { text: subtitle, size: 0.34, gapBefore: 0.34, weight: '400' },
    ],
    { width: TEXW, height: TEXH, font: fontIdx, pad: 0.06, letterSpacing: 0.06 });
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
        animMode: Math.round(inputs.mode || 0),
        holdTime: inputs.holdTime,
        speed: inputs.speed,
        posX: inputs.posX,
        posY: inputs.posY,
        sizeParam: inputs.size,
        zoomDrift: inputs.zoomDrift,
        titleTone: inputs.titleTone,
        divider: inputs.divider,
        letterbox: inputs.letterbox,
        dimAmt: inputs.dim,
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

const fableTitleCardDef: CompoundGeneratorDef = {
  id: 'builtin_fableTitleCard',
  name: 'Fable Title Card',
  description: 'Cinematic centered title with divider, letterbox bars, background dim, and a slow push-in — cycling or held',
  defaultCameraDistance: 0,
  generatorType: 'fableTitleCard_generator',
  outputMode: 'shader',
  params: titleCardParams,
  inputs: titleCardParams.map(p => ({
    name: p.name,
    type: (p.type === 'text' ? 'string' : 'number') as 'string' | 'number',
    default: p.type === 'text' ? (p.default as string) : (p.type === 'bool' ? (p.default ? 1 : 0) : (p.type === 'enum' ? 0 : (p.default as number))),
  })),
  outputs: [{ name: 'shaderConfig', type: 'array' as const }],
  evaluateSource: titleCardEvaluateSource,
  shaderSources: {
    display: titleCardShader,
  },
}

export const FABLE_TITLE_CARD_GENERATORS: CompoundGeneratorDef[] = [fableTitleCardDef]
