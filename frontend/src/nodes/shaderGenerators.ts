import type { CompoundGeneratorDef } from './generatorGraphFactory'
import type { ParamSchemaDef } from './storage'

// ═══════════════════════════════════════════════════════════════════════════
// FRACTAL
// ═══════════════════════════════════════════════════════════════════════════

const fractalFragShader = `precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uFractalType;
uniform float uMaxIter;
uniform float uPower;
uniform float uCenterX;
uniform float uCenterY;
uniform float uZoom;
uniform float uJuliaReal;
uniform float uJuliaImag;
uniform float uColorPalette;
uniform float uColorSpeed;
uniform float uColorOffset;
uniform float uGlowAmount;
uniform float uOrbitTrap;
uniform float uTrapShape;
uniform float uSmoothColoring;
uniform float uAspect;

vec2 cpow(vec2 z, float n) {
  float r = length(z);
  float theta = atan(z.y, z.x);
  float rn = pow(r, n);
  return vec2(rn * cos(n * theta), rn * sin(n * theta));
}
vec3 paletteRainbow(float t) { return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67))); }
vec3 paletteFire(float t) { return vec3(min(1.0, t*3.0), max(0.0, min(1.0, t*3.0-1.0)), max(0.0, t*3.0-2.0)); }
vec3 paletteIce(float t) { return vec3(max(0.0, 1.0-t*2.0)*0.3, 0.4+0.6*t, 0.6+0.4*cos(t*6.28318)); }
vec3 paletteElectric(float t) { return 0.5 + 0.5 * cos(6.28318 * (t*2.0 + vec3(0.5, 0.8, 1.0))); }
vec3 paletteGrayscale(float t) { return vec3(0.1 + t * 0.85); }
vec3 getColor(float t, float palette) {
  if (palette < 1.5 && palette > 0.5) return paletteFire(t);
  if (palette < 2.5 && palette > 1.5) return paletteIce(t);
  if (palette < 3.5 && palette > 2.5) return paletteElectric(t);
  if (palette > 3.5) return paletteGrayscale(t);
  return paletteRainbow(t);
}
float orbitTrapDist(vec2 z, float shape) {
  if (shape > 0.5 && shape < 1.5) return min(abs(z.x), abs(z.y));
  if (shape > 1.5) return abs(z.y);
  return abs(length(z) - 1.0);
}
void main() {
  float scale = 3.0 / uZoom;
  float aspect = uAspect > 0.0 ? uAspect : 1.0;
  vec2 c_coord = vec2((vUv.x - 0.5) * scale * aspect + uCenterX, (vUv.y - 0.5) * scale + uCenterY);
  vec2 z, c;
  if (uFractalType > 0.5 && uFractalType < 1.5) { z = c_coord; c = vec2(uJuliaReal, uJuliaImag); }
  else { z = vec2(0.0); c = c_coord; }
  float minTrap = 1e10, iter = 0.0, escape = 256.0;
  int maxIter = int(uMaxIter);
  for (int i = 0; i < 1000; i++) {
    if (i >= maxIter) break;
    if (uFractalType > 1.5 && uFractalType < 2.5) z = abs(z);
    if (uFractalType > 2.5) z.y = -z.y;
    if (uPower == 2.0) z = vec2(z.x*z.x - z.y*z.y, 2.0*z.x*z.y) + c;
    else z = cpow(z, uPower) + c;
    float r2 = dot(z, z);
    if (uOrbitTrap > 0.5) minTrap = min(minTrap, orbitTrapDist(z, uTrapShape));
    if (r2 > escape) {
      if (uSmoothColoring > 0.5) { float log_zn = log(r2)*0.5; float nu = log(log_zn/log(2.0))/log(uPower); iter = float(i)+1.0-nu; }
      else iter = float(i);
      break;
    }
    iter = float(i);
  }
  iter = max(iter, 0.0);
  float r2Final = dot(z, z);
  if (r2Final <= escape) {
    if (uOrbitTrap > 0.5) { float t = fract(minTrap * uColorSpeed + uColorOffset); gl_FragColor = vec4(getColor(t, uColorPalette), 1.0); }
    else {
      // Interior coloring based on final orbit position for visual interest
      float it = fract(float(maxIter) * uColorSpeed * 0.01 + atan(z.y, z.x) / 6.28318 + uColorOffset);
      vec3 intCol = getColor(it, uColorPalette) * 0.15;
      gl_FragColor = vec4(intCol, 1.0);
    }
  } else {
    float t;
    if (uOrbitTrap > 0.5) t = fract(minTrap * uColorSpeed + uColorOffset);
    else t = fract(sqrt(iter) * uColorSpeed * 0.15 + uColorOffset);
    vec3 col = getColor(t, uColorPalette);
    if (uGlowAmount > 0.0) col += vec3(exp(-iter * 0.05) * uGlowAmount);
    gl_FragColor = vec4(col, 1.0);
  }
}`

const fractalParams: ParamSchemaDef[] = [
  { name: 'fractalType', type: 'enum', default: 'mandelbrot', enumValues: ['mandelbrot', 'julia', 'burningShip', 'tricorn'], description: 'Fractal type' },
  { name: 'maxIterations', type: 'int', min: 50, max: 1000, default: 200, description: 'Max iterations' },
  { name: 'power', type: 'float', min: 1, max: 8, default: 2, description: 'Exponent power' },
  { name: 'centerX', type: 'float', min: -2.5, max: 1, default: -0.5, description: 'Center X' },
  { name: 'centerY', type: 'float', min: -1.5, max: 1.5, default: 0, description: 'Center Y' },
  { name: 'zoom', type: 'float', min: 0.5, max: 15, default: 1, description: 'Zoom' },
  { name: 'juliaReal', type: 'float', min: -1.5, max: 0.5, default: -0.7, description: 'Julia c (real)' },
  { name: 'juliaImag', type: 'float', min: -1, max: 1, default: 0.27015, description: 'Julia c (imag)' },
  { name: 'colorPalette', type: 'enum', default: 'rainbow', enumValues: ['rainbow', 'fire', 'ice', 'electric', 'grayscale'], description: 'Color palette' },
  { name: 'colorSpeed', type: 'float', min: 0.3, max: 3, default: 1, description: 'Color speed' },
  { name: 'colorOffset', type: 'float', min: 0, max: 1, default: 0, description: 'Color offset' },
  { name: 'animateJulia', type: 'bool', default: true, description: 'Animate Julia' },
  { name: 'juliaSpeed', type: 'float', min: 0, max: 2, default: 0.3, description: 'Julia anim speed' },
  { name: 'autoZoom', type: 'bool', default: false, description: 'Auto zoom' },
  { name: 'autoZoomSpeed', type: 'float', min: 0, max: 1, default: 0.1, description: 'Auto zoom speed' },
  { name: 'glowAmount', type: 'float', min: 0, max: 2, default: 0, description: 'Glow amount' },
  { name: 'orbitTrap', type: 'bool', default: false, description: 'Orbit trap' },
  { name: 'trapShape', type: 'enum', default: 'circle', enumValues: ['circle', 'cross', 'line'], description: 'Trap shape' },
  { name: 'smoothColoring', type: 'bool', default: true, description: 'Smooth coloring' },
]

const fractalEvaluateSource = `
var juliaReal = inputs.juliaReal;
var juliaImag = inputs.juliaImag;
if (inputs.animateJulia > 0.5 && Math.round(inputs.fractalType) === 1) {
  juliaReal += Math.sin(ctx.elapsed * inputs.juliaSpeed) * 0.15;
  juliaImag += Math.cos(ctx.elapsed * inputs.juliaSpeed * 1.3) * 0.15;
}
var zoom = inputs.zoom;
if (inputs.autoZoom > 0.5) {
  var t = ctx.elapsed * inputs.autoZoomSpeed;
  zoom *= 1 + (Math.sin(t) * 0.5 + 0.5) * 49;
}
return { shaderConfig: {
  fragmentShader: inputs.fragmentShader,
  uniforms: {
    uTime: ctx.elapsed,
    uFractalType: Math.round(inputs.fractalType || 0),
    uMaxIter: Math.round(inputs.maxIterations),
    uPower: inputs.power,
    uCenterX: inputs.centerX,
    uCenterY: inputs.centerY,
    uZoom: zoom,
    uJuliaReal: juliaReal,
    uJuliaImag: juliaImag,
    uColorPalette: Math.round(inputs.colorPalette || 0),
    uColorSpeed: inputs.colorSpeed,
    uColorOffset: inputs.colorOffset,
    uGlowAmount: inputs.glowAmount,
    uOrbitTrap: inputs.orbitTrap > 0.5 ? 1.0 : 0.0,
    uTrapShape: Math.round(inputs.trapShape || 0),
    uSmoothColoring: inputs.smoothColoring > 0.5 ? 1.0 : 0.0,
    uAspect: ctx.resolution ? ctx.resolution[0] / Math.max(ctx.resolution[1], 1) : 1.0,
  }
}};
`

const fractalDef: CompoundGeneratorDef = {
  id: 'builtin_fractal',
  name: 'Fractal',
  description: 'Mandelbrot, Julia, Burning Ship and Tricorn fractals with multiple color palettes',
  defaultCameraDistance: 0,
  generatorType: 'fractal_generator',
  outputMode: 'shader',
  params: fractalParams,
  inputs: fractalParams.map(p => ({
    name: p.name,
    type: 'number' as const,
    default: p.type === 'bool' ? (p.default ? 1 : 0) : (p.type === 'enum' ? 0 : (p.default as number)),
  })),
  outputs: [{ name: 'shaderConfig', type: 'array' as const }],
  evaluateSource: fractalEvaluateSource,
  fragmentShader: fractalFragShader,
}

// ═══════════════════════════════════════════════════════════════════════════
// DOMAIN WARPING
// ═══════════════════════════════════════════════════════════════════════════

