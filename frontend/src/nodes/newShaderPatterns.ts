import type { CompoundGeneratorDef } from './generatorGraphFactory'
import type { ParamSchemaDef } from './storage'

// ═══════════════════════════════════════════════════════════════════════════
// SLIME MOLD (multi-species physarum variant based on fogleman/physarum)
// ═══════════════════════════════════════════════════════════════════════════

const slimeMoldAgentFrag = `precision highp float;
uniform sampler2D agentTex;
uniform sampler2D trailTex;
uniform float sensorAngle;
uniform float sensorDist;
uniform float turnSpeed;
uniform float moveSpeed;
uniform vec2 resolution;
uniform float time;
uniform float randomStrength;
uniform float speciesCount;
uniform float selfAttract;
uniform float otherRepel;
varying vec2 vUv;

float rand(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

float senseTrail(vec2 pos, float species) {
  vec4 trail = texture2D(trailTex, fract(pos));
  float sc = floor(speciesCount + 0.5);
  float myVal = 0.0;
  float otherVal = 0.0;
  if (species < 0.5) { myVal = trail.r; otherVal = trail.g + trail.b; }
  else if (species < 1.5) { myVal = trail.g; otherVal = trail.r + trail.b; }
  else { myVal = trail.b; otherVal = trail.r + trail.g; }
  return myVal * selfAttract - otherVal * otherRepel / max(sc - 1.0, 1.0);
}

void main() {
  vec4 agent = texture2D(agentTex, vUv);
  vec2 pos = agent.xy;
  float angle = agent.z;
  float species = floor(agent.w + 0.5);

  float sa = sensorAngle * 3.14159 / 180.0;
  float sd = sensorDist / resolution.x;

  vec2 frontPos = pos + vec2(cos(angle), sin(angle)) * sd;
  vec2 leftPos = pos + vec2(cos(angle + sa), sin(angle + sa)) * sd;
  vec2 rightPos = pos + vec2(cos(angle - sa), sin(angle - sa)) * sd;

  float frontVal = senseTrail(frontPos, species);
  float leftVal = senseTrail(leftPos, species);
  float rightVal = senseTrail(rightPos, species);

  float ts = turnSpeed * 3.14159 / 180.0;
  float rnd = rand(pos + vec2(time * 0.137, time * 0.071));
  float rnd2 = rand(pos.yx + vec2(time * 0.093, time * 0.119));

  if (frontVal > leftVal && frontVal > rightVal) {
    angle += (rnd - 0.5) * ts * randomStrength * 0.1;
  } else if (frontVal < leftVal && frontVal < rightVal) {
    angle += (rnd > 0.5 ? 1.0 : -1.0) * ts;
  } else if (rightVal > leftVal) {
    angle -= ts;
  } else if (leftVal > rightVal) {
    angle += ts;
  } else {
    angle += (rnd - 0.5) * ts * 0.5;
  }

  angle += (rnd2 - 0.5) * randomStrength * 0.05;

  float ms = moveSpeed / resolution.x;
  pos += vec2(cos(angle), sin(angle)) * ms;
  pos = fract(pos);

  gl_FragColor = vec4(pos, angle, species);
}
`

const slimeMoldDiffuseFrag = `precision highp float;
uniform sampler2D trailTex;
uniform float decayRate;
uniform float diffuseSpeed;
uniform vec2 resolution;
varying vec2 vUv;

void main() {
  vec2 texel = 1.0 / resolution;
  vec4 center = texture2D(trailTex, vUv);
  vec4 sum = center * 4.0;
  sum += texture2D(trailTex, vUv + vec2(-1.0, 0.0) * texel);
  sum += texture2D(trailTex, vUv + vec2(1.0, 0.0) * texel);
  sum += texture2D(trailTex, vUv + vec2(0.0, -1.0) * texel);
  sum += texture2D(trailTex, vUv + vec2(0.0, 1.0) * texel);
  sum += texture2D(trailTex, vUv + vec2(-1.0, -1.0) * texel) * 0.5;
  sum += texture2D(trailTex, vUv + vec2(1.0, -1.0) * texel) * 0.5;
  sum += texture2D(trailTex, vUv + vec2(-1.0, 1.0) * texel) * 0.5;
  sum += texture2D(trailTex, vUv + vec2(1.0, 1.0) * texel) * 0.5;
  vec4 diffused = sum / 10.0;
  vec4 blended = mix(center, diffused, diffuseSpeed);
  vec4 decayed = blended * (1.0 - decayRate);
  gl_FragColor = min(decayed, vec4(1.0));
}
`

const slimeMoldDepositVert = `attribute vec2 agentUV;
uniform sampler2D agentTex;
uniform float depositAmount;
varying float vDeposit;
varying float vSpecies;
void main() {
  vec4 agent = texture2D(agentTex, agentUV);
  vec2 pos = agent.xy;
  vSpecies = agent.w;
  gl_Position = vec4(pos * 2.0 - 1.0, 0.0, 1.0);
  gl_PointSize = 1.0;
  vDeposit = depositAmount;
}
`

const slimeMoldDepositFrag = `precision highp float;
varying float vDeposit;
varying float vSpecies;
void main() {
  float d = vDeposit * 0.05;
  float s = floor(vSpecies + 0.5);
  float r = s < 0.5 ? d : 0.0;
  float g = (s > 0.5 && s < 1.5) ? d : 0.0;
  float b = s > 1.5 ? d : 0.0;
  gl_FragColor = vec4(r, g, b, 1.0);
}
`

const slimeMoldDisplayFrag = `precision highp float;
uniform sampler2D trailTex;
uniform vec3 color1;
uniform vec3 color2;
uniform vec3 color3;
uniform float contrast;
uniform float brightness;
uniform float speciesCount;
uniform float edgeGlow;
uniform vec2 resolution;
varying vec2 vUv;

void main() {
  vec4 trail = texture2D(trailTex, vUv);
  vec2 texel = 1.0 / resolution;

  float dx = length(texture2D(trailTex, vUv + vec2(texel.x, 0.0)).rgb -
                    texture2D(trailTex, vUv - vec2(texel.x, 0.0)).rgb);
  float dy = length(texture2D(trailTex, vUv + vec2(0.0, texel.y)).rgb -
                    texture2D(trailTex, vUv - vec2(0.0, texel.y)).rgb);
  float gradMag = length(vec2(dx, dy));

  float sc = floor(speciesCount + 0.5);
  vec3 col = vec3(0.01, 0.01, 0.02);

  // Layer each species with its color
  float r = trail.r, g = trail.g, b = trail.b;
  float t1 = smoothstep(0.005, 0.15, r);
  float h1 = smoothstep(0.1, 0.5, r);
  col = mix(col, color1 * 0.4, t1 * 0.6);
  col = mix(col, color1 * brightness, t1);
  col += vec3(0.8, 0.9, 1.0) * h1 * 0.3;

  if (sc > 1.5) {
    float t2 = smoothstep(0.005, 0.15, g);
    float h2 = smoothstep(0.1, 0.5, g);
    col = mix(col, color2 * 0.4, t2 * 0.6);
    col += color2 * brightness * t2;
    col += vec3(0.8, 0.9, 1.0) * h2 * 0.3;
  }
  if (sc > 2.5) {
    float t3 = smoothstep(0.005, 0.15, b);
    float h3 = smoothstep(0.1, 0.5, b);
    col = mix(col, color3 * 0.4, t3 * 0.6);
    col += color3 * brightness * t3;
    col += vec3(0.8, 0.9, 1.0) * h3 * 0.3;
  }

  // Edge glow
  col += vec3(1.0) * gradMag * 3.0 * edgeGlow * 0.2;

  col = pow(max(col, vec3(0.0)), vec3(1.0 / max(contrast, 0.1)));

  gl_FragColor = vec4(col, 1.0);
}
`

const slimeMoldParams: ParamSchemaDef[] = [
  { name: 'speciesCount', type: 'enum', default: '2', enumValues: ['1', '2', '3'], description: 'Number of species' },
  { name: 'agentCount', type: 'int', min: 5000, max: 262144, default: 100000, description: 'Agent count' },
  { name: 'sensorAngle', type: 'float', min: 5, max: 90, default: 30, description: 'Sensor angle (deg)' },
  { name: 'sensorDistance', type: 'float', min: 2, max: 50, default: 20, description: 'Sensor distance' },
  { name: 'turnSpeed', type: 'float', min: 5, max: 120, default: 45, description: 'Turn speed (deg)' },
  { name: 'moveSpeed', type: 'float', min: 0.2, max: 5, default: 1.5, description: 'Move speed' },
  { name: 'decayRate', type: 'float', min: 0.005, max: 0.1, default: 0.02, description: 'Decay rate' },
  { name: 'depositAmount', type: 'float', min: 0.5, max: 20, default: 5, description: 'Deposit amount' },
  { name: 'diffuseSpeed', type: 'float', min: 0, max: 1, default: 0.5, description: 'Diffuse speed' },
  { name: 'selfAttract', type: 'float', min: 0.2, max: 2, default: 1, description: 'Self attraction' },
  { name: 'otherRepel', type: 'float', min: 0, max: 2, default: 0.8, description: 'Other species repulsion' },
  { name: 'randomStrength', type: 'float', min: 0, max: 2, default: 0.5, description: 'Random jitter' },
  { name: 'stepsPerFrame', type: 'int', min: 1, max: 8, default: 4, description: 'Steps per frame' },
  { name: 'simResolution', type: 'int', min: 256, max: 1024, default: 512, description: 'Sim resolution' },
  { name: 'spawnPattern', type: 'enum', default: 'ring', enumValues: ['center', 'ring', 'random', 'clusters'], description: 'Spawn pattern' },
  { name: 'colorHue1', type: 'float', min: 0, max: 360, default: 120, description: 'Species 1 hue' },
  { name: 'colorHue2', type: 'float', min: 0, max: 360, default: 280, description: 'Species 2 hue' },
  { name: 'colorHue3', type: 'float', min: 0, max: 360, default: 30, description: 'Species 3 hue' },
  { name: 'contrast', type: 'float', min: 0.5, max: 3, default: 1.5, description: 'Contrast' },
  { name: 'brightness', type: 'float', min: 0.5, max: 3, default: 1.2, description: 'Brightness' },
  { name: 'edgeGlow', type: 'float', min: 0, max: 3, default: 1, description: 'Edge glow' },
]

const slimeMoldEvaluateSource = `
var agentCount = Math.min(262144, Math.max(5000, Math.round(inputs.agentCount)));
var agentSide = Math.min(512, Math.ceil(Math.sqrt(agentCount)));
var simRes = Math.min(1024, Math.max(256, Math.round(inputs.simResolution)));
var speciesCount = Math.round(inputs.speciesCount) + 1;
var spawnIdx = Math.round(inputs.spawnPattern || 0);

var key = nodeId + '_slime';
var state = ctx.frameState.get(key);
if (!state || state.agentSide !== agentSide || state.spawnIdx !== spawnIdx || state.speciesCount !== speciesCount) {
  var agentData = new Float32Array(agentSide * agentSide * 4);
  var rng = (function(s){return function(){s=(s*1103515245+12345)&0x7fffffff;return s/0x7fffffff;}})(42);
  for (var i = 0; i < agentSide * agentSide; i++) {
    var species = i % speciesCount;
    var px, py, angle;
    if (spawnIdx === 0) {
      var r2 = rng() * 0.15;
      var a2 = rng() * Math.PI * 2;
      px = 0.5 + Math.cos(a2) * r2;
      py = 0.5 + Math.sin(a2) * r2;
      angle = a2 + Math.PI;
    } else if (spawnIdx === 1) {
      var ringR = 0.2 + species * 0.1;
      var a2 = rng() * Math.PI * 2;
      px = 0.5 + Math.cos(a2) * ringR + (rng() - 0.5) * 0.02;
      py = 0.5 + Math.sin(a2) * ringR + (rng() - 0.5) * 0.02;
      angle = a2 + Math.PI + (rng() - 0.5) * 0.5;
    } else if (spawnIdx === 2) {
      px = rng(); py = rng();
      angle = rng() * Math.PI * 2;
    } else {
      var clusters = [[0.3,0.3],[0.7,0.3],[0.5,0.7],[0.3,0.7],[0.7,0.7]];
      var ci = species % clusters.length;
      px = clusters[ci][0] + (rng() - 0.5) * 0.15;
      py = clusters[ci][1] + (rng() - 0.5) * 0.15;
      angle = rng() * Math.PI * 2;
    }
    agentData[i*4] = px;
    agentData[i*4+1] = py;
    agentData[i*4+2] = angle;
    agentData[i*4+3] = species;
  }
  state = { agentSide: agentSide, agentData: agentData, spawnIdx: spawnIdx, speciesCount: speciesCount, gen: (state ? state.gen + 1 : 0) };
  ctx.frameState.set(key, state);
}

function hsvToRgb(h,s,v){h=((h%360)+360)%360/360;var i=Math.floor(h*6),f=h*6-i,p=v*(1-s),q=v*(1-f*s),t=v*(1-(1-f)*s);var m=i%6;if(m===0)return[v,t,p];if(m===1)return[q,v,p];if(m===2)return[p,v,t];if(m===3)return[p,q,v];if(m===4)return[t,p,v];return[v,p,q];}
var c1 = hsvToRgb(inputs.colorHue1, 0.9, 1.0);
var c2 = hsvToRgb(inputs.colorHue2, 0.9, 1.0);
var c3 = hsvToRgb(inputs.colorHue3, 0.9, 1.0);

return { shaderConfig: {
  passes: [
    { name: 'agents', fragmentShader: inputs.agentsShader, target: 'agentState',
      readFrom: { agentTex: 'agentState', trailTex: 'trail' },
      uniforms: { sensorAngle: inputs.sensorAngle, sensorDist: inputs.sensorDistance,
        turnSpeed: inputs.turnSpeed, moveSpeed: inputs.moveSpeed,
        randomStrength: inputs.randomStrength, resolution: [simRes, simRes],
        time: ctx.elapsed, speciesCount: speciesCount,
        selfAttract: inputs.selfAttract, otherRepel: inputs.otherRepel } },
    { name: 'diffuse', fragmentShader: inputs.diffuseShader, target: 'trail',
      readFrom: { trailTex: 'trail' },
      uniforms: { decayRate: inputs.decayRate, diffuseSpeed: inputs.diffuseSpeed, resolution: [simRes, simRes] } },
    { name: 'deposit', mode: 'deposit', agentTarget: 'agentState', agentRes: state.agentSide,
      vertexShader: inputs.depositVertShader, fragmentShader: inputs.depositFragShader,
      target: 'trail', noClear: true,
      uniforms: { depositAmount: inputs.depositAmount } },
    { name: 'display', fragmentShader: inputs.displayShader, target: null,
      readFrom: { trailTex: 'trail' },
      uniforms: { color1: c1, color2: c2, color3: c3,
        contrast: inputs.contrast, brightness: inputs.brightness,
        speciesCount: speciesCount, edgeGlow: inputs.edgeGlow, resolution: [simRes, simRes] } },
  ],
  renderTargetDefs: {
    agentState: { width: state.agentSide, height: state.agentSide, type: 'float', filter: 'nearest', pingPong: true, _gen: state.gen },
    trail: { width: simRes, height: simRes, type: 'float', filter: 'linear', pingPong: true, _gen: state.gen },
  },
  initData: { agentState: state.agentData },
  stepsPerFrame: Math.min(8, Math.round(inputs.stepsPerFrame)),
}};
`

const slimeMoldDef: CompoundGeneratorDef = {
  id: 'builtin_slimeMold',
  name: 'Slime Mold',
  description: 'Multi-species physarum simulation with competing trail networks',
  defaultCameraDistance: 0,
  generatorType: 'slimeMold_generator',
  outputMode: 'shader',
  params: slimeMoldParams,
  inputs: slimeMoldParams.map(p => ({
    name: p.name,
    type: 'number' as const,
    default: p.type === 'bool' ? (p.default ? 1 : 0) : (p.type === 'enum' ? 0 : (p.default as number)),
  })),
  outputs: [{ name: 'shaderConfig', type: 'array' as const }],
  evaluateSource: slimeMoldEvaluateSource,
  shaderSources: {
    agents: slimeMoldAgentFrag,
    depositVert: slimeMoldDepositVert,
    depositFrag: slimeMoldDepositFrag,
    diffuse: slimeMoldDiffuseFrag,
    display: slimeMoldDisplayFrag,
  },
}

// ═══════════════════════════════════════════════════════════════════════════
// PLANET
// ═══════════════════════════════════════════════════════════════════════════

