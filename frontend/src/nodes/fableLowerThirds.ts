import type { CompoundGeneratorDef } from './generatorGraphFactory'
import type { ParamSchemaDef } from './storage'
import { FABLE_GLSL_LIB, FABLE_EVAL_LIB, FABLE_PALETTE_NAMES } from './fableDisplayLib'
import { FABLE_TEXT_EVAL_LIB, FABLE_TEXT_GLSL, FABLE_FONT_NAMES } from './fableTextLib'

// ═══════════════════════════════════════════════════════════════════════════
// FABLE LOWER THIRDS — broadcast-style name/title overlay
//
// Title + subtitle rasterized left-aligned into one SDF texture. The shader
// draws a backing panel (glass / solid / gradient / minimal underline), an
// accent bar that leads the animation, and a shine sweep. Loops through
// slide-in → hold → slide-out, or stays permanently on. Alpha overlay.
// ═══════════════════════════════════════════════════════════════════════════

const lowerThirdsShader = `precision highp float;
uniform sampler2D textTex;
uniform vec2 resolution;
uniform float uTime;
uniform float uAspect;
uniform float texAspect;
uniform float aa;
uniform float animMode;    // 0 loop, 1 always
uniform float holdTime;
uniform float speed;
uniform float posX;
uniform float posY;
uniform float sizeParam;
uniform float widthParam;
uniform float styleMode;   // 0 glass, 1 solid, 2 gradient, 3 minimal
uniform float accentTone;
uniform float shine;
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

float roundBox(vec2 p, vec2 half_, float r) {
  vec2 q = abs(p) - half_ + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void main() {
  vec2 suv = vUv - 0.5;
  vec2 pc = vec2(suv.x * uAspect, suv.y);

  // animation cycle: in 0.7s, hold, out 0.7s, off 1.2s (scaled by speed)
  float presence = 1.0;
  if (animMode < 0.5) {
    float cycleT = 0.7 + holdTime + 0.7 + 1.2;
    float ct = mod(uTime * speed, cycleT);
    float inE = smoothstep(0.0, 0.7, ct);
    float outE = smoothstep(holdTime + 0.7, holdTime + 1.4, ct);
    presence = inE - outE;
  }
  // ease with overshoot flavor
  float e = presence * presence * (3.0 - 2.0 * presence);

  float panelH = 0.17 * sizeParam;
  float panelW = widthParam * uAspect;
  vec2 anchor = vec2(posX * 0.5 * uAspect, posY * 0.5);
  // slide in from the left; panel parks at the anchor
  float slideOff = (1.0 - e) * (panelW + 0.6 * uAspect);
  vec2 p = pc - anchor + vec2(slideOff, 0.0);

  // accent bar leads slightly (arrives sooner)
  float eBar = clamp(e * 1.15, 0.0, 1.0);
  float barSlide = (1.0 - eBar) * (panelW + 0.6 * uAspect);
  vec2 pBar = pc - anchor + vec2(barSlide, 0.0);

  vec3 accent = fablePal(accentTone, palA, palB, palC, palD);

  // panel geometry: origin at panel's left-center
  vec2 pn = p - vec2(panelW * 0.5, 0.0);
  float dPanel = roundBox(pn, vec2(panelW * 0.5, panelH * 0.5), panelH * 0.12);
  float panelMask = smoothstep(0.004, -0.004, dPanel);

  float barW = panelH * 0.14;
  vec2 pb = pBar - vec2(barW * 0.5, 0.0);
  float dBar = roundBox(pb, vec2(barW * 0.5, panelH * 0.5), barW * 0.3);
  float barMask = smoothstep(0.003, -0.003, dBar);

  // panel fill by style
  vec3 panelCol;
  float panelA;
  if (styleMode < 0.5) {          // glass
    panelCol = vec3(0.03, 0.035, 0.05) + accent * 0.06;
    panelA = 0.55;
  } else if (styleMode < 1.5) {   // solid
    panelCol = vec3(0.02, 0.022, 0.03);
    panelA = 0.92;
  } else if (styleMode < 2.5) {   // gradient
    float gx = clamp(p.x / max(panelW, 1e-4), 0.0, 1.0);
    panelCol = mix(accent * 0.45, vec3(0.02), gx);
    panelA = 0.8;
  } else {                        // minimal: underline only
    panelCol = vec3(0.0);
    panelA = 0.0;
    float dLine = roundBox(pn - vec2(0.0, -panelH * 0.5), vec2(panelW * 0.5, panelH * 0.03), 0.002);
    barMask = max(barMask, smoothstep(0.003, -0.003, dLine));
  }

  // shine sweep across the panel during hold
  float sweep = fract(uTime * speed * 0.15);
  float sx = (p.x / max(panelW, 1e-4)) - sweep * 1.6 + 0.3 - p.y * 0.5;
  float shineBand = exp(-sx * sx * 90.0) * shine * panelMask * e;

  // text sampled left-aligned inside the panel, block centered vertically
  float textH = panelH * 0.74;
  vec2 tp = p - vec2(panelH * 0.32, 0.0);
  vec2 tuv = vec2(tp.x / (textH * texAspect), tp.y / textH + 0.5);
  float inBox = step(0.0, tuv.x) * step(tuv.x, 1.0) * step(0.0, tuv.y) * step(tuv.y, 1.0);
  // clip text to panel interior for solid/glass/gradient, allow free for minimal
  float clip = styleMode > 2.5 ? 1.0 : step(dPanel, 0.0);
  float sdf = texture2D(textTex, clamp(tuv, 0.0, 1.0)).r * inBox * clip;
  float textMask = fableSdfMask(sdf, 0.5, aa);

  // title line sits in the upper 60%: brighter; subtitle dimmer
  float lineMix = smoothstep(0.42, 0.5, tuv.y);
  vec3 textCol = mix(vec3(0.68) + accent * 0.1, vec3(0.98), lineMix);

  // composite: panel under bar under text under shine
  float aPanel = panelMask * panelA * e;
  float aBar = barMask * eBar;
  float aText = textMask * e;
  float a = aPanel;
  vec3 rgb = panelCol;
  rgb = mix(rgb, accent, aBar * (1.0 - aText));
  a = max(a, aBar);
  rgb = mix(rgb, textCol, aText);
  a = max(a, aText);
  rgb += vec3(1.0) * shineBand * 0.25;
  a = max(a, shineBand * 0.25);

  rgb = fableACES(rgb * exposure);
  rgb = fableGrade(rgb, vUv, suv, resolution, grain, vignette);
  gl_FragColor = vec4(rgb, clamp(a, 0.0, 1.0) * opacityParam);
}`