const domainWarpingFragShader = `precision highp float;
varying vec2 vUv;
uniform float u_time;
uniform float u_warpStrength;
uniform float u_noiseScale;
uniform float u_octaves;
uniform float u_lacunarity;
uniform float u_gain;
uniform float u_speed;
uniform float u_colorPalette;
uniform float u_colorContrast;
uniform float u_colorOffset;
uniform float u_colorCycles;
uniform float u_zoom;
uniform float u_rotation;
uniform bool u_ridged;
uniform bool u_turbulence;
uniform float u_sharpness;
uniform float u_brightness;
uniform float u_mixMode;
uniform float u_secondaryWarp;
uniform float u_warpLayers;

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f*f*f*(f*(f*6.0-15.0)+10.0);
  float a = dot(hash2(i), f);
  float b = dot(hash2(i+vec2(1,0)), f-vec2(1,0));
  float c = dot(hash2(i+vec2(0,1)), f-vec2(0,1));
  float d = dot(hash2(i+vec2(1,1)), f-vec2(1,1));
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}
float fbm(vec2 p) {
  float value = 0.0, amplitude = 0.5, frequency = 1.0;
  for (int i = 0; i < 8; i++) {
    if (float(i) >= u_octaves) break;
    float n = noise(p * frequency);
    if (u_turbulence) n = abs(n);
    if (u_ridged) { n = 1.0-abs(n); n = n*n; }
    value += amplitude * n;
    frequency *= u_lacunarity;
    amplitude *= u_gain;
  }
  return value;
}
vec3 cosinePalette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
  return a + b * cos(6.28318 * (c * t + d));
}
vec3 getPaletteColor(float t) {
  t = t * u_colorCycles + u_colorOffset;
  t = 0.5 + (t - 0.5) * u_colorContrast;
  if (u_colorPalette < 0.5) return cosinePalette(t, vec3(0.80,0.78,0.76), vec3(0.20,0.18,0.22), vec3(1), vec3(0.00,0.05,0.10));
  if (u_colorPalette < 1.5) return cosinePalette(t, vec3(0.50,0.20,0.05), vec3(0.50,0.30,0.20), vec3(1,1,0.5), vec3(0.00,0.15,0.20));
  if (u_colorPalette < 2.5) return cosinePalette(t, vec3(0.10,0.30,0.50), vec3(0.20,0.30,0.40), vec3(1), vec3(0.00,0.10,0.20));
  if (u_colorPalette < 3.5) return cosinePalette(t, vec3(0.50), vec3(0.50), vec3(1), vec3(0.00,0.33,0.67));
  if (u_colorPalette < 4.5) return cosinePalette(t, vec3(0.50,0.30,0.30), vec3(0.50,0.40,0.30), vec3(1,0.7,0.4), vec3(0.00,0.15,0.40));
  if (u_colorPalette < 5.5) return cosinePalette(t, vec3(0.30,0.50,0.20), vec3(0.40,0.50,0.50), vec3(1,1,0.5), vec3(0.80,0.90,0.30));
  float g = 0.5 + 0.5 * cos(6.28318 * t); return vec3(g);
}
void main() {
  vec2 center = vec2(0.5);
  vec2 p = (vUv - center) / u_zoom;
  float c = cos(u_rotation), s = sin(u_rotation);
  p = vec2(c*p.x - s*p.y, s*p.x + c*p.y);
  p *= u_noiseScale;
  float t = u_time * u_speed;
  vec2 q = vec2(fbm(p + vec2(t*0.1, t*0.13)), fbm(p + vec2(5.2,1.3) + vec2(t*0.07, -t*0.11)));
  vec2 warped = p + u_warpStrength * q;
  if (u_secondaryWarp > 0.001) {
    vec2 sq = vec2(fbm(p+vec2(8.1,3.7)+vec2(-t*0.09,t*0.06)), fbm(p+vec2(2.8,7.4)+vec2(t*0.12,t*0.08)));
    vec2 perp = vec2(-q.y, q.x);
    warped += u_secondaryWarp * (perp*0.5 + sq*0.5);
  }
  if (u_warpLayers > 1.5) { vec2 r = vec2(fbm(warped+vec2(1.7,9.2)+vec2(t*0.15,-t*0.08)), fbm(warped+vec2(8.3,2.8)+vec2(-t*0.06,t*0.14))); warped = p + u_warpStrength * r; }
  if (u_warpLayers > 2.5) { vec2 w = vec2(fbm(warped+vec2(3.4,6.1)+vec2(-t*0.11,t*0.09)), fbm(warped+vec2(7.7,4.5)+vec2(t*0.08,-t*0.12))); warped = p + u_warpStrength * w; }
  if (u_warpLayers > 3.5) { vec2 v = vec2(fbm(warped+vec2(2.9,8.6)+vec2(t*0.13,t*0.07)), fbm(warped+vec2(6.3,1.9)+vec2(-t*0.10,-t*0.05))); warped = p + u_warpStrength * v; }
  float f = fbm(warped) * 0.5 + 0.5;
  if (u_sharpness > 0.001) f = pow(f, 1.0 + u_sharpness * 3.0);
  vec3 color = getPaletteColor(f);
  if (u_mixMode > 0.5 && u_mixMode < 1.5) color *= vec3(f*0.5+0.5);
  else if (u_mixMode > 1.5) color = vec3(1.0) - (vec3(1.0)-color)*(vec3(1.0)-vec3(f));
  color *= u_brightness;
  gl_FragColor = vec4(color, 1.0);
}`

const domainWarpingParams: ParamSchemaDef[] = [
  { name: 'warpLayers', type: 'int', min: 1, max: 4, default: 2, description: 'Warp layers' },
  { name: 'warpStrength', type: 'float', min: 0, max: 5, default: 1.5, description: 'Warp strength' },
  { name: 'noiseScale', type: 'float', min: 0.1, max: 10, default: 2, description: 'Noise scale' },
  { name: 'octaves', type: 'int', min: 1, max: 8, default: 5, description: 'Octaves' },
  { name: 'lacunarity', type: 'float', min: 1, max: 4, default: 2, description: 'Lacunarity' },
  { name: 'gain', type: 'float', min: 0.1, max: 1, default: 0.5, description: 'Gain' },
  { name: 'speed', type: 'float', min: 0, max: 2, default: 0.3, description: 'Speed' },
  { name: 'colorPalette', type: 'enum', default: 'marble', enumValues: ['marble', 'lava', 'ocean', 'aurora', 'sunset', 'alien', 'grayscale'], description: 'Color palette' },
  { name: 'colorContrast', type: 'float', min: 0.1, max: 3, default: 1.5, description: 'Color contrast' },
  { name: 'colorOffset', type: 'float', min: 0, max: 1, default: 0, description: 'Color offset' },
  { name: 'colorCycles', type: 'float', min: 0.1, max: 5, default: 1, description: 'Color cycles' },
  { name: 'zoom', type: 'float', min: 0.1, max: 5, default: 1, description: 'Zoom' },
  { name: 'rotation', type: 'float', min: -3.14, max: 3.14, default: 0, description: 'Rotation' },
  { name: 'rotationSpeed', type: 'float', min: 0, max: 2, default: 0, description: 'Rotation speed' },
  { name: 'ridged', type: 'bool', default: false, description: 'Ridged noise' },
  { name: 'turbulence', type: 'bool', default: false, description: 'Turbulence' },
  { name: 'sharpness', type: 'float', min: 0, max: 3, default: 0, description: 'Sharpness' },
  { name: 'brightness', type: 'float', min: 0.1, max: 3, default: 1, description: 'Brightness' },
  { name: 'mixMode', type: 'enum', default: 'normal', enumValues: ['normal', 'multiply', 'screen'], description: 'Mix mode' },
  { name: 'secondaryWarp', type: 'float', min: 0, max: 3, default: 0, description: 'Secondary warp' },
]

const domainWarpingEvaluateSource = `
return { shaderConfig: {
  fragmentShader: inputs.fragmentShader,
  uniforms: {
    u_time: ctx.elapsed,
    u_warpLayers: Math.round(inputs.warpLayers),
    u_warpStrength: inputs.warpStrength,
    u_noiseScale: inputs.noiseScale,
    u_octaves: Math.round(inputs.octaves),
    u_lacunarity: inputs.lacunarity,
    u_gain: inputs.gain,
    u_speed: inputs.speed,
    u_colorPalette: Math.round(inputs.colorPalette || 0),
    u_colorContrast: inputs.colorContrast,
    u_colorOffset: inputs.colorOffset,
    u_colorCycles: inputs.colorCycles,
    u_zoom: inputs.zoom,
    u_rotation: inputs.rotation + ctx.elapsed * inputs.rotationSpeed,
    u_ridged: inputs.ridged > 0.5,
    u_turbulence: inputs.turbulence > 0.5,
    u_sharpness: inputs.sharpness,
    u_brightness: inputs.brightness,
    u_mixMode: Math.round(inputs.mixMode || 0),
    u_secondaryWarp: inputs.secondaryWarp,
  }
}};
`

const domainWarpingDef: CompoundGeneratorDef = {
  id: 'builtin_domainWarping',
  name: 'Domain Warping',
  description: 'Multi-layer FBM domain warping with cosine color palettes',
  defaultCameraDistance: 0,
  generatorType: 'domainWarping_generator',
  outputMode: 'shader',
  params: domainWarpingParams,
  inputs: domainWarpingParams.map(p => ({
    name: p.name,
    type: 'number' as const,
    default: p.type === 'bool' ? (p.default ? 1 : 0) : (p.type === 'enum' ? 0 : (p.default as number)),
  })),
  outputs: [{ name: 'shaderConfig', type: 'array' as const }],
  evaluateSource: domainWarpingEvaluateSource,
  fragmentShader: domainWarpingFragShader,
}

// ═══════════════════════════════════════════════════════════════════════════
// TRUCHET TILING
// ═══════════════════════════════════════════════════════════════════════════

const truchetFragShader = `precision highp float;
varying vec2 vUv;
uniform float gridSize;
uniform float lineWidth;
uniform float time;
uniform float rotationSpeed;
uniform float tileType;
uniform float fillMode;
uniform float seed;
uniform float animateRotation;
uniform float colorCycleSpeed;
uniform float noiseWarp;
uniform float zoom;
uniform float multiScale;
uniform float scaleLevels;
uniform float invert;
uniform float edgeFade;
uniform float animateColors;
uniform float waveDistort;
uniform float waveFreq;
uniform float contrast;
uniform float thickness;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453 + seed * 0.01); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
}
float sdCircle(vec2 p, float r) { return length(p) - r; }
float sdLine(vec2 p, vec2 a, vec2 b) {
  vec2 ba = b-a, pa = p-a;
  float h = clamp(dot(pa,ba)/dot(ba,ba), 0.0, 1.0);
  return length(pa - h*ba);
}
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}
vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0,-1.0/3.0,2.0/3.0,-1.0);
  vec4 p = mix(vec4(c.bg,K.wz), vec4(c.gb,K.xy), step(c.b,c.g));
  vec4 q = mix(vec4(p.xyw,c.r), vec4(c.r,p.yzx), step(p.x,c.r));
  float d = q.x - min(q.w,q.y); float e = 1.0e-10;
  return vec3(abs(q.z+(q.w-q.y)/(6.0*d+e)), d/(q.x+e), q.x);
}
float computeTile(vec2 uv, float gs, float lw) {
  vec2 cell = floor(uv); vec2 f = fract(uv);
  float h = hash(cell);
  if (noiseWarp > 0.0) h = fract(h + noise(cell*0.5+time*0.1)*noiseWarp);
  float orient = step(0.5, h);
  float rot = 0.0;
  if (animateRotation > 0.5) {
    float cellPhase = hash(cell+0.5);
    rot = time * rotationSpeed * (cellPhase > 0.5 ? 1.0 : -1.0);
  }
  vec2 center = vec2(0.5); vec2 p = f - center;
  float c = cos(rot), s = sin(rot);
  p = vec2(c*p.x-s*p.y, s*p.x+c*p.y) + center;
  float d = 1000.0;
  float lwScaled = lw / gs * 0.02 * thickness;
  if (tileType < 0.5) {
    if (orient > 0.5) { d = min(abs(sdCircle(p, 0.5)), abs(sdCircle(p-vec2(1,1), 0.5))); }
    else { d = min(abs(sdCircle(p-vec2(1,0), 0.5)), abs(sdCircle(p-vec2(0,1), 0.5))); }
  } else if (tileType < 1.5) {
    d = orient > 0.5 ? sdLine(p, vec2(0), vec2(1)) : sdLine(p, vec2(1,0), vec2(0,1));
  } else {
    if (orient > 0.5) d = min(min(sdLine(p,vec2(0),vec2(0.5,1)), sdLine(p,vec2(0.5,1),vec2(1,0))), sdLine(p,vec2(1,0),vec2(0)));
    else d = min(min(sdLine(p,vec2(0,1),vec2(0.5,0)), sdLine(p,vec2(0.5,0),vec2(1,1))), sdLine(p,vec2(1,1),vec2(0,1)));
  }
  float edge = 1.0;
  if (fillMode < 0.5) edge = 1.0 - smoothstep(lwScaled-0.005, lwScaled+0.005, d);
  else if (fillMode < 1.5) edge = 1.0 - smoothstep(0.0, 0.01, d-0.25);
  else { edge = max((1.0-smoothstep(0.0,0.01,d-0.25))*0.3, 1.0-smoothstep(lwScaled-0.005, lwScaled+0.005, d)); }
  return edge;
}
void main() {
  vec2 uv = vUv;
  if (waveDistort > 0.0) {
    uv.x += sin(uv.y*waveFreq*6.2832+time*0.5)*waveDistort*0.05;
    uv.y += cos(uv.x*waveFreq*6.2832+time*0.7)*waveDistort*0.05;
  }
  uv = (uv - 0.5) / zoom + 0.5;
  float edge;
  if (multiScale > 0.5) {
    edge = 0.0; float weight = 1.0, totalWeight = 0.0;
    for (int i = 0; i < 4; i++) {
      if (float(i) >= scaleLevels) break;
      float sc = pow(2.0, float(i));
      edge += computeTile(uv*gridSize*sc, gridSize*sc, lineWidth) * weight;
      totalWeight += weight; weight *= 0.5;
    }
    edge /= totalWeight;
  } else { edge = computeTile(uv*gridSize, gridSize, lineWidth); }
  if (invert > 0.5) edge = 1.0 - edge;
  edge = pow(clamp(edge, 0.0, 1.0), 1.0/contrast);
  vec3 cA = vec3(0.0), cB = vec3(1.0);
  if (animateColors > 0.5 || colorCycleSpeed > 0.0) {
    float spd = colorCycleSpeed > 0.0 ? colorCycleSpeed : 1.0;
    float hueShift = time * spd * 0.1;
    vec3 hsvA = rgb2hsv(cA); vec3 hsvB = rgb2hsv(cB);
    hsvA.x = fract(hsvA.x + hueShift); hsvB.x = fract(hsvB.x + hueShift + 0.5);
    if (colorCycleSpeed > 0.0) { hsvA.yz = max(hsvA.yz, vec2(0.7,0.6)); hsvB.yz = max(hsvB.yz, vec2(0.7,0.6)); }
    cA = hsv2rgb(hsvA); cB = hsv2rgb(hsvB);
  }
  vec3 col = mix(cA, cB, edge);
  vec2 cellCoord = floor(vUv * gridSize);
  col += edge * vec3(0.1,0.2,0.3) * (0.5+0.5*sin(time*0.5+cellCoord.x*0.3+cellCoord.y*0.7));
  if (edgeFade > 0.0) { vec2 q = (vUv-0.5)*2.0; col *= clamp(1.0-dot(q,q)*edgeFade, 0.0, 1.0); }
  gl_FragColor = vec4(col, 1.0);
}`

