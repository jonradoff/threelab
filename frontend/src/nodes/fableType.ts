import type { CompoundGeneratorDef } from './generatorGraphFactory'
import type { ParamSchemaDef } from './storage'
import { FABLE_GLSL_LIB, FABLE_EVAL_LIB, FABLE_PALETTE_NAMES } from './fableDisplayLib'
import { FABLE_TEXT_EVAL_LIB, FABLE_TEXT_GLSL, FABLE_FONT_NAMES, FABLE_WEIGHT_NAMES } from './fableTextLib'

// ═══════════════════════════════════════════════════════════════════════════
// FABLE TYPE — kinetic 2D typography overlay
//
// User text is rasterized to an SDF texture; the shader places it anywhere
// on screen (position/size/rotation params) with a choice of motion modes —
// including 'static' for plain fixed captions — and fill styles (solid,
// animated gradient, outline, neon). Alpha-composites over lower layers.
// ═══════════════════════════════════════════════════════════════════════════

const typeDisplayShader = `precision highp float;
uniform sampler2D textTex;
uniform vec2 resolution;
uniform float uTime;
uniform float uAspect;
uniform float texAspect;
uniform float aa;
uniform float motionMode;   // 0 static 1 drift 2 wave 3 bounce 4 orbit 5 typewriter 6 pulse 7 shake
uniform float motionSpeed;
uniform float motionAmount;
uniform float posX;
uniform float posY;
uniform float sizeParam;
uniform float rotation;
uniform float fillStyle;    // 0 solid 1 gradient 2 outline 3 neon
uniform float fillTone;
uniform float glowAmt;
uniform float outlineWidth;
uniform float backdropAmt;
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
  float t = uTime * motionSpeed;

  vec2 anchor = vec2(posX * 0.5 * uAspect, posY * 0.5);
  vec2 p = pc - anchor;
  float scl = max(sizeParam, 0.01);
  float wob = 0.0;

  if (motionMode > 0.5 && motionMode < 1.5) {            // drift
    p -= motionAmount * 0.12 * vec2(sin(t * 0.5), 0.6 * sin(t * 0.37 + 1.7));
  } else if (motionMode > 2.5 && motionMode < 3.5) {     // bounce
    float b = abs(sin(t * 2.2));
    p.y -= motionAmount * 0.16 * b;
    scl *= 1.0 + motionAmount * 0.06 * (1.0 - b);
  } else if (motionMode > 3.5 && motionMode < 4.5) {     // orbit
    p -= motionAmount * 0.1 * vec2(cos(t), 0.6 * sin(t));
    wob = motionAmount * 7.0 * sin(t * 0.8);
  } else if (motionMode > 5.5 && motionMode < 6.5) {     // pulse
    scl *= 1.0 + motionAmount * 0.14 * sin(t * 2.5);
  } else if (motionMode > 6.5) {                          // shake
    float sTick = floor(t * 22.0);
    p -= motionAmount * 0.03 * (vec2(fableHash(vec2(sTick, 1.3)), fableHash(vec2(sTick, 7.7))) - 0.5);
  }

  float ang = (rotation + wob) * 0.0174533;
  float ca = cos(ang), sa = sin(ang);
  p = mat2(ca, sa, -sa, ca) * p;

  vec2 tuv = vec2(p.x / (scl * texAspect), p.y / scl) + 0.5;
  if (motionMode > 1.5 && motionMode < 2.5) {            // wave (jelly)
    tuv.y += motionAmount * 0.1 * sin(tuv.x * 12.0 + t * 2.2);
  }
  float inBox = step(0.0, tuv.x) * step(tuv.x, 1.0) * step(0.0, tuv.y) * step(tuv.y, 1.0);
  float sdf = texture2D(textTex, clamp(tuv, 0.0, 1.0)).r * inBox;

  // typewriter reveal with blinking caret
  float reveal = 1.0;
  float caret = 0.0;
  if (motionMode > 4.5 && motionMode < 5.5) {
    float prog = fract(t * 0.1);
    float rp = smoothstep(0.02, 0.62, prog) * 1.04;
    reveal = step(tuv.x, rp);
    caret = step(abs(tuv.x - min(rp, 1.0)), 0.005) * step(fract(t * 1.4), 0.55)
          * inBox * step(tuv.y, 0.82) * step(0.2, tuv.y) * step(prog, 0.65);
  }

  float mask = fableSdfMask(sdf, 0.5, aa) * reveal;
  vec3 fill;
  if (fillStyle < 0.5) {
    fill = fablePal(fillTone, palA, palB, palC, palD);
  } else if (fillStyle < 1.5) {
    fill = fablePal(fract(tuv.x * 0.55 + uTime * 0.06), palA, palB, palC, palD);
  } else if (fillStyle < 2.5) {
    float inner = fableSdfMask(sdf, 0.5 + outlineWidth, aa);
    mask = mask * (1.0 - inner * 0.88);
    fill = fablePal(fillTone, palA, palB, palC, palD);
  } else {
    fill = fablePal(fillTone, palA, palB, palC, palD) * 1.25;
  }

  // glow halo outside the glyph edge
  float halo = exp(-(0.5 - min(sdf, 0.5)) * 13.0) * (1.0 - mask) * inBox * reveal;
  float glowK = glowAmt * (fillStyle > 2.5 ? 1.7 : 0.8);

  float textA = clamp(mask + halo * glowK + caret, 0.0, 1.0);

  // soft dark rounded panel for legibility over busy patterns
  vec2 q = abs(p) / vec2(scl * texAspect * 0.5 + scl * 0.3, scl * 0.5 + scl * 0.2);
  float box = max(q.x, q.y);
  float backA = backdropAmt * smoothstep(1.08, 0.92, box) * 0.8;

  float a = clamp(textA + backA * (1.0 - textA), 0.0, 1.0) * opacityParam;
  vec3 col = fableACES(fill * exposure);
  col = fableGrade(col, vUv, suv, resolution, grain, vignette);
  vec3 rgb = mix(vec3(0.012, 0.012, 0.02), col, textA / max(textA + backA * (1.0 - textA), 1e-4));
  gl_FragColor = vec4(rgb, a);
}`