const planetFragShader = `precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uSeed;
uniform float uOceanLevel;
uniform float uCloudDensity;
uniform float uCloudSpeed;
uniform float uAtmosphereThickness;
uniform float uMineralHue;
uniform float uMineralVariation;
uniform float uTerrainRoughness;
uniform float uIceCaps;
uniform float uRotationSpeed;
uniform float uLightAngle;
uniform float uZoom;
uniform float uLushness;
uniform float uRiverFrequency;
uniform float uMountainHeight;
uniform float uContinentSize;
uniform float uStormIntensity;
uniform float uCivilization;
uniform float uAspect;
uniform float uPlanetAge;

#define PI 3.14159265359

// Simplex noise
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - 0.5;
  i = mod289(i);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  vec4 j = p - 49.0 * floor(p * (1.0/49.0));
  vec4 x_ = floor(j * (1.0/7.0));
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x2_ = (x_ * 2.0 + 0.5) / 7.0 - 1.0;
  vec4 y2_ = (y_ * 2.0 + 0.5) / 7.0 - 1.0;
  vec4 h = 1.0 - abs(x2_) - abs(y2_);
  vec4 b0 = vec4(x2_.xy, y2_.xy);
  vec4 b1 = vec4(x2_.zw, y2_.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}

// Standard FBM (5 octaves max for performance)
float fbm5(vec3 p, float rough) {
  float v = 0.0, a = 0.5;
  vec3 shift = vec3(100.0);
  for (int i = 0; i < 5; i++) {
    v += a * snoise(p);
    p = p * 2.0 + shift;
    a *= rough;
  }
  return v;
}

// Lighter 3-octave FBM for secondary details
float fbm3(vec3 p, float rough) {
  float v = 0.0, a = 0.5;
  vec3 shift = vec3(100.0);
  for (int i = 0; i < 3; i++) {
    v += a * snoise(p);
    p = p * 2.0 + shift;
    a *= rough;
  }
  return v;
}

// Ridged FBM for mountain ranges (4 octaves)
float ridgedFbm(vec3 p, float rough) {
  float v = 0.0, a = 0.5, prev = 1.0;
  vec3 shift = vec3(100.0);
  for (int i = 0; i < 4; i++) {
    float n = 1.0 - abs(snoise(p));
    n = n * n;
    n *= prev;
    prev = n;
    v += a * n;
    p = p * 2.0 + shift;
    a *= rough;
  }
  return v;
}

// Coarse terrain height for river valley detection
// Uses only continent shape + ridges (no fine detail) to find major drainage valleys
float riverTerrain(vec3 p, vec3 seedOff, float contScl, float mmask, float mh) {
  float c = fbm3(p * contScl + seedOff, 0.5);
  float ridgeVal = ridgedFbm(p * 5.0 + seedOff * 1.5, 0.6);
  float r = pow(max(ridgeVal * mmask, 0.0), mix(1.0, 0.6, mh)) * mh;
  return (c * 0.5 + 0.5) * 0.6 + r * 0.3;
}

// Tectonic plate field — returns the plate elevation at a point
// Low frequency creates large coherent plates; domain warping adds realistic coastlines
float plateField(vec3 p, vec3 seed, float contSize) {
  // contSize 0→1 maps to frequency 2.5→0.8 (fewer plates = bigger continents)
  float freq = mix(2.5, 0.8, contSize);
  vec3 sp = p * freq;
  // Domain warp for fractal coastlines — warp the plate coordinates
  vec3 warp = vec3(
    snoise(sp * 0.8 + seed),
    snoise(sp * 0.8 + seed + vec3(5.2, 1.3, 2.8)),
    snoise(sp * 0.8 + seed + vec3(9.1, 3.7, 6.4))
  );
  vec3 warped = sp + warp * 0.6;
  // Two octaves of noise — large plates with some sub-plate structure
  float plate = snoise(warped + seed) * 0.7
              + snoise(warped * 2.0 + seed + vec3(100.0)) * 0.3;
  // Continental shelf — sharpen the land/ocean transition
  // Power curve: higher contSize → flatter distribution → more land area above threshold
  float normalized = plate * 0.5 + 0.5; // 0-1
  normalized = pow(normalized, mix(0.7, 1.3, contSize));
  return normalized * 2.0 - 1.0; // back to -1..1
}

// Plate boundary detection — gradient magnitude of the plate field
// High gradient = plate collision zone = mountain formation
float plateBoundary(vec3 p, vec3 seed, float contSize) {
  float eps = 0.02;
  float c  = plateField(p, seed, contSize);
  float cx = plateField(p + vec3(eps, 0.0, 0.0), seed, contSize);
  float cy = plateField(p + vec3(0.0, eps, 0.0), seed, contSize);
  float cz = plateField(p + vec3(0.0, 0.0, eps), seed, contSize);
  float gx = (cx - c) / eps;
  float gy = (cy - c) / eps;
  float gz = (cz - c) / eps;
  return length(vec3(gx, gy, gz));
}

void main() {
  // Zoom: 1.0 = planet fills viewport, <1 = zoomed out (planet smaller), >1 = zoomed in
  float zoomScale = 1.0 / max(uZoom, 0.1);
  vec2 uv = (vUv - 0.5) * 2.0 * zoomScale;
  // Correct for aspect ratio while keeping planet fully visible and centered
  if (uAspect > 1.0) {
    uv.x *= uAspect;  // widescreen: stretch x, planet fits in height
  }

  float dist = length(uv);

  // Lighting setup (needed for atmosphere glow too)
  float lightA = uLightAngle * PI / 180.0;
  vec3 lightDir = normalize(vec3(cos(lightA), 0.3, sin(lightA)));
  vec3 viewDir = vec3(0.0, 0.0, 1.0);

  // Outside the planet — atmosphere bubble with alpha
  // Thicker atmosphere = visibly larger bubble around the planet
  float atmosRadius = 1.0 + uAtmosphereThickness * 0.35;
  if (dist > atmosRadius) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
    return;
  }
  if (dist > 1.0) {
    // Atmospheric scattering in the bubble shell
    float atmosDist = (dist - 1.0) / (atmosRadius - 1.0);
    // Softer falloff for thicker atmospheres — more visible bubble
    float falloffExp = mix(3.0, 1.5, clamp(uAtmosphereThickness, 0.0, 2.0) * 0.5);
    float glow = pow(1.0 - atmosDist, falloffExp);

    // Sun-side brightening (reduced — was making it too bright from behind)
    vec2 uvNorm = normalize(uv);
    float sunSide = dot(uvNorm, lightDir.xy) * 0.2 + 0.8;

    // Atmospheric color: blue core, slightly warmer at edge
    vec3 atmosCol = mix(vec3(0.25, 0.45, 1.0), vec3(0.45, 0.55, 0.95), atmosDist);
    atmosCol = mix(atmosCol, vec3(0.3, 0.55, 0.9), uLushness * 0.15);
    // Scale brightness more gently — bubble should be visible but not blinding
    atmosCol *= glow * sunSide * 0.4;

    gl_FragColor = vec4(atmosCol, glow * 0.6);
    return;
  }

  // Sphere mapping
  float z = sqrt(1.0 - uv.x * uv.x - uv.y * uv.y);
  vec3 normal = normalize(vec3(uv.x, uv.y, z));

  // Rotation
  float rot = uTime * uRotationSpeed * 0.1;
  float cr = cos(rot), sr = sin(rot);
  vec3 spherePos = vec3(
    normal.x * cr - normal.z * sr,
    normal.y,
    normal.x * sr + normal.z * cr
  );

  // === TERRAIN GENERATION (tectonic plate-driven) ===
  vec3 seedOffset = vec3(uSeed * 17.31, uSeed * 43.17, uSeed * 7.93);

  // Tectonic plate field — defines continental vs oceanic plates
  float continent = plateField(spherePos, seedOffset, uContinentSize);

  // Plate boundary gradient — where plates meet, mountains form
  float boundary = plateBoundary(spherePos, seedOffset, uContinentSize);
  // Normalize boundary into a mountain mask (steep gradients = collision zones)
  // This mask defines WHERE mountains can exist — it does NOT change with height
  float mountainMask = smoothstep(1.0, 4.0, boundary);
  // Add some spread for foothills
  mountainMask = max(mountainMask, smoothstep(0.5, 2.0, boundary) * 0.25);

  // Ridged peaks along plate boundaries
  float ridgesRaw = ridgedFbm(spherePos * 5.0 + seedOffset * 1.5, 0.6);
  // Mountain height only amplifies the peaks vertically, NOT the footprint
  // Use pow() to make height increase concentrate on the tallest peaks
  float ridgesBase = max(ridgesRaw * mountainMask, 0.0);
  float ridges = pow(ridgesBase, mix(1.0, 0.6, uMountainHeight)) * uMountainHeight;

  // === EROSION (driven by uPlanetAge) ===
  // Young planets: sharp peaks, jagged ridges, high detail
  // Old planets: rounded mountains, smoothed terrain, wider valleys, sediment fill
  float erosion = clamp(uPlanetAge, 0.0, 1.0);
  // Erode peaks — reduce the sharpest features, round mountain tops
  float peakErosion = smoothstep(0.4, 1.0, ridges / max(uMountainHeight, 0.01));
  ridges *= 1.0 - peakErosion * erosion * 0.4; // old planets lose up to 40% peak height
  // Sediment deposition — fill valleys on old planets (raises lowlands slightly)
  float sedimentFill = erosion * 0.06 * smoothstep(0.3, 0.0, ridges / max(uMountainHeight, 0.01));

  // Fine terrain detail for surface roughness — reduced by erosion (weathering smooths detail)
  float detailScale = 1.0 - erosion * 0.5; // old planets have half the fine detail
  float detail = fbm3(spherePos * 12.0 + seedOffset * 2.0, uTerrainRoughness) * 0.1 * detailScale;
  float microDetail = snoise(spherePos * 30.0 + seedOffset * 3.0) * 0.03 * detailScale;

  // Combined height map — ridges contribution is capped to prevent footprint spread
  // At low mountainHeight, ridges barely contribute to terrain threshold
  // At high mountainHeight, peaks are taller but don't widen
  float terrain = continent + ridges * 0.3 + detail + microDetail + sedimentFill;

  // Height above ocean (used for coloring and mountains)
  // At oceanLevel=0, push threshold so low that no terrain is below it (no ocean)
  float oceanThreshold = uOceanLevel < 0.01 ? -99.0 : uOceanLevel * 0.5 - 0.2;
  float heightAboveOcean = terrain - oceanThreshold;
  bool isOcean = heightAboveOcean < 0.0;
  float latitude = abs(spherePos.y);

  // Ice caps with noise-modulated, natural boundary
  float iceEdgeNoise = snoise(spherePos * 8.0 + seedOffset * 1.2) * 0.08
                     + snoise(spherePos * 16.0 + seedOffset * 2.5) * 0.04;
  float iceThreshold = 1.0 - uIceCaps * 0.45;
  // Gradual blend factor: 0 below threshold (equator side), 1 above (deep into polar region)
  float iceFactor = smoothstep(iceThreshold - 0.08 + iceEdgeNoise, iceThreshold + iceEdgeNoise, latitude);
  // Ice only on land and shallow ocean (continental ice sheets + sea ice)
  iceFactor *= smoothstep(-0.05, 0.0, heightAboveOcean + 0.08);
  bool isIce = iceFactor > 0.01;

  // === SURFACE COLORING ===
  vec3 surfaceColor;

  if (false) { // ice handled after land coloring via blend
    surfaceColor = vec3(0.0);
  } else if (isOcean && !isIce) {
    // Ocean with depth-based coloring and subtle caustics
    float depth = smoothstep(0.0, -0.25, heightAboveOcean);
    vec3 shallowOcean = vec3(0.08, 0.35, 0.55);
    vec3 deepOcean = vec3(0.01, 0.03, 0.12);

    // Lush planets get warmer, more tropical oceans
    shallowOcean = mix(shallowOcean, vec3(0.05, 0.38, 0.45), uLushness * 0.5);

    surfaceColor = mix(shallowOcean, deepOcean, depth);

    // Subsurface caustics
    float caustic = snoise(spherePos * 25.0 + vec3(uTime * 0.15, 0.0, uTime * 0.1)) * 0.03;
    surfaceColor += vec3(caustic * 0.5, caustic * 0.8, caustic);
  } else {
    // Land: biome selection based on terrain variation
    float continentHeight = continent * 0.5 + 0.5; // remap -1..1 to 0..1
    float ridgeHeight = ridges / max(uMountainHeight, 0.01);
    float height01 = clamp(continentHeight * 0.6 + ridgeHeight * 0.4, 0.0, 1.0);

    // === TEMPERATURE & MOISTURE MAPS ===
    // Physical properties independent of lushness

    // Temperature: equator=1, poles=0, drops modestly with altitude
    float temperature = (1.0 - latitude * 0.9) * (1.0 - smoothstep(0.5, 0.95, height01) * 0.4);
    temperature += snoise(spherePos * 4.0 + seedOffset * 14.0) * 0.08;
    temperature = clamp(temperature, 0.0, 1.0);

    // Moisture: additive model — base rainfall + coast bonus + rain shadow
    // Base rainfall from atmospheric circulation (ITCZ near equator, rain belts)
    float baseMoisture = smoothstep(0.0, 0.5, temperature) * 0.5; // warm = more evaporation
    // Coast proximity bonus — land near ocean gets more rain
    float coastBonus = smoothstep(0.2, 0.0, heightAboveOcean) * 0.35;
    // Weather pattern noise — rain belts, monsoons, local variation
    float weatherNoise = fbm3(spherePos * 5.0 + seedOffset * 4.0, 0.5) * 0.5 + 0.5;

    // === RAIN SHADOW MODEL ===
    // Prevailing wind direction varies by latitude (Earth-like circulation):
    //   0-30°: Trade winds blow west (easterlies)
    //   30-60°: Westerlies blow east
    //   60-90°: Polar easterlies blow west
    // On sphere, use XZ plane for wind direction
    float absLat2 = abs(spherePos.y);
    float tradeWind = smoothstep(0.0, 0.3, absLat2) * smoothstep(0.5, 0.3, absLat2); // 0-30°
    float westerly = smoothstep(0.3, 0.5, absLat2) * smoothstep(0.8, 0.6, absLat2);  // 30-60°
    float polarEast = smoothstep(0.7, 0.9, absLat2);                                    // 60-90°
    // Net wind direction on XZ plane: -1 = blowing west (easterly), +1 = blowing east (westerly)
    float windDir = -tradeWind + westerly - polarEast;
    // Add some large-scale variation so it's not perfectly zonal
    windDir += snoise(spherePos * 2.0 + seedOffset * 9.0) * 0.3;

    // Sample terrain height a bit UPWIND to detect mountain blocking
    // Offset along the wind direction in the XZ plane
    float windSampleDist = 0.08;
    vec3 upwindPos = spherePos;
    upwindPos.x -= windDir * windSampleDist;
    upwindPos = normalize(upwindPos); // stay on sphere
    // Mountain height upwind
    float upwindContinent = fbm5(upwindPos * mix(2.0, 4.0, uContinentSize) + seedOffset, 0.5);
    float upwindRidges = max(ridgedFbm(upwindPos * 5.0 + seedOffset * 1.5, 0.6) * mountainMask, 0.0);
    float upwindHeight = clamp((upwindContinent * 0.5 + 0.5) * 0.6 + upwindRidges * 0.4, 0.0, 1.0);
    // If upwind terrain is high (mountains), we're in the rain shadow (lee side is dry)
    // The shadow strength depends on how tall the upwind mountains are
    float shadowStrength = smoothstep(0.3, 0.7, upwindHeight) * smoothstep(0.2, 0.4, height01);
    // Also check: if WE are on the windward side (our terrain is rising), we get MORE rain (orographic lift)
    float orographicLift = smoothstep(0.2, 0.5, height01) * (1.0 - shadowStrength) * 0.2;

    float rainShadow = -shadowStrength * 0.4 + orographicLift;

    // Altitude drying — high mountains are drier
    float altDry = smoothstep(0.5, 0.85, height01) * 0.4;

    float moisture = baseMoisture + coastBonus + weatherNoise * 0.3 + rainShadow - altDry;
    moisture = clamp(moisture, 0.0, 1.0);

    // === VEGETATION HABITABILITY ===
    // Lushness = species robustness — how harsh an environment plants can tolerate
    // Low lushness: only warm, wet lowlands. High lushness: vegetation spreads everywhere viable.

    // Thresholds that lushness relaxes
    float minTemp = mix(0.45, 0.05, uLushness);
    float minMoisture = mix(0.45, 0.05, uLushness);
    float maxAltitude = mix(0.45, 0.85, uLushness);

    // Suitability curves — wide transitions for natural blending
    float tempSuit = smoothstep(minTemp - 0.05, minTemp + 0.2, temperature);
    float moistSuit = smoothstep(minMoisture - 0.05, minMoisture + 0.2, moisture);
    float altSuit = 1.0 - smoothstep(maxAltitude, maxAltitude + 0.15, height01);

    // === FOREST SPREAD MODEL ===
    // Forests don't appear uniformly — they spread from ideal nucleation points
    // (river valleys, coastal lowlands, tropical zones) outward as lushness increases

    // Raw habitability — can plants survive here at all?
    float rawHabit = tempSuit * moistSuit * altSuit;

    // Forest nucleation — patches of dense forest form at the best sites
    // These are the seeds from which forest spreads with lushness
    float forestNoise1 = snoise(spherePos * 5.0 + seedOffset * 30.0) * 0.5 + 0.5;
    float forestNoise2 = snoise(spherePos * 10.0 + seedOffset * 31.0) * 0.5 + 0.5;
    float forestNoise3 = snoise(spherePos * 20.0 + seedOffset * 32.0) * 0.5 + 0.5;
    // Multi-scale forest patches — large biomes + medium stands + small groves
    float forestField = forestNoise1 * 0.5 + forestNoise2 * 0.3 + forestNoise3 * 0.2;

    // Forest spread threshold — lower = more forest coverage
    // At lushness 0: threshold is high, only the very best spots (>0.7) get forests
    // At lushness 1: threshold drops to near 0, forest covers almost everywhere habitable
    float spreadThreshold = mix(0.7, 0.05, uLushness);

    // Forest density based on how far above the spread threshold we are
    float forestDensity = smoothstep(spreadThreshold, spreadThreshold + 0.25, forestField);

    // Combine: must be habitable AND in a forest spread zone
    // At max lushness, rawHabit dominates (forests fill all habitable land)
    // At low lushness, both conditions must be met (forests only in ideal patches)
    float vegDensity = rawHabit * mix(forestDensity, 1.0, rawHabit * uLushness);

    // Dense forests in ideal conditions — deeper green, more opaque canopy
    // Sparse vegetation in marginal conditions — grassier, more transparent
    vegDensity *= (0.5 + uLushness * 0.5);
    vegDensity = clamp(vegDensity, 0.0, 1.0);

    float warmth = temperature;

    // === RIVERS ===
    // Three mechanisms make rivers flow realistically from highlands to coast:
    //
    // 1. HEIGHT-AS-COORDINATE: Adding terrain height to noise sampling position
    //    means the noise "slice" shifts as elevation changes. The isoline at
    //    elevation 0.4 is a different curve than at 0.2. Following the isoline
    //    as terrain slopes down traces a path from highlands toward coast.
    //    This prevents loops — returning uphill enters a different noise slice.
    //
    // 2. TERRAIN GRADIENT WARP: Pushing the noise sampling position downhill
    //    pulls river paths into valleys between mountains.
    //
    // 3. ELEVATION-DEPENDENT WIDTH: Rivers widen near the coast (accumulating
    //    water from tributaries) and thin to nothing at high altitude, naturally
    //    hiding any remnant loop artifacts.
    //
    // 4. FLAT-TERRAIN MEANDERING: Extra noise perturbation on flat terrain
    //    creates oxbow-like meanders where rivers cross lowland plains.
    float riverMask = 0.0;
    float riverCarve = 0.0;
    float rawRn1 = 0.0, rawRn2 = 0.0;
    float riverWidth1 = 0.0, riverWidth2 = 0.0;
    vec3 riverWarpDir = vec3(0.0);
    float riverWarpStr = 0.0;
    vec3 riverMeander = vec3(0.0);
    float riverHeightWarp = 0.0;
    if (uRiverFrequency > 0.01) {
      float contScl = mix(2.0, 4.0, uContinentSize);

      // Compute terrain gradient for valley warping
      float wEps = 0.015;
      float hC_r = riverTerrain(spherePos, seedOffset, contScl, mountainMask, uMountainHeight);
      float h_east = riverTerrain(normalize(spherePos + vec3(wEps, 0.0, 0.0)), seedOffset, contScl, mountainMask, uMountainHeight);
      float h_north = riverTerrain(normalize(spherePos + vec3(0.0, 0.0, wEps)), seedOffset, contScl, mountainMask, uMountainHeight);
      vec3 tGrad = vec3(h_east - hC_r, 0.0, h_north - hC_r) / wEps;
      float tGradMag = length(tGrad);
      riverWarpDir = tGradMag > 0.001 ? tGrad / tGradMag : vec3(0.0);

      // Valley warp: push sampling position downhill (stronger on steep terrain)
      riverWarpStr = 0.07 * smoothstep(0.0, 2.0, tGradMag);
      vec3 warpedPos = normalize(spherePos - riverWarpDir * riverWarpStr);

      // Flat-terrain meandering: extra noise perturbation on gentle slopes
      // Real rivers meander most on floodplains, less in mountain valleys
      float meanderStr = mix(0.035, 0.003, smoothstep(0.0, 1.5, tGradMag));
      riverMeander = vec3(
        snoise(spherePos * 18.0 + seedOffset * 22.0),
        0.0,
        snoise(spherePos * 18.0 + seedOffset * 23.0)
      ) * meanderStr;
      warpedPos = normalize(warpedPos + riverMeander);

      // === HEIGHT-AS-COORDINATE ===
      // Add terrain height directly to noise Y coordinate.
      // Each elevation samples a different noise "slice" — as terrain slopes
      // downhill, the isoline shifts, tracing a path toward the coast.
      // This prevents loops: going back uphill enters a different noise region.
      // Keep the multiplier moderate so zero-crossings remain dense enough to see.
      riverHeightWarp = height01 * 1.5;

      // Primary rivers (large, continent-scale)
      vec3 rPos1 = warpedPos * 5.0 + seedOffset * 20.0;
      rPos1.y += riverHeightWarp;
      rawRn1 = snoise(rPos1);

      // Secondary rivers (tributaries, smaller)
      vec3 rPos2 = warpedPos * 11.0 + seedOffset * 21.0;
      rPos2.y += riverHeightWarp * 1.4;
      rawRn2 = snoise(rPos2);

      // River width: narrow in highlands, wide near coast
      float ageWidthMult = 1.0 + erosion * 0.5;
      riverWidth1 = mix(0.02, 0.10, smoothstep(0.50, 0.06, height01)) * ageWidthMult;
      riverWidth2 = mix(0.01, 0.05, smoothstep(0.45, 0.06, height01)) * ageWidthMult;

      float river1 = 1.0 - smoothstep(0.0, riverWidth1, abs(rawRn1));
      float river2 = (1.0 - smoothstep(0.0, riverWidth2, abs(rawRn2))) * 0.5;

      // Must be on land, above ocean
      float riverElevMask = smoothstep(-0.01, 0.03, heightAboveOcean);
      // Fade at very high altitude
      float highAltFade = smoothstep(0.75, 0.4, height01);

      float rivers = max(river1, river2) * riverElevMask * highAltFade;
      riverMask = clamp(rivers * uRiverFrequency, 0.0, 1.0);

      // === RIVER VALLEY CARVING ===
      float carveAmount = mix(0.04, 0.25, smoothstep(0.15, 0.5, height01)) * (1.0 + erosion * 0.6);
      riverCarve = riverMask * carveAmount * uRiverFrequency;
      height01 = max(0.01, height01 - riverCarve);

      // Riparian vegetation along river banks
      float bankWidth1 = riverWidth1 * 2.5;
      float bankWidth2 = riverWidth2 * 2.5;
      float bankZone = max(
        1.0 - smoothstep(0.0, bankWidth1, abs(rawRn1)),
        1.0 - smoothstep(0.0, bankWidth2, abs(rawRn2))
      ) * riverElevMask * highAltFade * uRiverFrequency;
      float bankVeg = clamp(bankZone - riverMask, 0.0, 1.0);
      vegDensity = min(1.0, vegDensity + bankVeg * 0.5);
    }

    // Biome colors — rocky/barren palette
    vec3 desert = vec3(0.55, 0.42, 0.28);
    vec3 rock = vec3(0.4, 0.38, 0.35);
    vec3 darkRock = vec3(0.25, 0.22, 0.2);
    vec3 mountainGray = vec3(0.45, 0.42, 0.38);
    vec3 mountainDark = vec3(0.3, 0.28, 0.25);
    // Vegetation palette — chosen by temperature
    vec3 tropicalForest = vec3(0.04, 0.26, 0.03);
    vec3 temperateForest = vec3(0.08, 0.30, 0.06);
    vec3 grassland = vec3(0.20, 0.36, 0.08);
    vec3 savanna = vec3(0.42, 0.42, 0.15);
    vec3 tundra = vec3(0.35, 0.38, 0.3);
    vec3 dryGrass = vec3(0.45, 0.40, 0.18);

    // Select vegetation color based on temperature and moisture
    // Hot+wet = tropical, hot+dry = savanna, cool+wet = temperate, cool+dry = tundra
    vec3 hotVeg = mix(savanna, tropicalForest, moisture);
    vec3 coolVeg = mix(tundra, temperateForest, moisture);
    vec3 vegColor = mix(coolVeg, hotVeg, temperature);
    // Sparse vegetation is more grass-like
    vegColor = mix(mix(dryGrass, grassland, moisture), vegColor, smoothstep(0.2, 0.6, vegDensity));

    // Select barren terrain color based on altitude
    vec3 barrenColor;
    if (height01 < 0.2) {
      barrenColor = mix(mix(desert, rock, 0.4), desert, 1.0 - latitude);
      barrenColor *= 0.85 + height01 / 0.2 * 0.15;
    } else if (height01 < 0.5) {
      barrenColor = mix(desert, rock, (height01 - 0.2) / 0.3);
      barrenColor = mix(barrenColor, darkRock, latitude * 0.3);
    } else if (height01 < 0.75) {
      barrenColor = mix(rock, mountainGray, (height01 - 0.5) / 0.25);
    } else if (height01 < 0.9) {
      barrenColor = mix(mountainGray, mountainDark, (height01 - 0.75) / 0.15);
    } else {
      // Peaks — snow dusting at high latitudes
      float snowLine = 0.85 + (1.0 - latitude) * 0.1;
      vec3 peakColor = mountainDark * 0.8;
      vec3 snowColor = vec3(0.85, 0.88, 0.92);
      barrenColor = mix(peakColor, snowColor, smoothstep(snowLine, snowLine + 0.1, height01) * (0.3 + latitude * 0.7));
    }

    // Blend vegetation over barren terrain using vegDensity
    vec3 biomeColor = mix(barrenColor, vegColor, vegDensity);

    // Mineral hue shift — only applied to rocky/desert portions, NOT vegetation
    float mineralH = uMineralHue / 360.0;
    float hueAngle = mineralH * 6.2832;
    float cosA = cos(hueAngle), sinA = sin(hueAngle);
    float k = 0.57735;
    float c1 = 1.0 - cosA;
    mat3 hueRot = mat3(
      cosA + k*k*c1,       k*k*c1 - k*sinA,    k*k*c1 + k*sinA,
      k*k*c1 + k*sinA,     cosA + k*k*c1,       k*k*c1 - k*sinA,
      k*k*c1 - k*sinA,     k*k*c1 + k*sinA,     cosA + k*k*c1
    );
    float vegAmount = vegDensity;
    vec3 rotated = hueRot * biomeColor;
    surfaceColor = mix(rotated, biomeColor, vegAmount * 0.85);

    // === SURFACE DETAIL (via relief shading, not color variation) ===
    float mountainAmount = smoothstep(0.3, 0.7, height01);

    // Mineral variation — subtle regional color shifts
    float variation = snoise(spherePos * 8.0 + seedOffset * 3.0) * uMineralVariation * 0.08;
    surfaceColor += variation;

    // Vegetation texture — forest canopy patchiness
    if (vegAmount > 0.1) {
      float vegTex = snoise(spherePos * 40.0 + seedOffset * 11.0) * 0.04;
      surfaceColor += vegTex * vegAmount;
    }

    // === MULTI-SCALE BUMP-MAP RELIEF SHADING ===
    // Perturb in SCREEN-SPACE UV, then re-project to sphere positions
    // This ensures gradients align with the view and light direction properly
    float eps = 0.003;
    vec2 uvDx = uv + vec2(eps, 0.0);
    vec2 uvDy = uv + vec2(0.0, eps);

    // Re-project perturbed UVs to sphere positions (same as main sphere mapping)
    float zDx = 1.0 - uvDx.x * uvDx.x - uvDx.y * uvDx.y;
    float zDy = 1.0 - uvDy.x * uvDy.x - uvDy.y * uvDy.y;
    // Skip relief if perturbed UV falls off sphere edge
    if (zDx > 0.0 && zDy > 0.0) {
      vec3 nDx = normalize(vec3(uvDx.x, uvDx.y, sqrt(zDx)));
      vec3 nDy = normalize(vec3(uvDy.x, uvDy.y, sqrt(zDy)));
      vec3 spDx = vec3(nDx.x * cr - nDx.z * sr, nDx.y, nDx.x * sr + nDx.z * cr);
      vec3 spDy = vec3(nDy.x * cr - nDy.z * sr, nDy.y, nDy.x * sr + nDy.z * cr);

      // Height function: macro ridges + multi-octave detail
      // Detail weight: mountains get full detail, plains get some
      // Erosion reduces fine detail (weathering rounds terrain)
      float detailWeight = mix(0.3, 1.0, mountainAmount) * (0.5 + uTerrainRoughness) * detailScale;

      // Sample height at center, +dx, +dy
      float hCenter = ridges;
      float hDx = pow(max(ridgedFbm(spDx * 5.0 + seedOffset * 1.5, 0.6) * mountainMask, 0.0), mix(1.0, 0.6, uMountainHeight)) * uMountainHeight;
      float hDy = pow(max(ridgedFbm(spDy * 5.0 + seedOffset * 1.5, 0.6) * mountainMask, 0.0), mix(1.0, 0.6, uMountainHeight)) * uMountainHeight;

      // Medium detail (freq 15) — foothills/valleys
      float dM = snoise(spherePos * 15.0 + seedOffset * 4.0) * 0.2;
      float dMx = snoise(spDx * 15.0 + seedOffset * 4.0) * 0.2;
      float dMy = snoise(spDy * 15.0 + seedOffset * 4.0) * 0.2;

      // Ridged detail (freq 30) — sharp creases
      float dR = abs(snoise(spherePos * 30.0 + seedOffset * 4.5)) * 0.15;
      float dRx = abs(snoise(spDx * 30.0 + seedOffset * 4.5)) * 0.15;
      float dRy = abs(snoise(spDy * 30.0 + seedOffset * 4.5)) * 0.15;

      // Fine grain (freq 55)
      float dF = snoise(spherePos * 55.0 + seedOffset * 5.0) * 0.1;
      float dFx = snoise(spDx * 55.0 + seedOffset * 5.0) * 0.1;
      float dFy = snoise(spDy * 55.0 + seedOffset * 5.0) * 0.1;

      // Very fine grain (freq 100)
      float dV = snoise(spherePos * 100.0 + seedOffset * 6.0) * 0.06;
      float dVx = snoise(spDx * 100.0 + seedOffset * 6.0) * 0.06;
      float dVy = snoise(spDy * 100.0 + seedOffset * 6.0) * 0.06;

      // Micro texture (freq 180)
      float dU = snoise(spherePos * 180.0 + seedOffset * 7.0) * 0.035;
      float dUx = snoise(spDx * 180.0 + seedOffset * 7.0) * 0.035;
      float dUy = snoise(spDy * 180.0 + seedOffset * 7.0) * 0.035;

      // Composite height
      float detailC = (dM + dR + dF + dV + dU) * detailWeight;
      float detailX = (dMx + dRx + dFx + dVx + dUx) * detailWeight;
      float detailY = (dMy + dRy + dFy + dVy + dUy) * detailWeight;

      float hC = hCenter + detailC * uMountainHeight;
      float hX = hDx + detailX * uMountainHeight;
      float hY = hDy + detailY * uMountainHeight;

      // River canyon carving in bump map — re-sample river noise at offset
      // positions so canyon walls create a real height gradient (visible shadows)
      if (uRiverFrequency > 0.01 && riverCarve > 0.001) {
        float carveScale = mix(0.08, 0.45, smoothstep(0.15, 0.55, height01 + riverCarve));

        // Re-sample river noise at bump offset positions
        // Use same warp/height parameters (constant over sub-pixel eps)
        vec3 wpDx = normalize(spDx - riverWarpDir * riverWarpStr + riverMeander);
        vec3 wpDy = normalize(spDy - riverWarpDir * riverWarpStr + riverMeander);

        vec3 rpDx1 = wpDx * 5.0 + seedOffset * 20.0;
        rpDx1.y += riverHeightWarp;
        vec3 rpDy1 = wpDy * 5.0 + seedOffset * 20.0;
        rpDy1.y += riverHeightWarp;

        float rnDx = snoise(rpDx1);
        float rnDy = snoise(rpDy1);

        // River mask at offset positions
        float rmDx = 1.0 - smoothstep(0.0, riverWidth1, abs(rnDx));
        float rmDy = 1.0 - smoothstep(0.0, riverWidth1, abs(rnDy));
        rmDx = clamp(rmDx * uRiverFrequency, 0.0, 1.0);
        rmDy = clamp(rmDy * uRiverFrequency, 0.0, 1.0);

        // Carve each sample point by its own river mask
        hC -= riverMask * carveScale * uMountainHeight;
        hX -= rmDx * carveScale * uMountainHeight;
        hY -= rmDy * carveScale * uMountainHeight;
      }

      // Screen-space gradients
      float gradX = (hX - hC) / eps;
      float gradY = (hY - hC) / eps;

      // === TRUE BUMP MAPPING ===
      // Perturb the sphere normal using the height gradient
      // Clamp gradients to prevent extreme normal tilting (which blacks out the planet)
      float bumpStrength = 0.15 + uTerrainRoughness * 0.15;
      float gLen = length(vec2(gradX, gradY));
      float maxGrad = 3.0; // limit gradient magnitude
      float gradScale = gLen > maxGrad ? maxGrad / gLen : 1.0;
      vec3 bumpOffset = vec3(-gradX * gradScale, -gradY * gradScale, 0.0) * bumpStrength;
      vec3 bumpedNormal = normalize(normal + bumpOffset);
      // Blend bumped normal — keep macro shape, add surface detail
      normal = mix(normal, bumpedNormal, 0.6);

      // Steep terrain darkening — cliff faces get darker albedo
      float steepness = length(vec2(gradX, gradY));
      surfaceColor *= 1.0 - smoothstep(0.8, 3.0, steepness) * 0.4;

      // Ambient occlusion — valleys are darker
      float ao = 1.0 - smoothstep(0.0, 0.12, -dM) * 0.25 * mountainAmount;
      surfaceColor *= ao;
    }

    // === RIVER COLORING (applied last — on top of all surface processing) ===
    if (riverMask > 0.01) {
      // River water color depends on context:
      // Mountain canyons: darker, bluer (deep gorge water)
      // Lowland rivers: slightly brighter, greener (sediment-laden)
      vec3 canyonWater = vec3(0.01, 0.06, 0.14);
      vec3 lowlandWater = vec3(0.04, 0.16, 0.24);
      vec3 deltaWater = vec3(0.06, 0.20, 0.28); // wide, shallow, silty
      float origHeight = height01 + riverCarve; // height before carving
      vec3 riverColor = mix(deltaWater, lowlandWater, smoothstep(0.1, 0.3, origHeight));
      riverColor = mix(riverColor, canyonWater, smoothstep(0.35, 0.6, origHeight));
      // Stronger blend — water fully replaces terrain color
      float riverBlend = smoothstep(0.01, 0.08, riverMask);
      surfaceColor = mix(surfaceColor, riverColor, riverBlend);
    }

  }

  // Ice cap blending — snow follows terrain height for visible mountains
  if (isIce) {
    float iceDetail = snoise(spherePos * 20.0 + seedOffset) * 0.04;
    float iceCrack = snoise(spherePos * 35.0 + seedOffset * 1.8) * 0.03;

    // Snow-covered terrain: preserve mountain relief shading under ice
    // Mountains show through as darker snow shadows; valleys are bright white
    float continentHeight = continent * 0.5 + 0.5;
    float ridgeHeight = ridges / max(uMountainHeight, 0.01);
    float terrainRelief = clamp(continentHeight * 0.6 + ridgeHeight * 0.4, 0.0, 1.0);

    // Snow base color varies with terrain height — darker on peaks (shadow/rock showing through)
    vec3 snowBright = vec3(0.88 + iceDetail, 0.92 + iceDetail + iceCrack, 0.97);
    vec3 snowShadow = vec3(0.55, 0.58, 0.68); // shadowed snow on steep faces
    vec3 rockPeek = vec3(0.35, 0.33, 0.38); // bare rock on steepest peaks

    // Higher terrain = more rock showing through snow
    float snowCoverage = 1.0 - smoothstep(0.6, 0.9, terrainRelief) * 0.6;
    vec3 iceColor = mix(snowBright, snowShadow, smoothstep(0.3, 0.7, terrainRelief));
    iceColor = mix(iceColor, rockPeek, smoothstep(0.75, 0.95, terrainRelief) * 0.5);

    // Add fine snow texture
    float snowTex = snoise(spherePos * 50.0 + seedOffset * 3.0) * 0.03;
    iceColor += snowTex;

    // Gradual blend from terrain to ice using the smooth iceFactor
    // Kill vegetation completely in ice zones
    surfaceColor = mix(surfaceColor, iceColor, iceFactor * snowCoverage + iceFactor * (1.0 - snowCoverage) * 0.5);
  }

  // === PLANETARY WEATHER SYSTEM ===
  float absLat = abs(spherePos.y);
  // Coriolis wind shear — differential rotation by latitude
  float coriolisShift = spherePos.y * 2.5;

  // ITCZ (Inter-Tropical Convergence Zone) — convective towers near equator, not a solid band
  float itczBase = exp(-absLat * absLat * 30.0); // gaussian band at equator
  float cloudSpd = uCloudSpeed * 0.2; // scaled way down for realistic motion
  // Use longitude-like coordinate for ITCZ wobble to avoid vertical banding
  float lon = atan(spherePos.z, spherePos.x);
  float itczWobble = snoise(vec3(lon * 1.5 + uTime * cloudSpd * 0.02, uSeed * 5.3, spherePos.y * 2.0)) * 0.12;
  // Break up the band with convective cell noise — use 3D sphere position, not just XZ
  float itczBreakup = fbm3(spherePos * 5.0 + vec3(uTime * cloudSpd * 0.03, 0.0, 0.0) + seedOffset * 2.1, 0.5);
  float itcz = smoothstep(0.3, 0.7, itczBase + itczWobble) * smoothstep(0.15, 0.45, itczBreakup);

  // Mid-latitude storm tracks (30-60 degrees) — Earth's weather belts
  float midLatBand = smoothstep(0.25, 0.45, absLat) * smoothstep(0.7, 0.55, absLat);
  vec3 stormTrackPos = spherePos;
  stormTrackPos.x += uTime * cloudSpd * 0.06 + coriolisShift * 0.15;
  float stormTrack = fbm5(stormTrackPos * 4.0 + seedOffset * 5.0, 0.55);
  stormTrack = smoothstep(0.1, 0.5, stormTrack) * midLatBand;

  // Tropical cyclones with spiral arms
  float stormNoise = fbm3(spherePos * 2.0 + seedOffset * 6.0 + vec3(uTime * 0.01), 0.5);
  float stormMask = smoothstep(0.35, 0.65, stormNoise) * uStormIntensity;
  float stormAngle = atan(spherePos.z - stormNoise, spherePos.x - stormNoise * 0.7);
  float stormR = length(vec2(spherePos.x - stormNoise, spherePos.z - stormNoise * 0.7));
  float cycloneSpiral = sin(stormAngle * 4.0 + stormR * 12.0 - uTime * cloudSpd * 0.4) * 0.5 + 0.5;
  // Eye of the storm — clear center
  float cycloneEye = smoothstep(0.05, 0.12, stormR);
  float cyclone = cycloneSpiral * stormMask * cycloneEye * smoothstep(0.6, 0.15, absLat);

  // Polar cloud cover — persistent overcast near poles
  float polarClouds = smoothstep(0.65, 0.85, absLat);

  // Fine-scale cloud detail and wisps
  vec3 cloudPos3 = spherePos;
  cloudPos3.x += uTime * cloudSpd * 0.05;
  float wisps = fbm3(cloudPos3 * 8.0 + seedOffset * 7.0, 0.5);
  float wispCoverage = smoothstep(0.2, 0.65, wisps);

  // Combine all cloud systems
  // Thicker atmosphere allows more cloud formation — boosts coverage and adds high-altitude haze clouds
  float atmosCloudBoost = 1.0 + clamp(uAtmosphereThickness - 0.5, 0.0, 1.5) * 0.4;
  float clouds = 0.0;
  clouds += itcz * 0.45;                   // ITCZ convective zone
  clouds += stormTrack * 0.65;            // mid-latitude weather
  clouds += cyclone * 0.5;               // tropical cyclones
  clouds += polarClouds * 0.4;           // polar overcast
  clouds += wispCoverage * 0.2 * atmosCloudBoost; // wisps spread more in thick atmosphere
  // High-altitude haze layer in thick atmospheres
  float highAltHaze = smoothstep(0.3, 0.6, wisps) * clamp(uAtmosphereThickness - 0.8, 0.0, 1.2) * 0.25;
  clouds += highAltHaze;
  clouds = clamp(clouds, 0.0, 1.0) * uCloudDensity;

  // === LIGHTING ===
  float diffuse = max(dot(normal, lightDir), 0.0);
  float ambient = 0.01; // very low ambient — dark side should be nearly black
  float rawDot = dot(normal, lightDir);
  float terminator = smoothstep(-0.02, 0.08, rawDot);

  // === COMPOSE ===
  vec3 lit = surfaceColor * (ambient + diffuse * 0.97);

  // Clouds — lit by sun, cast soft shadows on surface
  float cloudShadow = clouds * 0.15;
  lit *= (1.0 - cloudShadow);
  vec3 cloudColorLit = vec3(0.95, 0.95, 0.98) * diffuse * 0.9;
  vec3 cloudColorDark = vec3(0.005, 0.005, 0.008);
  float cloudDayFactor = smoothstep(0.0, 0.15, diffuse);
  vec3 cloudColor = mix(cloudColorDark, cloudColorLit, cloudDayFactor);
  lit = mix(lit, cloudColor, clouds * 0.8);

  // Apply terminator — dark side goes to near-zero
  lit *= terminator;

  // === ATMOSPHERE ===
  float rim = 1.0 - dot(normal, viewDir);

  vec3 atmosBlue = vec3(0.3, 0.5, 1.0);
  vec3 atmosWarm = vec3(0.4, 0.35, 0.6);
  vec3 atmosColor = mix(atmosWarm, atmosBlue, uLushness * 0.6 + 0.4);

  float sunRim = max(dot(normal, lightDir), 0.0);
  float atmosSunBoost = sunRim * 0.5 + 0.5;

  // Atmospheric haze — only on lit side
  float hazeExp = mix(2.5, 0.8, clamp(uAtmosphereThickness * 0.5, 0.0, 1.0));
  float hazeDensity = pow(rim, hazeExp) * uAtmosphereThickness * 0.55;
  float globalHaze = clamp(uAtmosphereThickness - 0.5, 0.0, 1.5) * 0.12;
  hazeDensity = clamp(hazeDensity + globalHaze, 0.0, 0.85);
  vec3 hazeColor = atmosColor * diffuse * 0.5 * atmosSunBoost;
  lit = mix(lit, hazeColor, hazeDensity * terminator);

  // Rayleigh scattering glow at limb — only on sun-lit side
  float scatterGlow = pow(rim, 3.5) * uAtmosphereThickness * 0.3 * smoothstep(-0.1, 0.2, rawDot);
  lit += atmosColor * scatterGlow * atmosSunBoost;

  // Warm atmospheric glow on terminator line
  float terminatorGlow = smoothstep(0.0, 0.12, diffuse) * (1.0 - smoothstep(0.12, 0.3, diffuse));
  lit += vec3(0.5, 0.3, 0.15) * terminatorGlow * rim * uAtmosphereThickness * 0.2;

  // Night side city lights — controlled by civilization slider
  // civLevel controls DISTRIBUTION (how many areas are settled), not brightness
  float nightMask = smoothstep(0.05, -0.1, rawDot);
  if (uCivilization > 0.5 && nightMask > 0.01) {
    float civLevel = uCivilization / 100.0;
    float landMask = isOcean ? 0.0 : 1.0;

    // Population density — large regional clusters near coasts and lowlands
    float popRegion = snoise(spherePos * 3.0 + seedOffset * 8.0) * 0.5 + 0.5;
    float coastBonus = smoothstep(0.2, 0.0, abs(heightAboveOcean)) * 0.4;
    float lowlandBonus = smoothstep(0.25, 0.0, heightAboveOcean) * 0.3;
    float popDensity = popRegion * (coastBonus + lowlandBonus + 0.3);

    // civLevel as a THRESHOLD — low civ = only densest areas are lit,
    // high civ = even sparse areas have lights
    // This controls FREQUENCY of lights, not brightness
    float settlementThreshold = 1.0 - civLevel; // low civ → high threshold (few lights)
    float isSettled = smoothstep(settlementThreshold, settlementThreshold + 0.15, popDensity);

    // Major cities — bright concentrated dots (always bright when they exist)
    float cityNoise = snoise(spherePos * 60.0 + seedOffset * 10.0);
    float majorCities = pow(smoothstep(0.55, 0.95, cityNoise), 3.0);

    // Medium towns — appear more with higher civilization
    float townNoise = snoise(spherePos * 35.0 + seedOffset * 11.0);
    float townThreshold = mix(0.8, 0.45, civLevel); // more towns at higher civ
    float towns = pow(smoothstep(townThreshold, townThreshold + 0.3, townNoise), 2.0) * 0.4;

    // Road/transport networks — only at higher civilization
    float roadNoise1 = snoise(spherePos * 45.0 + seedOffset * 12.0);
    float roadNoise2 = snoise(spherePos * 45.0 + seedOffset * 13.0 + vec3(3.7, 1.2, 5.8));
    float roads = exp(-roadNoise1 * roadNoise1 * 80.0) * 0.15;
    roads += exp(-roadNoise2 * roadNoise2 * 80.0) * 0.1;
    roads *= smoothstep(0.3, 0.6, popDensity) * smoothstep(0.3, 0.6, civLevel);

    // Suburban glow — only in populated settled areas
    float suburbanGlow = smoothstep(0.4, 0.7, popDensity) * 0.08 * civLevel;

    // Combine: isSettled gates WHERE lights appear; brightness is fixed (high)
    float cityIntensity = (majorCities + towns + roads + suburbanGlow) * isSettled;
    cityIntensity *= landMask * nightMask;

    // Avoid cities in ice caps and high mountains
    cityIntensity *= 1.0 - smoothstep(0.55, 0.85, latitude);
    cityIntensity *= smoothstep(0.35, 0.15, heightAboveOcean);

    // City light colors: warm sodium orange for most, white-blue for major metros
    vec3 cityColor = mix(
      vec3(1.0, 0.72, 0.3),   // sodium lamp orange
      vec3(1.0, 0.95, 0.85),  // white LED
      majorCities * 0.6
    );

    // Fixed brightness — lights are bright when they exist
    lit += cityColor * cityIntensity * 0.8;

    // Light pollution halo around dense areas
    float pollutionHalo = smoothstep(0.5, 0.8, popDensity) * isSettled * nightMask * landMask;
    lit += vec3(0.3, 0.22, 0.12) * pollutionHalo * 0.05;
  }

  gl_FragColor = vec4(lit, 1.0);
}
`