const truchetParams: ParamSchemaDef[] = [
  { name: 'tileType', type: 'enum', default: 'quarter-circle', enumValues: ['quarter-circle', 'diagonal', 'triangle'], description: 'Tile type' },
  { name: 'gridSize', type: 'float', min: 2, max: 64, default: 16, description: 'Grid size' },
  { name: 'lineWidth', type: 'float', min: 0.1, max: 10, default: 2, description: 'Line width' },
  { name: 'animateRotation', type: 'bool', default: true, description: 'Animate rotation' },
  { name: 'rotationSpeed', type: 'float', min: 0, max: 2, default: 0.2, description: 'Rotation speed' },
  { name: 'fillMode', type: 'enum', default: 'stroke', enumValues: ['stroke', 'fill', 'both'], description: 'Fill mode' },
  { name: 'randomSeed', type: 'float', min: 0, max: 100, default: 42, description: 'Random seed' },
  { name: 'colorCycleSpeed', type: 'float', min: 0, max: 5, default: 0, description: 'Color cycle speed' },
  { name: 'noiseWarp', type: 'float', min: 0, max: 2, default: 0, description: 'Noise warp' },
  { name: 'zoom', type: 'float', min: 0.1, max: 5, default: 1, description: 'Zoom' },
  { name: 'multiScale', type: 'bool', default: false, description: 'Multi-scale' },
  { name: 'scaleLevels', type: 'int', min: 2, max: 4, default: 2, description: 'Scale levels' },
  { name: 'invert', type: 'bool', default: false, description: 'Invert' },
  { name: 'edgeFade', type: 'float', min: 0, max: 2, default: 0, description: 'Edge fade' },
  { name: 'animateColors', type: 'bool', default: false, description: 'Animate colors' },
  { name: 'waveDistort', type: 'float', min: 0, max: 3, default: 0, description: 'Wave distortion' },
  { name: 'waveFreq', type: 'float', min: 0.5, max: 10, default: 3, description: 'Wave frequency' },
  { name: 'contrast', type: 'float', min: 0.1, max: 5, default: 1, description: 'Contrast' },
  { name: 'thickness', type: 'float', min: 0.1, max: 5, default: 1, description: 'Thickness' },
]

const truchetEvaluateSource = `
return { shaderConfig: {
  fragmentShader: inputs.fragmentShader,
  uniforms: {
    time: ctx.elapsed,
    gridSize: inputs.gridSize,
    lineWidth: inputs.lineWidth,
    rotationSpeed: inputs.rotationSpeed,
    tileType: Math.round(inputs.tileType || 0),
    fillMode: Math.round(inputs.fillMode || 0),
    seed: inputs.randomSeed,
    animateRotation: inputs.animateRotation > 0.5 ? 1 : 0,
    colorCycleSpeed: inputs.colorCycleSpeed,
    noiseWarp: inputs.noiseWarp,
    zoom: inputs.zoom,
    multiScale: inputs.multiScale > 0.5 ? 1 : 0,
    scaleLevels: Math.round(inputs.scaleLevels),
    invert: inputs.invert > 0.5 ? 1 : 0,
    edgeFade: inputs.edgeFade,
    animateColors: inputs.animateColors > 0.5 ? 1 : 0,
    waveDistort: inputs.waveDistort,
    waveFreq: inputs.waveFreq,
    contrast: inputs.contrast,
    thickness: inputs.thickness,
  }
}};
`

const truchetDef: CompoundGeneratorDef = {
  id: 'builtin_truchetTiling',
  name: 'Truchet Tiling',
  description: 'Animated Truchet tiles with SDF rendering and fractal multi-scale overlay',
  defaultCameraDistance: 0,
  generatorType: 'truchetTiling_generator',
  outputMode: 'shader',
  params: truchetParams,
  inputs: truchetParams.map(p => ({
    name: p.name,
    type: 'number' as const,
    default: p.type === 'bool' ? (p.default ? 1 : 0) : (p.type === 'enum' ? 0 : (p.default as number)),
  })),
  outputs: [{ name: 'shaderConfig', type: 'array' as const }],
  evaluateSource: truchetEvaluateSource,
  fragmentShader: truchetFragShader,
}

// ═══════════════════════════════════════════════════════════════════════════
// MAGNETIC PENDULUM
// ═══════════════════════════════════════════════════════════════════════════

const magneticPendulumFragShader = `precision highp float;
varying vec2 vUv;
uniform float time;
uniform float magnetCount;
uniform float friction;
uniform float magnetStrength;
uniform float gravity;
uniform float maxIterations;
uniform float zoom;
uniform float centerX;
uniform float centerY;
uniform float colorSaturation;
uniform float colorBrightness;
uniform bool showMagnets;
uniform float magnetSize;
uniform float magnetRadius;
uniform float settleThreshold;
uniform bool colorByTime;
uniform float timeColorSpeed;
uniform float pendulumHeight;
uniform float contrast;
uniform vec2 magnets[6];
uniform vec3 magnetColors[6];

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0,2.0/3.0,1.0/3.0,3.0);
  vec3 p = abs(fract(c.xxx+K.xyz)*6.0-K.www);
  return c.z*mix(K.xxx, clamp(p-K.xxx,0.0,1.0), c.y);
}
void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  vec2 startPos = uv / zoom + vec2(centerX, centerY);
  vec2 pos = startPos; vec2 vel = vec2(0.0);
  float dt = 0.02; float h2 = pendulumHeight*pendulumHeight;
  int settledMagnet = -1; int settleTime = int(maxIterations);
  for (int i = 0; i < 500; i++) {
    if (float(i) >= maxIterations) break;
    vec2 force = -gravity * pos;
    for (int m = 0; m < 6; m++) {
      if (float(m) >= magnetCount) break;
      vec2 diff = magnets[m] - pos;
      float dist2 = dot(diff,diff) + h2;
      force += magnetStrength * diff / (dist2 * sqrt(dist2));
    }
    force -= friction * vel;
    vel += force * dt; pos += vel * dt;
    float speed2 = dot(vel,vel);
    for (int m = 0; m < 6; m++) {
      if (float(m) >= magnetCount) break;
      vec2 diff = magnets[m] - pos;
      if (dot(diff,diff) < settleThreshold && speed2 < settleThreshold*0.1) { settledMagnet = m; settleTime = i; break; }
    }
    if (settledMagnet >= 0) break;
  }
  if (settledMagnet < 0) {
    float minDist = 1e10;
    for (int m = 0; m < 6; m++) {
      if (float(m) >= magnetCount) break;
      float d = dot(magnets[m]-pos, magnets[m]-pos);
      if (d < minDist) { minDist = d; settledMagnet = m; }
    }
  }
  vec3 col;
  if (colorByTime) {
    float t = float(settleTime)/float(maxIterations);
    col = hsv2rgb(vec3(t*timeColorSpeed, colorSaturation, colorBrightness));
  } else {
    float brightness = 1.0 - pow(float(settleTime)/float(maxIterations), 1.0/contrast);
    brightness = clamp(brightness*colorBrightness*2.0, 0.0, 1.0);
    vec3 baseColor = vec3(0.5);
    for (int m = 0; m < 6; m++) { if (m == settledMagnet) { baseColor = magnetColors[m]; break; } }
    col = mix(vec3(0.0), baseColor, brightness);
    float gray = dot(col, vec3(0.299,0.587,0.114));
    col = mix(vec3(gray), col, 1.0+colorSaturation);
  }
  if (showMagnets) {
    for (int m = 0; m < 6; m++) {
      if (float(m) >= magnetCount) break;
      float d = length(startPos - magnets[m]) * 500.0 * zoom;
      if (d < magnetSize) col = mix(col, vec3(1.0), smoothstep(magnetSize, magnetSize-1.5, d));
    }
  }
  gl_FragColor = vec4(col, 1.0);
}`

const magneticPendulumParams: ParamSchemaDef[] = [
  { name: 'magnetCount', type: 'int', min: 3, max: 6, default: 3, description: 'Magnet count' },
  { name: 'friction', type: 'float', min: 0, max: 1, default: 0.1, description: 'Friction' },
  { name: 'magnetStrength', type: 'float', min: 0.1, max: 5, default: 1, description: 'Magnet strength' },
  { name: 'gravity', type: 'float', min: 0, max: 2, default: 0.5, description: 'Gravity' },
  { name: 'maxIterations', type: 'int', min: 50, max: 500, default: 200, description: 'Max iterations' },
  { name: 'zoom', type: 'float', min: 0.1, max: 5, default: 1, description: 'Zoom' },
  { name: 'centerX', type: 'float', min: -2, max: 2, default: 0, description: 'Center X' },
  { name: 'centerY', type: 'float', min: -2, max: 2, default: 0, description: 'Center Y' },
  { name: 'colorSaturation', type: 'float', min: 0, max: 2, default: 0.8, description: 'Saturation' },
  { name: 'colorBrightness', type: 'float', min: 0.1, max: 2, default: 0.7, description: 'Brightness' },
  { name: 'showMagnets', type: 'bool', default: true, description: 'Show magnets' },
  { name: 'magnetSize', type: 'float', min: 1, max: 10, default: 3, description: 'Magnet dot size' },
  { name: 'animateMagnets', type: 'bool', default: true, description: 'Animate magnets' },
  { name: 'animateSpeed', type: 'float', min: 0, max: 2, default: 0.2, description: 'Animation speed' },
  { name: 'magnetRadius', type: 'float', min: 0.1, max: 1, default: 0.3, description: 'Orbit radius' },
  { name: 'settleThreshold', type: 'float', min: 0.001, max: 0.1, default: 0.01, description: 'Settle threshold' },
  { name: 'colorByTime', type: 'bool', default: false, description: 'Color by time' },
  { name: 'timeColorSpeed', type: 'float', min: 0.1, max: 5, default: 1, description: 'Time color speed' },
  { name: 'pendulumHeight', type: 'float', min: 0.1, max: 2, default: 0.5, description: 'Pendulum height' },
  { name: 'contrast', type: 'float', min: 0.5, max: 5, default: 1.5, description: 'Contrast' },
]