const typeParams: ParamSchemaDef[] = [
  { name: 'text', type: 'text', default: 'Enter text here', description: 'Text to display' },
  { name: 'font', type: 'enum', default: 'sans', enumValues: FABLE_FONT_NAMES, description: 'Font family' },
  { name: 'weight', type: 'enum', default: 'bold', enumValues: FABLE_WEIGHT_NAMES, description: 'Font weight' },
  { name: 'letterSpacing', type: 'float', min: 0, max: 0.5, default: 0.02, description: 'Letter spacing (em)' },
  { name: 'motion', type: 'enum', default: 'drift', enumValues: ['static', 'drift', 'wave', 'bounce', 'orbit', 'typewriter', 'pulse', 'shake'], description: 'Motion mode (static = no movement)' },
  { name: 'motionSpeed', type: 'float', min: 0, max: 3, default: 1, description: 'Motion speed' },
  { name: 'motionAmount', type: 'float', min: 0, max: 1, default: 0.5, description: 'Motion amplitude' },
  { name: 'posX', type: 'float', min: -1, max: 1, default: 0, description: 'Horizontal position' },
  { name: 'posY', type: 'float', min: -1, max: 1, default: 0, description: 'Vertical position' },
  { name: 'size', type: 'float', min: 0.05, max: 1.5, default: 0.34, description: 'Text size' },
  { name: 'rotation', type: 'float', min: -180, max: 180, default: 0, description: 'Rotation (degrees)' },
  { name: 'fillStyle', type: 'enum', default: 'gradient', enumValues: ['solid', 'gradient', 'outline', 'neon'], description: 'Fill style' },
  { name: 'fillTone', type: 'float', min: 0, max: 1, default: 0.62, description: 'Palette tone (solid/outline/neon)' },
  { name: 'glow', type: 'float', min: 0, max: 2, default: 0.5, description: 'Glow halo' },
  { name: 'outlineWidth', type: 'float', min: 0.01, max: 0.2, default: 0.06, description: 'Outline thickness' },
  { name: 'backdrop', type: 'float', min: 0, max: 1, default: 0, description: 'Dark panel behind text' },
  { name: 'opacity', type: 'float', min: 0, max: 1, default: 1, description: 'Overall opacity' },
  { name: 'palette', type: 'enum', default: 'aurora', enumValues: FABLE_PALETTE_NAMES, description: 'Palette' },
  { name: 'colorHue', type: 'float', min: 0, max: 360, default: 0, description: 'Palette hue shift' },
  { name: 'exposure', type: 'float', min: 0.3, max: 3, default: 1.1, description: 'Exposure' },
  { name: 'grain', type: 'float', min: 0, max: 1, default: 0, description: 'Film grain' },
  { name: 'vignette', type: 'float', min: 0, max: 1, default: 0, description: 'Vignette' },
]