const planetParams: ParamSchemaDef[] = [
  { name: 'seed', type: 'float', min: 0, max: 100, default: 42, description: 'Random seed' },
  { name: 'lushness', type: 'float', min: 0, max: 1, default: 0.72, description: 'Rocky (0) to Lush (1)' },
  { name: 'oceanLevel', type: 'float', min: 0, max: 1, default: 0.645, description: 'Ocean coverage' },
  { name: 'continentSize', type: 'float', min: 0, max: 1, default: 0.5, description: 'Continent size' },
  { name: 'mountainHeight', type: 'float', min: 0, max: 2, default: 1.1, description: 'Mountain height' },
  { name: 'terrainRoughness', type: 'float', min: 0.3, max: 0.7, default: 0.5, description: 'Terrain roughness' },
  { name: 'cloudDensity', type: 'float', min: 0, max: 1, default: 0.65, description: 'Cloud density' },
  { name: 'cloudSpeed', type: 'float', min: 0, max: 1, default: 0.645, description: 'Cloud speed' },
  { name: 'stormIntensity', type: 'float', min: 0, max: 1, default: 0.4, description: 'Storm/cyclone intensity' },
  { name: 'civilization', type: 'float', min: 0, max: 100, default: 91.5, description: 'Civilization (city lights)' },
  { name: 'atmosphereThickness', type: 'float', min: 0, max: 2, default: 0.8, description: 'Atmosphere thickness' },
  { name: 'mineralHue', type: 'float', min: 0, max: 360, default: 120, description: 'Mineral composition hue' },
  { name: 'mineralVariation', type: 'float', min: 0, max: 1, default: 0.4, description: 'Mineral variation' },
  { name: 'iceCaps', type: 'float', min: 0, max: 1, default: 0.565, description: 'Ice cap size' },
  { name: 'riverFrequency', type: 'float', min: 0, max: 1, default: 0.97, description: 'River frequency (0 = none)' },
  { name: 'planetAge', type: 'float', min: 0, max: 1, default: 0.76, description: 'Planet age (0 = young, 1 = ancient)' },
  { name: 'zoom', type: 'float', min: 0.2, max: 2, default: 0.758, description: 'Zoom (smaller = further away)' },
  { name: 'rotationSpeed', type: 'float', min: 0, max: 5, default: 0.5, description: 'Rotation speed' },
  { name: 'lightAngle', type: 'float', min: -180, max: 180, default: 30, description: 'Sun angle' },
]

const planetEvaluateSource = `
return { shaderConfig: {
  fragmentShader: inputs.fragmentShader,
  uniforms: {
    uTime: ctx.elapsed,
    uSeed: inputs.seed,
    uLushness: inputs.lushness,
    uOceanLevel: inputs.oceanLevel,
    uContinentSize: inputs.continentSize,
    uMountainHeight: inputs.mountainHeight,
    uCloudDensity: inputs.cloudDensity,
    uCloudSpeed: inputs.cloudSpeed,
    uStormIntensity: inputs.stormIntensity,
    uCivilization: inputs.civilization,
    uAtmosphereThickness: inputs.atmosphereThickness,
    uMineralHue: inputs.mineralHue,
    uMineralVariation: inputs.mineralVariation,
    uTerrainRoughness: inputs.terrainRoughness,
    uIceCaps: inputs.iceCaps,
    uRiverFrequency: inputs.riverFrequency,
    uPlanetAge: inputs.planetAge,
    uZoom: inputs.zoom,
    uRotationSpeed: inputs.rotationSpeed,
    uLightAngle: inputs.lightAngle,
    uAspect: ctx.resolution ? ctx.resolution[0] / Math.max(ctx.resolution[1], 1) : 1.0,
  }
}};
`

const planetDef: CompoundGeneratorDef = {
  id: 'builtin_planet',
  name: 'Planet',
  description: 'Generative planet with oceans, clouds, terrain, ice caps and atmosphere',
  defaultCameraDistance: 0,
  generatorType: 'planet_generator',
  outputMode: 'shader',
  params: planetParams,
  inputs: planetParams.map(p => ({
    name: p.name,
    type: 'number' as const,
    default: p.type === 'enum' ? 0 : (p.default as number),
  })),
  outputs: [{ name: 'shaderConfig', type: 'array' as const }],
  evaluateSource: planetEvaluateSource,
  fragmentShader: planetFragShader,
}

// ═══════════════════════════════════════════════════════════════════════════
// STARFIELD
// ═══════════════════════════════════════════════════════════════════════════

