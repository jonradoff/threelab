import type { CompoundGeneratorDef } from './generatorGraphFactory'
import type { ParamSchemaDef } from './storage'

// ═══════════════════════════════════════════════════════════════════════════
// FABLE PHYSARUM — high-fidelity slime mold
//
// Differences from the classic Physarum built-in:
// - HDR trail accumulation (no clamp) + filmic exposure tone mapping
// - RGB trail: agents deposit color by heading/trait → iridescent flow mixing
//   (alpha channel carries pure density for sensing, independent of color)
// - Relief lighting from the density gradient (embossed "wet vein" look)
// - Curated cosine palettes, duotone, and flow-chroma color modes
// - Sensor "breathing" (pulse) and per-agent traits for living motion
// - Petri-dish boundary or seamless wrap (wrap mode tiles the display)
// - Aspect-corrected display with vignette + dithering
// ═══════════════════════════════════════════════════════════════════════════

const fableAgentFrag = `precision highp float;
uniform sampler2D agentTex;
uniform sampler2D trailTex;
uniform float sensorAngle;
uniform float sensorDist;
uniform float turnSpeed;
uniform float moveSpeed;
uniform vec2 resolution;
uniform float time;
uniform float randomStrength;
uniform float pulse;
uniform float pulseSpeed;
uniform float boundaryMode;
uniform vec2 mousePos;
uniform float mouseForce;
varying vec2 vUv;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float sense(vec2 p) {
  // Compress sensed density so saturated trails plateau — without this,
  // unbounded HDR trails become inescapable attractors and the sim freezes
  return 1.0 - exp(-texture2D(trailTex, fract(p)).a * 0.25);
}

void main() {
  vec4 agent = texture2D(agentTex, vUv);
  vec2 pos = agent.xy;
  float angle = agent.z;
  float trait = agent.w;

  // Sensor breathing — each agent pulses on its own phase
  float breathe = 1.0 + pulse * 0.6 * sin(time * pulseSpeed * 2.0 + trait * 6.28318);
  float sa = sensorAngle * 0.0174533 * (1.0 + pulse * 0.25 * sin(time * pulseSpeed * 1.3 + trait * 12.0));
  float sd = sensorDist * breathe / resolution.x;

  float F = sense(pos + vec2(cos(angle), sin(angle)) * sd);
  float L = sense(pos + vec2(cos(angle + sa), sin(angle + sa)) * sd);
  float R = sense(pos + vec2(cos(angle - sa), sin(angle - sa)) * sd);

  float ts = turnSpeed * 0.0174533;
  float rnd = hash(pos * 913.7 + vUv * 271.3 + fract(time) * 37.1);

  if (F > 0.95 && L > 0.95 && R > 0.95) {
    // Lost in saturated fog — no gradient to follow, wander hard to disperse
    angle += (rnd - 0.5) * 3.14159 * 0.6;
  } else if (F > L && F > R) {
    angle += (rnd - 0.5) * ts * randomStrength * 0.2;
  } else if (F < L && F < R) {
    angle += (rnd - 0.5) * 2.0 * ts;
  } else if (R > L) {
    angle -= ts * (0.6 + 0.4 * rnd);
  } else {
    angle += ts * (0.6 + 0.4 * rnd);
  }
  angle += (hash(pos.yx * 517.3 + fract(time * 0.7) * 91.7) - 0.5) * randomStrength * ts * 0.5;

  float speed = (0.75 + trait * 0.5) * moveSpeed / resolution.x;
  vec2 dir = vec2(cos(angle), sin(angle));

  // Mouse attract/repel with gaussian falloff
  vec2 toM = mousePos - pos;
  float md = length(toM);
  float mstr = mouseForce * exp(-md * md * 60.0);
  if (abs(mstr) > 0.001) {
    dir = normalize(dir + normalize(toM + vec2(1e-5)) * mstr);
    angle = atan(dir.y, dir.x);
  }

  pos += dir * speed;

  if (boundaryMode > 0.5) {
    // Petri dish: steer back inward at the rim
    vec2 fromC = pos - 0.5;
    float r = length(fromC);
    if (r > 0.48) {
      dir = normalize(dir - fromC / r * (r - 0.48) * 30.0);
      angle = atan(dir.y, dir.x);
      pos = vec2(0.5) + fromC / r * 0.48;
    }
  } else {
    pos = fract(pos);
  }

  gl_FragColor = vec4(pos, angle, trait);
}`