const lowerThirdsParams: ParamSchemaDef[] = [
  { name: 'title', type: 'text', default: 'Enter text here', description: 'Title line' },
  { name: 'subtitle', type: 'text', default: 'Enter text here', description: 'Subtitle line' },
  { name: 'font', type: 'enum', default: 'sans', enumValues: FABLE_FONT_NAMES, description: 'Font family' },
  { name: 'style', type: 'enum', default: 'glass', enumValues: ['glass', 'solid', 'gradient', 'minimal'], description: 'Panel style' },
  { name: 'mode', type: 'enum', default: 'loop', enumValues: ['loop', 'always'], description: 'Loop in/out or stay on' },
  { name: 'holdTime', type: 'float', min: 1, max: 15, default: 5, description: 'Hold seconds (loop mode)' },
  { name: 'speed', type: 'float', min: 0.3, max: 3, default: 1, description: 'Animation speed' },
  { name: 'posX', type: 'float', min: -1, max: 1, default: -0.72, description: 'Horizontal position' },
  { name: 'posY', type: 'float', min: -1, max: 1, default: -0.6, description: 'Vertical position' },
  { name: 'size', type: 'float', min: 0.4, max: 2, default: 1, description: 'Overall size' },
  { name: 'width', type: 'float', min: 0.2, max: 1, default: 0.42, description: 'Panel width (screen fraction)' },
  { name: 'accentTone', type: 'float', min: 0, max: 1, default: 0.6, description: 'Accent palette tone' },
  { name: 'shine', type: 'float', min: 0, max: 1, default: 0.4, description: 'Shine sweep' },
  { name: 'opacity', type: 'float', min: 0, max: 1, default: 1, description: 'Overall opacity' },
  { name: 'palette', type: 'enum', default: 'aurora', enumValues: FABLE_PALETTE_NAMES, description: 'Palette' },
  { name: 'colorHue', type: 'float', min: 0, max: 360, default: 0, description: 'Palette hue shift' },
  { name: 'exposure', type: 'float', min: 0.3, max: 3, default: 1.1, description: 'Exposure' },
  { name: 'grain', type: 'float', min: 0, max: 1, default: 0, description: 'Film grain' },
  { name: 'vignette', type: 'float', min: 0, max: 1, default: 0, description: 'Vignette' },
]

const lowerThirdsEvaluateSource = FABLE_EVAL_LIB + FABLE_TEXT_EVAL_LIB + `
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
      { text: title, size: 1, weight: '800' },
      { text: subtitle, size: 0.52, gapBefore: 0.16, weight: '400' },
    ],
    { width: TEXW, height: TEXH, font: fontIdx, align: 'left', pad: 0.05 });
  return fableTextSDF(raster, SPREAD);
});

var textHeightPx = Math.max(0.17 * inputs.size * 0.74 * res[1], 8);
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
        widthParam: inputs.width,
        styleMode: Math.round(inputs.style || 0),
        accentTone: inputs.accentTone,
        shine: inputs.shine,
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

const fableLowerThirdsDef: CompoundGeneratorDef = {
  id: 'builtin_fableLowerThirds',
  name: 'Fable Lower Thirds',
  description: 'Broadcast-style lower third — title and subtitle on a glass panel with an accent bar, sliding in and out or held on screen',
  defaultCameraDistance: 0,
  generatorType: 'fableLowerThirds_generator',
  outputMode: 'shader',
  params: lowerThirdsParams,
  inputs: lowerThirdsParams.map(p => ({
    name: p.name,
    type: (p.type === 'text' ? 'string' : 'number') as 'string' | 'number',
    default: p.type === 'text' ? (p.default as string) : (p.type === 'bool' ? (p.default ? 1 : 0) : (p.type === 'enum' ? 0 : (p.default as number))),
  })),
  outputs: [{ name: 'shaderConfig', type: 'array' as const }],
  evaluateSource: lowerThirdsEvaluateSource,
  shaderSources: {
    display: lowerThirdsShader,
  },
}

export const FABLE_LOWER_THIRDS_GENERATORS: CompoundGeneratorDef[] = [fableLowerThirdsDef]