const starfieldFragShader = `precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uSeed;
uniform float uStarDensity;
uniform float uStarBrightness;
uniform float uNebulaIntensity;
uniform float uNebulaScale;
uniform float uNebulaHue;
uniform float uNebulaHue2;
uniform float uDustDensity;
uniform float uTwinkleSpeed;
uniform float uStarColorVariation;
uniform float uDriftSpeed;
uniform float uGalaxyIntensity;
uniform float uGalaxyAngle;
uniform float uGalaxyWidth;
uniform float uGalaxyCore;
uniform float uAspect;

#define PI 3.14159265359

// Better hash — no diagonal banding
float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float hash3(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.x + p.y) * p.z);
}

float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
             mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
}

float fbm(vec2 p, int octaves) {
  float v = 0.0, a = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    v += a * noise(p);
    p = rot * p * 2.0;
    a *= 0.5;
  }
  return v;
}

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
  vec2 uv = vUv;
  float drift = uTime * uDriftSpeed * 0.01;
  uv += vec2(drift * 0.3, drift * 0.1);
  vec2 coord = uv * vec2(uAspect, 1.0);

  vec3 col = vec3(0.005, 0.005, 0.015); // deep space

  // Nebula layers
  float nebulaScale1 = uNebulaScale * 2.0;
  float n1 = fbm(coord * nebulaScale1 + vec2(uSeed * 7.31, uSeed * 3.17), 6);
  float n2 = fbm(coord * nebulaScale1 * 1.5 + vec2(uSeed * 13.7, uSeed * 9.3) + vec2(drift * 0.1, 0.0), 5);
  float n3 = fbm(coord * nebulaScale1 * 0.5 + vec2(uSeed * 23.1, uSeed * 5.7), 4);

  // Nebula coloring
  vec3 nebCol1 = hsv2rgb(vec3(uNebulaHue / 360.0, 0.7, 1.0));
  vec3 nebCol2 = hsv2rgb(vec3(uNebulaHue2 / 360.0, 0.6, 0.8));
  vec3 nebCol3 = hsv2rgb(vec3(fract(uNebulaHue / 360.0 + 0.5), 0.5, 0.6));

  // At low nebula scale, raise threshold so nebula fills less of the screen
  float scaleThresh = mix(0.55, 0.3, clamp((uNebulaScale - 0.5) / 3.0, 0.0, 1.0));
  float neb1 = smoothstep(scaleThresh, scaleThresh + 0.35, n1) * uNebulaIntensity;
  float neb2 = smoothstep(scaleThresh + 0.05, scaleThresh + 0.35, n2) * uNebulaIntensity * 0.6;
  float neb3 = smoothstep(scaleThresh + 0.1, scaleThresh + 0.25, n3) * uNebulaIntensity * 0.3;

  col += nebCol1 * neb1 * 0.3;
  col += nebCol2 * neb2 * 0.25;
  col += nebCol3 * neb3 * 0.15;

  // Dark dust lanes
  float dust = fbm(coord * nebulaScale1 * 2.0 + vec2(uSeed * 5.3, uSeed * 11.9), 5);
  float dustMask = smoothstep(0.3, 0.6, dust) * uDustDensity;
  col *= (1.0 - dustMask * 0.7);

  // Stars - multiple density layers
  float starCount = uStarDensity * 200.0;
  for (float layer = 0.0; layer < 3.0; layer++) {
    vec2 starUV = coord * (starCount * (0.3 + layer * 0.35));
    vec2 cell = floor(starUV);
    vec2 f = fract(starUV);

    for (int dy = -1; dy <= 1; dy++) {
      for (int dx = -1; dx <= 1; dx++) {
        vec2 neighbor = vec2(float(dx), float(dy));
        vec2 cellId = cell + neighbor;
        float h = hash(cellId + layer * 100.0 + uSeed);
        if (h > 0.7 - layer * 0.1) continue; // star probability

        vec2 starPos = neighbor + vec2(hash(cellId * 1.31 + uSeed), hash(cellId * 2.17 + uSeed)) - f;
        float d = length(starPos);

        // Star brightness variation
        float brightness = hash(cellId * 3.71 + uSeed);
        brightness = pow(brightness, 2.0) * uStarBrightness;

        // Twinkle
        float twinkle = sin(uTime * uTwinkleSpeed * (1.0 + hash(cellId * 5.3) * 3.0) + hash(cellId) * 6.28) * 0.3 + 0.7;
        brightness *= twinkle;

        // Star color (temperature variation)
        float temp = hash(cellId * 7.13 + uSeed);
        vec3 starCol;
        if (temp < 0.15) starCol = vec3(1.0, 0.7, 0.4); // red giant
        else if (temp < 0.3) starCol = vec3(1.0, 0.9, 0.7); // orange
        else if (temp < 0.7) starCol = vec3(1.0, 1.0, 0.95); // white/yellow
        else starCol = vec3(0.7, 0.8, 1.0); // blue
        starCol = mix(vec3(1.0), starCol, uStarColorVariation);

        // Star glow
        float starSize = (0.01 + brightness * 0.02) / (0.3 + layer * 0.35);
        float glow = exp(-d * d / (starSize * starSize)) * brightness;
        // Diffraction spikes for bright stars
        if (brightness > 0.5 && layer < 1.5) {
          float spike = max(exp(-abs(starPos.x) / (starSize * 4.0)) * exp(-abs(starPos.y) / (starSize * 0.3)),
                          exp(-abs(starPos.y) / (starSize * 4.0)) * exp(-abs(starPos.x) / (starSize * 0.3)));
          glow += spike * brightness * 0.15;
        }

        col += starCol * glow;
      }
    }
  }

  // === GALACTIC BAND (Milky Way) ===
  if (uGalaxyIntensity > 0.01) {
    float galAngle = uGalaxyAngle * PI / 180.0;
    float cosG = cos(galAngle), sinG = sin(galAngle);
    // Rotate UV to align galaxy band
    vec2 galUV = coord - vec2(uAspect * 0.5, 0.5);
    vec2 rotUV = vec2(galUV.x * cosG + galUV.y * sinG, -galUV.x * sinG + galUV.y * cosG);

    // Galaxy core proximity — shifts our viewpoint along the band
    // uGalaxyCore 0 = far from core (faint, narrow), 1 = at the core (bright, wide), 2 = deep inside
    float coreProximity = uGalaxyCore;
    // Offset the galaxy center — closer means the core is visible nearby
    float coreOffset = (1.0 - coreProximity) * 0.6; // far = core pushed off-screen
    vec2 coreCenter = vec2(-coreOffset, 0.0);

    // Band gets wider and brighter as we approach the core
    float proximityWidth = 1.0 + coreProximity * 0.8;
    float bandWidth = uGalaxyWidth * 0.15 * proximityWidth;
    float bandDist = abs(rotUV.y) / max(bandWidth, 0.01);
    float bandProfile = exp(-bandDist * bandDist * 2.0);

    // Core glow — centered at our distance-dependent position
    vec2 coreVec = (rotUV - coreCenter) * vec2(0.4, 1.0);
    float coreDist = length(coreVec);
    float coreRadius = 0.1 + coreProximity * 0.3;
    float coreGlow = exp(-coreDist * coreDist / (coreRadius * coreRadius)) * coreProximity;

    // Galactic dust and star clouds using FBM
    float galCloud1 = fbm(rotUV * vec2(3.0, 8.0) + vec2(uSeed * 17.3, uSeed * 3.7), 5);
    float galCloud2 = fbm(rotUV * vec2(5.0, 12.0) + vec2(uSeed * 7.1, uSeed * 11.3), 4);

    // Star concentration in the band — denser near core
    float coreInfluence = exp(-coreDist * coreDist / (0.3 + coreProximity * 0.5));
    float galStars = (smoothstep(0.3, 0.7, galCloud1) * 0.6 + smoothstep(0.35, 0.65, galCloud2) * 0.3) * (1.0 + coreInfluence * coreProximity);

    // Dark dust lanes within the galaxy — absorb light in narrow bands
    float dustLane1 = fbm(rotUV * vec2(4.0, 15.0) + vec2(uSeed * 23.1, 0.0), 5);
    float dustLane2 = fbm(rotUV * vec2(6.0, 20.0) + vec2(uSeed * 31.7, 0.0), 4);
    float galDust = smoothstep(0.4, 0.55, dustLane1) * 0.5 + smoothstep(0.42, 0.55, dustLane2) * 0.3;

    // Galaxy colors — warmer/denser near core, bluer far out
    vec3 galColor = vec3(0.85, 0.82, 0.75); // warm milky tone
    vec3 galYellow = vec3(1.0, 0.9, 0.6);   // core region — old yellow stars
    vec3 galBlue = vec3(0.5, 0.6, 0.9);     // outer spiral arms
    vec3 galPink = vec3(0.9, 0.5, 0.55);    // emission nebulae
    float pinkSpots = smoothstep(0.6, 0.75, galCloud2) * 0.3;
    // Near core: yellower. Far: bluer.
    galColor = mix(galColor, galYellow, coreInfluence * coreProximity * 0.5);
    galColor = mix(galColor, galBlue, smoothstep(0.3, 0.8, bandDist) * 0.3 * (1.0 - coreInfluence * 0.5));
    galColor += galPink * pinkSpots;

    // Combine band profile with cloud structure
    float galBrightness = bandProfile * (galStars + 0.3 + coreGlow) * (1.0 - galDust * 0.6);
    galBrightness *= uGalaxyIntensity;

    // Thousands of unresolved faint stars create the milky glow
    float microStars = noise(rotUV * 80.0 + uSeed) * 0.2 + noise(rotUV * 160.0 + uSeed) * 0.1;
    galBrightness += microStars * bandProfile * uGalaxyIntensity * 0.3;

    col += galColor * galBrightness * 0.4;
  }

  // Vignette
  float vig = 1.0 - length((vUv - 0.5) * 1.2) * 0.3;
  col *= vig;

  gl_FragColor = vec4(col, 1.0);
}
`

const starfieldParams: ParamSchemaDef[] = [
  { name: 'seed', type: 'float', min: 0, max: 100, default: 7, description: 'Random seed' },
  { name: 'starDensity', type: 'float', min: 0.2, max: 3, default: 1, description: 'Star density' },
  { name: 'starBrightness', type: 'float', min: 0.3, max: 2, default: 1, description: 'Star brightness' },
  { name: 'starColorVariation', type: 'float', min: 0, max: 1, default: 0.7, description: 'Star color variation' },
  { name: 'twinkleSpeed', type: 'float', min: 0, max: 1, default: 0.3, description: 'Twinkle speed' },
  { name: 'nebulaIntensity', type: 'float', min: 0, max: 2, default: 0.8, description: 'Nebula intensity' },
  { name: 'nebulaScale', type: 'float', min: 0.5, max: 5, default: 2, description: 'Nebula scale' },
  { name: 'nebulaHue', type: 'float', min: 0, max: 360, default: 270, description: 'Nebula hue' },
  { name: 'nebulaHue2', type: 'float', min: 0, max: 360, default: 30, description: 'Nebula secondary hue' },
  { name: 'dustDensity', type: 'float', min: 0, max: 1, default: 0.4, description: 'Dust lane density' },
  { name: 'galaxyIntensity', type: 'float', min: 0, max: 2, default: 0, description: 'Milky Way intensity' },
  { name: 'galaxyAngle', type: 'float', min: -90, max: 90, default: 25, description: 'Galaxy band angle' },
  { name: 'galaxyWidth', type: 'float', min: 0.5, max: 5, default: 2, description: 'Galaxy band width' },
  { name: 'galaxyCore', type: 'float', min: 0, max: 2, default: 0.8, description: 'Distance to galactic core (higher = closer)' },
  { name: 'driftSpeed', type: 'float', min: 0, max: 5, default: 0.5, description: 'Drift speed' },
]

const starfieldEvaluateSource = `
return { shaderConfig: {
  fragmentShader: inputs.fragmentShader,
  uniforms: {
    uTime: ctx.elapsed,
    uSeed: inputs.seed,
    uStarDensity: inputs.starDensity,
    uStarBrightness: inputs.starBrightness,
    uStarColorVariation: inputs.starColorVariation,
    uTwinkleSpeed: inputs.twinkleSpeed,
    uNebulaIntensity: inputs.nebulaIntensity,
    uNebulaScale: inputs.nebulaScale,
    uNebulaHue: inputs.nebulaHue,
    uNebulaHue2: inputs.nebulaHue2,
    uDustDensity: inputs.dustDensity,
    uGalaxyIntensity: inputs.galaxyIntensity,
    uGalaxyAngle: inputs.galaxyAngle,
    uGalaxyWidth: inputs.galaxyWidth,
    uGalaxyCore: inputs.galaxyCore,
    uDriftSpeed: inputs.driftSpeed,
    uAspect: ctx.resolution ? ctx.resolution[0] / Math.max(ctx.resolution[1], 1) : 1.0,
  }
}};
`

const starfieldDef: CompoundGeneratorDef = {
  id: 'builtin_starfield',
  name: 'Starfield',
  description: 'Generative starfield with nebulae, dust lanes, and twinkling stars',
  defaultCameraDistance: 0,
  generatorType: 'starfield_generator',
  outputMode: 'shader',
  params: starfieldParams,
  inputs: starfieldParams.map(p => ({
    name: p.name,
    type: 'number' as const,
    default: p.default as number,
  })),
  outputs: [{ name: 'shaderConfig', type: 'array' as const }],
  evaluateSource: starfieldEvaluateSource,
  fragmentShader: starfieldFragShader,
}

// ═══════════════════════════════════════════════════════════════════════════
// KALEIDOSCOPE
// ═══════════════════════════════════════════════════════════════════════════

const kaleidoscopeFragShader = `precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uSegments;
uniform float uZoom;
uniform float uRotationSpeed;
uniform float uColorSpeed;
uniform float uComplexity;
uniform float uSymmetryMode;
uniform float uColorPalette;
uniform float uDistortion;
uniform float uPulseAmount;
uniform float uInnerPattern;
uniform float uAspect;

#define PI 3.14159265359
#define TAU 6.28318530718

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
             mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = rot * p * 2.0;
    a *= 0.5;
  }
  return v;
}

vec3 palette(float t, float pal) {
  t = fract(t);
  if (pal < 0.5) { // jewel
    vec3 a=vec3(0.5,0.5,0.5), b=vec3(0.5,0.5,0.5), c=vec3(1.0,1.0,1.0), d=vec3(0.0,0.1,0.2);
    return a + b * cos(TAU * (c * t + d));
  }
  if (pal < 1.5) { // fire
    vec3 a=vec3(0.5,0.5,0.5), b=vec3(0.5,0.5,0.5), c=vec3(1.0,0.7,0.4), d=vec3(0.0,0.15,0.2);
    return a + b * cos(TAU * (c * t + d));
  }
  if (pal < 2.5) { // ocean
    vec3 a=vec3(0.5,0.5,0.5), b=vec3(0.5,0.5,0.5), c=vec3(1.0,1.0,0.5), d=vec3(0.8,0.9,0.3);
    return a + b * cos(TAU * (c * t + d));
  }
  if (pal < 3.5) { // neon
    vec3 a=vec3(0.5,0.5,0.5), b=vec3(0.5,0.5,0.5), c=vec3(2.0,1.0,0.0), d=vec3(0.5,0.2,0.25);
    return a + b * cos(TAU * (c * t + d));
  }
  // stained glass
  vec3 a=vec3(0.8,0.5,0.4), b=vec3(0.2,0.4,0.2), c=vec3(2.0,1.0,1.0), d=vec3(0.0,0.25,0.25);
  return a + b * cos(TAU * (c * t + d));
}

void main() {
  vec2 uv = (vUv - 0.5) * 2.0;
  uv.x *= uAspect;

  // Polar coordinates
  float r = length(uv);
  float a = atan(uv.y, uv.x);

  // Kaleidoscope fold
  float segs = max(2.0, floor(uSegments));
  float segAngle = TAU / segs;
  a = mod(a, segAngle);
  if (mod(floor(atan(uv.y, uv.x) / segAngle), 2.0) > 0.5) {
    a = segAngle - a; // mirror alternate segments
  }

  // Apply secondary symmetry
  float symMode = floor(uSymmetryMode + 0.5);
  if (symMode > 0.5 && symMode < 1.5) {
    // Radial mirror
    a = abs(a - segAngle * 0.5);
  } else if (symMode > 1.5) {
    // Double fold
    a = abs(abs(a - segAngle * 0.5) - segAngle * 0.25);
  }

  // Convert back to cartesian with animation
  float rot = uTime * uRotationSpeed * 0.2;
  float pulse = 1.0 + sin(uTime * 1.5) * uPulseAmount * 0.2;
  float zoomR = r * uZoom * pulse;
  vec2 p = vec2(cos(a + rot), sin(a + rot)) * zoomR;

  // Distortion
  p += vec2(sin(p.y * 3.0 + uTime * 0.5), cos(p.x * 3.0 + uTime * 0.7)) * uDistortion * 0.2;

  // Inner pattern selection
  float pat = floor(uInnerPattern + 0.5);
  float value;

  if (pat < 0.5) {
    // Organic fbm
    value = fbm(p * uComplexity + vec2(uTime * uColorSpeed * 0.1, uTime * uColorSpeed * 0.07));
  } else if (pat < 1.5) {
    // Geometric tiles
    vec2 gp = p * uComplexity;
    float g1 = sin(gp.x * 3.0 + uTime * uColorSpeed * 0.3) * cos(gp.y * 3.0 + uTime * uColorSpeed * 0.2);
    float g2 = sin(length(gp) * 5.0 - uTime * uColorSpeed * 0.5);
    value = g1 * 0.5 + g2 * 0.5;
  } else if (pat < 2.5) {
    // Spiral
    float spiralA = atan(p.y, p.x);
    float spiralR = length(p);
    value = sin(spiralA * 4.0 + spiralR * uComplexity * 5.0 - uTime * uColorSpeed) * 0.5 + 0.5;
    value += fbm(p * uComplexity * 0.5 + uTime * 0.05) * 0.3;
  } else {
    // Crystalline
    vec2 cp = p * uComplexity;
    float c1 = abs(sin(cp.x + uTime * uColorSpeed * 0.2) * cos(cp.y + uTime * uColorSpeed * 0.15));
    float c2 = abs(sin(cp.x + cp.y + uTime * uColorSpeed * 0.1));
    float c3 = abs(cos(cp.x - cp.y + uTime * uColorSpeed * 0.12));
    value = c1 * c2 * c3;
    value = sqrt(value);
  }

  // Color mapping
  float colorT = value * 0.5 + uTime * uColorSpeed * 0.02;
  vec3 col = palette(colorT, floor(uColorPalette + 0.5));

  // Radial brightness
  float radialFade = 1.0 - smoothstep(0.0, 1.5, r);
  col *= radialFade * 0.7 + 0.3;

  // Center glow
  float centerGlow = exp(-r * r * 4.0) * 0.15;
  col += vec3(1.0, 0.9, 0.8) * centerGlow;

  gl_FragColor = vec4(col, 1.0);
}
`

const kaleidoscopeParams: ParamSchemaDef[] = [
  { name: 'segments', type: 'int', min: 3, max: 24, default: 8, description: 'Mirror segments' },
  { name: 'zoom', type: 'float', min: 0.5, max: 5, default: 2, description: 'Zoom level' },
  { name: 'rotationSpeed', type: 'float', min: 0, max: 3, default: 0.5, description: 'Rotation speed' },
  { name: 'colorSpeed', type: 'float', min: 0, max: 5, default: 1, description: 'Color animation speed' },
  { name: 'complexity', type: 'float', min: 0.5, max: 5, default: 2, description: 'Pattern complexity' },
  { name: 'symmetryMode', type: 'enum', default: 'standard', enumValues: ['standard', 'radial', 'double'], description: 'Symmetry mode' },
  { name: 'innerPattern', type: 'enum', default: 'organic', enumValues: ['organic', 'geometric', 'spiral', 'crystalline'], description: 'Inner pattern' },
  { name: 'colorPalette', type: 'enum', default: 'jewel', enumValues: ['jewel', 'fire', 'ocean', 'neon', 'stained_glass'], description: 'Color palette' },
  { name: 'distortion', type: 'float', min: 0, max: 2, default: 0.3, description: 'Distortion amount' },
  { name: 'pulseAmount', type: 'float', min: 0, max: 1, default: 0.2, description: 'Pulse amount' },
]

const kaleidoscopeEvaluateSource = `
return { shaderConfig: {
  fragmentShader: inputs.fragmentShader,
  uniforms: {
    uTime: ctx.elapsed,
    uSegments: inputs.segments,
    uZoom: inputs.zoom,
    uRotationSpeed: inputs.rotationSpeed,
    uColorSpeed: inputs.colorSpeed,
    uComplexity: inputs.complexity,
    uSymmetryMode: Math.round(inputs.symmetryMode || 0),
    uInnerPattern: Math.round(inputs.innerPattern || 0),
    uColorPalette: Math.round(inputs.colorPalette || 0),
    uDistortion: inputs.distortion,
    uPulseAmount: inputs.pulseAmount,
    uAspect: ctx.resolution ? ctx.resolution[0] / Math.max(ctx.resolution[1], 1) : 1.0,
  }
}};
`

const kaleidoscopeDef: CompoundGeneratorDef = {
  id: 'builtin_kaleidoscope',
  name: 'Kaleidoscope',
  description: 'Animated kaleidoscope with mirrored symmetry and multiple inner patterns',
  defaultCameraDistance: 0,
  generatorType: 'kaleidoscope_generator',
  outputMode: 'shader',
  params: kaleidoscopeParams,
  inputs: kaleidoscopeParams.map(p => ({
    name: p.name,
    type: 'number' as const,
    default: p.type === 'enum' ? 0 : (p.default as number),
  })),
  outputs: [{ name: 'shaderConfig', type: 'array' as const }],
  evaluateSource: kaleidoscopeEvaluateSource,
  fragmentShader: kaleidoscopeFragShader,
}

// ═══════════════════════════════════════════════════════════════════════════
// LIGHTNING STORM
// ═══════════════════════════════════════════════════════════════════════════

