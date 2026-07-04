import type { CompoundGeneratorDef } from './generatorGraphFactory'
import type { ParamSchemaDef } from './storage'
import { FABLE_GLSL_LIB, FABLE_EVAL_LIB, FABLE_PALETTE_NAMES } from './fableDisplayLib'
import { FABLE_TEXT_EVAL_LIB, FABLE_TEXT_GLSL, FABLE_FONT_NAMES, FABLE_WEIGHT_NAMES } from './fableTextLib'

// ═══════════════════════════════════════════════════════════════════════════
// FABLE TYPE 3D — extruded 3D text, raymarched
//
// The 2D text SDF is extruded into a beveled 3D solid and sphere-traced
// with real lighting: keylight + rim, palette-colored faces and sides,
// specular. Camera modes include orbit/tumble/flip/swing — or 'static'
// with manual rotX/rotY angles for a fixed 3D title. Alpha overlay.
// ═══════════════════════════════════════════════════════════════════════════

const type3DShader = `precision highp float;
uniform sampler2D textTex;
uniform vec2 resolution;
uniform float uTime;
uniform float uAspect;
uniform float texAspect;
uniform float sdfScale;    // signed-distance units per tex value (y-units)
uniform float motionMode;  // 0 static 1 orbit 2 tumble 3 flip 4 swing
uniform float motionSpeed;
uniform float rotX;
uniform float rotY;
uniform float posX;
uniform float posY;
uniform float sizeParam;
uniform float depthParam;
uniform float bevel;
uniform float faceTone;
uniform float sideTone;
uniform float metallic;
uniform float glowAmt;
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

float sdBox3(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

// 2D signed distance to the text ink, in y-units (text block height = 1)
float textDist2(vec2 xy) {
  vec2 uv = vec2(xy.x / texAspect + 0.5, xy.y + 0.5);
  vec2 uvc = clamp(uv, 0.0, 1.0);
  float r = texture2D(textTex, uvc).r;
  float d = (0.5 - r) * sdfScale;
  // outside the texture card: add the distance back to the card
  vec2 off = (uv - uvc) * vec2(texAspect, 1.0);
  return d + length(off);
}

float map(vec3 p) {
  float d2 = textDist2(p.xy);
  vec2 w = vec2(d2, abs(p.z) - depthParam);
  float dExt = min(max(w.x, w.y), 0.0) + length(max(w, 0.0)) - bevel;
  // bounding-box lower bound accelerates the saturated far field
  float dBox = sdBox3(p, vec3(texAspect * 0.5 + 0.1, 0.6, depthParam + 0.1));
  return max(dExt, dBox);
}

vec3 calcNormal(vec3 p) {
  vec2 e = vec2(0.004, 0.0);
  return normalize(vec3(
    map(p + e.xyy) - map(p - e.xyy),
    map(p + e.yxy) - map(p - e.yxy),
    map(p + e.yyx) - map(p - e.yyx)));
}

void main() {
  vec2 suv = vUv - 0.5;
  vec2 pc = vec2(suv.x * uAspect, suv.y);
  vec2 anchor = vec2(posX * 0.5 * uAspect, posY * 0.5);
  pc = (pc - anchor) / max(sizeParam, 0.05);

  float t = uTime * motionSpeed;
  float yaw = rotY * 0.0174533;
  float pitch = rotX * 0.0174533;
  if (motionMode > 0.5 && motionMode < 1.5) {        // orbit
    yaw += t * 0.7;
  } else if (motionMode > 1.5 && motionMode < 2.5) { // tumble
    yaw += t * 0.6;
    pitch += sin(t * 0.45) * 0.45;
  } else if (motionMode > 2.5 && motionMode < 3.5) { // flip
    pitch += t * 1.2;
  } else if (motionMode > 3.5) {                     // swing
    yaw += sin(t * 0.8) * 0.6;
    pitch += cos(t * 0.53) * 0.12;
  }

  float cy = cos(yaw), sy = sin(yaw);
  float cx = cos(pitch), sx = sin(pitch);
  mat3 rotM = mat3(cy, 0.0, -sy, 0.0, 1.0, 0.0, sy, 0.0, cy)
            * mat3(1.0, 0.0, 0.0, 0.0, cx, sx, 0.0, -sx, cx);

  vec3 ro = vec3(0.0, 0.0, 3.6);
  vec3 rd = normalize(vec3(pc * 0.72, -1.0));

  // march in object space (rotate the ray instead of the object)
  vec3 roO = rotM * ro;
  vec3 rdO = normalize(rotM * rd);

  float tr = 0.0;
  bool hit = false;
  float minD = 1e9;
  for (int i = 0; i < 72; i++) {
    vec3 pos = roO + rdO * tr;
    float d = map(pos);
    if (d < minD) minD = d;
    if (d < 0.0025) { hit = true; break; }
    tr += d * 0.9;
    if (tr > 7.0) break;
  }

  vec3 rgb = vec3(0.0);
  float a = 0.0;
  if (hit) {
    vec3 pos = roO + rdO * tr;
    vec3 nO = calcNormal(pos);
    // faces vs extruded side walls get different palette tones
    float faceness = smoothstep(0.55, 0.85, abs(nO.z));
    vec3 albedo = mix(fablePal(sideTone, palA, palB, palC, palD) * 0.75,
                      fablePal(faceTone, palA, palB, palC, palD), faceness);

    vec3 n = nO * rotM; // back to world (transpose of orthonormal rotM)
    vec3 keyL = normalize(vec3(0.45, 0.7, 0.55));
    vec3 fillL = normalize(vec3(-0.6, -0.2, 0.45));
    float diff = max(dot(n, keyL), 0.0);
    float fill = max(dot(n, fillL), 0.0) * 0.35;
    vec3 h = normalize(keyL - rd);
    float spec = pow(max(dot(n, h), 0.0), 14.0 + metallic * 50.0) * (0.4 + metallic * 1.4);
    float rim = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);

    rgb = albedo * (0.18 + diff * 0.95 + fill) + spec + albedo * rim * 0.6;
    a = 1.0;
  } else {
    // soft halo where the ray grazed the solid
    float halo = exp(-max(minD, 0.0) * 9.0) * glowAmt;
    rgb = fablePal(faceTone, palA, palB, palC, palD) * halo;
    a = halo * 0.6;
  }

  rgb = fableACES(rgb * exposure);
  rgb = fableGrade(rgb, vUv, suv, resolution, grain, vignette);
  gl_FragColor = vec4(rgb, clamp(a, 0.0, 1.0) * opacityParam);
}`

