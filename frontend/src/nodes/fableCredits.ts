import type { CompoundGeneratorDef } from './generatorGraphFactory'
import type { ParamSchemaDef } from './storage'
import { FABLE_GLSL_LIB, FABLE_EVAL_LIB, FABLE_PALETTE_NAMES } from './fableDisplayLib'
import { FABLE_TEXT_EVAL_LIB, FABLE_TEXT_GLSL, FABLE_FONT_NAMES } from './fableTextLib'

// ═══════════════════════════════════════════════════════════════════════════
// FABLE CREDITS ROLL — scrolling end credits
//
// Multi-line text (separate lines with "|") rasterized into a tall texture
// and rolled bottom-to-top with soft fade zones at the screen edges.
// Lines starting with "*" render larger, as section headings. Alpha overlay.
// ═══════════════════════════════════════════════════════════════════════════

const creditsShader = `precision highp float;
uniform sampler2D textTex;
uniform vec2 resolution;
uniform float uTime;
uniform float uAspect;
uniform float texAspectV;   // texture H/W
uniform float aa;
uniform float scrollSpeed;
uniform float posX;
uniform float widthParam;
uniform float fadeZone;
uniform float textTone;
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

  float colW = widthParam * uAspect;
  float blockH = colW * texAspectV;
  // roll from below the screen to fully above, then loop
  float travel = 1.0 + blockH;
  float yScroll = -0.5 - blockH * 0.5 + mod(uTime * scrollSpeed * 0.06, travel);

  vec2 p = pc - vec2(posX * 0.5 * uAspect, yScroll);
  vec2 tuv = vec2(p.x / colW, p.y / blockH) + 0.5;
  float inBox = step(0.0, tuv.x) * step(tuv.x, 1.0) * step(0.0, tuv.y) * step(tuv.y, 1.0);
  float sdf = texture2D(textTex, clamp(tuv, 0.0, 1.0)).r * inBox;
  float mask = fableSdfMask(sdf, 0.5, aa);

  // fade near top and bottom of screen
  float fade = smoothstep(0.5, 0.5 - fadeZone * 0.25, abs(suv.y));
  mask *= fade;

  vec3 textCol = mix(vec3(0.92), fablePal(textTone, palA, palB, palC, palD), 0.35);
  vec3 rgb = fableACES(textCol * exposure);
  rgb = fableGrade(rgb, vUv, suv, resolution, grain, vignette);
  gl_FragColor = vec4(rgb, mask * opacityParam);
}`

const creditsParams: ParamSchemaDef[] = [
  { name: 'text', type: 'text', default: 'Enter text here|Separate lines with the | character|*Headings start with an asterisk', description: 'Credits (| separates lines, * marks headings)' },
  { name: 'font', type: 'enum', default: 'sans', enumValues: FABLE_FONT_NAMES, description: 'Font family' },
  { name: 'scrollSpeed', type: 'float', min: 0.1, max: 3, default: 1, description: 'Roll speed' },
  { name: 'posX', type: 'float', min: -1, max: 1, default: 0, description: 'Horizontal position' },
  { name: 'width', type: 'float', min: 0.15, max: 0.9, default: 0.4, description: 'Column width (screen fraction)' },
  { name: 'fadeZone', type: 'float', min: 0, max: 1, default: 0.6, description: 'Edge fade zones' },
  { name: 'textTone', type: 'float', min: 0, max: 1, default: 0.62, description: 'Tint palette tone' },
  { name: 'opacity', type: 'float', min: 0, max: 1, default: 1, description: 'Overall opacity' },
  { name: 'palette', type: 'enum', default: 'aurora', enumValues: FABLE_PALETTE_NAMES, description: 'Palette' },
  { name: 'colorHue', type: 'float', min: 0, max: 360, default: 0, description: 'Palette hue shift' },
  { name: 'exposure', type: 'float', min: 0.3, max: 3, default: 1.1, description: 'Exposure' },
  { name: 'grain', type: 'float', min: 0, max: 1, default: 0, description: 'Film grain' },
  { name: 'vignette', type: 'float', min: 0, max: 1, default: 0, description: 'Vignette' },
]

const creditsEvaluateSource = FABLE_EVAL_LIB + FABLE_TEXT_EVAL_LIB + `
var text = (typeof inputs.text === 'string' && inputs.text.length > 0) ? inputs.text : 'Enter text here';
var fontIdx = Math.round(inputs.font || 0);
var paletteIdx = Math.round(inputs.palette || 0);
var pal = fablePalette(paletteIdx, inputs.colorHue / 360);
var res = ctx.resolution || [1, 1];
var aspect = res[1] > 0 ? res[0] / res[1] : 1;

var TEXW = 1024, TEXH = 2048, SPREAD = 12;
var cacheKey = [text, fontIdx].join('|');
var st = fableTextState(ctx, nodeId, cacheKey, function () {
  var rawLines = text.split('|');
  var lines = [];
  for (var i = 0; i < rawLines.length; i++) {
    var s = rawLines[i].trim();
    if (s.indexOf('*') === 0) {
      lines.push({ text: s.slice(1).trim(), size: 1.5, weight: '800', gapBefore: i === 0 ? 0 : 0.9 });
    } else {
      lines.push({ text: s, size: 1, weight: '400', gapBefore: i === 0 ? 0 : 0.45 });
    }
  }
  var raster = fableRasterText(lines, { width: TEXW, height: TEXH, font: fontIdx, pad: 0.04 });
  return fableTextSDF(raster, SPREAD);
});

var lineHeightPx = Math.max(inputs.width * res[0] * 0.06, 6);
var aa = Math.min(0.35, TEXH / (2 * SPREAD * lineHeightPx * 20));

return { shaderConfig: {
  passes: [
    { name: 'display', fragmentShader: inputs.displayShader, target: null,
      readFrom: { textTex: 'texttex' },
      uniforms: {
        resolution: res,
        uTime: ctx.elapsed,
        uAspect: aspect,
        texAspectV: TEXH / TEXW,
        aa: aa,
        scrollSpeed: inputs.scrollSpeed,
        posX: inputs.posX,
        widthParam: inputs.width,
        fadeZone: inputs.fadeZone,
        textTone: inputs.textTone,
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

const fableCreditsDef: CompoundGeneratorDef = {
  id: 'builtin_fableCredits',
  name: 'Fable Credits Roll',
  description: 'Scrolling end credits — multi-line text rolling bottom to top with fade zones; | separates lines, * marks headings',
  defaultCameraDistance: 0,
  generatorType: 'fableCredits_generator',
  outputMode: 'shader',
  params: creditsParams,
  inputs: creditsParams.map(p => ({
    name: p.name,
    type: (p.type === 'text' ? 'string' : 'number') as 'string' | 'number',
    default: p.type === 'text' ? (p.default as string) : (p.type === 'bool' ? (p.default ? 1 : 0) : (p.type === 'enum' ? 0 : (p.default as number))),
  })),
  outputs: [{ name: 'shaderConfig', type: 'array' as const }],
  evaluateSource: creditsEvaluateSource,
  shaderSources: {
    display: creditsShader,
  },
}

export const FABLE_CREDITS_GENERATORS: CompoundGeneratorDef[] = [fableCreditsDef]