const lightningStormFragShader = `precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uSeed;
uniform float uBoltFrequency;
uniform float uBoltBranching;
uniform float uBoltThickness;
uniform float uBoltGlow;
uniform float uCloudCoverage;
uniform float uCloudIllumination;
uniform float uRainIntensity;
uniform float uWindAngle;
uniform float uFlashBrightness;
uniform float uBoltColor;
uniform float uSkyDarkness;
uniform float uForkCount;
uniform float uBoltSpeed;
uniform float uAspect;

#define PI 3.14159265359

float hash(float n) { return fract(sin(n) * 43758.5453); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2(1,0)), f.x),
             mix(hash2(i + vec2(0,1)), hash2(i + vec2(1,1)), f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 6; i++) {
    v += a * noise(p);
    p = rot * p * 2.0;
    a *= 0.5;
  }
  return v;
}

// Lightning bolt using FBM-displaced line with branching
float bolt(vec2 uv, vec2 start, vec2 end, float seed, float thickness, float branching) {
  float glow = 0.0;
  vec2 dir = end - start;
  float len = length(dir);
  vec2 norm = normalize(dir);
  vec2 perp = vec2(-norm.y, norm.x);

  // Main bolt
  float segments = 30.0;
  for (float i = 0.0; i < 30.0; i++) {
    float t0 = i / segments;
    float t1 = (i + 1.0) / segments;

    vec2 p0 = start + dir * t0;
    vec2 p1 = start + dir * t1;

    // FBM displacement perpendicular to bolt direction
    float disp0 = (fbm(vec2(t0 * 8.0 + seed, seed * 3.7)) - 0.5) * 0.15 * len;
    float disp1 = (fbm(vec2(t1 * 8.0 + seed, seed * 3.7)) - 0.5) * 0.15 * len;

    // Taper displacement at endpoints
    float taper0 = smoothstep(0.0, 0.1, t0) * smoothstep(1.0, 0.8, t0);
    float taper1 = smoothstep(0.0, 0.1, t1) * smoothstep(1.0, 0.8, t1);

    p0 += perp * disp0 * taper0;
    p1 += perp * disp1 * taper1;

    // Distance from point to line segment
    vec2 pa = uv - p0, ba = p1 - p0;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    float d = length(pa - ba * h);

    float bright = thickness / (d + thickness * 0.5);
    glow += bright * 0.03;

    // Branching forks
    if (branching > 0.0 && hash(seed + i * 7.13) > (1.0 - branching * 0.3)) {
      float branchAngle = (hash(seed + i * 13.7) - 0.5) * 1.2;
      float branchLen = len * (0.1 + hash(seed + i * 23.1) * 0.15);
      vec2 branchDir = vec2(
        norm.x * cos(branchAngle) - norm.y * sin(branchAngle),
        norm.x * sin(branchAngle) + norm.y * cos(branchAngle)
      );
      vec2 branchEnd = p0 + branchDir * branchLen;

      // Simple branch (fewer segments)
      for (float j = 0.0; j < 10.0; j++) {
        float bt0 = j / 10.0;
        float bt1 = (j + 1.0) / 10.0;
        vec2 bp0 = p0 + (branchEnd - p0) * bt0;
        vec2 bp1 = p0 + (branchEnd - p0) * bt1;
        float bdisp0 = (hash(seed + i * 5.0 + j * 3.0) - 0.5) * 0.04 * branchLen;
        float bdisp1 = (hash(seed + i * 5.0 + (j+1.0) * 3.0) - 0.5) * 0.04 * branchLen;
        bp0 += perp * bdisp0 * (1.0 - bt0);
        bp1 += perp * bdisp1 * (1.0 - bt1);

        vec2 bpa = uv - bp0, bba = bp1 - bp0;
        float bh = clamp(dot(bpa, bba) / dot(bba, bba), 0.0, 1.0);
        float bd = length(bpa - bba * bh);
        glow += (thickness * 0.5) / (bd + thickness * 0.5) * 0.015 * (1.0 - bt0);
      }
    }
  }
  return glow;
}

void main() {
  vec2 uv = vUv;
  uv.x *= uAspect;
  float windRad = uWindAngle * PI / 180.0;

  // === STORM CLOUDS ===
  vec2 cloudUV = uv * 3.0;
  cloudUV += vec2(uTime * 0.02, uTime * 0.01);
  float cloud = fbm(cloudUV + vec2(uSeed * 5.3, uSeed * 3.1));
  float cloud2 = fbm(cloudUV * 1.5 + vec2(uSeed * 7.1, uSeed * 11.3) + uTime * 0.03);
  float cloudDensity = smoothstep(0.3 - uCloudCoverage * 0.3, 0.7, cloud * 0.6 + cloud2 * 0.4);

  // Dark storm sky gradient
  vec3 skyTop = vec3(0.02, 0.02, 0.04) * (1.0 - uSkyDarkness * 0.5);
  vec3 skyBot = vec3(0.04, 0.04, 0.06) * (1.0 - uSkyDarkness * 0.5);
  vec3 skyColor = mix(skyBot, skyTop, uv.y);

  // Cloud color (dark gray with slight purple tint)
  vec3 cloudColor = vec3(0.08, 0.07, 0.1) * (1.0 - uSkyDarkness * 0.3);
  vec3 col = mix(skyColor, cloudColor, cloudDensity);

  // === LIGHTNING BOLTS ===
  // Multiple bolt slots — each fires based on time and frequency
  float totalBoltGlow = 0.0;
  float flashAccum = 0.0;
  int forkCount = int(uForkCount);

  for (int b = 0; b < 5; b++) {
    if (b >= forkCount) break;

    // Each bolt has its own timing cycle
    float boltSeed = uSeed + float(b) * 17.3;
    float cycleLen = mix(3.0, 0.5, uBoltFrequency);
    float cycle = mod(uTime * uBoltSpeed + hash(boltSeed) * cycleLen, cycleLen);
    float boltLife = 0.15 + hash(boltSeed + 1.0) * 0.1; // how long bolt stays visible

    if (cycle < boltLife) {
      // Bolt is active
      float boltPhase = cycle / boltLife;
      float boltAlpha = smoothstep(0.0, 0.05, boltPhase) * smoothstep(1.0, 0.3, boltPhase);

      // Random start/end positions
      float startX = hash(boltSeed + floor(uTime * uBoltSpeed / cycleLen) * 7.3) * uAspect;
      float startY = 0.7 + hash(boltSeed + floor(uTime * uBoltSpeed / cycleLen) * 11.1) * 0.3;
      float endX = startX + (hash(boltSeed + floor(uTime * uBoltSpeed / cycleLen) * 19.7) - 0.5) * 0.3;
      float endY = 0.0 + hash(boltSeed + floor(uTime * uBoltSpeed / cycleLen) * 23.3) * 0.3;

      vec2 bStart = vec2(startX, startY);
      vec2 bEnd = vec2(endX, endY);

      float bSeed = boltSeed + floor(uTime * uBoltSpeed / cycleLen) * 100.0;
      float g = bolt(uv, bStart, bEnd, bSeed, uBoltThickness * 0.003, uBoltBranching);
      totalBoltGlow += g * boltAlpha;

      // Flash illumination
      flashAccum += boltAlpha * 0.5;
    }
  }

  // Bolt color — from white-blue to purple based on uBoltColor
  vec3 boltCol;
  if (uBoltColor < 0.33) {
    boltCol = mix(vec3(0.7, 0.8, 1.0), vec3(0.9, 0.9, 1.0), uBoltColor * 3.0); // white-blue
  } else if (uBoltColor < 0.66) {
    boltCol = mix(vec3(0.9, 0.9, 1.0), vec3(0.7, 0.5, 1.0), (uBoltColor - 0.33) * 3.0); // purple
  } else {
    boltCol = mix(vec3(0.7, 0.5, 1.0), vec3(1.0, 0.7, 0.3), (uBoltColor - 0.66) * 3.0); // warm
  }

  // Apply bolt glow
  col += boltCol * totalBoltGlow * uBoltGlow;

  // Lightning flash illuminates clouds from behind/within
  float flashAmount = flashAccum * uFlashBrightness * uCloudIllumination;
  vec3 flashColor = boltCol * 0.5 + vec3(0.5);

  // Volumetric cloud illumination — use raw FBM layers for internal structure
  // Sample at different scales to create depth variation within clouds
  float cloudDetail = fbm(cloudUV * 2.5 + vec2(uSeed * 9.1, uSeed * 4.7));
  float cloudRidges = abs(cloud - cloud2) * 2.0; // internal structure from two cloud layers
  float cloudThickness = cloudDensity * (0.5 + cloudDetail * 0.5); // varies within cloud mass

  // Brightest at thick internal regions, not uniformly across density
  col += flashColor * flashAmount * cloudThickness * 0.35;

  // Subsurface scattering — light bleeding through thinner cloud edges
  float cloudEdge = smoothstep(0.1, 0.5, cloudDensity) * smoothstep(0.9, 0.5, cloudDensity);
  col += flashColor * flashAmount * cloudEdge * 0.12;

  // Internal ridges/turbulence visible during flash
  col += flashColor * flashAmount * cloudRidges * cloudDensity * 0.15;

  // Sky flash — general ambient brightening (reduced so clouds stand out more)
  col += flashColor * flashAmount * 0.05;

  // === RAIN ===
  if (uRainIntensity > 0.01) {
    for (float layer = 0.0; layer < 3.0; layer++) {
      float layerScale = 80.0 + layer * 40.0;
      float layerSpeed = 3.0 + layer * 1.5;
      float layerAlpha = (0.3 - layer * 0.08) * uRainIntensity;

      // Wind-tilted rain
      vec2 rainUV = uv * vec2(layerScale, layerScale * 0.3);
      rainUV.x += rainUV.y * sin(windRad) * 0.3; // wind tilt
      rainUV.y += uTime * layerSpeed;

      vec2 rainCell = floor(rainUV);
      vec2 rainF = fract(rainUV);

      float dropX = hash2(rainCell + layer * 100.0 + uSeed);
      float dropLen = 0.15 + hash2(rainCell * 1.3 + layer * 200.0) * 0.25;
      float dropY = fract(hash2(rainCell * 2.7 + layer * 300.0) + uTime * layerSpeed * 0.1);

      float dx = abs(rainF.x - dropX);
      float dy = rainF.y - dropY;
      if (dy > 0.0 && dy < dropLen && dx < 0.02) {
        float streak = (1.0 - dx / 0.02) * (1.0 - dy / dropLen);
        col += vec3(0.3, 0.35, 0.4) * streak * layerAlpha;
      }
    }
  }

  // Subtle ground reflection of lightning
  if (uv.y < 0.1) {
    float groundReflect = (0.1 - uv.y) / 0.1;
    col += boltCol * totalBoltGlow * groundReflect * 0.1 * uBoltGlow;
    col += flashColor * flashAccum * groundReflect * 0.05 * uFlashBrightness;
  }

  gl_FragColor = vec4(col, 1.0);
}
`

const lightningStormParams: ParamSchemaDef[] = [
  { name: 'seed', type: 'float', min: 0, max: 100, default: 7, description: 'Random seed' },
  { name: 'boltFrequency', type: 'float', min: 0.1, max: 1, default: 0.5, description: 'Bolt frequency' },
  { name: 'forkCount', type: 'int', min: 1, max: 5, default: 3, description: 'Simultaneous bolts' },
  { name: 'boltBranching', type: 'float', min: 0, max: 1, default: 0.5, description: 'Branch density' },
  { name: 'boltThickness', type: 'float', min: 0.3, max: 3, default: 1, description: 'Bolt thickness' },
  { name: 'boltGlow', type: 'float', min: 0.5, max: 5, default: 2, description: 'Bolt glow intensity' },
  { name: 'boltSpeed', type: 'float', min: 0.3, max: 3, default: 1, description: 'Bolt cycle speed' },
  { name: 'boltColor', type: 'float', min: 0, max: 1, default: 0.15, description: 'Bolt color (blue→purple→warm)' },
  { name: 'flashBrightness', type: 'float', min: 0, max: 2, default: 1, description: 'Flash brightness' },
  { name: 'cloudCoverage', type: 'float', min: 0, max: 1, default: 0.7, description: 'Cloud coverage' },
  { name: 'cloudIllumination', type: 'float', min: 0, max: 2, default: 1, description: 'Cloud illumination' },
  { name: 'rainIntensity', type: 'float', min: 0, max: 1, default: 0.5, description: 'Rain intensity' },
  { name: 'windAngle', type: 'float', min: -45, max: 45, default: 10, description: 'Wind angle' },
  { name: 'skyDarkness', type: 'float', min: 0, max: 1, default: 0.6, description: 'Sky darkness' },
]

const lightningStormEvaluateSource = `
return { shaderConfig: {
  fragmentShader: inputs.fragmentShader,
  uniforms: {
    uTime: ctx.elapsed,
    uSeed: inputs.seed,
    uBoltFrequency: inputs.boltFrequency,
    uForkCount: inputs.forkCount,
    uBoltBranching: inputs.boltBranching,
    uBoltThickness: inputs.boltThickness,
    uBoltGlow: inputs.boltGlow,
    uBoltSpeed: inputs.boltSpeed,
    uBoltColor: inputs.boltColor,
    uFlashBrightness: inputs.flashBrightness,
    uCloudCoverage: inputs.cloudCoverage,
    uCloudIllumination: inputs.cloudIllumination,
    uRainIntensity: inputs.rainIntensity,
    uWindAngle: inputs.windAngle,
    uSkyDarkness: inputs.skyDarkness,
    uAspect: ctx.resolution ? ctx.resolution[0] / Math.max(ctx.resolution[1], 1) : 1.0,
  }
}};
`

const lightningStormDef: CompoundGeneratorDef = {
  id: 'builtin_lightningStorm',
  name: 'Lightning Storm',
  description: 'Electrical storm with branching lightning bolts, storm clouds, and rain',
  defaultCameraDistance: 0,
  generatorType: 'lightningStorm_generator',
  outputMode: 'shader',
  params: lightningStormParams,
  inputs: lightningStormParams.map(p => ({
    name: p.name,
    type: 'number' as const,
    default: p.default as number,
  })),
  outputs: [{ name: 'shaderConfig', type: 'array' as const }],
  evaluateSource: lightningStormEvaluateSource,
  fragmentShader: lightningStormFragShader,
}

// ═══════════════════════════════════════════════════════════════════════════
// AURORA BOREALIS
// ═══════════════════════════════════════════════════════════════════════════

const auroraFragShader = `precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uSeed;
uniform float uIntensity;
uniform float uCurtainHeight;
uniform float uCurtainWidth;
uniform float uWaveSpeed;
uniform float uWaveScale;
uniform float uColorShift;
uniform float uVerticalStretch;
uniform float uShimmerSpeed;
uniform float uShimmerAmount;
uniform float uGreenBlue;
uniform float uPurpleAmount;
uniform float uHorizonGlow;
uniform float uStarDensity;
uniform float uSwoosh;
uniform float uAspect;

#define PI 3.14159265359

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

// Smooth value noise with quintic interpolation (no grid artifacts)
float snoise2(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  // Quintic Hermite interpolation — eliminates grid artifacts
  f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// FBM with smooth noise for aurora
float auroraFbm(vec2 p, int octaves) {
  float v = 0.0, a = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 5; i++) {
    if (i >= octaves) break;
    v += a * snoise2(p);
    p = rot * p * 2.0;
    a *= 0.5;
  }
  return v;
}

// Aurora curtain using FBM-difference technique (smooth, no grid)
float auroraCurtain(vec2 uv, float time, float seed, float swoosh) {
  // Swoosh: vertical displacement that varies along x — creates arcing ribbons
  // Multiple swoosh waves at different scales for organic feel
  float swoopDisplace = 0.0;
  swoopDisplace += sin(uv.x * 1.8 + time * 0.12 + seed * 2.3) * 0.35;
  swoopDisplace += sin(uv.x * 3.5 - time * 0.08 + seed * 5.1) * 0.2;
  swoopDisplace += auroraFbm(vec2(uv.x * 2.0 + time * 0.06 + seed, seed * 1.7), 3) * 0.5;
  swoopDisplace *= swoosh;

  // Apply swoosh to y coordinate — this bends the curtain up and down
  vec2 swooshed = vec2(uv.x, uv.y + swoopDisplace);

  // Stretch horizontally for curtain-like appearance, but less squash with more swoosh
  float ySquash = mix(0.3, 0.6, swoosh);
  vec2 st = swooshed * vec2(1.0, ySquash);

  // Two FBM fields at slightly different scales — their difference creates curtain folds
  float n1 = auroraFbm(st * 3.0 + vec2(time * 0.15 + seed, seed * 3.7), 5);
  float n2 = auroraFbm(st * 3.3 + vec2(time * 0.12 + seed * 2.1, seed * 5.3), 5);
  float curtain = abs(n1 - n2);

  // Finer detail layer
  vec2 st2 = swooshed * vec2(1.5, mix(0.4, 0.7, swoosh));
  float d1 = auroraFbm(st2 * 6.0 + vec2(time * 0.2 + seed * 4.1, seed * 7.1), 4);
  float d2 = auroraFbm(st2 * 6.5 + vec2(time * 0.18 + seed * 6.3, seed * 9.7), 4);
  curtain += abs(d1 - d2) * 0.4;

  // Fine shimmer
  float f1 = snoise2(swooshed * vec2(3.0, 1.0) * 8.0 + vec2(time * 0.3 + seed * 8.1, seed * 11.3));
  float f2 = snoise2(swooshed * vec2(3.2, 1.05) * 8.0 + vec2(time * 0.28 + seed * 10.7, seed * 13.1));
  curtain += abs(f1 - f2) * 0.2;

  return curtain;
}

void main() {
  vec2 uv = vUv;
  uv.x *= uAspect;

  // === DARK SKY WITH STARS ===
  vec3 col = vec3(0.005, 0.005, 0.02);

  // Horizon gradient
  float horizonGrad = smoothstep(0.0, 0.4, uv.y);
  col = mix(vec3(0.01, 0.015, 0.03), col, horizonGrad);

  // Stars
  if (uStarDensity > 0.01) {
    float starScale = 150.0 * uStarDensity;
    vec2 starUV = uv * starScale;
    vec2 starCell = floor(starUV);
    vec2 starF = fract(starUV);
    float starH = hash(starCell + uSeed);
    if (starH > 0.92) {
      vec2 starPos = vec2(hash(starCell * 1.3 + uSeed), hash(starCell * 2.7 + uSeed));
      float d = length(starF - starPos);
      float twinkle = sin(uTime * (1.0 + starH * 4.0) + starH * 6.28) * 0.3 + 0.7;
      float star = exp(-d * d * 800.0) * starH * twinkle;
      col += vec3(0.8, 0.85, 1.0) * star * 0.5;
    }
  }

  // === AURORA ===
  // Vertical position mapping — aurora band in upper portion of sky
  // Swoosh makes the band undulate vertically across the sky
  float swoopOffset = 0.0;
  swoopOffset += sin(uv.x * 1.8 + uTime * 0.12 + uSeed * 2.3) * 0.08;
  swoopOffset += sin(uv.x * 3.5 - uTime * 0.08 + uSeed * 5.1) * 0.05;
  swoopOffset *= uSwoosh;

  float auroraBottom = uCurtainHeight * 0.3 + 0.3 + swoopOffset;
  float bandHeight = mix(0.35, 0.45, uSwoosh); // wider band when swooshy
  float auroraTop = auroraBottom + bandHeight;
  float auroraY = (uv.y - auroraBottom) / (auroraTop - auroraBottom);

  if (auroraY > -0.3 && auroraY < 1.3) {
    // Vertical envelope — Gaussian-like profile, wider for swoosh
    float envWidth = mix(2.5, 1.8, uSwoosh);
    float envelope = exp(-pow((auroraY - 0.5) * envWidth, 2.0));
    // Sharper bottom edge (like real aurora)
    envelope *= smoothstep(-0.05, 0.15, auroraY);
    // Softer top fade
    envelope *= smoothstep(1.15, 0.8, auroraY);

    // Horizontal coverage — the aurora doesn't fill the whole sky evenly
    float hCoverage = smoothstep(0.0, 0.2, uv.x / uAspect) * smoothstep(1.0, 0.8, uv.x / uAspect);
    float hWave = sin(uv.x * 2.0 + uTime * 0.1 + uSeed) * 0.15 + 0.85;
    hCoverage *= hWave * uCurtainWidth;

    // Aurora curtain pattern
    vec2 aUV = vec2(uv.x * 2.0, auroraY * uVerticalStretch);
    float curtain = auroraCurtain(aUV * uWaveScale, uTime * uWaveSpeed, uSeed, uSwoosh);

    // Shimmer — rapid fine variations
    float shimmer = snoise2(vec2(uv.x * 20.0, auroraY * 3.0 + uTime * uShimmerSpeed));
    curtain = mix(curtain, curtain * (0.7 + shimmer * 0.6), uShimmerAmount);

    // Intensity
    float auroraAlpha = curtain * envelope * hCoverage * uIntensity;
    auroraAlpha = clamp(auroraAlpha, 0.0, 1.0);

    // === AURORA COLORS ===
    // Height-dependent: green center, blue-purple bottom, red top (real emission lines)
    // Bottom: blue-purple (nitrogen)
    vec3 bottomColor = vec3(0.2, 0.1, 0.6 + uPurpleAmount * 0.4);
    // Lower-mid: bright green (557.7nm oxygen)
    vec3 greenColor = vec3(0.1, 0.9, 0.3);
    // Adjust green-blue balance
    greenColor = mix(greenColor, vec3(0.1, 0.6, 0.9), uGreenBlue);
    // Upper: yellow-green to red (630nm oxygen)
    vec3 topColor = vec3(0.7, 0.2, 0.3);

    vec3 auroraColor;
    float colorY = auroraY + uColorShift * 0.3;
    if (colorY < 0.3) {
      auroraColor = mix(bottomColor, greenColor, smoothstep(0.0, 0.3, colorY));
    } else if (colorY < 0.7) {
      auroraColor = mix(greenColor, mix(greenColor, topColor, 0.3), smoothstep(0.3, 0.7, colorY));
    } else {
      auroraColor = mix(mix(greenColor, topColor, 0.3), topColor, smoothstep(0.7, 1.0, colorY));
    }

    // Brighter regions shift toward green (intensity-modulated hue)
    float brightShift = smoothstep(0.3, 0.8, curtain);
    auroraColor = mix(auroraColor, greenColor, brightShift * 0.3);

    // Apply aurora
    col += auroraColor * auroraAlpha * 1.5;

    // Soft glow around bright regions
    float glowRadius = 0.15;
    float glow = exp(-pow((auroraY - 0.4) * 3.0, 2.0)) * curtain * 0.3 * uIntensity;
    col += auroraColor * glow * 0.2;
  }

  // === HORIZON GLOW ===
  // Subtle reflected light on horizon from aurora
  float horizonRef = smoothstep(0.15, 0.0, uv.y) * uHorizonGlow;
  vec3 horizonColor = vec3(0.05, 0.15, 0.08);
  // Tint horizon glow based on green-blue setting
  horizonColor = mix(horizonColor, vec3(0.05, 0.1, 0.15), uGreenBlue);
  col += horizonColor * horizonRef * uIntensity;

  // Dark landscape silhouette at bottom
  float landscape = smoothstep(0.08, 0.05, uv.y);
  float terrainBump = snoise2(vec2(uv.x * 15.0 + uSeed, uSeed)) * 0.03;
  landscape = smoothstep(0.08 + terrainBump, 0.05 + terrainBump, uv.y);
  col = mix(col, vec3(0.005, 0.008, 0.01), landscape);

  gl_FragColor = vec4(col, 1.0);
}
`

const auroraParams: ParamSchemaDef[] = [
  { name: 'seed', type: 'float', min: 0, max: 100, default: 12, description: 'Random seed' },
  { name: 'intensity', type: 'float', min: 0.2, max: 2, default: 1, description: 'Aurora intensity' },
  { name: 'curtainHeight', type: 'float', min: 0, max: 1, default: 0.5, description: 'Curtain height' },
  { name: 'curtainWidth', type: 'float', min: 0.3, max: 1.5, default: 1, description: 'Curtain width' },
  { name: 'waveSpeed', type: 'float', min: 0.1, max: 3, default: 0.8, description: 'Wave speed' },
  { name: 'waveScale', type: 'float', min: 0.5, max: 3, default: 1.2, description: 'Wave scale' },
  { name: 'verticalStretch', type: 'float', min: 0.5, max: 3, default: 1.5, description: 'Vertical stretch' },
  { name: 'shimmerSpeed', type: 'float', min: 0.5, max: 5, default: 2, description: 'Shimmer speed' },
  { name: 'shimmerAmount', type: 'float', min: 0, max: 1, default: 0.5, description: 'Shimmer intensity' },
  { name: 'colorShift', type: 'float', min: -1, max: 1, default: 0, description: 'Color band shift' },
  { name: 'greenBlue', type: 'float', min: 0, max: 1, default: 0.2, description: 'Green vs blue' },
  { name: 'purpleAmount', type: 'float', min: 0, max: 1, default: 0.4, description: 'Purple edge intensity' },
  { name: 'swoosh', type: 'float', min: 0, max: 1, default: 0.5, description: 'Swoosh — arcing ribbon motion' },
  { name: 'horizonGlow', type: 'float', min: 0, max: 2, default: 0.8, description: 'Horizon glow' },
  { name: 'starDensity', type: 'float', min: 0, max: 2, default: 1, description: 'Star density' },
]

const auroraEvaluateSource = `
return { shaderConfig: {
  fragmentShader: inputs.fragmentShader,
  uniforms: {
    uTime: ctx.elapsed,
    uSeed: inputs.seed,
    uIntensity: inputs.intensity,
    uCurtainHeight: inputs.curtainHeight,
    uCurtainWidth: inputs.curtainWidth,
    uWaveSpeed: inputs.waveSpeed,
    uWaveScale: inputs.waveScale,
    uVerticalStretch: inputs.verticalStretch,
    uShimmerSpeed: inputs.shimmerSpeed,
    uShimmerAmount: inputs.shimmerAmount,
    uColorShift: inputs.colorShift,
    uGreenBlue: inputs.greenBlue,
    uPurpleAmount: inputs.purpleAmount,
    uSwoosh: inputs.swoosh,
    uHorizonGlow: inputs.horizonGlow,
    uStarDensity: inputs.starDensity,
    uAspect: ctx.resolution ? ctx.resolution[0] / Math.max(ctx.resolution[1], 1) : 1.0,
  }
}};
`

const auroraDef: CompoundGeneratorDef = {
  id: 'builtin_aurora',
  name: 'Aurora Borealis',
  description: 'Northern lights with shimmering curtains, realistic emission colors, and landscape',
  defaultCameraDistance: 0,
  generatorType: 'aurora_generator',
  outputMode: 'shader',
  params: auroraParams,
  inputs: auroraParams.map(p => ({
    name: p.name,
    type: 'number' as const,
    default: p.default as number,
  })),
  outputs: [{ name: 'shaderConfig', type: 'array' as const }],
  evaluateSource: auroraEvaluateSource,
  fragmentShader: auroraFragShader,
}