const magneticPendulumEvaluateSource = `
var mc = Math.round(inputs.magnetCount);
var r = inputs.magnetRadius;
var positions = [];
var colors = [];
for (var i = 0; i < mc; i++) {
  var angle = (i / mc) * Math.PI * 2;
  if (inputs.animateMagnets > 0.5) angle += ctx.elapsed * inputs.animateSpeed;
  positions.push([Math.cos(angle) * r, Math.sin(angle) * r]);
  var h = i / Math.max(mc, 1);
  var cr = Math.max(0, Math.min(1, Math.abs(h*6-3)-1));
  var cg = Math.max(0, Math.min(1, 2-Math.abs(h*6-2)));
  var cb = Math.max(0, Math.min(1, 2-Math.abs(h*6-4)));
  colors.push([cr*0.8+0.2, cg*0.8+0.2, cb*0.8+0.2]);
}
while (positions.length < 6) { positions.push([-10,-10]); colors.push([0,0,0]); }
return { shaderConfig: {
  fragmentShader: inputs.fragmentShader,
  uniforms: {
    time: ctx.elapsed,
    magnetCount: mc,
    friction: inputs.friction,
    magnetStrength: inputs.magnetStrength,
    gravity: inputs.gravity,
    maxIterations: Math.round(inputs.maxIterations),
    zoom: inputs.zoom,
    centerX: inputs.centerX,
    centerY: inputs.centerY,
    colorSaturation: inputs.colorSaturation,
    colorBrightness: inputs.colorBrightness,
    showMagnets: inputs.showMagnets > 0.5,
    magnetSize: inputs.magnetSize,
    magnetRadius: r,
    settleThreshold: inputs.settleThreshold,
    colorByTime: inputs.colorByTime > 0.5,
    timeColorSpeed: inputs.timeColorSpeed,
    pendulumHeight: inputs.pendulumHeight,
    contrast: inputs.contrast,
    magnets: positions,
    magnetColors: colors,
  }
}};
`

const magneticPendulumDef: CompoundGeneratorDef = {
  id: 'builtin_magneticPendulum',
  name: 'Magnetic Pendulum',
  description: 'Basin boundary visualization of a pendulum attracted to multiple magnets',
  defaultCameraDistance: 0,
  generatorType: 'magneticPendulum_generator',
  outputMode: 'shader',
  params: magneticPendulumParams,
  inputs: magneticPendulumParams.map(p => ({
    name: p.name,
    type: 'number' as const,
    default: p.type === 'bool' ? (p.default ? 1 : 0) : (p.type === 'enum' ? 0 : (p.default as number)),
  })),
  outputs: [{ name: 'shaderConfig', type: 'array' as const }],
  evaluateSource: magneticPendulumEvaluateSource,
  fragmentShader: magneticPendulumFragShader,
}

// ═══════════════════════════════════════════════════════════════════════════
// ELECTRIC FIELD
// ═══════════════════════════════════════════════════════════════════════════

const electricFieldFragShader = `precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform vec2 uChargePos[16];
uniform float uChargeMag[16];
uniform float uChargeCount;
uniform float uDisplayMode;
uniform float uColorPalette;
uniform float uFieldScale;
uniform bool uLogScale;
uniform bool uContourLines;
uniform float uContourCount;
uniform float uContourWidth;
uniform float uZoom;
uniform float uBrightness;
uniform float uContrast;
uniform bool uShowCharges;
uniform float uChargeSize;
uniform bool uVectorField;
uniform float uVectorDensity;
uniform vec2 uResolution;

#define PI 3.14159265359
#define TAU 6.28318530718

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0,2.0/3.0,1.0/3.0,3.0);
  vec3 p = abs(fract(c.xxx+K.xyz)*6.0-K.www);
  return c.z*mix(K.xxx, clamp(p-K.xxx,0.0,1.0), c.y);
}
vec2 computeField(vec2 pos) {
  vec2 E = vec2(0.0);
  for (int i = 0; i < 16; i++) {
    if (float(i) >= uChargeCount) break;
    vec2 r = pos - uChargePos[i];
    float dist2 = dot(r,r); float dist = sqrt(dist2);
    float minDist = 0.01;
    if (dist < minDist) { dist = minDist; dist2 = minDist*minDist; }
    E += uChargeMag[i] * r / (dist * dist2);
  }
  return E;
}
float computePotential(vec2 pos) {
  float V = 0.0;
  for (int i = 0; i < 16; i++) {
    if (float(i) >= uChargeCount) break;
    float dist = max(length(pos-uChargePos[i]), 0.01);
    V += uChargeMag[i] / dist;
  }
  return V;
}
vec3 paletteColor(float t) {
  t = clamp(t, 0.0, 1.0);
  if (uColorPalette < 0.5) {
    vec3 c0=vec3(0.02,0.01,0.15), c1=vec3(0,0.4,0.8), c2=vec3(0,0.9,1), c3=vec3(1), c4=vec3(1,0.9,0.2), c5=vec3(1,0.2,0.05);
    if (t<0.2) return mix(c0,c1,t/0.2); if (t<0.4) return mix(c1,c2,(t-0.2)/0.2);
    if (t<0.6) return mix(c2,c3,(t-0.4)/0.2); if (t<0.8) return mix(c3,c4,(t-0.6)/0.2);
    return mix(c4,c5,(t-0.8)/0.2);
  }
  if (uColorPalette < 1.5) {
    vec3 c0=vec3(0), c1=vec3(0.5,0,0.5), c2=vec3(1,0,0), c3=vec3(1,0.6,0), c4=vec3(1,1,0.4), c5=vec3(1);
    if (t<0.2) return mix(c0,c1,t/0.2); if (t<0.4) return mix(c1,c2,(t-0.2)/0.2);
    if (t<0.6) return mix(c2,c3,(t-0.4)/0.2); if (t<0.8) return mix(c3,c4,(t-0.6)/0.2);
    return mix(c4,c5,(t-0.8)/0.2);
  }
  if (uColorPalette < 2.5) return hsv2rgb(vec3(t*0.85, 0.9, 0.95));
  if (uColorPalette < 3.5) return vec3(t);
  vec3 c0=vec3(0.05,0,0.2), c1=vec3(0.5,0,0.7), c2=vec3(0.9,0.1,0.5), c3=vec3(1,0.5,0.1), c4=vec3(1,0.95,0.2);
  if (t<0.25) return mix(c0,c1,t/0.25); if (t<0.5) return mix(c1,c2,(t-0.25)/0.25);
  if (t<0.75) return mix(c2,c3,(t-0.5)/0.25); return mix(c3,c4,(t-0.75)/0.25);
}
vec3 divergingColor(float t) {
  t = clamp(t, -1.0, 1.0);
  if (t < 0.0) return mix(vec3(1.0), vec3(0.1,0.3,1.0), -t);
  return mix(vec3(1.0), vec3(1.0,0.15,0.05), t);
}
float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123); }
float noise(vec2 p) {
  vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y);
}
void main() {
  vec2 uv = (vUv - 0.5) * 2.0 / uZoom;
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  uv.x *= aspect;
  vec2 E = computeField(uv);
  float Emag = length(E);
  float V = computePotential(uv);
  float fieldVal = Emag * uFieldScale;
  if (uLogScale) fieldVal = log(1.0+fieldVal*10.0)/log(11.0);
  else fieldVal = fieldVal/(1.0+fieldVal);
  vec3 color = vec3(0.0);
  if (uDisplayMode < 0.5) {
    color = paletteColor(pow(clamp(fieldVal,0.0,1.0), 1.0/uContrast));
  } else if (uDisplayMode < 1.5) {
    float Vnorm = V*uFieldScale/(1.0+abs(V*uFieldScale));
    color = divergingColor(Vnorm*uContrast);
    if (uContourLines) {
      float cs = 2.0/uContourCount;
      float cv = mod(Vnorm+1.0,cs);
      float edge = fwidth(Vnorm)*uContourWidth*2.0;
      float line = smoothstep(edge,0.0,abs(cv-cs*0.5)-cs*0.25+edge*0.5);
      color = mix(color, vec3(1.0), line*0.6);
    }
  } else if (uDisplayMode < 2.5) {
    float angle = atan(E.y, E.x);
    color = hsv2rgb(vec3(angle/TAU+0.5, 0.8, 0.5+0.5*fieldVal));
  } else {
    vec2 pos = uv; float intensity = 0.0, samples = 0.0;
    vec2 p = pos;
    for (int s = 0; s < 30; s++) {
      vec2 field = computeField(p); float fmag = length(field);
      if (fmag < 0.0001) break;
      p += (field/fmag) * 0.005/uZoom;
      float n = noise(p*50.0*uZoom+uTime*0.5);
      float decay = exp(-float(s)*0.08);
      intensity += n*decay; samples += decay;
    }
    p = pos;
    for (int s = 0; s < 30; s++) {
      vec2 field = computeField(p); float fmag = length(field);
      if (fmag < 0.0001) break;
      p -= (field/fmag) * 0.005/uZoom;
      float n = noise(p*50.0*uZoom+uTime*0.5);
      float decay = exp(-float(s)*0.08);
      intensity += n*decay; samples += decay;
    }
    if (samples > 0.0) intensity /= samples;
    float magFactor = uLogScale ? log(1.0+Emag*uFieldScale*10.0)/log(11.0) : Emag*uFieldScale/(1.0+Emag*uFieldScale);
    float streamVal = pow(clamp(intensity*(0.3+0.7*clamp(magFactor,0.0,1.0)),0.0,1.0), 1.0/uContrast);
    color = paletteColor(streamVal);
  }
  if (uVectorField) {
    float density = float(uVectorDensity);
    vec2 cellSize = vec2(aspect, 1.0) * 2.0 / (density * uZoom);
    vec2 cell = floor(uv / cellSize);
    vec2 cellCenter = (cell + 0.5) * cellSize;
    vec2 localPos = (uv - cellCenter) / cellSize;
    vec2 cellE = computeField(cellCenter);
    float cellMag = length(cellE);
    if (cellMag > 0.001) {
      vec2 dir = cellE / cellMag;
      float along = dot(localPos, dir);
      float across = abs(dot(localPos, vec2(-dir.y, dir.x)));
      float arrowLen = 0.4 * min(1.0, cellMag * uFieldScale * 2.0);
      float bodyWidth = 0.04;
      float headWidth = 0.12;
      float headLen = 0.12;
      bool inBody = along > -arrowLen && along < arrowLen - headLen && across < bodyWidth;
      bool inHead = along >= arrowLen - headLen && along < arrowLen
        && across < headWidth * (1.0 - (along - (arrowLen - headLen)) / headLen);
      if (inBody || inHead) {
        color = mix(color, vec3(1.0), 0.7);
      }
    }
  }
  if (uShowCharges) {
    for (int i = 0; i < 16; i++) {
      if (float(i) >= uChargeCount) break;
      float dist = length(uv-uChargePos[i]);
      float radius = uChargeSize*0.005/uZoom;
      float glow = smoothstep(radius*3.0,radius,dist);
      float core = smoothstep(radius,radius*0.5,dist);
      vec3 chargeColor = uChargeMag[i] > 0.0 ? vec3(1,0.2,0.1) : vec3(0.1,0.4,1);
      color = mix(color, chargeColor*0.5, glow*0.5);
      color = mix(color, chargeColor, core);
    }
  }
  color *= uBrightness;
  gl_FragColor = vec4(color, 1.0);
}`

const electricFieldParams: ParamSchemaDef[] = [
  { name: 'chargeCount', type: 'int', min: 1, max: 16, default: 4, description: 'Charge count' },
  { name: 'chargePattern', type: 'enum', default: 'dipole', enumValues: ['dipole', 'quadrupole', 'random', 'ring', 'line'], description: 'Charge pattern' },
  { name: 'displayMode', type: 'enum', default: 'magnitude', enumValues: ['magnitude', 'potential', 'direction', 'streamlines'], description: 'Display mode' },
  { name: 'colorPalette', type: 'enum', default: 'electric', enumValues: ['electric', 'thermal', 'rainbow', 'monochrome', 'plasma'], description: 'Color palette' },
  { name: 'fieldScale', type: 'float', min: 0.1, max: 5, default: 1, description: 'Field scale' },
  { name: 'logScale', type: 'bool', default: true, description: 'Log scale' },
  { name: 'contourLines', type: 'bool', default: true, description: 'Contour lines' },
  { name: 'contourCount', type: 'int', min: 1, max: 50, default: 15, description: 'Contour count' },
  { name: 'contourWidth', type: 'float', min: 0.1, max: 5, default: 1.5, description: 'Contour width' },
  { name: 'animateCharges', type: 'bool', default: true, description: 'Animate charges' },
  { name: 'animateSpeed', type: 'float', min: 0, max: 2, default: 0.3, description: 'Animation speed' },
  { name: 'chargeStrength', type: 'float', min: 0.1, max: 5, default: 1, description: 'Charge strength' },
  { name: 'alternatePolarity', type: 'bool', default: true, description: 'Alternate polarity' },
  { name: 'zoom', type: 'float', min: 0.1, max: 5, default: 1, description: 'Zoom' },
  { name: 'brightness', type: 'float', min: 0.1, max: 3, default: 1, description: 'Brightness' },
  { name: 'contrast', type: 'float', min: 0.5, max: 5, default: 1.5, description: 'Contrast' },
  { name: 'showCharges', type: 'bool', default: true, description: 'Show charges' },
  { name: 'chargeSize', type: 'float', min: 1, max: 15, default: 5, description: 'Charge size' },
  { name: 'vectorField', type: 'bool', default: false, description: 'Vector field overlay' },
  { name: 'vectorDensity', type: 'int', min: 5, max: 40, default: 20, description: 'Vector density' },
]