const type3DParams: ParamSchemaDef[] = [
  { name: 'text', type: 'text', default: 'Enter text here', description: 'Text to display' },
  { name: 'font', type: 'enum', default: 'display', enumValues: FABLE_FONT_NAMES, description: 'Font family' },
  { name: 'weight', type: 'enum', default: 'black', enumValues: FABLE_WEIGHT_NAMES, description: 'Font weight' },
  { name: 'letterSpacing', type: 'float', min: 0, max: 0.5, default: 0.04, description: 'Letter spacing (em)' },
  { name: 'motion', type: 'enum', default: 'swing', enumValues: ['static', 'orbit', 'tumble', 'flip', 'swing'], description: 'Camera motion (static = fixed angle)' },
  { name: 'motionSpeed', type: 'float', min: 0, max: 3, default: 1, description: 'Motion speed' },
  { name: 'rotX', type: 'float', min: -80, max: 80, default: -8, description: 'Fixed tilt (degrees)' },
  { name: 'rotY', type: 'float', min: -80, max: 80, default: 16, description: 'Fixed turn (degrees)' },
  { name: 'posX', type: 'float', min: -1, max: 1, default: 0, description: 'Horizontal position' },
  { name: 'posY', type: 'float', min: -1, max: 1, default: 0, description: 'Vertical position' },
  { name: 'size', type: 'float', min: 0.1, max: 2.5, default: 1, description: 'Text size' },
  { name: 'depth', type: 'float', min: 0.02, max: 0.5, default: 0.16, description: 'Extrusion depth' },
  { name: 'bevel', type: 'float', min: 0, max: 0.04, default: 0.012, description: 'Edge bevel' },
  { name: 'faceTone', type: 'float', min: 0, max: 1, default: 0.62, description: 'Face palette tone' },
  { name: 'sideTone', type: 'float', min: 0, max: 1, default: 0.25, description: 'Side-wall palette tone' },
  { name: 'metallic', type: 'float', min: 0, max: 1, default: 0.55, description: 'Specular shine' },
  { name: 'glow', type: 'float', min: 0, max: 2, default: 0.4, description: 'Halo glow' },
  { name: 'opacity', type: 'float', min: 0, max: 1, default: 1, description: 'Overall opacity' },
  { name: 'palette', type: 'enum', default: 'chrome', enumValues: FABLE_PALETTE_NAMES, description: 'Palette' },
  { name: 'colorHue', type: 'float', min: 0, max: 360, default: 0, description: 'Palette hue shift' },
  { name: 'exposure', type: 'float', min: 0.3, max: 3, default: 1.15, description: 'Exposure' },
  { name: 'grain', type: 'float', min: 0, max: 1, default: 0, description: 'Film grain' },
  { name: 'vignette', type: 'float', min: 0, max: 1, default: 0, description: 'Vignette' },
]