const fableDepositVert = `attribute vec2 agentUV;
uniform sampler2D agentTex;
uniform float depositAmount;
uniform float colorMode;
uniform float colorHue;
uniform float saturation;
uniform float hueDrift;
varying vec3 vColor;
varying float vDeposit;

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
  vec4 agent = texture2D(agentTex, agentUV);
  gl_Position = vec4(agent.xy * 2.0 - 1.0, 0.0, 1.0);
  gl_PointSize = 1.0;
  vDeposit = depositAmount * 0.05;
  if (colorMode < 0.5) {
    // Flow mode: hue follows heading (continuous across the 2π wrap) + trait
    float hue = colorHue + agent.z / 6.28318 + agent.w * 0.12 + hueDrift;
    vColor = hsv2rgb(vec3(hue, saturation, 1.0));
  } else {
    vColor = vec3(1.0);
  }
}`

// Additive blending (srcFactor = SrcAlpha): rgb += vColor * vDeposit, a += vDeposit²
const fableDepositFrag = `precision highp float;
varying vec3 vColor;
varying float vDeposit;
void main() {
  gl_FragColor = vec4(vColor, vDeposit);
}`

const fableDiffuseFrag = `precision highp float;
uniform sampler2D trailTex;
uniform float decayRate;
uniform float diffuseSpeed;
uniform vec2 resolution;
varying vec2 vUv;

void main() {
  vec2 texel = 1.0 / resolution;
  vec4 center = texture2D(trailTex, vUv);
  vec4 sum = center * 4.0;
  sum += texture2D(trailTex, fract(vUv + vec2(-1.0, 0.0) * texel));
  sum += texture2D(trailTex, fract(vUv + vec2(1.0, 0.0) * texel));
  sum += texture2D(trailTex, fract(vUv + vec2(0.0, -1.0) * texel));
  sum += texture2D(trailTex, fract(vUv + vec2(0.0, 1.0) * texel));
  sum += texture2D(trailTex, fract(vUv + vec2(-1.0, -1.0) * texel)) * 0.5;
  sum += texture2D(trailTex, fract(vUv + vec2(1.0, -1.0) * texel)) * 0.5;
  sum += texture2D(trailTex, fract(vUv + vec2(-1.0, 1.0) * texel)) * 0.5;
  sum += texture2D(trailTex, fract(vUv + vec2(1.0, 1.0) * texel)) * 0.5;
  vec4 diffused = sum / 10.0;
  vec4 blended = mix(center, diffused, diffuseSpeed);
  // HDR: no clamp to 1 — just a stability ceiling
  gl_FragColor = min(blended * (1.0 - decayRate), vec4(20000.0));
}`