const electricFieldEvaluateSource = `
var cc = Math.round(inputs.chargeCount);
var patIdx = Math.round(inputs.chargePattern || 0);
var patterns = ['dipole','quadrupole','random','ring','line'];
var pat = patterns[patIdx] || 'dipole';
var key = nodeId + '_charges';
var state = ctx.frameState.get(key);
if (!state || state.cc !== cc || state.pat !== pat || state.str !== inputs.chargeStrength || state.alt !== (inputs.alternatePolarity > 0.5)) {
  state = { positions: [], magnitudes: [] };
  for (var i = 0; i < cc; i++) {
    var angle = (i / cc) * Math.PI * 2;
    var r = 0.3;
    if (pat === 'line') { state.positions.push([0, (i/(cc-1||1))*1.2-0.6]); }
    else if (pat === 'random') { state.positions.push([Math.random()*1.4-0.7, Math.random()*1.4-0.7]); }
    else { state.positions.push([Math.cos(angle)*r, Math.sin(angle)*r]); }
    var polarity = (inputs.alternatePolarity > 0.5) ? (i % 2 === 0 ? 1 : -1) : 1;
    state.magnitudes.push(inputs.chargeStrength * polarity);
  }
  state.cc = cc; state.pat = pat; state.str = inputs.chargeStrength; state.alt = (inputs.alternatePolarity > 0.5);
  ctx.frameState.set(key, state);
}
if (inputs.animateCharges > 0.5) {
  for (var i = 0; i < cc; i++) {
    var angle = (i / cc) * Math.PI * 2 + ctx.elapsed * inputs.animateSpeed;
    var r = 0.3;
    if (pat === 'line') {
      state.positions[i] = [0, (i/(cc-1||1))*1.2-0.6 + Math.sin(ctx.elapsed*inputs.animateSpeed*2+i*1.5)*0.15];
    } else {
      state.positions[i] = [Math.cos(angle)*r, Math.sin(angle)*r];
    }
  }
}
var positions = []; var mags = [];
for (var i = 0; i < 16; i++) {
  if (i < cc) { positions.push(state.positions[i]); mags.push(state.magnitudes[i]); }
  else { positions.push([-10,-10]); mags.push(0); }
}
return { shaderConfig: {
  fragmentShader: inputs.fragmentShader,
  uniforms: {
    uTime: ctx.elapsed,
    uChargePos: positions,
    uChargeMag: mags,
    uChargeCount: cc,
    uDisplayMode: Math.round(inputs.displayMode || 0),
    uColorPalette: Math.round(inputs.colorPalette || 0),
    uFieldScale: inputs.fieldScale,
    uLogScale: inputs.logScale > 0.5,
    uContourLines: inputs.contourLines > 0.5,
    uContourCount: Math.round(inputs.contourCount),
    uContourWidth: inputs.contourWidth,
    uZoom: inputs.zoom,
    uBrightness: inputs.brightness,
    uContrast: inputs.contrast,
    uShowCharges: inputs.showCharges > 0.5,
    uChargeSize: inputs.chargeSize,
    uVectorField: inputs.vectorField > 0.5,
    uVectorDensity: Math.round(inputs.vectorDensity),
    uResolution: [ctx.resolution ? ctx.resolution[0] : 800, ctx.resolution ? ctx.resolution[1] : 600],
  }
}};
`

const electricFieldDef: CompoundGeneratorDef = {
  id: 'builtin_electricField',
  name: 'Electric Field',
  description: 'Electric field visualization with animated charges and multiple display modes',
  defaultCameraDistance: 0,
  generatorType: 'electricField_generator',
  outputMode: 'shader',
  params: electricFieldParams,
  inputs: electricFieldParams.map(p => ({
    name: p.name,
    type: 'number' as const,
    default: p.type === 'bool' ? (p.default ? 1 : 0) : (p.type === 'enum' ? 0 : (p.default as number)),
  })),
  outputs: [{ name: 'shaderConfig', type: 'array' as const }],
  evaluateSource: electricFieldEvaluateSource,
  fragmentShader: electricFieldFragShader,
}

// ═══════════════════════════════════════════════════════════════════════════
// VORONOI
// ═══════════════════════════════════════════════════════════════════════════

const voronoiFragShader = `precision highp float;
varying vec2 vUv;
uniform vec2 seeds[64];
uniform vec3 seedColors[64];
uniform float seedCount;
uniform float borderWidth;
uniform vec3 borderColor;
uniform float cellOpacity;
uniform float distortAmount;
uniform float distortFreq;
uniform float metric;
uniform bool showSeeds;
uniform float seedSize;
uniform float pulseSpeed;
uniform float time;
uniform bool invertColors;
uniform float blendEdges;
uniform float rotation;

float rand(vec2 co) { return fract(sin(dot(co, vec2(12.9898,78.233)))*43758.5453); }
vec2 distort(vec2 p) {
  if (distortAmount < 0.001) return p;
  return p + vec2(sin(p.y*distortFreq*6.2831+time*0.5)*distortAmount*0.05, cos(p.x*distortFreq*6.2831+time*0.7)*distortAmount*0.05);
}
float metricDist(vec2 a, vec2 b) {
  vec2 d = abs(a-b);
  if (metric > 0.5 && metric < 1.5) return d.x+d.y;
  if (metric > 1.5) return max(d.x,d.y);
  return length(a-b);
}
void main() {
  vec2 center = vec2(0.5);
  vec2 p = vUv - center;
  float c = cos(rotation), s = sin(rotation);
  p = vec2(c*p.x-s*p.y, s*p.x+c*p.y) + center;
  vec2 dp = distort(p);
  float d1 = 1e10, d2 = 1e10; int nearest = 0, secondNearest = 0;
  for (int i = 0; i < 64; i++) {
    if (float(i) >= seedCount) break;
    float d = metricDist(dp, seeds[i]);
    if (d < d1) { d2=d1; secondNearest=nearest; d1=d; nearest=i; }
    else if (d < d2) { d2=d; secondNearest=i; }
  }
  float pulse = 1.0;
  if (pulseSpeed > 0.001) pulse = 0.85+0.15*sin(time*pulseSpeed+float(nearest)*1.7);
  vec3 cellColor = seedColors[nearest];
  if (blendEdges > 0.001) {
    vec3 neighborColor = seedColors[secondNearest];
    cellColor = mix(neighborColor, cellColor, smoothstep(0.0, blendEdges*0.1, d2-d1));
  }
  cellColor *= pulse;
  if (invertColors) cellColor = vec3(1.0)-cellColor;
  float borderDist = d2-d1;
  float borderFactor = 1.0-smoothstep(0.0, borderWidth*0.002, borderDist);
  vec3 color = mix(cellColor, borderColor, borderFactor);
  float alpha = mix(cellOpacity, 1.0, borderFactor);
  if (showSeeds) {
    float seedFactor = 1.0-smoothstep(0.0, seedSize*0.002, d1);
    color = mix(color, vec3(1.0), seedFactor*0.9);
    alpha = mix(alpha, 1.0, seedFactor);
  }
  gl_FragColor = vec4(color, alpha);
}`

const voronoiParams: ParamSchemaDef[] = [
  { name: 'seedCount', type: 'int', min: 1, max: 64, default: 30, description: 'Seed count' },
  { name: 'motionType', type: 'enum', default: 'brownian', enumValues: ['brownian', 'orbital', 'linear', 'static'], description: 'Motion type' },
  { name: 'motionSpeed', type: 'float', min: 0, max: 3, default: 0.5, description: 'Motion speed' },
  { name: 'colorMode', type: 'enum', default: 'random', enumValues: ['distance', 'palette', 'height', 'random'], description: 'Color mode' },
  { name: 'borderWidth', type: 'float', min: 0, max: 10, default: 2, description: 'Border width' },
  { name: 'cellOpacity', type: 'float', min: 0, max: 1, default: 0.8, description: 'Cell opacity' },
  { name: 'distortAmount', type: 'float', min: 0, max: 3, default: 0, description: 'Distortion' },
  { name: 'distortFreq', type: 'float', min: 0.5, max: 10, default: 2, description: 'Distort frequency' },
  { name: 'metric', type: 'enum', default: 'euclidean', enumValues: ['euclidean', 'manhattan', 'chebyshev'], description: 'Distance metric' },
  { name: 'showSeeds', type: 'bool', default: false, description: 'Show seeds' },
  { name: 'seedSize', type: 'float', min: 1, max: 10, default: 3, description: 'Seed size' },
  { name: 'pulseSpeed', type: 'float', min: 0, max: 5, default: 0, description: 'Pulse speed' },
  { name: 'invertColors', type: 'bool', default: false, description: 'Invert colors' },
  { name: 'blendEdges', type: 'float', min: 0, max: 3, default: 0, description: 'Blend edges' },
  { name: 'rotationSpeed', type: 'float', min: 0, max: 2, default: 0, description: 'Rotation speed' },
]

const voronoiEvaluateSource = `
var sc = Math.round(inputs.seedCount);
var motIdx = Math.round(inputs.motionType || 0);
var motTypes = ['brownian','orbital','linear','static'];
var motType = motTypes[motIdx] || 'brownian';
var colIdx = Math.round(inputs.colorMode || 0);
var key = nodeId + '_seeds';
var state = ctx.frameState.get(key);
if (!state) {
  state = { seeds: [], cachedColors: [] };
  for (var i = 0; i < sc; i++) {
    var s = {
      x: 0.1 + Math.random() * 0.8, y: 0.1 + Math.random() * 0.8,
      vx: (Math.random()-0.5)*0.01, vy: (Math.random()-0.5)*0.01,
      angle: Math.random()*Math.PI*2,
      orbitCenterX: 0.5+(Math.random()-0.5)*0.4,
      orbitCenterY: 0.5+(Math.random()-0.5)*0.4,
      orbitRadius: 0.05+Math.random()*0.2,
      orbitSpeed: (Math.random()-0.5)*2,
    };
    state.seeds.push(s);
    var hue = i / Math.max(sc, 1);
    state.cachedColors.push([Math.sin(hue*6.28)*0.5+0.5, Math.sin(hue*6.28+2.09)*0.5+0.5, Math.sin(hue*6.28+4.19)*0.5+0.5]);
  }
  ctx.frameState.set(key, state);
}
var speed = inputs.motionSpeed * 0.01;
var dt = Math.min(1/30, 0.016);
for (var i = 0; i < sc && i < state.seeds.length; i++) {
  var s = state.seeds[i];
  if (motType === 'brownian') {
    s.vx += (Math.random()-0.5)*speed*0.5; s.vy += (Math.random()-0.5)*speed*0.5;
    s.vx *= 0.95; s.vy *= 0.95;
    s.x += s.vx; s.y += s.vy;
    s.x = Math.max(0.02, Math.min(0.98, s.x));
    s.y = Math.max(0.02, Math.min(0.98, s.y));
  } else if (motType === 'orbital') {
    s.angle += s.orbitSpeed * speed * dt * 60;
    s.x = s.orbitCenterX + Math.cos(s.angle)*s.orbitRadius;
    s.y = s.orbitCenterY + Math.sin(s.angle)*s.orbitRadius;
  } else if (motType === 'linear') {
    s.x += s.vx*speed*dt*600; s.y += s.vy*speed*dt*600;
    if (s.x<0||s.x>1) { s.vx*=-1; s.x=Math.max(0,Math.min(1,s.x)); }
    if (s.y<0||s.y>1) { s.vy*=-1; s.y=Math.max(0,Math.min(1,s.y)); }
  }
}
var positions = []; var colors = [];
for (var i = 0; i < 64; i++) {
  if (i < sc && i < state.seeds.length) {
    positions.push([state.seeds[i].x, state.seeds[i].y]);
    colors.push(state.cachedColors[i] || [0.5,0.5,0.5]);
  } else { positions.push([-10,-10]); colors.push([0,0,0]); }
}
return { shaderConfig: {
  fragmentShader: inputs.fragmentShader,
  uniforms: {
    time: ctx.elapsed,
    seeds: positions,
    seedColors: colors,
    seedCount: sc,
    borderWidth: inputs.borderWidth,
    borderColor: [1,1,1],
    cellOpacity: inputs.cellOpacity,
    distortAmount: inputs.distortAmount,
    distortFreq: inputs.distortFreq,
    metric: Math.round(inputs.metric || 0),
    showSeeds: inputs.showSeeds > 0.5,
    seedSize: inputs.seedSize,
    pulseSpeed: inputs.pulseSpeed,
    invertColors: inputs.invertColors > 0.5,
    blendEdges: inputs.blendEdges,
    rotation: ctx.elapsed * inputs.rotationSpeed * 0.5,
  }
}};
`