// ═══════════════════════════════════════════════════════════════════════════
// PSYCHEDELIC — feedback-loop fractal warp with color cycling
// ═══════════════════════════════════════════════════════════════════════════

// Pass 1: Warp + inject fresh pattern into feedback buffer
const psychedelicWarpFrag = `precision highp float;
varying vec2 vUv;
uniform sampler2D feedbackTex;
uniform float uTime;
uniform float uSeed;
uniform float uWarpIntensity;
uniform float uSpiralTightness;
uniform float uZoomPulse;
uniform float uColorSpeed;
uniform float uFeedbackAmount;
uniform float uNoiseScale;
uniform float uFlowSpeed;
uniform float uSymmetry;
uniform vec2 uResolution;

// Simplex-style hash
vec3 hash3(vec3 p) {
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
           dot(p, vec3(269.5, 183.3, 246.1)),
           dot(p, vec3(113.5, 271.9, 124.6)));
  return fract(sin(p) * 43758.5453123) * 2.0 - 1.0;
}

float snoise(vec3 p) {
  const float F3 = 0.333333;
  const float G3 = 0.166667;
  vec3 s = floor(p + dot(p, vec3(F3)));
  vec3 x = p - s + dot(s, vec3(G3));
  vec3 e = step(vec3(0.0), x - x.yzx);
  vec3 i1 = e * (1.0 - e.zxy);
  vec3 i2 = 1.0 - e.zxy * (1.0 - e);
  vec3 x1 = x - i1 + G3;
  vec3 x2 = x - i2 + 2.0 * G3;
  vec3 x3 = x - 1.0 + 3.0 * G3;
  vec4 w = max(0.6 - vec4(dot(x,x), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  w *= w; w *= w;
  return dot(w, vec4(dot(hash3(s), x), dot(hash3(s+i1), x1),
                     dot(hash3(s+i2), x2), dot(hash3(s+1.0), x3))) * 32.0;
}

float fbm(vec3 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * snoise(p);
    p = p * 2.0 + vec3(100.0);
    a *= 0.5;
  }
  return v;
}

vec3 hsl2rgb(float h, float s, float l) {
  vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
}

void main() {
  vec2 uv = vUv;
  vec2 center = uv - 0.5;
  float r = length(center);
  float angle = atan(center.y, center.x);

  // Symmetry fold
  float symSectors = max(1.0, floor(uSymmetry));
  if (symSectors > 1.0) {
    float sectorAngle = 6.2832 / symSectors;
    float foldedAngle = mod(angle + 3.1416, sectorAngle);
    // Mirror within sector
    if (foldedAngle > sectorAngle * 0.5) foldedAngle = sectorAngle - foldedAngle;
    center = vec2(cos(foldedAngle), sin(foldedAngle)) * r;
  }

  // Breathing zoom pulse
  float breathe = 1.0 + sin(uTime * 0.5) * uZoomPulse * 0.08;

  // Spiral warp — rotate more near center for vortex effect
  float spiralAngle = uSpiralTightness * (0.3 / (r + 0.1)) * 0.02 + uTime * uFlowSpeed * 0.1;
  float cs = cos(spiralAngle), sn = sin(spiralAngle);
  vec2 warped = vec2(center.x * cs - center.y * sn, center.x * sn + center.y * cs);

  // Domain warp with noise
  float t = uTime * uFlowSpeed * 0.15;
  vec2 noiseWarp = vec2(
    snoise(vec3(warped * uNoiseScale * 3.0 + uSeed * 10.0, t)),
    snoise(vec3(warped * uNoiseScale * 3.0 + uSeed * 10.0 + 50.0, t + 33.0))
  ) * uWarpIntensity * 0.06;

  // Sample feedback with warp applied
  vec2 sampleUV = (warped + noiseWarp) * breathe + 0.5;
  // Soft edge fade to prevent hard border artifacts
  sampleUV = clamp(sampleUV, 0.001, 0.999);
  vec3 feedback = texture2D(feedbackTex, sampleUV).rgb;

  // Slight color rotation on feedback to create evolving hue shifts
  float hueShift = uColorSpeed * 0.003;
  float cosH = cos(hueShift), sinH = sin(hueShift);
  float k = 0.57735;
  float c1 = 1.0 - cosH;
  mat3 hueRot = mat3(
    cosH + k*k*c1,     k*k*c1 - k*sinH,  k*k*c1 + k*sinH,
    k*k*c1 + k*sinH,   cosH + k*k*c1,     k*k*c1 - k*sinH,
    k*k*c1 - k*sinH,   k*k*c1 + k*sinH,   cosH + k*k*c1
  );
  feedback = hueRot * feedback;

  // Fresh pattern injection — fractal noise creates organic shapes
  vec3 noisePos = vec3(center * uNoiseScale * 5.0, uTime * uFlowSpeed * 0.08 + uSeed * 7.0);
  float n1 = fbm(noisePos);
  float n2 = fbm(noisePos + vec3(33.3, 77.7, 0.0));
  float n3 = fbm(noisePos * 1.5 + vec3(0.0, 0.0, uTime * 0.05));

  // Color from noise — full spectrum cycling
  float hue = fract(uTime * uColorSpeed * 0.02 + n1 * 0.3 + r * 0.5);
  float sat = 0.7 + n2 * 0.3;
  float lum = 0.4 + n3 * 0.2 + 0.1;
  vec3 fresh = hsl2rgb(hue, sat, lum);

  // Concentric ring pattern for structure
  float rings = sin(r * 20.0 - uTime * uFlowSpeed * 0.8 + n1 * 4.0) * 0.5 + 0.5;
  fresh *= 0.7 + rings * 0.3;

  // Radial energy burst
  float burst = smoothstep(0.5, 0.0, r) * 0.3;
  fresh += burst;

  // Blend feedback with fresh pattern
  vec3 color = mix(fresh, feedback, uFeedbackAmount);

  // Soft vignette to prevent edge buildup
  float vignette = smoothstep(0.7, 0.3, r);
  color *= 0.5 + vignette * 0.5;

  gl_FragColor = vec4(color, 1.0);
}
`

// Pass 2: Display with post-processing
const psychedelicDisplayFrag = `precision highp float;
varying vec2 vUv;
uniform sampler2D feedbackTex;
uniform float uBrightness;
uniform float uContrast;
uniform float uSaturation;
uniform float uAspect;

void main() {
  vec2 uv = vUv;
  // Correct for aspect ratio
  vec2 center = uv - 0.5;
  if (uAspect > 1.0) center.x *= uAspect;

  vec3 color = texture2D(feedbackTex, uv).rgb;

  // Contrast
  color = (color - 0.5) * (1.0 + uContrast) + 0.5;

  // Saturation
  float gray = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(vec3(gray), color, 1.0 + uSaturation);

  // Brightness
  color *= uBrightness;

  // Tone mapping (soft clamp to prevent harsh clipping)
  color = color / (1.0 + color);
  color = pow(color, vec3(0.9)); // slight gamma lift

  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
`

const psychedelicParams: ParamSchemaDef[] = [
  { name: 'seed', type: 'float', min: 0, max: 100, default: 42, description: 'Random seed' },
  { name: 'warpIntensity', type: 'float', min: 0, max: 3, default: 1.2, description: 'Domain warp strength' },
  { name: 'spiralTightness', type: 'float', min: 0, max: 10, default: 3.0, description: 'Spiral vortex tightness' },
  { name: 'zoomPulse', type: 'float', min: 0, max: 5, default: 2.0, description: 'Breathing zoom depth' },
  { name: 'colorSpeed', type: 'float', min: 0, max: 5, default: 1.5, description: 'Color cycling speed' },
  { name: 'feedbackAmount', type: 'float', min: 0, max: 0.99, default: 0.85, description: 'Feedback loop strength' },
  { name: 'noiseScale', type: 'float', min: 0.2, max: 5, default: 1.0, description: 'Pattern scale' },
  { name: 'flowSpeed', type: 'float', min: 0, max: 3, default: 1.0, description: 'Animation speed' },
  { name: 'symmetry', type: 'float', min: 1, max: 12, default: 1, description: 'Symmetry fold count' },
  { name: 'brightness', type: 'float', min: 0.3, max: 3, default: 1.3, description: 'Brightness' },
  { name: 'contrast', type: 'float', min: -0.5, max: 1.5, default: 0.4, description: 'Contrast' },
  { name: 'saturation', type: 'float', min: -1, max: 2, default: 0.5, description: 'Saturation boost' },
]

const psychedelicEvaluateSource = `
var simRes = 512;
return { shaderConfig: {
  passes: [
    { name: 'warp', fragmentShader: inputs.warpShader, target: 'feedback',
      readFrom: { feedbackTex: 'feedback' },
      uniforms: {
        uTime: ctx.elapsed, uSeed: inputs.seed,
        uWarpIntensity: inputs.warpIntensity,
        uSpiralTightness: inputs.spiralTightness,
        uZoomPulse: inputs.zoomPulse,
        uColorSpeed: inputs.colorSpeed,
        uFeedbackAmount: inputs.feedbackAmount,
        uNoiseScale: inputs.noiseScale,
        uFlowSpeed: inputs.flowSpeed,
        uSymmetry: inputs.symmetry,
        uResolution: [simRes, simRes]
      }
    },
    { name: 'display', fragmentShader: inputs.displayShader, target: null,
      readFrom: { feedbackTex: 'feedback' },
      uniforms: {
        uBrightness: inputs.brightness,
        uContrast: inputs.contrast,
        uSaturation: inputs.saturation,
        uAspect: ctx.resolution[0] / Math.max(1, ctx.resolution[1])
      }
    }
  ],
  renderTargetDefs: {
    feedback: { width: simRes, height: simRes, type: 'half', filter: 'linear', pingPong: true }
  },
  stepsPerFrame: 1
}};
`

const psychedelicDef: CompoundGeneratorDef = {
  id: 'builtin_psychedelic',
  name: 'Psychedelic',
  description: 'Feedback-loop fractal warp with spiraling vortex, color cycling, and morphing noise',
  defaultCameraDistance: 0,
  generatorType: 'psychedelic_generator',
  outputMode: 'shader',
  params: psychedelicParams,
  inputs: psychedelicParams.map(p => ({
    name: p.name,
    type: 'number' as const,
    default: p.default as number,
  })),
  outputs: [{ name: 'shaderConfig', type: 'array' as const }],
  evaluateSource: psychedelicEvaluateSource,
  shaderSources: {
    warp: psychedelicWarpFrag,
    display: psychedelicDisplayFrag,
  },
}

// ═══════════════════════════════════════════════════════════════════════════
// FIRE SIM (removed)
// ═══════════════════════════════════════════════════════════════════════════

const fireSimFragShader = `precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uSeed;
uniform float uIntensity;
uniform float uTurbulence;
uniform float uFlameHeight;
uniform float uFlameWidth;
uniform float uFlameSpeed;
uniform float uEmberAmount;
uniform float uEmberSpeed;
uniform float uWindStrength;
uniform float uWindDirection;
uniform float uColorTemp;
uniform float uSmokeAmount;
uniform float uSmokeDarkness;
uniform float uDetailScale;
uniform float uAspect;

#define PI 3.14159265359

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
             mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
}

float fbm(vec2 p, int octaves) {
  float v = 0.0, a = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    v += a * noise(p);
    p = rot * p * 2.0 + vec2(100.0);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = vUv;
  uv.x = (uv.x - 0.5) * uAspect + 0.5;

  // Fire source at bottom center
  float windAngle = uWindDirection * PI / 180.0;
  float windX = sin(windAngle) * uWindStrength;
  float windY = cos(windAngle) * uWindStrength * 0.3;

  // Distance from fire base
  vec2 fireBase = vec2(0.5, 0.08);
  vec2 toFire = uv - fireBase;

  // Wind displaces flame sideways as it rises
  float rise = max(toFire.y, 0.0);
  toFire.x -= windX * rise * 0.5;
  toFire.y -= windY * rise * 0.2;

  // Flame shape envelope
  float flameW = uFlameWidth * (1.0 - rise / uFlameHeight * 0.6);
  float inFlame = 1.0 - smoothstep(0.0, flameW * 0.5, abs(toFire.x));
  float heightFade = 1.0 - smoothstep(0.0, uFlameHeight, rise);
  float flameEnvelope = inFlame * heightFade;

  // Animated turbulence — fire noise moves upward
  float t = uTime * uFlameSpeed;
  vec2 noiseCoord = vec2(toFire.x * 3.0 / max(uFlameWidth, 0.01), rise * 4.0 - t);
  noiseCoord.x += windX * 0.3;

  // Multi-octave fire turbulence
  float turb = fbm(noiseCoord * uDetailScale + uSeed * 10.0, 6);
  float turb2 = fbm(noiseCoord * uDetailScale * 2.3 + uSeed * 20.0 + vec2(0.0, t * 0.5), 4);

  // Fire intensity
  float rawFire = flameEnvelope * (turb * 0.6 + turb2 * 0.4) * uIntensity;
  rawFire *= 1.0 + uTurbulence * (turb2 - 0.5) * 2.0;
  rawFire = clamp(rawFire, 0.0, 1.0);

  // Inner core is hotter (brighter, whiter)
  float core = smoothstep(0.3, 0.8, rawFire) * inFlame * heightFade;
  core *= smoothstep(uFlameHeight * 0.5, 0.0, rise); // core only near base

  // Fire color gradient — temperature controls the palette
  // colorTemp 0 = cool (red/orange), 0.5 = normal (yellow core), 1 = hot (blue-white)
  vec3 coolOuter = vec3(0.6, 0.05, 0.0);
  vec3 coolMid = vec3(0.9, 0.3, 0.0);
  vec3 coolInner = vec3(1.0, 0.7, 0.1);
  vec3 hotOuter = vec3(0.1, 0.1, 0.7);
  vec3 hotMid = vec3(0.3, 0.5, 1.0);
  vec3 hotInner = vec3(0.7, 0.85, 1.0);

  vec3 outerColor = mix(coolOuter, hotOuter, uColorTemp);
  vec3 midColor = mix(coolMid, hotMid, uColorTemp);
  vec3 innerColor = mix(coolInner, hotInner, uColorTemp);

  vec3 fireColor = mix(outerColor, midColor, smoothstep(0.1, 0.4, rawFire));
  fireColor = mix(fireColor, innerColor, smoothstep(0.5, 0.85, rawFire));
  fireColor = mix(fireColor, vec3(1.0, 0.95, 0.9), core * 0.7);

  // Embers/sparks — rise slower than flames, decelerate, drift and wander
  float emberMask = 0.0;
  vec3 emberTint = vec3(0.0);
  for (int i = 0; i < 30; i++) {
    float fi = float(i);
    // Per-spark random properties
    float r0 = hash(vec2(fi * 73.1 + uSeed, fi * 31.7));
    float r1 = hash(vec2(fi * 17.3 + uSeed, fi * 91.1));
    float r2 = hash(vec2(fi * 43.7 + uSeed, fi * 67.3));
    float r3 = hash(vec2(fi * 11.9 + uSeed, fi * 53.9));

    // Varied spawn position across fire width
    float spawnX = fireBase.x + (r0 - 0.5) * uFlameWidth * 1.2;

    // Each spark has its own speed (slower than flames), with high variation
    float sparkSpeed = (0.2 + r1 * 0.6) * uEmberSpeed;
    // Life cycle: 0→1 as spark rises, different period per spark
    float life = fract(r0 * 7.0 + r1 * 3.0 + uTime * sparkSpeed * 0.08);

    // Deceleration: fast at start, slows as it rises (quadratic ease-out)
    float decel = life * (2.0 - life); // starts fast, decelerates
    float maxHeight = uFlameHeight * (1.2 + r2 * 0.8);
    float sparkY = decel * maxHeight;

    // Lateral drift increases with height (air currents push sparks sideways)
    float drift = sin(uTime * (1.5 + r2 * 2.0) + fi * 4.1) * 0.04 * (1.0 + life);
    float wobble = sin(uTime * (3.0 + r3 * 4.0) + fi * 2.7) * 0.015;
    float windDrift = windX * sparkY * (0.3 + r1 * 0.5);

    vec2 sparkPos = vec2(spawnX + drift + wobble + windDrift, fireBase.y + sparkY);
    vec2 diff = uv - sparkPos;

    // Spark size varies: some tiny bright sparks, some larger dim embers
    float sparkSize = (0.003 + r2 * 0.012) * (1.0 + r3 * 0.5);
    // Elongation ratio varies per spark (2x to 6x)
    float elongation = 2.0 + r3 * 4.0;

    // Spark orientation: mostly upward but tilted by drift velocity
    float tiltAngle = 1.5708 + (drift + windDrift * 0.3) * 8.0;
    vec2 sparkDir = vec2(cos(tiltAngle), sin(tiltAngle));
    vec2 sparkPerp = vec2(-sparkDir.y, sparkDir.x);
    float along = abs(dot(diff, sparkDir));
    float across = abs(dot(diff, sparkPerp));

    // Fade: bright at birth, dim as cooling (exponential decay)
    float fade = exp(-life * 3.0) * (1.0 - smoothstep(0.85, 1.0, life));

    float shape = smoothstep(sparkSize * elongation, 0.0, along)
                * smoothstep(sparkSize, 0.0, across);
    float brightness = shape * fade;

    // Color variation: hotter sparks are brighter/whiter, cooler ones are orange/red
    float heat = r1 * 0.5 + (1.0 - life) * 0.5; // hotter when young
    vec3 sparkColor = mix(vec3(1.0, 0.3, 0.02), vec3(1.0, 0.8, 0.4), heat);

    emberMask += brightness;
    emberTint += sparkColor * brightness;
  }
  emberMask *= uEmberAmount;
  // Normalize tint
  vec3 emberColorFinal = emberMask > 0.001 ? emberTint / max(emberMask, 0.001) : vec3(1.0, 0.5, 0.1);
  emberMask = clamp(emberMask, 0.0, 1.0);

  // Smoke above fire
  float smokeY = rise - uFlameHeight * 0.6;
  float smokeMask = 0.0;
  if (smokeY > 0.0 && uSmokeAmount > 0.01) {
    vec2 smokeCoord = vec2(toFire.x * 2.0, smokeY * 2.0 - uTime * uFlameSpeed * 0.3);
    smokeCoord.x += windX * smokeY * 0.8;
    float smokeNoise = fbm(smokeCoord * 3.0 + uSeed * 5.0, 5);
    float smokeEnv = smoothstep(0.0, 0.15, smokeY) * smoothstep(0.8, 0.3, smokeY);
    float smokeWidth = uFlameWidth * (1.0 + smokeY * 2.0);
    float inSmoke = smoothstep(smokeWidth * 0.5, 0.0, abs(toFire.x + windX * smokeY * 0.5));
    smokeMask = smokeNoise * smokeEnv * inSmoke * uSmokeAmount;
  }

  // Compose
  vec3 col = vec3(0.01, 0.005, 0.02); // dark background

  // Ambient glow from fire on background
  float glowDist = length(toFire * vec2(1.0, 0.5));
  vec3 ambientGlow = mix(outerColor, midColor, 0.3) * 0.15 * smoothstep(0.6, 0.0, glowDist) * uIntensity;
  col += ambientGlow;

  // Smoke layer
  vec3 smokeColor = vec3(0.04, 0.035, 0.03) * (1.0 - uSmokeDarkness * 0.5);
  col = mix(col, smokeColor, clamp(smokeMask * 0.6, 0.0, 0.8));

  // Fire
  col = mix(col, fireColor * (1.0 + rawFire * 0.5), rawFire);

  // Embers — per-spark color variation already computed
  col += emberColorFinal * emberMask;

  // HDR tonemap
  col = col / (col + 0.8);

  gl_FragColor = vec4(col, 1.0);
}
`

const fireSimParams: ParamSchemaDef[] = [
  { name: 'seed', type: 'float', min: 0, max: 100, default: 7, description: 'Random seed' },
  { name: 'intensity', type: 'float', min: 0.1, max: 3, default: 1.5, description: 'Fire intensity' },
  { name: 'turbulence', type: 'float', min: 0, max: 2, default: 0.8, description: 'Turbulence amount' },
  { name: 'flameHeight', type: 'float', min: 0.1, max: 1, default: 0.55, description: 'Flame height' },
  { name: 'flameWidth', type: 'float', min: 0.05, max: 0.8, default: 0.3, description: 'Flame width' },
  { name: 'flameSpeed', type: 'float', min: 0.1, max: 5, default: 1.5, description: 'Flame speed' },
  { name: 'emberAmount', type: 'float', min: 0, max: 2, default: 0.8, description: 'Ember amount' },
  { name: 'emberSpeed', type: 'float', min: 0.1, max: 3, default: 1, description: 'Ember rise speed' },
  { name: 'windStrength', type: 'float', min: -1, max: 1, default: 0.15, description: 'Wind strength' },
  { name: 'windDirection', type: 'float', min: -90, max: 90, default: 10, description: 'Wind angle (degrees)' },
  { name: 'colorTemp', type: 'float', min: 0, max: 1, default: 0.15, description: 'Color temperature (0=red, 1=blue)' },
  { name: 'smokeAmount', type: 'float', min: 0, max: 1, default: 0.5, description: 'Smoke amount' },
  { name: 'smokeDarkness', type: 'float', min: 0, max: 1, default: 0.5, description: 'Smoke darkness' },
  { name: 'detailScale', type: 'float', min: 0.5, max: 4, default: 1.5, description: 'Detail scale' },
]

const fireSimEvaluateSource = `
return { shaderConfig: {
  fragmentShader: inputs.fragmentShader,
  uniforms: {
    uTime: ctx.elapsed,
    uSeed: inputs.seed,
    uIntensity: inputs.intensity,
    uTurbulence: inputs.turbulence,
    uFlameHeight: inputs.flameHeight,
    uFlameWidth: inputs.flameWidth,
    uFlameSpeed: inputs.flameSpeed,
    uEmberAmount: inputs.emberAmount,
    uEmberSpeed: inputs.emberSpeed,
    uWindStrength: inputs.windStrength,
    uWindDirection: inputs.windDirection,
    uColorTemp: inputs.colorTemp,
    uSmokeAmount: inputs.smokeAmount,
    uSmokeDarkness: inputs.smokeDarkness,
    uDetailScale: inputs.detailScale,
    uAspect: ctx.resolution ? ctx.resolution[0] / Math.max(ctx.resolution[1], 1) : 1.0,
  }
}};
`

const fireSimDef: CompoundGeneratorDef = {
  id: 'builtin_fireSim',
  name: 'Fire',
  description: 'Procedural fire simulation with flames, embers, smoke, and wind',
  defaultCameraDistance: 0,
  generatorType: 'fireSim_generator',
  outputMode: 'shader',
  params: fireSimParams,
  inputs: fireSimParams.map(p => ({
    name: p.name,
    type: 'number' as const,
    default: p.default as number,
  })),
  outputs: [{ name: 'shaderConfig', type: 'array' as const }],
  evaluateSource: fireSimEvaluateSource,
  fragmentShader: fireSimFragShader,
}

// ═══════════════════════════════════════════════════════════════════════════
// CELTIC KNOT
// ═══════════════════════════════════════════════════════════════════════════