const type3DEvaluateSource = FABLE_EVAL_LIB + FABLE_TEXT_EVAL_LIB + `
var text = (typeof inputs.text === 'string' && inputs.text.length > 0) ? inputs.text : 'Enter text here';
var fontIdx = Math.round(inputs.font || 0);
var weightIdx = Math.round(inputs.weight || 0);
var ls = inputs.letterSpacing || 0;
var paletteIdx = Math.round(inputs.palette || 0);
var pal = fablePalette(paletteIdx, inputs.colorHue / 360);
var res = ctx.resolution || [1, 1];
var aspect = res[1] > 0 ? res[0] / res[1] : 1;

var TEXW = 2048, TEXH = 512, SPREAD = 40;
var cacheKey = [text, fontIdx, weightIdx, ls.toFixed(3)].join('|');
var st = fableTextState(ctx, nodeId, cacheKey, function () {
  var raster = fableRasterText(
    [{ text: text, size: 1, weight: FABLE_WEIGHT_LIST[weightIdx] }],
    { width: TEXW, height: TEXH, font: fontIdx, letterSpacing: ls, pad: 0.1 });
  return fableTextSDF(raster, SPREAD);
});

return { shaderConfig: {
  passes: [
    { name: 'display', fragmentShader: inputs.displayShader, target: null,
      readFrom: { textTex: 'texttex' },
      uniforms: {
        resolution: res,
        uTime: ctx.elapsed,
        uAspect: aspect,
        texAspect: TEXW / TEXH,
        sdfScale: (2 * SPREAD) / TEXH,
        motionMode: Math.round(inputs.motion || 0),
        motionSpeed: inputs.motionSpeed,
        rotX: inputs.rotX,
        rotY: inputs.rotY,
        posX: inputs.posX,
        posY: inputs.posY,
        sizeParam: inputs.size,
        depthParam: inputs.depth,
        bevel: inputs.bevel,
        faceTone: inputs.faceTone,
        sideTone: inputs.sideTone,
        metallic: inputs.metallic,
        glowAmt: inputs.glow,
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

const fableType3DDef: CompoundGeneratorDef = {
  id: 'builtin_fableType3D',
  name: 'Fable Type 3D',
  description: 'Extruded 3D text with beveled edges and real lighting — orbiting, tumbling, or held at a fixed angle you choose',
  defaultCameraDistance: 0,
  generatorType: 'fableType3D_generator',
  outputMode: 'shader',
  params: type3DParams,
  inputs: type3DParams.map(p => ({
    name: p.name,
    type: (p.type === 'text' ? 'string' : 'number') as 'string' | 'number',
    default: p.type === 'text' ? (p.default as string) : (p.type === 'bool' ? (p.default ? 1 : 0) : (p.type === 'enum' ? 0 : (p.default as number))),
  })),
  outputs: [{ name: 'shaderConfig', type: 'array' as const }],
  evaluateSource: type3DEvaluateSource,
  shaderSources: {
    display: type3DShader,
  },
}

export const FABLE_TYPE_3D_GENERATORS: CompoundGeneratorDef[] = [fableType3DDef]