const fableDisplayFrag = `precision highp float;
uniform sampler2D trailTex;
uniform vec2 resolution;
uniform float exposure;
uniform float contrast;
uniform float glow;
uniform float relief;
uniform float vignette;
uniform float colorMode;
uniform float boundaryMode;
uniform float densityNorm;
uniform float depositNorm;
uniform vec3 palA;
uniform vec3 palB;
uniform vec3 palC;
uniform vec3 palD;
uniform vec3 colorA;
uniform vec3 colorB;
uniform vec3 bgColor;
uniform float uAspect;
varying vec2 vUv;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

vec3 pal(float t) {
  return palA + palB * cos(6.28318 * (palC * t + palD));
}

float dens(vec2 uv) {
  return texture2D(trailTex, uv).a;
}

float tone(float d) {
  return 1.0 - exp(-d * densityNorm * exposure);
}

void main() {
  // Aspect-corrected square sim space
  vec2 suv = vUv - 0.5;
  if (uAspect > 1.0) suv.x *= uAspect;
  else if (uAspect > 0.0) suv.y /= uAspect;
  vec2 tuv = suv + 0.5;

  float inDish = 1.0;
  if (boundaryMode > 0.5) {
    inDish = 1.0 - smoothstep(0.484, 0.5, length(suv));
    tuv = clamp(tuv, 0.0, 1.0);
  } else {
    tuv = fract(tuv); // wrap: seamless tiling fills any aspect
  }

  vec4 trail = texture2D(trailTex, tuv);
  float density = trail.a;
  float lum = pow(tone(density), max(contrast, 0.05));

  vec3 col;
  vec3 tint;
  if (colorMode < 0.5) {
    // Flow chroma: average deposit color, normalized to full saturation range
    vec3 chroma = trail.rgb / max(density, 1e-5) * depositNorm;
    chroma = chroma / max(max(chroma.r, max(chroma.g, chroma.b)), 1e-4);
    col = chroma * lum;
    tint = chroma;
  } else if (colorMode < 1.5) {
    vec3 pc = pal(clamp(lum, 0.0, 1.0) * 0.9);
    col = pc * lum;
    tint = pal(0.65);
  } else {
    col = mix(colorA, colorB, lum) * lum;
    tint = mix(colorA, colorB, 0.65);
  }

  // Relief lighting from the tone-mapped density gradient
  vec2 texel = 1.0 / resolution;
  float gx = tone(dens(tuv + vec2(texel.x, 0.0))) - tone(dens(tuv - vec2(texel.x, 0.0)));
  float gy = tone(dens(tuv + vec2(0.0, texel.y))) - tone(dens(tuv - vec2(0.0, texel.y)));
  vec3 n = normalize(vec3(-gx * relief * 6.0, -gy * relief * 6.0, 1.0));
  vec3 Ld = normalize(vec3(-0.45, 0.65, 0.62));
  float diff = max(dot(n, Ld), 0.0);
  float spec = pow(max(reflect(-Ld, n).z, 0.0), 32.0);
  float lit = mix(1.0, 0.4 + 0.75 * diff, clamp(relief, 0.0, 1.0) * smoothstep(0.02, 0.2, lum));
  col *= lit;
  col += (col + 0.12) * spec * relief * 0.3 * smoothstep(0.12, 0.55, lum);

  // Soft halo glow sampled from surrounding trail
  float spread = 0.0;
  spread += tone(dens(fract(tuv + vec2( 5.0,  0.0) * texel)));
  spread += tone(dens(fract(tuv + vec2(-5.0,  0.0) * texel)));
  spread += tone(dens(fract(tuv + vec2( 0.0,  5.0) * texel)));
  spread += tone(dens(fract(tuv + vec2( 0.0, -5.0) * texel)));
  spread += tone(dens(fract(tuv + vec2( 3.5,  3.5) * texel)));
  spread += tone(dens(fract(tuv + vec2(-3.5,  3.5) * texel)));
  spread += tone(dens(fract(tuv + vec2( 3.5, -3.5) * texel)));
  spread += tone(dens(fract(tuv + vec2(-3.5, -3.5) * texel)));
  spread *= 0.125;
  col += tint * spread * spread * glow * 0.45;

  // Compose over background with vignette
  col = col * inDish + bgColor * (1.0 - inDish * 0.85);
  col *= 1.0 - vignette * smoothstep(0.35, 0.85, length(suv));

  // Petri dish rim light
  if (boundaryMode > 0.5) {
    float rr = length(suv);
    col += vec3(0.45, 0.55, 0.65) * 0.2 * smoothstep(0.012, 0.0, abs(rr - 0.494));
  }

  // Dither to kill banding in the dark falloff
  col += (hash(vUv * resolution) - 0.5) / 255.0;

  gl_FragColor = vec4(col, 1.0);
}`