const celticKnotFragShader = `precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uSeed;
uniform float uComplexity;
uniform float uStrandWidth;
uniform float uBorderWidth;
uniform float uRoundness;
uniform float uRotationSpeed;
uniform float uColorHue1;
uniform float uColorHue2;
uniform float uColorCycleSpeed;
uniform float uOverUnderScale;
uniform float uSymmetry;
uniform float uBackgroundBrightness;
uniform float uShadowStrength;
uniform float uPulseAmount;
uniform float uAspect;

#define PI 3.14159265359

vec3 hsl2rgb(float h, float s, float l) {
  vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
}

void main() {
  vec2 uv = vUv - 0.5;
  uv.x *= uAspect;

  // Rotation
  float t = uTime * uRotationSpeed;
  float ca = cos(t), sa = sin(t);
  uv = vec2(ca * uv.x - sa * uv.y, sa * uv.x + ca * uv.y);

  // Symmetry folding (kaleidoscope)
  float sym = max(2.0, floor(uSymmetry + 0.5));
  float ang = atan(uv.y, uv.x);
  float r = length(uv);
  float sector = PI / sym;
  ang = mod(ang + sector, 2.0 * sector) - sector;
  ang = abs(ang);
  uv = vec2(cos(ang), sin(ang)) * r;

  // Scale to grid — seed offsets the grid for different patterns
  float scl = 2.0 + uComplexity;
  vec2 seedOff = vec2(sin(uSeed * 1.618) * 3.7, cos(uSeed * 2.714) * 2.9);
  vec2 p = uv * scl + seedOff;

  // Seed also rotates the band angle for variety
  float bandAngle = uSeed * 0.1;
  float ba = cos(bandAngle), bb = sin(bandAngle);
  p = vec2(ba * p.x - bb * p.y, bb * p.x + ba * p.y);

  // Two families of diagonal bands at +/-45 degrees
  // Family A: perpendicular to (1,-1), runs along (1,1)
  float a = (p.x - p.y) * 0.7071;
  float aCell = floor(a + 0.5);
  float aFrac = a - aCell;
  float aAlong = (p.x + p.y) * 0.7071;

  // Family B: perpendicular to (1,1), runs along (1,-1)
  float b = (p.x + p.y) * 0.7071;
  float bCell = floor(b + 0.5);
  float bFrac = b - bCell;
  float bAlong = (p.x - p.y) * 0.7071;

  // Add undulation to bands for organic celtic curves
  // Seed varies the curve frequency for different weave patterns
  float curveFreq = 1.5 + sin(uSeed * 0.7) * 0.8;
  float curveA = sin(aAlong * PI * curveFreq) * uRoundness * 0.12;
  float curveB = sin(bAlong * PI * curveFreq) * uRoundness * 0.12;

  float distA = abs(aFrac + curveA);
  float distB = abs(bFrac + curveB);

  float halfW = uStrandWidth * 0.5;
  float bw = uBorderWidth;

  // Smooth band masks with anti-aliasing
  float bandA = 1.0 - smoothstep(halfW - 0.015, halfW + 0.005, distA);
  float bandB = 1.0 - smoothstep(halfW - 0.015, halfW + 0.005, distB);
  float outerA = 1.0 - smoothstep(halfW + bw - 0.01, halfW + bw + 0.005, distA);
  float outerB = 1.0 - smoothstep(halfW + bw - 0.01, halfW + bw + 0.005, distB);
  float borderA = max(outerA - bandA, 0.0);
  float borderB = max(outerB - bandB, 0.0);

  // Over/under: checkerboard parity at each crossing
  float parity = mod(aCell + bCell, 2.0);
  parity = step(0.5, parity); // clean to 0 or 1

  // Colors — each family gets its own hue, varied by cell
  float colorT = uTime * uColorCycleSpeed;
  float pulse = 1.0 + sin(uTime * 2.0) * uPulseAmount * 0.15;

  float hueA = fract((uColorHue1 + aCell * 37.0 + colorT * 20.0) / 360.0);
  float hueB = fract((uColorHue2 + bCell * 53.0 + colorT * 20.0) / 360.0);

  vec3 colorA = hsl2rgb(hueA, 0.75, 0.5 * pulse);
  vec3 colorB = hsl2rgb(hueB, 0.75, 0.5 * pulse);
  vec3 borderColorA = hsl2rgb(hueA, 0.5, 0.18);
  vec3 borderColorB = hsl2rgb(hueB, 0.5, 0.18);

  // 3D ribbon highlight (brighter at center of band)
  float highlightA = smoothstep(halfW, 0.0, distA) * 0.35;
  float highlightB = smoothstep(halfW, 0.0, distB) * 0.35;
  colorA *= 1.0 + highlightA;
  colorB *= 1.0 + highlightB;

  // Select under/over based on parity
  // parity=0: A over B; parity=1: B over A
  float underDist = mix(distB, distA, parity);
  float overDist = mix(distA, distB, parity);
  float underBand = mix(bandB, bandA, parity);
  float overBand = mix(bandA, bandB, parity);
  float underBorder = mix(borderB, borderA, parity);
  float overBorder = mix(borderA, borderB, parity);
  vec3 underColor = mix(colorB, colorA, parity);
  vec3 overColor = mix(colorA, colorB, parity);
  vec3 underBorderCol = mix(borderColorB, borderColorA, parity);
  vec3 overBorderCol = mix(borderColorA, borderColorB, parity);

  // Background — smooth dark tone, no grid hash
  vec3 bg = vec3(uBackgroundBrightness * 0.08);

  // Compose layers: under strand first, then over strand on top
  vec3 col = bg;

  // Under strand (darkened at crossings where over strand covers it)
  float underShadow = overBand * uShadowStrength * uOverUnderScale * 0.5;
  col = mix(col, underBorderCol * (1.0 - underShadow), underBorder);
  col = mix(col, underColor * (1.0 - underShadow), underBand);

  // Over strand (full brightness, drawn on top)
  col = mix(col, overBorderCol, overBorder);
  col = mix(col, overColor, overBand);

  // Drop shadow around strands for depth
  float shadowDistMin = min(distA - halfW - bw, distB - halfW - bw);
  float dropShadow = smoothstep(0.12, 0.0, shadowDistMin) * 0.15 * uShadowStrength;
  float anyStrand = max(max(bandA, bandB), max(borderA, borderB));
  col *= 1.0 - dropShadow * (1.0 - anyStrand);

  gl_FragColor = vec4(col, 1.0);
}
`

const celticKnotParams: ParamSchemaDef[] = [
  { name: 'seed', type: 'float', min: 0, max: 100, default: 59.5, description: 'Random seed' },
  { name: 'complexity', type: 'float', min: 2, max: 12, default: 5, description: 'Number of interlace strands' },
  { name: 'strandWidth', type: 'float', min: 0.02, max: 0.3, default: 0.3, description: 'Strand width' },
  { name: 'borderWidth', type: 'float', min: 0.005, max: 0.08, default: 0.08, description: 'Border width' },
  { name: 'roundness', type: 'float', min: 0, max: 1, default: 1, description: 'Curve roundness' },
  { name: 'rotationSpeed', type: 'float', min: 0, max: 2, default: 0.15, description: 'Rotation speed' },
  { name: 'colorHue1', type: 'float', min: 0, max: 360, default: 35, description: 'Primary hue (gold)' },
  { name: 'colorHue2', type: 'float', min: 0, max: 360, default: 145, description: 'Secondary hue (green)' },
  { name: 'colorCycleSpeed', type: 'float', min: 0, max: 2, default: 0.3, description: 'Color cycle speed' },
  { name: 'overUnderScale', type: 'float', min: 0, max: 2, default: 1, description: 'Over/under emphasis' },
  { name: 'symmetry', type: 'float', min: 2, max: 12, default: 4, description: 'Symmetry folds' },
  { name: 'backgroundBrightness', type: 'float', min: 0, max: 1, default: 0.15, description: 'Background brightness' },
  { name: 'shadowStrength', type: 'float', min: 0, max: 1, default: 0.6, description: 'Shadow strength' },
  { name: 'pulseAmount', type: 'float', min: 0, max: 1, default: 0.3, description: 'Color pulse amount' },
]

const celticKnotEvaluateSource = `
return { shaderConfig: {
  fragmentShader: inputs.fragmentShader,
  uniforms: {
    uTime: ctx.elapsed,
    uSeed: inputs.seed,
    uComplexity: inputs.complexity,
    uStrandWidth: inputs.strandWidth,
    uBorderWidth: inputs.borderWidth,
    uRoundness: inputs.roundness,
    uRotationSpeed: inputs.rotationSpeed,
    uColorHue1: inputs.colorHue1,
    uColorHue2: inputs.colorHue2,
    uColorCycleSpeed: inputs.colorCycleSpeed,
    uOverUnderScale: inputs.overUnderScale,
    uSymmetry: inputs.symmetry,
    uBackgroundBrightness: inputs.backgroundBrightness,
    uShadowStrength: inputs.shadowStrength,
    uPulseAmount: inputs.pulseAmount,
    uAspect: ctx.resolution ? ctx.resolution[0] / Math.max(ctx.resolution[1], 1) : 1.0,
  }
}};
`

const celticKnotDef: CompoundGeneratorDef = {
  id: 'builtin_celticKnot',
  name: 'Celtic Knot',
  description: 'Interlacing Celtic knot pattern with over/under crossings and symmetry',
  defaultCameraDistance: 0,
  generatorType: 'celticKnot_generator',
  outputMode: 'shader',
  params: celticKnotParams,
  inputs: celticKnotParams.map(p => ({
    name: p.name,
    type: 'number' as const,
    default: p.default as number,
  })),
  outputs: [{ name: 'shaderConfig', type: 'array' as const }],
  evaluateSource: celticKnotEvaluateSource,
  fragmentShader: celticKnotFragShader,
}

// ═══════════════════════════════════════════════════════════════════════════
// FLOCKING (BOIDS)
// ═══════════════════════════════════════════════════════════════════════════

const boidsUpdateFrag = `precision highp float;
uniform sampler2D boidState;
uniform vec2 resolution;
uniform float time;
uniform float deltaTime;
uniform float separationDist;
uniform float alignmentDist;
uniform float cohesionDist;
uniform float separationForce;
uniform float alignmentForce;
uniform float cohesionForce;
uniform float maxSpeed;
uniform float turnSpeed;
uniform float predatorX;
uniform float predatorY;
uniform float predatorForce;
uniform float wanderStrength;
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main() {
  vec4 self = texture2D(boidState, vUv);
  vec2 pos = self.xy;
  vec2 vel = self.zw;

  vec2 sepForce = vec2(0.0);
  vec2 alignVel = vec2(0.0);
  vec2 cohesionCenter = vec2(0.0);
  float sepCount = 0.0;
  float alignCount = 0.0;
  float cohesionCount = 0.0;

  float texW = resolution.x;
  float texH = resolution.y;
  float step = 1.0 / 16.0;

  for (float y = 0.0; y < 1.0; y += step) {
    for (float x = 0.0; x < 1.0; x += step) {
      vec2 sampleUv = vec2(x + 0.5 / texW, y + 0.5 / texH);
      if (abs(sampleUv.x - vUv.x) < 0.01 && abs(sampleUv.y - vUv.y) < 0.01) continue;

      vec4 other = texture2D(boidState, sampleUv);
      vec2 oPos = other.xy;
      vec2 oVel = other.zw;

      vec2 diff = pos - oPos;
      diff -= floor(diff + 0.5);
      float dist = length(diff);

      if (dist < separationDist && dist > 0.001) {
        sepForce += normalize(diff) / dist;
        sepCount += 1.0;
      }
      if (dist < alignmentDist) {
        alignVel += oVel;
        alignCount += 1.0;
      }
      if (dist < cohesionDist) {
        cohesionCenter += oPos;
        cohesionCount += 1.0;
      }
    }
  }

  vec2 accel = vec2(0.0);
  if (sepCount > 0.0) accel += normalize(sepForce / sepCount) * separationForce;
  if (alignCount > 0.0) accel += (alignVel / alignCount - vel) * alignmentForce;
  if (cohesionCount > 0.0) {
    vec2 toCenter = cohesionCenter / cohesionCount - pos;
    toCenter -= floor(toCenter + 0.5);
    accel += toCenter * cohesionForce;
  }

  vec2 predPos = vec2(predatorX, predatorY);
  vec2 toPred = pos - predPos;
  toPred -= floor(toPred + 0.5);
  float predDist = length(toPred);
  if (predDist < 0.15 && predDist > 0.001) {
    accel += normalize(toPred) * predatorForce / predDist;
  }

  float rnd = hash(pos * 1000.0 + time);
  accel += vec2(cos(rnd * 6.28), sin(rnd * 6.28)) * wanderStrength;

  vel += accel * deltaTime * turnSpeed;
  float speed = length(vel);
  if (speed > maxSpeed) vel = vel / speed * maxSpeed;
  if (speed < maxSpeed * 0.1) vel += vec2(cos(rnd * 6.28), sin(rnd * 6.28)) * maxSpeed * 0.1;

  pos += vel * deltaTime;
  pos = fract(pos);

  gl_FragColor = vec4(pos, vel);
}
`

const boidsDisplayFrag = `precision highp float;
uniform sampler2D boidState;
uniform vec2 resolution;
uniform float boidSize;
uniform float trailLength;
uniform float colorHue;
uniform float colorVariation;
uniform float glowAmount;
uniform float backgroundDarkness;
varying vec2 vUv;

vec3 hsl2rgb(float h, float s, float l) {
  vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
}

void main() {
  float texW = resolution.x;
  float texH = resolution.y;
  float step = 1.0 / 16.0;

  vec3 col = vec3(backgroundDarkness * 0.02);

  for (float y = 0.0; y < 1.0; y += step) {
    for (float x = 0.0; x < 1.0; x += step) {
      vec2 sampleUv = vec2(x + 0.5 / texW, y + 0.5 / texH);
      vec4 boid = texture2D(boidState, sampleUv);
      vec2 bPos = boid.xy;
      vec2 bVel = boid.zw;

      vec2 diff = vUv - bPos;
      diff -= floor(diff + 0.5);
      float dist = length(diff);

      if (dist < boidSize * 5.0) {
        float speed = length(bVel);
        vec2 dir = speed > 0.001 ? bVel / speed : vec2(1.0, 0.0);
        vec2 perp = vec2(-dir.y, dir.x);

        float along = dot(diff, dir);
        float across = dot(diff, perp);
        // Arrow/chevron shape pointing in direction of travel
        float shape = smoothstep(boidSize, 0.0, abs(across) * 2.0 - along * 0.8)
                    * smoothstep(boidSize * 2.0, 0.0, dist);

        float heading = atan(bVel.y, bVel.x) / 6.28 + 0.5;
        float hue = colorHue / 360.0 + heading * colorVariation;
        vec3 boidColor = hsl2rgb(hue, 0.7, 0.45);

        col += boidColor * shape * 0.8;

        float glow = smoothstep(boidSize * 5.0, 0.0, dist) * glowAmount * 0.08;
        col += boidColor * glow;
      }
    }
  }

  // Soft tonemap to prevent blowout when boids cluster
  col = col / (col + 0.6);

  gl_FragColor = vec4(col, 1.0);
}
`

const boidsParams: ParamSchemaDef[] = [
  { name: 'seed', type: 'float', min: 0, max: 100, default: 88.53, description: 'Random seed' },
  { name: 'separationDist', type: 'float', min: 0.01, max: 0.2, default: 0.029, description: 'Separation distance' },
  { name: 'alignmentDist', type: 'float', min: 0.02, max: 0.3, default: 0.038, description: 'Alignment distance' },
  { name: 'cohesionDist', type: 'float', min: 0.02, max: 0.4, default: 0.385, description: 'Cohesion distance' },
  { name: 'separationForce', type: 'float', min: 0, max: 5, default: 4.88, description: 'Separation force' },
  { name: 'alignmentForce', type: 'float', min: 0, max: 5, default: 2.09, description: 'Alignment force' },
  { name: 'cohesionForce', type: 'float', min: 0, max: 5, default: 1.66, description: 'Cohesion force' },
  { name: 'maxSpeed', type: 'float', min: 0.05, max: 1, default: 0.98, description: 'Max speed' },
  { name: 'turnSpeed', type: 'float', min: 0.5, max: 5, default: 4.66, description: 'Turn speed' },
  { name: 'predatorForce', type: 'float', min: 0, max: 5, default: 1.48, description: 'Predator avoidance force' },
  { name: 'wanderStrength', type: 'float', min: 0, max: 1, default: 0.857, description: 'Wander randomness' },
  { name: 'boidSize', type: 'float', min: 0.003, max: 0.03, default: 0.005, description: 'Boid size' },
  { name: 'trailLength', type: 'float', min: 0, max: 0.99, default: 0.865, description: 'Trail persistence' },
  { name: 'colorHue', type: 'float', min: 0, max: 360, default: 355, description: 'Base color hue' },
  { name: 'colorVariation', type: 'float', min: 0, max: 1, default: 0.337, description: 'Color variation by heading' },
  { name: 'glowAmount', type: 'float', min: 0, max: 2, default: 0.95, description: 'Glow amount' },
  { name: 'backgroundDarkness', type: 'float', min: 0, max: 1, default: 0.939, description: 'Background brightness' },
]

const boidsEvaluateSource = `
var boidSide = 16; // 16x16 = 256 boids
var key = '__boids_' + inputs.seed;
var state = ctx.frameState.get(key);
if (!state) {
  var data = new Float32Array(boidSide * boidSide * 4);
  function rng(i) { var x = Math.sin(i * 127.1 + inputs.seed * 311.7) * 43758.5453; return x - Math.floor(x); }
  for (var i = 0; i < boidSide * boidSide; i++) {
    data[i*4] = rng(i * 4);
    data[i*4+1] = rng(i * 4 + 1);
    var angle = rng(i * 4 + 2) * Math.PI * 2;
    data[i*4+2] = Math.cos(angle) * 0.1;
    data[i*4+3] = Math.sin(angle) * 0.1;
  }
  state = { data: data, gen: 0 };
  ctx.frameState.set(key, state);
}

var predX = 0.5 + Math.sin(ctx.elapsed * 0.3) * 0.3;
var predY = 0.5 + Math.cos(ctx.elapsed * 0.4) * 0.3;

return { shaderConfig: {
  passes: [
    { name: 'update', fragmentShader: inputs.updateShader, target: 'boidState',
      readFrom: { boidState: 'boidState' },
      uniforms: { resolution: [boidSide, boidSide], time: ctx.elapsed, deltaTime: 0.016,
        separationDist: inputs.separationDist, alignmentDist: inputs.alignmentDist,
        cohesionDist: inputs.cohesionDist, separationForce: inputs.separationForce,
        alignmentForce: inputs.alignmentForce, cohesionForce: inputs.cohesionForce,
        maxSpeed: inputs.maxSpeed, turnSpeed: inputs.turnSpeed,
        predatorX: predX, predatorY: predY, predatorForce: inputs.predatorForce,
        wanderStrength: inputs.wanderStrength } },
    { name: 'display', fragmentShader: inputs.displayShader, target: null,
      readFrom: { boidState: 'boidState' },
      uniforms: { resolution: [boidSide, boidSide],
        boidSize: inputs.boidSize, trailLength: inputs.trailLength,
        colorHue: inputs.colorHue, colorVariation: inputs.colorVariation,
        glowAmount: inputs.glowAmount, backgroundDarkness: inputs.backgroundDarkness } },
  ],
  renderTargetDefs: {
    boidState: { width: boidSide, height: boidSide, type: 'float', filter: 'nearest', pingPong: true, _gen: state.gen },
  },
  initData: { boidState: state.data },
  stepsPerFrame: 2,
}};
`

const boidsDef: CompoundGeneratorDef = {
  id: 'builtin_boids',
  name: 'Flocking',
  description: 'GPU boids flocking simulation with separation, alignment, cohesion, and trails',
  defaultCameraDistance: 0,
  generatorType: 'boids_generator',
  outputMode: 'shader',
  params: boidsParams,
  inputs: [
    ...boidsParams.map(p => ({
      name: p.name,
      type: 'number' as const,
      default: p.default as number,
    })),
  ],
  outputs: [{ name: 'shaderConfig', type: 'array' as const }],
  evaluateSource: boidsEvaluateSource,
  shaderSources: {
    update: boidsUpdateFrag,
    display: boidsDisplayFrag,
  },
}

// ═══════════════════════════════════════════════════════════════════════════
// PARTICLE LIFE
// ═══════════════════════════════════════════════════════════════════════════

const particleLifeUpdateFrag = `precision highp float;
uniform sampler2D particleState;
uniform vec2 resolution;
uniform float time;
uniform float deltaTime;
uniform float attractStrength;
uniform float repelDist;
uniform float interactDist;
uniform float friction;
uniform float maxSpeed;
uniform float speciesCount;
uniform float matrix0;  uniform float matrix1;  uniform float matrix2;
uniform float matrix3;  uniform float matrix4;  uniform float matrix5;
uniform float matrix6;  uniform float matrix7;  uniform float matrix8;
uniform float matrix9;  uniform float matrix10; uniform float matrix11;
uniform float matrix12; uniform float matrix13; uniform float matrix14;
uniform float matrix15; uniform float matrix16; uniform float matrix17;
uniform float matrix18; uniform float matrix19; uniform float matrix20;
uniform float matrix21; uniform float matrix22; uniform float matrix23;
uniform float matrix24; uniform float matrix25; uniform float matrix26;
uniform float matrix27; uniform float matrix28; uniform float matrix29;
uniform float matrix30; uniform float matrix31; uniform float matrix32;
uniform float matrix33; uniform float matrix34; uniform float matrix35;
varying vec2 vUv;

float getMatrix(int idx) {
  if (idx == 0) return matrix0; if (idx == 1) return matrix1;
  if (idx == 2) return matrix2; if (idx == 3) return matrix3;
  if (idx == 4) return matrix4; if (idx == 5) return matrix5;
  if (idx == 6) return matrix6; if (idx == 7) return matrix7;
  if (idx == 8) return matrix8; if (idx == 9) return matrix9;
  if (idx == 10) return matrix10; if (idx == 11) return matrix11;
  if (idx == 12) return matrix12; if (idx == 13) return matrix13;
  if (idx == 14) return matrix14; if (idx == 15) return matrix15;
  if (idx == 16) return matrix16; if (idx == 17) return matrix17;
  if (idx == 18) return matrix18; if (idx == 19) return matrix19;
  if (idx == 20) return matrix20; if (idx == 21) return matrix21;
  if (idx == 22) return matrix22; if (idx == 23) return matrix23;
  if (idx == 24) return matrix24; if (idx == 25) return matrix25;
  if (idx == 26) return matrix26; if (idx == 27) return matrix27;
  if (idx == 28) return matrix28; if (idx == 29) return matrix29;
  if (idx == 30) return matrix30; if (idx == 31) return matrix31;
  if (idx == 32) return matrix32; if (idx == 33) return matrix33;
  if (idx == 34) return matrix34; if (idx == 35) return matrix35;
  return 0.0;
}

void main() {
  vec4 self = texture2D(particleState, vUv);
  vec2 pos = self.xy;
  vec2 vel = self.zw;
  float texW = resolution.x;

  float idx = floor(vUv.x * texW) + floor(vUv.y * texW) * texW;
  int sc = int(floor(speciesCount + 0.5));
  float mySpecies = mod(idx, speciesCount);
  int mySpeciesI = int(mySpecies);

  vec2 force = vec2(0.0);
  float step = 1.0 / 16.0;

  for (float y = 0.0; y < 1.0; y += step) {
    for (float x = 0.0; x < 1.0; x += step) {
      vec2 sampleUv = vec2(x + 0.5 / texW, y + 0.5 / texW);
      if (abs(sampleUv.x - vUv.x) < 0.01 && abs(sampleUv.y - vUv.y) < 0.01) continue;

      vec4 other = texture2D(particleState, sampleUv);
      vec2 oPos = other.xy;

      vec2 diff = oPos - pos;
      diff -= floor(diff + 0.5);
      float dist = length(diff);

      if (dist > 0.001 && dist < interactDist) {
        float oIdx = floor(sampleUv.x * texW) + floor(sampleUv.y * texW) * texW;
        float oSpecies = mod(oIdx, speciesCount);
        int oSpeciesI = int(oSpecies);

        int matIdx = mySpeciesI * sc + oSpeciesI;
        float attract = getMatrix(matIdx) * attractStrength;

        vec2 dir = diff / dist;
        if (dist < repelDist) {
          force -= dir * (1.0 - dist / repelDist) * 2.0;
        } else {
          float t = (dist - repelDist) / (interactDist - repelDist);
          force += dir * attract * (1.0 - abs(2.0 * t - 1.0));
        }
      }
    }
  }

  vel += force * deltaTime;
  vel *= friction;
  float speed = length(vel);
  if (speed > maxSpeed) vel = vel / speed * maxSpeed;

  pos += vel * deltaTime;
  pos = fract(pos);

  gl_FragColor = vec4(pos, vel);
}
`

