import type { CompoundGeneratorDef } from './generatorGraphFactory'
import type { ParamSchemaDef } from './storage'
import { FABLE_GLSL_LIB, FABLE_EVAL_LIB, FABLE_PALETTE_NAMES } from './fableDisplayLib'
import { FABLE_TEXT_EVAL_LIB, FABLE_TEXT_GLSL, FABLE_FONT_NAMES } from './fableTextLib'

// ═══════════════════════════════════════════════════════════════════════════
// FABLE TICKER — news-crawl strip
//
// The message (with a chosen separator glyph) is tiled to fill a wide
// texture, then scrolled seamlessly across a strip with wrap sampling.
// Bar styles, edge fade, either direction. Alpha overlay.
// ═══════════════════════════════════════════════════════════════════════════

const tickerShader = `precision highp float;
uniform sampler2D textTex;
uniform vec2 resolution;
uniform float uTime;
uniform float uAspect;
uniform float texAspect;
uniform float aa;
uniform float scrollSpeed;
uniform float direction;   // 0 left, 1 right
uniform float posY;
uniform float stripH;
uniform float barStyle;    // 0 solid, 1 glass, 2 gradient, 3 none
uniform float accentTone;
uniform float edgeFade;
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
  float cy = posY * 0.5;
  float dy = pc.y - cy;
  float halfH = stripH * 0.5;

  float bar = smoothstep(halfH + 0.003, halfH - 0.003, abs(dy));
  vec3 accent = fablePal(accentTone, palA, palB, palC, palD);
  vec3 barCol;
  float barA;
  if (barStyle < 0.5) { barCol = vec3(0.018, 0.02, 0.028); barA = 0.92; }
  else if (barStyle < 1.5) { barCol = vec3(0.03, 0.035, 0.05) + accent * 0.05; barA = 0.55; }
  else if (barStyle < 2.5) {
    float gx = suv.x + 0.5;
    barCol = mix(accent * 0.4, vec3(0.02), gx); barA = 0.8;
  } else { barCol = vec3(0.0); barA = 0.0; }

  // accent hairlines above and below the strip
  float hair = smoothstep(0.0035, 0.0015, abs(abs(dy) - halfH));
  float hairA = hair * (barStyle > 2.5 ? 0.0 : 0.9);

  float textH = stripH * 0.66;
  float dir = direction < 0.5 ? 1.0 : -1.0;
  float u = (pc.x + uTime * scrollSpeed * 0.12 * dir) / (textH * texAspect);
  float v = dy / textH + 0.5;
  float inRow = step(0.0, v) * step(v, 1.0);
  float sdf = texture2D(textTex, vec2(fract(u), clamp(v, 0.0, 1.0))).r * inRow;
  float mask = fableSdfMask(sdf, 0.5, aa) * bar;

  // fade the crawl near screen edges
  float fade = mix(1.0, smoothstep(uAspect * 0.5, uAspect * 0.5 - 0.22, abs(pc.x)), edgeFade);
  mask *= fade;

  float a = clamp(bar * barA + hairA * (1.0 - mask), 0.0, 1.0);
  vec3 rgb = mix(barCol, accent, hairA * (1.0 - mask));
  rgb = mix(rgb, vec3(0.96), mask);
  a = max(a, mask);

  rgb = fableACES(rgb * exposure);
  rgb = fableGrade(rgb, vUv, suv, resolution, grain, vignette);
  gl_FragColor = vec4(rgb, a * opacityParam);
}`

const tickerParams: ParamSchemaDef[] = [
  { name: 'text', type: 'text', default: 'Enter text here', description: 'Ticker message' },
  { name: 'font', type: 'enum', default: 'sans', enumValues: FABLE_FONT_NAMES, description: 'Font family' },
  { name: 'separator', type: 'enum', default: 'dot', enumValues: ['dot', 'diamond', 'slash', 'star', 'plus'], description: 'Item separator' },
  { name: 'scrollSpeed', type: 'float', min: 0.1, max: 3, default: 1, description: 'Crawl speed' },
  { name: 'direction', type: 'enum', default: 'left', enumValues: ['left', 'right'], description: 'Crawl direction' },
  { name: 'posY', type: 'float', min: -1, max: 1, default: -0.9, description: 'Vertical position' },
  { name: 'height', type: 'float', min: 0.03, max: 0.18, default: 0.062, description: 'Strip height' },
  { name: 'barStyle', type: 'enum', default: 'solid', enumValues: ['solid', 'glass', 'gradient', 'none'], description: 'Bar style' },
  { name: 'accentTone', type: 'float', min: 0, max: 1, default: 0.6, description: 'Accent palette tone' },
  { name: 'edgeFade', type: 'float', min: 0, max: 1, default: 0.6, description: 'Edge fade' },
  { name: 'opacity', type: 'float', min: 0, max: 1, default: 1, description: 'Overall opacity' },
  { name: 'palette', type: 'enum', default: 'aurora', enumValues: FABLE_PALETTE_NAMES, description: 'Palette' },
  { name: 'colorHue', type: 'float', min: 0, max: 360, default: 0, description: 'Palette hue shift' },
  { name: 'exposure', type: 'float', min: 0.3, max: 3, default: 1.1, description: 'Exposure' },
  { name: 'grain', type: 'float', min: 0, max: 1, default: 0, description: 'Film grain' },
  { name: 'vignette', type: 'float', min: 0, max: 1, default: 0, description: 'Vignette' },
]