const fablePhysarumParams: ParamSchemaDef[] = [
  { name: 'agentCount', type: 'int', min: 10000, max: 1048576, default: 400000, description: 'Number of agents' },
  { name: 'simResolution', type: 'int', min: 256, max: 2048, default: 1024, description: 'Trail field resolution' },
  { name: 'sensorAngle', type: 'float', min: 5, max: 85, default: 26, description: 'Sensor angle (degrees)' },
  { name: 'sensorDistance', type: 'float', min: 4, max: 80, default: 30, description: 'Sensor distance (texels)' },
  { name: 'turnSpeed', type: 'float', min: 5, max: 120, default: 34, description: 'Turn speed (degrees/step)' },
  { name: 'moveSpeed', type: 'float', min: 0.2, max: 4, default: 1.15, description: 'Move speed (texels/step)' },
  { name: 'randomStrength', type: 'float', min: 0, max: 2, default: 0.35, description: 'Random steering jitter' },
  { name: 'pulse', type: 'float', min: 0, max: 1, default: 0.25, description: 'Sensor breathing amount' },
  { name: 'pulseSpeed', type: 'float', min: 0, max: 3, default: 0.5, description: 'Sensor breathing speed' },
  { name: 'decayRate', type: 'float', min: 0.005, max: 0.15, default: 0.035, description: 'Trail decay rate' },
  { name: 'diffuseSpeed', type: 'float', min: 0, max: 1, default: 0.4, description: 'Trail diffusion speed' },
  { name: 'depositAmount', type: 'float', min: 0.5, max: 20, default: 4, description: 'Trail deposit strength' },
  { name: 'stepsPerFrame', type: 'int', min: 1, max: 8, default: 2, description: 'Simulation steps per frame' },
  { name: 'spawnPattern', type: 'enum', default: 'uniform', enumValues: ['bigBang', 'ring', 'spiral', 'uniform', 'clusters'], description: 'Agent spawn pattern' },
  { name: 'boundary', type: 'enum', default: 'wrap', enumValues: ['wrap', 'dish'], description: 'World boundary (wrap tiles, dish confines)' },
  { name: 'colorMode', type: 'enum', default: 'flow', enumValues: ['flow', 'palette', 'duotone'], description: 'Coloring mode' },
  { name: 'palette', type: 'enum', default: 'aurora', enumValues: ['aurora', 'ember', 'abyss', 'ultraviolet', 'chrome', 'candy'], description: 'Palette (palette mode)' },
  { name: 'colorHue', type: 'float', min: 0, max: 360, default: 165, description: 'Base hue / palette shift' },
  { name: 'secondaryHue', type: 'float', min: 0, max: 360, default: 285, description: 'Secondary hue (duotone)' },
  { name: 'saturation', type: 'float', min: 0, max: 1, default: 0.8, description: 'Color saturation' },
  { name: 'hueCycle', type: 'float', min: 0, max: 0.5, default: 0.05, description: 'Slow hue drift over time' },
  { name: 'exposure', type: 'float', min: 0.2, max: 6, default: 1.5, description: 'HDR exposure' },
  { name: 'contrast', type: 'float', min: 0.5, max: 2.5, default: 1.3, description: 'Tone curve contrast' },
  { name: 'glow', type: 'float', min: 0, max: 2, default: 0.8, description: 'Halo glow intensity' },
  { name: 'relief', type: 'float', min: 0, max: 2, default: 0.9, description: 'Relief lighting strength' },
  { name: 'vignette', type: 'float', min: 0, max: 1, default: 0.35, description: 'Edge vignette' },
  { name: 'mouseForce', type: 'float', min: -2, max: 2, default: 0.8, description: 'Mouse attract (+) / repel (−)' },
]