const particleLifeDisplayFrag = `precision highp float;
uniform sampler2D particleState;
uniform vec2 resolution;
uniform float particleSize;
uniform float trailLength;
uniform float speciesCount;
uniform float colorSaturation;
uniform float glowAmount;
varying vec2 vUv;

vec3 hsl2rgb(float h, float s, float l) {
  vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
}

void main() {
  float texW = resolution.x;
  float step = 1.0 / 16.0;
  vec3 col = vec3(0.005);

  for (float y = 0.0; y < 1.0; y += step) {
    for (float x = 0.0; x < 1.0; x += step) {
      vec2 sampleUv = vec2(x + 0.5 / texW, y + 0.5 / texW);
      vec4 particle = texture2D(particleState, sampleUv);
      vec2 pPos = particle.xy;

      vec2 diff = vUv - pPos;
      diff -= floor(diff + 0.5);
      float dist = length(diff);

      if (dist < particleSize * 5.0) {
        float idx = floor(sampleUv.x * texW) + floor(sampleUv.y * texW) * texW;
        float species = mod(idx, speciesCount);
        float hue = species / speciesCount;
        vec3 pColor = hsl2rgb(hue, colorSaturation, 0.6);

        float shape = smoothstep(particleSize, 0.0, dist);
        col += pColor * shape * 1.5;

        float glow = smoothstep(particleSize * 5.0, 0.0, dist) * glowAmount * 0.2;
        col += pColor * glow;
      }
    }
  }

  gl_FragColor = vec4(col, 1.0);
}
`

const particleLifeParams: ParamSchemaDef[] = [
  { name: 'seed', type: 'float', min: 0, max: 100, default: 42, description: 'Random seed (reshuffles interaction matrix)' },
  { name: 'speciesCount', type: 'float', min: 2, max: 6, default: 4, description: 'Number of species' },
  { name: 'attractStrength', type: 'float', min: 0.1, max: 5, default: 1.5, description: 'Interaction strength' },
  { name: 'repelDist', type: 'float', min: 0.01, max: 0.1, default: 0.03, description: 'Repulsion distance' },
  { name: 'interactDist', type: 'float', min: 0.05, max: 0.4, default: 0.15, description: 'Interaction range' },
  { name: 'friction', type: 'float', min: 0.8, max: 1, default: 0.95, description: 'Friction (1 = none)' },
  { name: 'maxSpeed', type: 'float', min: 0.1, max: 2, default: 0.5, description: 'Max speed' },
  { name: 'particleSize', type: 'float', min: 0.002, max: 0.025, default: 0.008, description: 'Particle size' },
  { name: 'trailLength', type: 'float', min: 0, max: 0.99, default: 0.94, description: 'Trail persistence' },
  { name: 'colorSaturation', type: 'float', min: 0, max: 1, default: 0.85, description: 'Color saturation' },
  { name: 'glowAmount', type: 'float', min: 0, max: 2, default: 0.6, description: 'Glow amount' },
]

const particleLifeEvaluateSource = `
var sc = Math.max(2, Math.min(6, Math.round(inputs.speciesCount)));
var side = 16;
var key = '__particleLife_' + inputs.seed + '_' + sc;
var state = ctx.frameState.get(key);
if (!state) {
  var data = new Float32Array(side * side * 4);
  function rng(i) { var x = Math.sin(i * 127.1 + inputs.seed * 311.7) * 43758.5453; return x - Math.floor(x); }
  for (var i = 0; i < side * side; i++) {
    data[i*4] = rng(i * 4);
    data[i*4+1] = rng(i * 4 + 1);
    var angle = rng(i * 4 + 2) * Math.PI * 2;
    data[i*4+2] = Math.cos(angle) * 0.02;
    data[i*4+3] = Math.sin(angle) * 0.02;
  }
  var matrix = new Float32Array(36);
  for (var a = 0; a < sc; a++) {
    for (var b = 0; b < sc; b++) {
      matrix[a * sc + b] = (rng(a * 100 + b * 7 + 500) * 2.0 - 1.0);
    }
  }
  state = { data: data, matrix: matrix, gen: 0 };
  ctx.frameState.set(key, state);
}

var matUniforms = {};
for (var mi = 0; mi < 36; mi++) {
  matUniforms['matrix' + mi] = state.matrix[mi] || 0;
}

return { shaderConfig: {
  passes: [
    { name: 'update', fragmentShader: inputs.updateShader, target: 'particleState',
      readFrom: { particleState: 'particleState' },
      uniforms: Object.assign({ resolution: [side, side], time: ctx.elapsed, deltaTime: 0.016,
        attractStrength: inputs.attractStrength, repelDist: inputs.repelDist,
        interactDist: inputs.interactDist, friction: inputs.friction,
        maxSpeed: inputs.maxSpeed, speciesCount: sc }, matUniforms) },
    { name: 'display', fragmentShader: inputs.displayShader, target: null,
      readFrom: { particleState: 'particleState' },
      uniforms: { resolution: [side, side], particleSize: inputs.particleSize,
        trailLength: inputs.trailLength, speciesCount: sc,
        colorSaturation: inputs.colorSaturation, glowAmount: inputs.glowAmount } },
  ],
  renderTargetDefs: {
    particleState: { width: side, height: side, type: 'float', filter: 'nearest', pingPong: true, _gen: state.gen },
  },
  initData: { particleState: state.data },
  stepsPerFrame: 2,
}};
`

const particleLifeDef: CompoundGeneratorDef = {
  id: 'builtin_particleLife',
  name: 'Particle Life',
  description: 'Multi-species artificial chemistry with emergent clustering, orbiting, and self-organization',
  defaultCameraDistance: 0,
  generatorType: 'particleLife_generator',
  outputMode: 'shader',
  params: particleLifeParams,
  inputs: [
    ...particleLifeParams.map(p => ({
      name: p.name,
      type: 'number' as const,
      default: p.default as number,
    })),
  ],
  outputs: [{ name: 'shaderConfig', type: 'array' as const }],
  evaluateSource: particleLifeEvaluateSource,
  shaderSources: {
    update: particleLifeUpdateFrag,
    display: particleLifeDisplayFrag,
  },
}

// ═══════════════════════════════════════════════════════════════════════════
// METABALLS
// ═══════════════════════════════════════════════════════════════════════════

const metaballsFragShader = `precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uSeed;
uniform float uBallCount;
uniform float uThreshold;
uniform float uSoftness;
uniform float uSpeed;
uniform float uSpread;
uniform float uColorHue1;
uniform float uColorHue2;
uniform float uColorSaturation;
uniform float uGlowStrength;
uniform float uEdgeWidth;
uniform float uBackgroundBrightness;
uniform float uPulse;
uniform float uAspect;

#define PI 3.14159265359

float hash(float n) { return fract(sin(n) * 43758.5453); }

vec3 hsl2rgb(float h, float s, float l) {
  vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
}

void main() {
  vec2 uv = vUv - 0.5;
  uv.x *= uAspect;

  float field = 0.0;
  // Weighted color blending: accumulate hue contributions weighted by field strength
  float weightedHue = 0.0;
  float totalWeight = 0.0;

  int count = int(uBallCount);
  for (int i = 0; i < 16; i++) {
    if (i >= count) break;
    float fi = float(i);
    float s0 = hash(fi * 127.1 + uSeed * 3.7);
    float s1 = hash(fi * 311.7 + uSeed * 7.3);
    float s2 = hash(fi * 73.9 + uSeed * 11.1);

    // Organic Lissajous-like orbits per ball
    float spd = uSpeed * (0.5 + s2 * 0.8);
    float px = sin(uTime * spd * 0.7 + fi * 2.1 + s0 * 6.28) * uSpread
             + sin(uTime * spd * 0.3 + fi * 4.7) * uSpread * 0.4;
    float py = cos(uTime * spd * 0.5 + fi * 3.3 + s1 * 6.28) * uSpread
             + cos(uTime * spd * 0.4 + fi * 1.9) * uSpread * 0.3;

    // Pulsing radius
    float radius = 0.06 + s2 * 0.04 + sin(uTime * 1.5 + fi * 2.0) * 0.01 * uPulse;

    vec2 ballPos = vec2(px, py);
    float d = length(uv - ballPos);
    float contrib = (radius * radius) / (d * d + 0.0001);

    field += contrib;

    // Smooth color blending: each ball contributes its hue weighted by its field
    float ballHue = mix(uColorHue1, uColorHue2, fract(fi * 0.618 + s0 * 0.3)) / 360.0;
    float w = contrib * contrib; // square for sharper blending near surfaces
    weightedHue += ballHue * w;
    totalWeight += w;
  }

  // Smoothly blended hue (no hard geometric boundaries)
  float hue = totalWeight > 0.0 ? weightedHue / totalWeight : uColorHue1 / 360.0;

  // Threshold with adjustable softness
  float edge = smoothstep(uThreshold - uSoftness, uThreshold + uSoftness * 0.2, field);
  float edgeGlow = smoothstep(uThreshold - uSoftness * 2.0, uThreshold, field)
                 * (1.0 - smoothstep(uThreshold, uThreshold + uSoftness * 3.0, field));

  float fieldIntensity = clamp((field - uThreshold) / (uThreshold * 2.0), 0.0, 1.0);
  vec3 blobColor = hsl2rgb(hue, uColorSaturation, 0.35 + fieldIntensity * 0.3);

  // Inner highlight for 3D look
  float highlight = smoothstep(uThreshold * 3.0, uThreshold * 8.0, field) * 0.4;
  blobColor += highlight;

  // Edge border
  vec3 edgeColor = hsl2rgb(hue, uColorSaturation * 0.8, 0.15);
  float edgeLine = smoothstep(uEdgeWidth, 0.0, abs(field - uThreshold)) * edge;

  // Background
  vec3 bg = vec3(uBackgroundBrightness * 0.05);

  // Compose
  vec3 col = bg;

  // Ambient glow beneath blobs
  float glowField = smoothstep(uThreshold * 0.3, uThreshold, field);
  col += hsl2rgb(hue, uColorSaturation * 0.5, 0.2) * glowField * uGlowStrength * 0.3;

  // Blob surface
  col = mix(col, blobColor, edge);

  // Edge highlight
  col = mix(col, edgeColor, edgeLine * 0.6);

  // Specular-like edge glow
  col += hsl2rgb(hue, 0.3, 0.8) * edgeGlow * uGlowStrength * 0.4;

  gl_FragColor = vec4(col, 1.0);
}
`

const metaballsParams: ParamSchemaDef[] = [
  { name: 'seed', type: 'float', min: 0, max: 100, default: 55.98, description: 'Random seed' },
  { name: 'ballCount', type: 'float', min: 2, max: 16, default: 13.2, description: 'Number of metaballs' },
  { name: 'threshold', type: 'float', min: 0.5, max: 5, default: 3.05, description: 'Surface threshold' },
  { name: 'softness', type: 'float', min: 0.05, max: 1.5, default: 0.238, description: 'Edge softness' },
  { name: 'speed', type: 'float', min: 0.1, max: 3, default: 1.76, description: 'Animation speed' },
  { name: 'spread', type: 'float', min: 0.05, max: 0.5, default: 0.353, description: 'Ball spread' },
  { name: 'colorHue1', type: 'float', min: 0, max: 360, default: 318, description: 'Primary hue' },
  { name: 'colorHue2', type: 'float', min: 0, max: 360, default: 14, description: 'Secondary hue' },
  { name: 'colorSaturation', type: 'float', min: 0, max: 1, default: 0.908, description: 'Color saturation' },
  { name: 'glowStrength', type: 'float', min: 0, max: 2, default: 0.426, description: 'Glow strength' },
  { name: 'edgeWidth', type: 'float', min: 0, max: 1, default: 0.911, description: 'Edge border width' },
  { name: 'backgroundBrightness', type: 'float', min: 0, max: 1, default: 0.959, description: 'Background brightness' },
  { name: 'pulse', type: 'float', min: 0, max: 1, default: 0.942, description: 'Pulse amount' },
]

const metaballsEvaluateSource = `
return { shaderConfig: {
  fragmentShader: inputs.fragmentShader,
  uniforms: {
    uTime: ctx.elapsed,
    uSeed: inputs.seed,
    uBallCount: inputs.ballCount,
    uThreshold: inputs.threshold,
    uSoftness: inputs.softness,
    uSpeed: inputs.speed,
    uSpread: inputs.spread,
    uColorHue1: inputs.colorHue1,
    uColorHue2: inputs.colorHue2,
    uColorSaturation: inputs.colorSaturation,
    uGlowStrength: inputs.glowStrength,
    uEdgeWidth: inputs.edgeWidth,
    uBackgroundBrightness: inputs.backgroundBrightness,
    uPulse: inputs.pulse,
    uAspect: ctx.resolution ? ctx.resolution[0] / Math.max(ctx.resolution[1], 1) : 1.0,
  }
}};
`

const metaballsDef: CompoundGeneratorDef = {
  id: 'builtin_metaballs',
  name: 'Metaballs',
  description: 'Classic implicit surface blobs — lava lamp, slime, and organic VFX',
  defaultCameraDistance: 0,
  generatorType: 'metaballs_generator',
  outputMode: 'shader',
  params: metaballsParams,
  inputs: metaballsParams.map(p => ({
    name: p.name,
    type: 'number' as const,
    default: p.default as number,
  })),
  outputs: [{ name: 'shaderConfig', type: 'array' as const }],
  evaluateSource: metaballsEvaluateSource,
  fragmentShader: metaballsFragShader,
}

// ═══════════════════════════════════════════════════════════════════════════
// VORONOI SHATTER
// ═══════════════════════════════════════════════════════════════════════════

const voronoiShatterFragShader = `precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uSeed;
uniform float uCellCount;
uniform float uCrackWidth;
uniform float uShatterAmount;
uniform float uExplosionForce;
uniform float uSpeed;
uniform float uColorHue;
uniform float uColorVariation;
uniform float uEmissiveStrength;
uniform float uDepth3D;
uniform float uCrackGlow;
uniform float uRoughness;
uniform float uAspect;

#define PI 3.14159265359

vec2 hash2(vec2 p) {
  return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453);
}

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
             mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
}

vec3 hsl2rgb(float h, float s, float l) {
  vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
}

void main() {
  vec2 uv = vUv - 0.5;
  uv.x *= uAspect;

  float scl = uCellCount;
  vec2 p = uv * scl;
  float shatterT = uShatterAmount;

  // Standard Voronoi — cell points stay in their grid cells (no displacement)
  float minDist1 = 99.0;
  float minDist2 = 99.0;
  vec2 nearestCell = vec2(0.0);
  vec2 nearestPoint = vec2(0.0);
  float nearestId = 0.0;
  vec2 cellCoord = floor(p);

  for (int dy = -2; dy <= 2; dy++) {
    for (int dx = -2; dx <= 2; dx++) {
      vec2 neighbor = cellCoord + vec2(float(dx), float(dy));
      vec2 rnd = hash2(neighbor + uSeed * 0.1);

      // Cell center: stays within its grid cell (stable Voronoi)
      vec2 cellPt = neighbor + rnd;

      // Gentle drift animation (cells wobble but don't leave their region)
      float driftAngle = rnd.x * 6.28 + uTime * uSpeed * (0.3 + rnd.y * 0.4);
      cellPt += vec2(cos(driftAngle), sin(driftAngle)) * 0.12;

      float d = length(p - cellPt);

      if (d < minDist1) {
        minDist2 = minDist1;
        minDist1 = d;
        nearestCell = neighbor;
        nearestPoint = cellPt;
        nearestId = rnd.x * 100.0 + rnd.y * 37.0;
      } else if (d < minDist2) {
        minDist2 = d;
      }
    }
  }

  // Edge distance (boundary between cells)
  float edgeDist = minDist2 - minDist1;

  // Shatter effect: widen cracks and push cell interiors inward
  // As shatterAmount increases: cracks widen, cells shrink, gaps appear
  float crackW = uCrackWidth + shatterT * 0.3;
  float crackMask = 1.0 - smoothstep(0.0, crackW, edgeDist);

  // Cell displacement: each shard moves outward from center as shatter increases
  float cellHash = hash(nearestCell + uSeed);
  float cellHash2 = hash(nearestCell * 1.7 + uSeed + 100.0);
  float cellHash3 = hash(nearestCell * 2.3 + uSeed + 200.0);

  // Per-shard explosion direction and rotation
  vec2 shardCenter = nearestPoint / scl; // world-space cell center
  float shardDist = length(shardCenter);
  vec2 explosionDir = shardDist > 0.001 ? shardCenter / shardDist : vec2(cellHash - 0.5, cellHash2 - 0.5);
  // Add random tangential component for more chaotic explosion
  vec2 tangent = vec2(-explosionDir.y, explosionDir.x);
  explosionDir += tangent * (cellHash3 - 0.5) * 0.6;
  explosionDir = normalize(explosionDir);

  // Displacement increases with shatter and distance from center
  float displacement = shatterT * uExplosionForce * (0.3 + shardDist * 2.0);

  // Transform UV within cell: offset by shard displacement + rotate
  vec2 shardOffset = explosionDir * displacement;
  float shardRotation = shatterT * (cellHash - 0.5) * 2.0; // per-shard rotation
  float cr = cos(shardRotation), sr = sin(shardRotation);

  // Check if this pixel is inside the shrunk cell (gap test)
  // Erode cell boundary inward as shatter increases
  float erosion = shatterT * 0.25;
  float inCell = smoothstep(erosion, erosion + 0.03, edgeDist);

  // Per-cell color
  float hue = fract(uColorHue / 360.0 + cellHash * uColorVariation);
  float sat = 0.5 + cellHash2 * 0.3;

  // Surface roughness
  float rough = noise(p * 8.0 + uSeed) * uRoughness * 0.15;

  // 3D depth: cells at different heights + bevel at edges
  float cellDepth = cellHash2 * uDepth3D;
  float bevel = smoothstep(0.0, 0.25, edgeDist) * 0.3;
  float lighting = 0.5 + bevel + cellDepth * 0.2 + rough;

  vec3 cellColor = hsl2rgb(hue, sat, clamp(lighting * 0.5, 0.1, 0.8));

  // Crack/gap color: dark void or glowing energy
  vec3 gapColor = vec3(0.01);
  if (uCrackGlow > 0.01) {
    float glowPulse = 0.7 + sin(uTime * 2.0 + nearestId) * 0.3;
    float glowIntensity = uCrackGlow * glowPulse;
    float crackHue = fract(uColorHue / 360.0 + 0.05);
    gapColor = hsl2rgb(crackHue, 0.9, 0.25) * glowIntensity;
    gapColor += vec3(1.0, 0.5, 0.1) * glowIntensity * 0.4;
    // Glow intensifies at crack edges
    float edgeGlow = smoothstep(crackW, 0.0, edgeDist) * glowIntensity;
    gapColor += vec3(1.0, 0.6, 0.2) * edgeGlow * 0.5;
  }

  // Emissive highlights on cell surface
  float emissive = smoothstep(0.7, 1.0, cellHash) * uEmissiveStrength;
  cellColor += hsl2rgb(hue, 0.8, 0.7) * emissive * 0.3;

  // Compose: cell interior vs gap
  vec3 col = gapColor;
  col = mix(col, cellColor, inCell);

  // At crack boundaries (thin line between cell and gap), add dark border
  float borderLine = smoothstep(0.0, 0.02, edgeDist - erosion) * (1.0 - smoothstep(0.02, 0.06, edgeDist - erosion));
  col = mix(col, vec3(0.02), borderLine * 0.7 * inCell);

  gl_FragColor = vec4(col, 1.0);
}
`

const voronoiShatterParams: ParamSchemaDef[] = [
  { name: 'seed', type: 'float', min: 0, max: 100, default: 2.83, description: 'Random seed' },
  { name: 'cellCount', type: 'float', min: 2, max: 20, default: 15.95, description: 'Number of cells across' },
  { name: 'crackWidth', type: 'float', min: 0.01, max: 0.3, default: 0.141, description: 'Crack width' },
  { name: 'shatterAmount', type: 'float', min: 0, max: 1, default: 0.641, description: 'Shatter amount (0=intact, 1=exploded)' },
  { name: 'explosionForce', type: 'float', min: 0, max: 3, default: 0.896, description: 'Explosion force' },
  { name: 'speed', type: 'float', min: 0, max: 2, default: 0.791, description: 'Cell drift speed' },
  { name: 'colorHue', type: 'float', min: 0, max: 360, default: 63, description: 'Base color hue' },
  { name: 'colorVariation', type: 'float', min: 0, max: 1, default: 0.495, description: 'Color variation between cells' },
  { name: 'emissiveStrength', type: 'float', min: 0, max: 2, default: 1.6, description: 'Emissive highlight strength' },
  { name: 'depth3D', type: 'float', min: 0, max: 1, default: 0.153, description: '3D depth variation' },
  { name: 'crackGlow', type: 'float', min: 0, max: 2, default: 0.489, description: 'Crack glow (magma/energy)' },
  { name: 'roughness', type: 'float', min: 0, max: 1, default: 0.196, description: 'Surface roughness' },
]

const voronoiShatterEvaluateSource = `
return { shaderConfig: {
  fragmentShader: inputs.fragmentShader,
  uniforms: {
    uTime: ctx.elapsed,
    uSeed: inputs.seed,
    uCellCount: inputs.cellCount,
    uCrackWidth: inputs.crackWidth,
    uShatterAmount: inputs.shatterAmount,
    uExplosionForce: inputs.explosionForce,
    uSpeed: inputs.speed,
    uColorHue: inputs.colorHue,
    uColorVariation: inputs.colorVariation,
    uEmissiveStrength: inputs.emissiveStrength,
    uDepth3D: inputs.depth3D,
    uCrackGlow: inputs.crackGlow,
    uRoughness: inputs.roughness,
    uAspect: ctx.resolution ? ctx.resolution[0] / Math.max(ctx.resolution[1], 1) : 1.0,
  }
}};
`

const voronoiShatterDef: CompoundGeneratorDef = {
  id: 'builtin_voronoiShatter',
  name: 'Voronoi Shatter',
  description: 'Voronoi cell fracture with glowing cracks, explosion, and 3D depth — game VFX staple',
  defaultCameraDistance: 0,
  generatorType: 'voronoiShatter_generator',
  outputMode: 'shader',
  params: voronoiShatterParams,
  inputs: voronoiShatterParams.map(p => ({
    name: p.name,
    type: 'number' as const,
    default: p.default as number,
  })),
  outputs: [{ name: 'shaderConfig', type: 'array' as const }],
  evaluateSource: voronoiShatterEvaluateSource,
  fragmentShader: voronoiShatterFragShader,
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════════

export const NEW_SHADER_PATTERNS: CompoundGeneratorDef[] = [
  slimeMoldDef,
  planetDef,
  starfieldDef,
  kaleidoscopeDef,
  lightningStormDef,
  auroraDef,
  psychedelicDef,
  celticKnotDef,
  boidsDef,
  particleLifeDef,
  metaballsDef,
  voronoiShatterDef,
]