const tickerEvaluateSource = FABLE_EVAL_LIB + FABLE_TEXT_EVAL_LIB + `
var text = (typeof inputs.text === 'string' && inputs.text.length > 0) ? inputs.text : 'Enter text here';
var fontIdx = Math.round(inputs.font || 0);
var sepIdx = Math.round(inputs.separator || 0);
var sep = ['  \\u2022  ', '  \\u25C6  ', '  /  ', '  \\u2605  ', '  +  '][Math.max(0, Math.min(sepIdx, 4))];
var paletteIdx = Math.round(inputs.palette || 0);
var pal = fablePalette(paletteIdx, inputs.colorHue / 360);
var res = ctx.resolution || [1, 1];
var aspect = res[1] > 0 ? res[0] / res[1] : 1;

// tile the message so the texture wraps seamlessly: repeat it enough times
// that the height-limited glyph size also fills the full width
var TEXW = 4096, TEXH = 256, SPREAD = 20;
var item = text + sep;
var reps = Math.max(1, Math.min(24, Math.ceil((TEXW / (TEXH * 0.86 * 0.52)) / Math.max(item.length, 1))));
var content = '';
for (var r = 0; r < reps; r++) content += item;

var cacheKey = [text, fontIdx, sepIdx].join('|');
var st = fableTextState(ctx, nodeId, cacheKey, function () {
  var raster = fableRasterText(
    [{ text: content, size: 1, weight: '600' }],
    { width: TEXW, height: TEXH, font: fontIdx, align: 'left', pad: 0.02 });
  return fableTextSDF(raster, SPREAD);
});

var textHeightPx = Math.max(inputs.height * 0.66 * res[1], 6);
var aa = Math.min(0.3, TEXH / (2 * SPREAD * textHeightPx));

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
        scrollSpeed: inputs.scrollSpeed,
        direction: Math.round(inputs.direction || 0),
        posY: inputs.posY,
        stripH: inputs.height,
        barStyle: Math.round(inputs.barStyle || 0),
        accentTone: inputs.accentTone,
        edgeFade: inputs.edgeFade,
        opacityParam: inputs.opacity,
        exposure: inputs.exposure,
        grain: inputs.grain,
        vignette: inputs.vignette,
        palA: pal.a, palB: pal.b, palC: pal.c, palD: pal.d,
      } },
  ],
  renderTargetDefs: {
    texttex: { width: TEXW, height: TEXH, type: 'float', filter: 'linear', wrap: 'repeat', _gen: st.gen },
  },
  initData: { texttex: st.tex.data },
  stepsPerFrame: 1,
}};
`

const fableTickerDef: CompoundGeneratorDef = {
  id: 'builtin_fableTicker',
  name: 'Fable Ticker',
  description: 'News-crawl strip — your message scrolling seamlessly with separator glyphs, either direction, over any pattern',
  defaultCameraDistance: 0,
  generatorType: 'fableTicker_generator',
  outputMode: 'shader',
  params: tickerParams,
  inputs: tickerParams.map(p => ({
    name: p.name,
    type: (p.type === 'text' ? 'string' : 'number') as 'string' | 'number',
    default: p.type === 'text' ? (p.default as string) : (p.type === 'bool' ? (p.default ? 1 : 0) : (p.type === 'enum' ? 0 : (p.default as number))),
  })),
  outputs: [{ name: 'shaderConfig', type: 'array' as const }],
  evaluateSource: tickerEvaluateSource,
  shaderSources: {
    display: tickerShader,
  },
}

export const FABLE_TICKER_GENERATORS: CompoundGeneratorDef[] = [fableTickerDef]