const voronoiDef: CompoundGeneratorDef = {
  id: 'builtin_voronoi',
  name: 'Voronoi',
  description: 'Animated Voronoi tessellation with multiple distance metrics and motion types',
  defaultCameraDistance: 0,
  generatorType: 'voronoi_generator',
  outputMode: 'shader',
  params: voronoiParams,
  inputs: voronoiParams.map(p => ({
    name: p.name,
    type: 'number' as const,
    default: p.type === 'bool' ? (p.default ? 1 : 0) : (p.type === 'enum' ? 0 : (p.default as number)),
  })),
  outputs: [{ name: 'shaderConfig', type: 'array' as const }],
  evaluateSource: voronoiEvaluateSource,
  fragmentShader: voronoiFragShader,
}

// ═══════════════════════════════════════════════════════════════════════════
// WAVE INTERFERENCE
// ═══════════════════════════════════════════════════════════════════════════

const waveInterferenceFragShader = `precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform vec2 uSources[16];
uniform float uFrequencies[16];
uniform float uPhases[16];
uniform float uSourceCount;
uniform float uAmplitude;
uniform float uSpeed;
uniform float uDamping;
uniform float uWavelength;
uniform float uContrast;
uniform float uBrightness;
uniform float uRippleDecay;
uniform float uWaveType;
uniform float uDisplayMode;
uniform float uColorScheme;
uniform float uInterference;
uniform bool uBackgroundDark;

#define PI 3.14159265359
#define TAU 6.28318530718

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0,2.0/3.0,1.0/3.0,3.0);
  vec3 p = abs(fract(c.xxx+K.xyz)*6.0-K.www);
  return c.z*mix(K.xxx, clamp(p-K.xxx,0.0,1.0), c.y);
}
vec3 applyColorScheme(float val, float phase) {
  if (uColorScheme < 0.5) {
    float t = val*0.5+0.5;
    vec3 blue=vec3(0.1,0.2,0.8), white=vec3(1), red=vec3(0.8,0.1,0.1);
    return t<0.5 ? mix(blue,white,t*2.0) : mix(white,red,(t-0.5)*2.0);
  } else if (uColorScheme < 1.5) { return hsv2rgb(vec3(val*0.5+0.5, 0.85, 0.9)); }
  else if (uColorScheme < 2.5) {
    float t = val*0.5+0.5;
    vec3 cold=vec3(0,0,0.2), mid=vec3(0.8,0.2,0), hot=vec3(1,1,0.3);
    return t<0.5 ? mix(cold,mid,t*2.0) : mix(mid,hot,(t-0.5)*2.0);
  } else if (uColorScheme < 3.5) {
    float t = val*0.5+0.5;
    return t<0.5 ? mix(vec3(0,0,0.05),vec3(0,0.8,1),t*2.0) : mix(vec3(0,0.8,1),vec3(1),( t-0.5)*2.0);
  }
  return vec3(val*0.5+0.5);
}
void main() {
  vec2 uv = (vUv - 0.5) * 2.0;
  float k = TAU / uWavelength;
  float omega = uSpeed * k;
  float sumReal = 0.0, sumImag = 0.0;
  for (int i = 0; i < 16; i++) {
    if (float(i) >= uSourceCount) break;
    vec2 src = uSources[i]; float freq = uFrequencies[i]; float phi = uPhases[i];
    float localK = k*freq, localOmega = omega*freq;
    if (uWaveType < 0.5) {
      float r = distance(uv, src);
      float decay = uDamping>0.0 ? exp(-uDamping*r) : 1.0;
      float ripple = uRippleDecay>0.0 ? 1.0/(1.0+uRippleDecay*r) : 1.0;
      float env = decay*ripple;
      sumReal += uAmplitude*env*sin(localK*r-localOmega*uTime+phi);
      sumImag += uAmplitude*env*cos(localK*r-localOmega*uTime+phi);
    } else if (uWaveType < 1.5) {
      vec2 dir = length(src)>0.001 ? normalize(src) : vec2(1,0);
      float proj = dot(uv, dir);
      sumReal += uAmplitude*sin(localK*proj-localOmega*uTime+phi);
      sumImag += uAmplitude*cos(localK*proj-localOmega*uTime+phi);
    } else {
      float r = distance(uv, src);
      float angle = atan(uv.y-src.y, uv.x-src.x);
      float env = (uDamping>0.0?exp(-uDamping*r):1.0)*(uRippleDecay>0.0?1.0/(1.0+uRippleDecay*r):1.0);
      sumReal += uAmplitude*env*sin(localK*r+angle*3.0-localOmega*uTime+phi);
      sumImag += uAmplitude*env*cos(localK*r+angle*3.0-localOmega*uTime+phi);
    }
  }
  if (uInterference < 0.5) sumReal = max(sumReal, 0.0);
  else if (uInterference < 1.5) sumReal = min(sumReal, 0.0);
  float maxAmp = max(uAmplitude * uSourceCount, 0.001);
  float displayVal = 0.0, phaseVal = 0.0;
  if (uDisplayMode < 0.5) displayVal = sumReal/maxAmp;
  else if (uDisplayMode < 1.5) { displayVal = (sumReal*sumReal+sumImag*sumImag)/(maxAmp*maxAmp)*2.0-1.0; }
  else if (uDisplayMode < 2.5) { phaseVal = atan(sumImag,sumReal); displayVal = phaseVal/PI; }
  else displayVal = sumReal/maxAmp;
  displayVal = clamp(displayVal*uContrast, -1.0, 1.0);
  vec3 color = applyColorScheme(displayVal, phaseVal) * uBrightness;
  if (!uBackgroundDark) color = 1.0-(1.0-color)*0.8;
  gl_FragColor = vec4(color, 1.0);
}`

const waveInterferenceParams: ParamSchemaDef[] = [
  { name: 'sourceCount', type: 'int', min: 1, max: 16, default: 3, description: 'Source count' },
  { name: 'frequency', type: 'float', min: 0.1, max: 20, default: 5, description: 'Frequency' },
  { name: 'amplitude', type: 'float', min: 0.1, max: 5, default: 1, description: 'Amplitude' },
  { name: 'speed', type: 'float', min: 0, max: 5, default: 1, description: 'Speed' },
  { name: 'damping', type: 'float', min: 0, max: 2, default: 0, description: 'Damping' },
  { name: 'waveType', type: 'enum', default: 'circular', enumValues: ['circular', 'plane', 'spiral'], description: 'Wave type' },
  { name: 'displayMode', type: 'enum', default: 'amplitude', enumValues: ['amplitude', 'intensity', 'phase', 'realPart'], description: 'Display mode' },
  { name: 'colorScheme', type: 'enum', default: 'blueRed', enumValues: ['blueRed', 'rainbow', 'thermal', 'electric', 'monochrome'], description: 'Color scheme' },
  { name: 'sourceMotion', type: 'enum', default: 'orbit', enumValues: ['orbit', 'bounce', 'random', 'static'], description: 'Source motion' },
  { name: 'motionSpeed', type: 'float', min: 0, max: 3, default: 0.5, description: 'Motion speed' },
  { name: 'sourceSpacing', type: 'float', min: 0.05, max: 1, default: 0.3, description: 'Source spacing' },
  { name: 'phaseOffset', type: 'float', min: 0, max: 6.28, default: 0, description: 'Phase offset' },
  { name: 'wavelength', type: 'float', min: 0.01, max: 1, default: 0.1, description: 'Wavelength' },
  { name: 'contrast', type: 'float', min: 0.1, max: 5, default: 1.5, description: 'Contrast' },
  { name: 'brightness', type: 'float', min: 0.1, max: 3, default: 1, description: 'Brightness' },
  { name: 'backgroundDark', type: 'bool', default: true, description: 'Dark background' },
  { name: 'rippleDecay', type: 'float', min: 0, max: 3, default: 0.5, description: 'Ripple decay' },
  { name: 'interference', type: 'enum', default: 'both', enumValues: ['constructive', 'destructive', 'both'], description: 'Interference filter' },
]

const waveInterferenceEvaluateSource = `
var sc = Math.round(inputs.sourceCount);
var motIdx = Math.round(inputs.sourceMotion || 0);
var motTypes = ['orbit','bounce','random','static'];
var motType = motTypes[motIdx] || 'orbit';
var key = nodeId + '_sources';
var state = ctx.frameState.get(key);
if (!state) {
  state = { sources: [], velocities: [] };
  for (var i = 0; i < sc; i++) {
    var angle = (i / sc) * Math.PI * 2;
    state.sources.push([Math.cos(angle)*inputs.sourceSpacing, Math.sin(angle)*inputs.sourceSpacing]);
    state.velocities.push([(Math.random()-0.5)*0.5, (Math.random()-0.5)*0.5]);
  }
  ctx.frameState.set(key, state);
}
while (state.sources.length < sc) {
  var angle = (state.sources.length / sc) * Math.PI * 2;
  state.sources.push([Math.cos(angle)*inputs.sourceSpacing, Math.sin(angle)*inputs.sourceSpacing]);
  state.velocities.push([(Math.random()-0.5)*0.5, (Math.random()-0.5)*0.5]);
}
for (var i = 0; i < sc; i++) {
  if (motType === 'orbit') {
    var angle = (i / sc) * Math.PI * 2 + ctx.elapsed * inputs.motionSpeed;
    state.sources[i] = [Math.cos(angle)*inputs.sourceSpacing, Math.sin(angle)*inputs.sourceSpacing];
  } else if (motType === 'bounce') {
    var dt = 1/60;
    state.sources[i][0] += state.velocities[i][0]*inputs.motionSpeed*dt;
    state.sources[i][1] += state.velocities[i][1]*inputs.motionSpeed*dt;
    if (state.sources[i][0]<-0.9||state.sources[i][0]>0.9) state.velocities[i][0]*=-1;
    if (state.sources[i][1]<-0.9||state.sources[i][1]>0.9) state.velocities[i][1]*=-1;
  } else if (motType === 'random') {
    var drift = 0.002*inputs.motionSpeed;
    state.sources[i][0] += (Math.random()-0.5)*drift;
    state.sources[i][1] += (Math.random()-0.5)*drift;
    state.sources[i][0] = Math.max(-1,Math.min(1,state.sources[i][0]));
    state.sources[i][1] = Math.max(-1,Math.min(1,state.sources[i][1]));
  }
}
var positions = []; var frequencies = []; var phases = [];
for (var i = 0; i < 16; i++) {
  if (i < sc) { positions.push(state.sources[i]); frequencies.push(inputs.frequency); phases.push(inputs.phaseOffset * i); }
  else { positions.push([-10,-10]); frequencies.push(1); phases.push(0); }
}
return { shaderConfig: {
  fragmentShader: inputs.fragmentShader,
  uniforms: {
    uTime: ctx.elapsed,
    uSources: positions,
    uFrequencies: frequencies,
    uPhases: phases,
    uSourceCount: sc,
    uAmplitude: inputs.amplitude,
    uSpeed: inputs.speed,
    uDamping: inputs.damping,
    uWavelength: inputs.wavelength,
    uContrast: inputs.contrast,
    uBrightness: inputs.brightness,
    uRippleDecay: inputs.rippleDecay,
    uWaveType: Math.round(inputs.waveType || 0),
    uDisplayMode: Math.round(inputs.displayMode || 0),
    uColorScheme: Math.round(inputs.colorScheme || 0),
    uInterference: Math.round(inputs.interference || 0),
    uBackgroundDark: inputs.backgroundDark > 0.5,
  }
}};
`