const fablePhysarumEvaluateSource = `
var agentCount = Math.min(1048576, Math.max(10000, Math.round(inputs.agentCount)));
var agentSide = Math.min(1024, Math.ceil(Math.sqrt(agentCount)));
var simRes = Math.min(2048, Math.max(256, Math.round(inputs.simResolution)));
var spawnIdx = Math.round(inputs.spawnPattern || 0);
var boundaryIdx = Math.round(inputs.boundary || 0);
var colorModeIdx = Math.round(inputs.colorMode || 0);
var paletteIdx = Math.round(inputs.palette || 0);

var key = nodeId + '_fablePhysarum';
var state = ctx.frameState.get(key);
if (!state || state.agentSide !== agentSide || state.spawnIdx !== spawnIdx) {
  var agentData = new Float32Array(agentSide * agentSide * 4);
  var rng = (function(s){return function(){s=(s*1103515245+12345)&0x7fffffff;return s/0x7fffffff;}})(1337);
  var total = agentSide * agentSide;
  for (var i = 0; i < total; i++) {
    var px, py, angle;
    if (spawnIdx === 0) {
      // bigBang: core exploding outward (radius must be sensing-scale or agents
      // collapse into a single point attractor)
      var th = rng() * Math.PI * 2;
      var r = Math.pow(rng(), 0.5) * 0.13;
      px = 0.5 + Math.cos(th) * r;
      py = 0.5 + Math.sin(th) * r;
      angle = th + (rng() - 0.5) * 0.3;
    } else if (spawnIdx === 1) {
      // ring imploding inward (wide band — tight rings self-trap)
      var th = rng() * Math.PI * 2;
      var r = 0.33 + (rng() - 0.5) * 0.09;
      px = 0.5 + Math.cos(th) * r;
      py = 0.5 + Math.sin(th) * r;
      angle = th + Math.PI + (rng() - 0.5) * 1.0;
    } else if (spawnIdx === 2) {
      // 3-arm spiral galaxy, tangential motion
      var arm = i % 3;
      var t = rng();
      var r = 0.02 + t * 0.38 + (rng() - 0.5) * 0.03;
      var th = arm * 2.0944 + t * 9.0 + (rng() - 0.5) * 0.5;
      px = 0.5 + Math.cos(th) * r;
      py = 0.5 + Math.sin(th) * r;
      angle = th + Math.PI / 2 + (rng() - 0.5) * 0.4;
    } else if (spawnIdx === 3) {
      px = rng(); py = rng();
      angle = rng() * Math.PI * 2;
    } else {
      // clusters
      var cs = [[0.27,0.3],[0.72,0.26],[0.5,0.52],[0.24,0.72],[0.76,0.74],[0.5,0.85]];
      var ci = i % cs.length;
      var th = rng() * Math.PI * 2;
      var r = Math.pow(rng(), 0.5) * 0.09;
      px = cs[ci][0] + Math.cos(th) * r;
      py = cs[ci][1] + Math.sin(th) * r;
      angle = rng() * Math.PI * 2;
    }
    agentData[i*4] = px;
    agentData[i*4+1] = py;
    agentData[i*4+2] = angle;
    agentData[i*4+3] = rng(); // trait: speed variation + color + pulse phase
  }
  state = { agentSide: agentSide, agentData: agentData, spawnIdx: spawnIdx, gen: (state ? state.gen + 1 : 0) };
  ctx.frameState.set(key, state);
}

function hsvToRgb(h,s,v){h=((h%360)+360)%360/360;var i=Math.floor(h*6),f=h*6-i,p=v*(1-s),q=v*(1-f*s),t=v*(1-(1-f)*s);var m=i%6;if(m===0)return[v,t,p];if(m===1)return[q,v,p];if(m===2)return[p,v,t];if(m===3)return[p,q,v];if(m===4)return[t,p,v];return[v,p,q];}

// Curated cosine palettes (IQ-style): color = a + b*cos(2π(c*t + d))
var PALETTES = [
  { a:[0.08,0.22,0.25], b:[0.35,0.55,0.50], c:[1.1,1.0,0.9], d:[0.35,0.12,0.45] }, // aurora
  { a:[0.45,0.16,0.06], b:[0.55,0.40,0.25], c:[1.2,1.0,0.8], d:[0.02,0.12,0.25] }, // ember
  { a:[0.06,0.14,0.28], b:[0.25,0.40,0.55], c:[1.0,1.0,1.1], d:[0.55,0.42,0.25] }, // abyss
  { a:[0.28,0.10,0.40], b:[0.50,0.35,0.50], c:[1.0,1.0,0.9], d:[0.65,0.40,0.15] }, // ultraviolet
  { a:[0.22,0.25,0.30], b:[0.50,0.53,0.58], c:[1.0,1.0,1.0], d:[0.08,0.10,0.14] }, // chrome
  { a:[0.50,0.30,0.40], b:[0.45,0.40,0.35], c:[1.0,1.0,0.8], d:[0.85,0.25,0.40] }, // candy
];
var pal = PALETTES[Math.min(paletteIdx, PALETTES.length - 1)];
var hueShift = inputs.colorHue / 360 + ctx.elapsed * inputs.hueCycle * 0.05;
var palD = [pal.d[0] + hueShift, pal.d[1] + hueShift, pal.d[2] + hueShift];

var cA = hsvToRgb(inputs.colorHue, inputs.saturation, 1.0);
var cB = hsvToRgb(inputs.secondaryHue, inputs.saturation, 1.0);

// Normalization: deposit alpha per agent-step is d², equilibrium ~ occupancy*d²/decay
var d = inputs.depositAmount * 0.05;
var occupancy = agentCount / (simRes * simRes);
var densityNorm = inputs.decayRate / Math.max(occupancy * d * d, 1e-6) * 0.08;

var res = ctx.resolution || [1, 1];
var aspect = res[1] > 0 ? res[0] / res[1] : 1;
var mx = ctx.mouse ? (ctx.mouse.x + 1) * 0.5 : -10;
var my = ctx.mouse ? (ctx.mouse.y + 1) * 0.5 : -10;

return { shaderConfig: {
  passes: [
    { name: 'agents', fragmentShader: inputs.agentsShader, target: 'agentState',
      readFrom: { agentTex: 'agentState', trailTex: 'trail' },
      uniforms: {
        sensorAngle: inputs.sensorAngle,
        sensorDist: inputs.sensorDistance,
        turnSpeed: inputs.turnSpeed,
        moveSpeed: inputs.moveSpeed,
        randomStrength: inputs.randomStrength,
        pulse: inputs.pulse,
        pulseSpeed: inputs.pulseSpeed,
        boundaryMode: boundaryIdx,
        mousePos: [mx, my],
        mouseForce: inputs.mouseForce,
        resolution: [simRes, simRes],
        time: ctx.elapsed,
      } },
    { name: 'diffuse', fragmentShader: inputs.diffuseShader, target: 'trail',
      readFrom: { trailTex: 'trail' },
      uniforms: { decayRate: inputs.decayRate, diffuseSpeed: inputs.diffuseSpeed, resolution: [simRes, simRes] } },
    { name: 'deposit', mode: 'deposit', agentTarget: 'agentState', agentRes: state.agentSide,
      vertexShader: inputs.depositVertShader, fragmentShader: inputs.depositFragShader,
      target: 'trail', noClear: true,
      uniforms: {
        depositAmount: inputs.depositAmount,
        colorMode: colorModeIdx,
        colorHue: inputs.colorHue / 360,
        saturation: inputs.saturation,
        hueDrift: ctx.elapsed * inputs.hueCycle * 0.05,
      } },
    { name: 'display', fragmentShader: inputs.displayShader, target: null,
      readFrom: { trailTex: 'trail' },
      uniforms: {
        exposure: inputs.exposure,
        contrast: inputs.contrast,
        glow: inputs.glow,
        relief: inputs.relief,
        vignette: inputs.vignette,
        colorMode: colorModeIdx,
        boundaryMode: boundaryIdx,
        densityNorm: densityNorm,
        depositNorm: d,
        palA: pal.a, palB: pal.b, palC: pal.c, palD: palD,
        colorA: cA, colorB: cB,
        bgColor: [0.004, 0.005, 0.012],
        uAspect: aspect,
        resolution: [simRes, simRes],
      } },
  ],
  renderTargetDefs: {
    agentState: { width: state.agentSide, height: state.agentSide, type: 'float', filter: 'nearest', pingPong: true, _gen: state.gen },
    trail: { width: simRes, height: simRes, type: 'float', filter: 'linear', wrap: 'repeat', pingPong: true, _gen: state.gen },
  },
  initData: { agentState: state.agentData },
  stepsPerFrame: Math.min(8, Math.max(1, Math.round(inputs.stepsPerFrame))),
}};
`

const fablePhysarumDef: CompoundGeneratorDef = {
  id: 'builtin_fablePhysarum',
  name: 'Fable Physarum',
  description: 'High-fidelity slime mold: HDR iridescent trails, relief lighting, and living sensor dynamics',
  defaultCameraDistance: 0,
  generatorType: 'fablePhysarum_generator',
  outputMode: 'shader',
  params: fablePhysarumParams,
  inputs: fablePhysarumParams.map(p => ({
    name: p.name,
    type: 'number' as const,
    default: p.type === 'bool' ? (p.default ? 1 : 0) : (p.type === 'enum' ? 0 : (p.default as number)),
  })),
  outputs: [{ name: 'shaderConfig', type: 'array' as const }],
  evaluateSource: fablePhysarumEvaluateSource,
  shaderSources: {
    agents: fableAgentFrag,
    depositVert: fableDepositVert,
    depositFrag: fableDepositFrag,
    diffuse: fableDiffuseFrag,
    display: fableDisplayFrag,
  },
}

export const FABLE_PHYSARUM_GENERATORS: CompoundGeneratorDef[] = [fablePhysarumDef]