const typeEvaluateSource = FABLE_EVAL_LIB + FABLE_TEXT_EVAL_LIB + `
var text = (typeof inputs.text === 'string' && inputs.text.length > 0) ? inputs.text : 'Enter text here';
var fontIdx = Math.round(inputs.font || 0);
var weightIdx = Math.round(inputs.weight || 0);
var ls = inputs.letterSpacing || 0;
var paletteIdx = Math.round(inputs.palette || 0);
var pal = fablePalette(paletteIdx, inputs.colorHue / 360);
var res = ctx.resolution || [1, 1];
var aspect = res[1] > 0 ? res[0] / res[1] : 1;

var TEXW = 2048, TEXH = 512, SPREAD = 28;
var cacheKey = [text, fontIdx, weightIdx, ls.toFixed(3)].join('|');
var st = fableTextState(ctx, nodeId, cacheKey, function () {
  var raster = fableRasterText(
    [{ text: text, size: 1, weight: FABLE_WEIGHT_LIST[weightIdx] }],
    { width: TEXW, height: TEXH, font: fontIdx, letterSpacing: ls });
  return fableTextSDF(raster, SPREAD);
});

// SDF units per on-screen pixel, for anti-aliased edges at any size
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
        motionMode: Math.round(inputs.motion || 0),
        motionSpeed: inputs.motionSpeed,
        motionAmount: inputs.motionAmount,
        posX: inputs.posX,
        posY: inputs.posY,
        sizeParam: inputs.size,
        rotation: inputs.rotation,
        fillStyle: Math.round(inputs.fillStyle || 0),
        fillTone: inputs.fillTone,
        glowAmt: inputs.glow,
        outlineWidth: inputs.outlineWidth,
        backdropAmt: inputs.backdrop,
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

const fableTypeDef: CompoundGeneratorDef = {
  id: 'builtin_fableType',
  name: 'Fable Type',
  description: 'Kinetic typography overlay — your text with drift, wave, bounce, typewriter and neon styles, or held perfectly static',
  defaultCameraDistance: 0,
  generatorType: 'fableType_generator',
  outputMode: 'shader',
  params: typeParams,
  inputs: typeParams.map(p => ({
    name: p.name,
    type: (p.type === 'text' ? 'string' : 'number') as 'string' | 'number',
    default: p.type === 'text' ? (p.default as string) : (p.type === 'bool' ? (p.default ? 1 : 0) : (p.type === 'enum' ? 0 : (p.default as number))),
  })),
  outputs: [{ name: 'shaderConfig', type: 'array' as const }],
  evaluateSource: typeEvaluateSource,
  shaderSources: {
    display: typeDisplayShader,
  },
}

export const FABLE_TYPE_GENERATORS: CompoundGeneratorDef[] = [fableTypeDef]