const waveInterferenceDef: CompoundGeneratorDef = {
  id: 'builtin_waveInterference',
  name: 'Wave Interference',
  description: 'Multiple wave source interference patterns with various wave types and display modes',
  defaultCameraDistance: 0,
  generatorType: 'waveInterference_generator',
  outputMode: 'shader',
  params: waveInterferenceParams,
  inputs: waveInterferenceParams.map(p => ({
    name: p.name,
    type: 'number' as const,
    default: p.type === 'bool' ? (p.default ? 1 : 0) : (p.type === 'enum' ? 0 : (p.default as number)),
  })),
  outputs: [{ name: 'shaderConfig', type: 'array' as const }],
  evaluateSource: waveInterferenceEvaluateSource,
  fragmentShader: waveInterferenceFragShader,
}

// ═══════════════════════════════════════════════════════════════════════════
// REACTION DIFFUSION (multi-pass)
// ═══════════════════════════════════════════════════════════════════════════

const rdSimFragShader = `precision highp float;
uniform sampler2D stateTex;
uniform float feed;
uniform float kill;
uniform float dA;
uniform float dB;
uniform float dt;
uniform vec2 resolution;
varying vec2 vUv;
void main() {
  vec2 texel = 1.0 / resolution;
  vec4 state = texture2D(stateTex, vUv);
  float a = state.r, b = state.g;
  float lapA = 0.0, lapB = 0.0;
  lapA += texture2D(stateTex, vUv+vec2(-texel.x,0)).r*0.2;
  lapA += texture2D(stateTex, vUv+vec2(texel.x,0)).r*0.2;
  lapA += texture2D(stateTex, vUv+vec2(0,-texel.y)).r*0.2;
  lapA += texture2D(stateTex, vUv+vec2(0,texel.y)).r*0.2;
  lapA += texture2D(stateTex, vUv+vec2(-texel.x,-texel.y)).r*0.05;
  lapA += texture2D(stateTex, vUv+vec2(texel.x,-texel.y)).r*0.05;
  lapA += texture2D(stateTex, vUv+vec2(-texel.x,texel.y)).r*0.05;
  lapA += texture2D(stateTex, vUv+vec2(texel.x,texel.y)).r*0.05;
  lapA -= a;
  lapB += texture2D(stateTex, vUv+vec2(-texel.x,0)).g*0.2;
  lapB += texture2D(stateTex, vUv+vec2(texel.x,0)).g*0.2;
  lapB += texture2D(stateTex, vUv+vec2(0,-texel.y)).g*0.2;
  lapB += texture2D(stateTex, vUv+vec2(0,texel.y)).g*0.2;
  lapB += texture2D(stateTex, vUv+vec2(-texel.x,-texel.y)).g*0.05;
  lapB += texture2D(stateTex, vUv+vec2(texel.x,-texel.y)).g*0.05;
  lapB += texture2D(stateTex, vUv+vec2(-texel.x,texel.y)).g*0.05;
  lapB += texture2D(stateTex, vUv+vec2(texel.x,texel.y)).g*0.05;
  lapB -= b;
  float abb = a*b*b;
  float newA = a + (dA*lapA - abb + feed*(1.0-a))*dt;
  float newB = b + (dB*lapB + abb - (kill+feed)*b)*dt;
  gl_FragColor = vec4(clamp(newA,0.0,1.0), clamp(newB,0.0,1.0), 0.0, 1.0);
}`

const rdDisplayFragShader = `precision highp float;
uniform sampler2D stateTex;
uniform float colorPalette;
varying vec2 vUv;
vec3 palette(float t, float pal) {
  t = clamp(t, 0.0, 1.0);
  if (pal < 0.5) { // ocean
    vec3 c0=vec3(0.01,0.01,0.05), c1=vec3(0.1,0.2,0.6), c2=vec3(0.2,0.8,0.9), c3=vec3(1.0,0.95,0.8);
    if (t<0.33) return mix(c0,c1,t*3.0); if (t<0.66) return mix(c1,c2,(t-0.33)*3.0);
    return mix(c2,c3,(t-0.66)*3.0);
  }
  if (pal < 1.5) { // fire
    vec3 c0=vec3(0.02,0.0,0.0), c1=vec3(0.5,0.05,0.0), c2=vec3(1.0,0.4,0.0), c3=vec3(1.0,0.95,0.5);
    if (t<0.33) return mix(c0,c1,t*3.0); if (t<0.66) return mix(c1,c2,(t-0.33)*3.0);
    return mix(c2,c3,(t-0.66)*3.0);
  }
  if (pal < 2.5) { // neon
    vec3 c0=vec3(0.0,0.0,0.05), c1=vec3(0.8,0.0,0.8), c2=vec3(0.0,1.0,0.8), c3=vec3(1.0,1.0,0.2);
    if (t<0.33) return mix(c0,c1,t*3.0); if (t<0.66) return mix(c1,c2,(t-0.33)*3.0);
    return mix(c2,c3,(t-0.66)*3.0);
  }
  if (pal < 3.5) { // earth
    vec3 c0=vec3(0.05,0.03,0.01), c1=vec3(0.3,0.2,0.05), c2=vec3(0.2,0.5,0.1), c3=vec3(0.9,0.85,0.6);
    if (t<0.33) return mix(c0,c1,t*3.0); if (t<0.66) return mix(c1,c2,(t-0.33)*3.0);
    return mix(c2,c3,(t-0.66)*3.0);
  }
  if (pal < 4.5) { // candy
    vec3 c0=vec3(0.1,0.0,0.15), c1=vec3(0.9,0.2,0.5), c2=vec3(0.5,0.8,1.0), c3=vec3(1.0,0.9,0.95);
    if (t<0.33) return mix(c0,c1,t*3.0); if (t<0.66) return mix(c1,c2,(t-0.33)*3.0);
    return mix(c2,c3,(t-0.66)*3.0);
  }
  // monochrome
  return vec3(t);
}
void main() {
  vec4 state = texture2D(stateTex, vUv);
  float a = state.r, b = state.g;
  float t = clamp(b * 3.0, 0.0, 1.0);
  vec3 col = palette(t, colorPalette);
  col *= 0.8 + 0.2 * (a - b);
  gl_FragColor = vec4(col, 1.0);
}`

const reactionDiffusionParams: ParamSchemaDef[] = [
  { name: 'preset', type: 'enum', default: 'mitosis', enumValues: ['mitosis', 'coral', 'maze', 'spots', 'worms', 'bubbles', 'solitons', 'pulsing', 'ripples', 'fingerprint'], description: 'Pattern preset' },
  { name: 'seedPattern', type: 'enum', default: 'multi', enumValues: ['center', 'multi', 'ring', 'random'], description: 'Seed pattern' },
  { name: 'diffusionRatio', type: 'float', min: 0.45, max: 0.55, default: 0.5, description: 'Diffusion ratio (B/A)' },
  { name: 'timeScale', type: 'float', min: 0.8, max: 1.2, default: 1.0, description: 'Simulation speed' },
  { name: 'colorPalette', type: 'enum', default: 'ocean', enumValues: ['ocean', 'fire', 'neon', 'earth', 'candy', 'monochrome'], description: 'Color palette' },
  { name: 'stepsPerFrame', type: 'int', min: 1, max: 16, default: 8, description: 'Steps per frame' },
  { name: 'resolution', type: 'int', min: 64, max: 512, default: 256, description: 'Resolution' },
]

const reactionDiffusionEvaluateSource = `
var res = Math.min(512, Math.round(inputs.resolution));
var presetIdx = Math.round(inputs.preset || 0);
var presets = [
  { feed: 0.0367, kill: 0.0649, dA: 1.0, dB: 0.5, dt: 1.0 },
  { feed: 0.0545, kill: 0.062,  dA: 1.0, dB: 0.5, dt: 1.0 },
  { feed: 0.029,  kill: 0.057,  dA: 1.0, dB: 0.5, dt: 1.0 },
  { feed: 0.035,  kill: 0.065,  dA: 1.0, dB: 0.5, dt: 1.0 },
  { feed: 0.078,  kill: 0.061,  dA: 1.0, dB: 0.5, dt: 1.0 },
  { feed: 0.012,  kill: 0.047,  dA: 1.0, dB: 0.5, dt: 1.0 },
  { feed: 0.03,   kill: 0.06,   dA: 1.0, dB: 0.5, dt: 1.0 },
  { feed: 0.025,  kill: 0.06,   dA: 1.0, dB: 0.5, dt: 1.0 },
  { feed: 0.018,  kill: 0.051,  dA: 1.0, dB: 0.5, dt: 1.0 },
  { feed: 0.055,  kill: 0.062,  dA: 1.0, dB: 0.5, dt: 1.0 },
];
var p = presets[presetIdx] || presets[0];
var feed = p.feed, kill = p.kill;
var diffRatio = inputs.diffusionRatio || 0.5;
var dA = 1.0, dB = diffRatio;
var dt = inputs.timeScale || 1.0;
var seedP = Math.round(inputs.seedPattern || 0);
var key = nodeId + '_rd';
var state = ctx.frameState.get(key);
var paramsKey = res + '_' + seedP + '_' + presetIdx;
if (!state || state.paramsKey !== paramsKey) {
  var data2 = new Float32Array(res * res * 4);
  for (var i = 0; i < res * res; i++) {
    data2[i*4] = 1.0; data2[i*4+1] = 0.0; data2[i*4+2] = 0.0; data2[i*4+3] = 1.0;
  }
  var seedR = Math.max(2, Math.floor(res * 0.03));
  var seedSpot = function(scx, scy) {
    for (var dy2 = -seedR; dy2 <= seedR; dy2++) {
      for (var dx2 = -seedR; dx2 <= seedR; dx2++) {
        if (dx2*dx2+dy2*dy2 <= seedR*seedR) {
          var px2 = scx+dx2, py2 = scy+dy2;
          if (px2>=0&&px2<res&&py2>=0&&py2<res) { data2[(py2*res+px2)*4+1] = 1.0; }
        }
      }
    }
  };
  if (seedP === 0) {
    seedSpot(Math.floor(res/2), Math.floor(res/2));
  } else if (seedP === 1) {
    var spots = [[0.25,0.25],[0.75,0.25],[0.5,0.5],[0.25,0.75],[0.75,0.75],[0.5,0.2],[0.5,0.8],[0.2,0.5],[0.8,0.5]];
    for (var si = 0; si < spots.length; si++) { seedSpot(Math.floor(spots[si][0]*res), Math.floor(spots[si][1]*res)); }
  } else if (seedP === 2) {
    var ringR2 = res * 0.25;
    for (var a2 = 0; a2 < 60; a2++) {
      var angle2 = a2 / 60 * Math.PI * 2;
      seedSpot(Math.floor(res/2 + Math.cos(angle2)*ringR2), Math.floor(res/2 + Math.sin(angle2)*ringR2));
    }
  } else {
    var rng = (function(s){return function(){s=(s*1103515245+12345)&0x7fffffff;return s/0x7fffffff;}})(presetIdx*7919+seedP*131+res);
    var numSeeds = 12 + Math.floor(rng() * 15);
    for (var si2 = 0; si2 < numSeeds; si2++) { seedSpot(Math.floor(rng()*res*0.8+res*0.1), Math.floor(rng()*res*0.8+res*0.1)); }
  }
  state = { initData: data2, res: res, paramsKey: paramsKey };
  ctx.frameState.set(key, state);
}
var result = {
  passes: [
    { name: 'sim', fragmentShader: inputs.simShader, target: 'state',
      readFrom: { stateTex: 'state' },
      uniforms: { feed: feed, kill: kill, dA: dA, dB: dB, dt: dt, resolution: [res, res] } },
    { name: 'display', fragmentShader: inputs.displayShader, target: null,
      readFrom: { stateTex: 'state' }, uniforms: { colorPalette: Math.round(inputs.colorPalette || 0) } },
  ],
  renderTargetDefs: { state: { width: res, height: res, type: 'float', filter: 'linear', wrap: 'repeat', pingPong: true } },
  stepsPerFrame: Math.min(16, Math.round(inputs.stepsPerFrame)),
  initData: { state: state.initData },
};
return { shaderConfig: result };
`

const reactionDiffusionDef: CompoundGeneratorDef = {
  id: 'builtin_reactionDiffusion',
  name: 'Reaction Diffusion',
  description: 'Gray-Scott reaction-diffusion system with tunable feed/kill rates',
  defaultCameraDistance: 0,
  generatorType: 'reactionDiffusion_generator',
  outputMode: 'shader',
  params: reactionDiffusionParams,
  inputs: reactionDiffusionParams.map(p => ({
    name: p.name,
    type: 'number' as const,
    default: p.type === 'enum' ? 0 : (p.default as number),
  })),
  outputs: [{ name: 'shaderConfig', type: 'array' as const }],
  evaluateSource: reactionDiffusionEvaluateSource,
  shaderSources: { sim: rdSimFragShader, display: rdDisplayFragShader },
  renderTargetDefs: { state: { width: 256, height: 256, type: 'float', filter: 'linear', wrap: 'repeat', pingPong: true } },
}

// ═══════════════════════════════════════════════════════════════════════════
// CELLULAR AUTOMATA (multi-pass)
// ═══════════════════════════════════════════════════════════════════════════

const caSimFragShader = `precision highp float;
uniform sampler2D stateTex;
uniform vec2 resolution;
uniform float ruleSet;
uniform bool wrap;
uniform bool invertRules;
uniform float ageColorSpeed;
varying vec2 vUv;
vec4 getCell(vec2 uv) {
  if (wrap) return texture2D(stateTex, fract(uv));
  if (uv.x<0.0||uv.x>1.0||uv.y<0.0||uv.y>1.0) return vec4(0.0);
  return texture2D(stateTex, uv);
}
bool isAlive(float s) { return s > 0.9; }
bool isDying(float s) { return s > 0.4 && s < 0.6; }
bool isConductor(float s) { return s > 0.7 && s < 0.8; }
void main() {
  vec2 texel = 1.0/resolution;
  vec4 current = texture2D(stateTex, vUv);
  float state = current.r, age = current.g;
  int liveNeighbors = 0;
  for (int dy=-1; dy<=1; dy++) {
    for (int dx=-1; dx<=1; dx++) {
      if (dx==0&&dy==0) continue;
      if (isAlive(getCell(vUv+vec2(float(dx),float(dy))*texel).r)) liveNeighbors++;
    }
  }
  float newState = 0.0, newAge = 0.0;
  if (ruleSet < 0.5) {
    bool alive = isAlive(state);
    bool born = (!alive && liveNeighbors == 3);
    bool survive = (alive && (liveNeighbors==2||liveNeighbors==3));
    if (invertRules) { born = (!alive && liveNeighbors!=3); survive = (alive && !(liveNeighbors==2||liveNeighbors==3)); }
    if (born||survive) { newState = 1.0; newAge = alive ? age+ageColorSpeed : 0.0; }
  } else if (ruleSet < 1.5) {
    if (isAlive(state)) { newState = 0.5; }
    else if (isDying(state)) { newState = 0.0; }
    else { bool born = (liveNeighbors==2); if (invertRules) born = (liveNeighbors!=2); if (born) newState = 1.0; }
  } else if (ruleSet < 2.5) {
    if (isAlive(state)) { newState = 0.5; }
    else if (isDying(state)) { newState = 0.75; }
    else if (isConductor(state)) {
      int heads = 0;
      for (int dy=-1; dy<=1; dy++) for (int dx=-1; dx<=1; dx++) {
        if (dx==0&&dy==0) continue;
        if (isAlive(getCell(vUv+vec2(float(dx),float(dy))*texel).r)) heads++;
      }
      newState = (heads==1||heads==2) ? 1.0 : 0.75;
    }
  } else if (ruleSet < 3.5) {
    bool alive = isAlive(state);
    bool born = (!alive && (liveNeighbors==3||liveNeighbors==6));
    bool survive = (alive && (liveNeighbors==2||liveNeighbors==3));
    if (born||survive) { newState = 1.0; newAge = alive ? age+ageColorSpeed : 0.0; }
  } else if (ruleSet < 4.5) {
    bool alive = isAlive(state);
    bool born = (!alive && (liveNeighbors==3||liveNeighbors==6||liveNeighbors==7||liveNeighbors==8));
    bool survive = (alive && (liveNeighbors==3||liveNeighbors==4||liveNeighbors==6||liveNeighbors==7||liveNeighbors==8));
    if (born||survive) { newState = 1.0; newAge = alive ? age+ageColorSpeed : 0.0; }
  } else {
    if (isAlive(state)) { newState = 0.0; }
    else { bool born = (liveNeighbors==2); if (born) newState = 1.0; }
  }
  gl_FragColor = vec4(newState, newAge, 0.0, 1.0);
}`

const caDisplayFragShader = `precision highp float;
uniform sampler2D stateTex;
uniform float ruleSet;
uniform bool colorByAge;
uniform bool showGrid;
uniform vec2 resolution;
uniform float zoom;
varying vec2 vUv;
vec3 hueShift(vec3 color, float shift) {
  float angle = shift*6.28318; float s = sin(angle), c = cos(angle);
  vec3 k = vec3(0.57735);
  return color*c + cross(k,color)*s + k*dot(k,color)*(1.0-c);
}
void main() {
  vec2 uv = (vUv-0.5)/zoom+0.5;
  if (uv.x<0.0||uv.x>1.0||uv.y<0.0||uv.y>1.0) { gl_FragColor = vec4(0.02,0.02,0.06,1); return; }
  vec4 cell = texture2D(stateTex, uv);
  float state = cell.r, age = cell.g;
  vec3 col = vec3(0.02,0.02,0.06);
  vec3 aliveCol = vec3(0.0,1.0,0.53);
  vec3 dyingCol = vec3(1.0,0.27,0.27);
  vec3 wireCol = vec3(1.0,0.67,0.0);
  if (ruleSet > 1.5 && ruleSet < 2.5) {
    if (state>0.9) col = aliveCol;
    else if (state>0.4&&state<0.6) col = dyingCol;
    else if (state>0.7&&state<0.8) col = wireCol;
  } else if (ruleSet > 0.5 && ruleSet < 1.5) {
    if (state>0.9) col = aliveCol;
    else if (state>0.4&&state<0.6) col = dyingCol;
  } else {
    if (state>0.9) { col = aliveCol; if (colorByAge) col = hueShift(aliveCol, fract(age*0.02)); }
  }
  if (showGrid) {
    vec2 gridPos = uv*resolution;
    vec2 gridLine = abs(fract(gridPos)-0.5);
    float line = 1.0-smoothstep(0.0,0.05,min(gridLine.x,gridLine.y));
    col = mix(col, vec3(0.15), line*0.4);
  }
  gl_FragColor = vec4(col, 1.0);
}`

const cellularAutomataParams: ParamSchemaDef[] = [
  { name: 'ruleSet', type: 'enum', default: 'life', enumValues: ['life', 'briansBrain', 'wireworld', 'highLife', 'dayNight', 'seeds'], description: 'Rule set' },
  { name: 'gridSize', type: 'int', min: 64, max: 1024, default: 512, description: 'Grid size' },
  { name: 'fillDensity', type: 'float', min: 0, max: 1, default: 0.3, description: 'Fill density' },
  { name: 'stepsPerFrame', type: 'int', min: 1, max: 16, default: 1, description: 'Steps per frame' },
  { name: 'zoom', type: 'float', min: 0.1, max: 5, default: 1, description: 'Zoom' },
  { name: 'wrap', type: 'bool', default: true, description: 'Wrap edges' },
  { name: 'colorByAge', type: 'bool', default: false, description: 'Color by age' },
  { name: 'ageColorSpeed', type: 'float', min: 0, max: 1, default: 0.1, description: 'Age color speed' },
  { name: 'showGrid', type: 'bool', default: false, description: 'Show grid' },
  { name: 'invertRules', type: 'bool', default: false, description: 'Invert rules' },
]

const cellularAutomataEvaluateSource = `
var gs = Math.min(1024, Math.max(64, Math.round(inputs.gridSize)));
var density = inputs.fillDensity;
var key = nodeId + '_ca';
var state = ctx.frameState.get(key);
if (!state || state.gs !== gs || state.density !== density) {
  var data2 = new Float32Array(gs * gs * 4);
  for (var i = 0; i < gs * gs; i++) {
    var alive = Math.random() < density;
    data2[i*4] = alive ? 1.0 : 0.0;
    data2[i*4+1] = 0.0; data2[i*4+2] = 0.0; data2[i*4+3] = 1.0;
  }
  state = { initData: data2, gs: gs, density: density, gen: (state ? state.gen + 1 : 0) };
  ctx.frameState.set(key, state);
}
var result = {
  passes: [
    { name: 'sim', fragmentShader: inputs.simShader, target: 'state',
      readFrom: { stateTex: 'state' },
      uniforms: { resolution: [gs, gs], ruleSet: Math.round(inputs.ruleSet || 0), wrap: inputs.wrap > 0.5, invertRules: inputs.invertRules > 0.5, ageColorSpeed: inputs.ageColorSpeed } },
    { name: 'display', fragmentShader: inputs.displayShader, target: null,
      readFrom: { stateTex: 'state' },
      uniforms: { ruleSet: Math.round(inputs.ruleSet || 0), colorByAge: inputs.colorByAge > 0.5, showGrid: inputs.showGrid > 0.5, resolution: [gs, gs], zoom: inputs.zoom } },
  ],
  renderTargetDefs: { state: { width: gs, height: gs, type: 'float', filter: 'nearest', wrap: 'repeat', pingPong: true, _gen: state.gen } },
  stepsPerFrame: Math.min(16, Math.round(inputs.stepsPerFrame)),
  initData: { state: state.initData },
};
return { shaderConfig: result };
`

const cellularAutomataDef: CompoundGeneratorDef = {
  id: 'builtin_cellularAutomata',
  name: 'Cellular Automata',
  description: 'GPU cellular automata: Game of Life, Brian\'s Brain, Wireworld and more',
  defaultCameraDistance: 0,
  generatorType: 'cellularAutomata_generator',
  outputMode: 'shader',
  params: cellularAutomataParams,
  inputs: cellularAutomataParams.map(p => ({
    name: p.name,
    type: 'number' as const,
    default: p.type === 'bool' ? (p.default ? 1 : 0) : (p.type === 'enum' ? 0 : (p.default as number)),
  })),
  outputs: [{ name: 'shaderConfig', type: 'array' as const }],
  evaluateSource: cellularAutomataEvaluateSource,
  shaderSources: { sim: caSimFragShader, display: caDisplayFragShader },
  renderTargetDefs: { state: { width: 512, height: 512, type: 'float', filter: 'nearest', wrap: 'repeat', pingPong: true } },
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════════

export const SHADER_GENERATORS: CompoundGeneratorDef[] = [
  fractalDef,
  domainWarpingDef,
  truchetDef,
  magneticPendulumDef,
  electricFieldDef,
  voronoiDef,
  waveInterferenceDef,
  reactionDiffusionDef,
  cellularAutomataDef,
]
