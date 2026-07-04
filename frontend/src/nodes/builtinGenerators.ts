import type { CompoundGeneratorDef } from './generatorGraphFactory'
import type { ParamSchemaDef } from './storage'
import { SHADER_GENERATORS } from './shaderGenerators'
import { REMAINING_GENERATORS } from './remainingGenerators'
import { NEW_SHADER_PATTERNS } from './newShaderPatterns'
import { FABLE_PHYSARUM_GENERATORS } from './fablePhysarum'
import { FABLE_PETRI_GENERATORS } from './fablePetri'
import { FABLE_CONTINUUM_GENERATORS } from './fableContinuum'
import { FABLE_INK_GENERATORS } from './fableInk'
import { FABLE_DREAMSCAPE_GENERATORS } from './fableDreamscape'
import { FABLE_PHYSARUM_XL_GENERATORS } from './fablePhysarumXL'
import { FABLE_FIREWORKS_GENERATORS } from './fableFireworks'

// ─── Lissajous ────────────────────────────────────────────────────────────

const lissajousParams: ParamSchemaDef[] = [
  { name: 'pointCount', type: 'int', min: 100, max: 50000, default: 5000, description: 'Number of points' },
  { name: 'curveCount', type: 'int', min: 1, max: 10, default: 3, description: 'Number of curves' },
  { name: 'freqA', type: 'float', min: 0.1, max: 20, default: 3, description: 'Frequency A' },
  { name: 'freqB', type: 'float', min: 0.1, max: 20, default: 2, description: 'Frequency B' },
  { name: 'freqC', type: 'float', min: 0.1, max: 20, default: 5, description: 'Frequency C (3D)' },
  { name: 'phaseShift', type: 'float', min: -180, max: 180, default: 0, description: 'Phase shift (degrees)' },
  { name: 'damping', type: 'float', min: 0, max: 5, default: 0, description: 'Damping factor' },
  { name: 'scale', type: 'float', min: 0.5, max: 30, default: 8, description: 'Scale' },
  { name: 'is3D', type: 'bool', default: false, description: '3D mode' },
  { name: 'freqRatio', type: 'float', min: 0.1, max: 5, default: 1, description: 'Frequency ratio' },
  { name: 'symmetry', type: 'int', min: 1, max: 8, default: 1, description: 'Symmetry folds' },
  { name: 'colorMode', type: 'int', min: 0, max: 3, default: 0, description: 'Color: 0=rainbow,1=speed,2=solid,3=palette' },
  { name: 'phaseAnimate', type: 'bool', default: true, description: 'Animate phase' },
  { name: 'phaseSpeed', type: 'float', min: 0, max: 3, default: 0.3, description: 'Phase animation speed' },
  { name: 'animated', type: 'bool', default: true, description: 'Progressive draw' },
  { name: 'drawSpeed', type: 'float', min: 0.1, max: 10, default: 2, description: 'Draw speed' },
  { name: 'rotationSpeed', type: 'float', min: 0, max: 2, default: 0.2, description: 'Rotation speed (3D)' },
]

const lissajousDef: CompoundGeneratorDef = {
  id: 'builtin_lissajous',
  name: 'Lissajous',
  description: 'Animated Lissajous and harmonograph curves',
  defaultCameraDistance: 22,
  generatorType: 'lissajous_generator',
  outputMode: 'line',
  params: lissajousParams,
  inputs: [
    { name: 'pointCount', type: 'number', default: 5000 },
    { name: 'curveCount', type: 'number', default: 3 },
    { name: 'freqA', type: 'number', default: 3 },
    { name: 'freqB', type: 'number', default: 2 },
    { name: 'freqC', type: 'number', default: 5 },
    { name: 'phaseShift', type: 'number', default: 0 },
    { name: 'damping', type: 'number', default: 0 },
    { name: 'scale', type: 'number', default: 8 },
    { name: 'is3D', type: 'number', default: 0 },
    { name: 'freqRatio', type: 'number', default: 1 },
    { name: 'symmetry', type: 'number', default: 1 },
    { name: 'colorMode', type: 'number', default: 0 },
    { name: 'phaseAnimate', type: 'number', default: 1 },
    { name: 'phaseSpeed', type: 'number', default: 0.3 },
    { name: 'animated', type: 'number', default: 1 },
    { name: 'drawSpeed', type: 'number', default: 2 },
    { name: 'rotationSpeed', type: 'number', default: 0.2 },
  ],
  outputs: [
    { name: 'positions', type: 'positions' },
    { name: 'colors', type: 'colors' },
    { name: 'drawCount', type: 'number' },
  ],
  // Uses the existing lissajous_generator evaluate (already in types.ts)
  evaluateSource: '', // empty = use the static evaluate from NODE_DEF_MAP
}

// ─── Strange Attractor ────────────────────────────────────────────────────

const attractorParams: ParamSchemaDef[] = [
  { name: 'attractorType', type: 'enum', default: 'lorenz', description: 'Attractor type', enumValues: ['lorenz', 'rossler', 'halvorsen', 'thomas', 'aizawa', 'dadras'] },
  { name: 'trailLength', type: 'int', min: 100, max: 5000, default: 3996, description: 'Trail length' },
  { name: 'dt', type: 'float', min: 0.001, max: 0.05, default: 0.00492, description: 'Time step' },
  { name: 'scale', type: 'float', min: 0.5, max: 20, default: 12.1025, description: 'Scale' },
  { name: 'colorBySpeed', type: 'bool', default: false, description: 'Color by speed' },
  { name: 'paramA', type: 'float', min: 0.1, max: 3, default: 2.006, description: 'Param A multiplier' },
  { name: 'paramB', type: 'float', min: 0.1, max: 3, default: 1.579, description: 'Param B multiplier' },
  { name: 'paramC', type: 'float', min: 0.1, max: 3, default: 1.898, description: 'Param C multiplier' },
  { name: 'rotationSpeed', type: 'float', min: 0, max: 2, default: 0.24, description: 'Rotation speed' },
  { name: 'colorHue', type: 'float', min: 0, max: 1, default: 0.6206, description: 'Base color hue' },
  { name: 'opacity', type: 'float', min: 0.1, max: 1, default: 0.672, description: 'Trail opacity' },
  { name: 'stepsPerFrame', type: 'int', min: 1, max: 20, default: 11, description: 'Steps per frame' },
]

const attractorEvaluateSource = `
// Attractor evaluate function body
// All 3 params (a,b,c) affect every attractor type
var attractors = {
  lorenz: function(x,y,z,a,b,c) { return [a*(y-x), x*(b-z)-y, x*y-c*z] },
  rossler: function(x,y,z,a,b,c) { return [-(y+z), x+a*y, b+z*(x-c)] },
  halvorsen: function(x,y,z,a,b,c) { return [-a*x-4*y-4*z-y*y, -a*y-4*z-4*x-z*z, -a*z-4*x-4*y-x*x] },
  thomas: function(x,y,z,a,b,c) { return [Math.sin(y)-a*x, Math.sin(z)-a*y, Math.sin(x)-a*z] },
  aizawa: function(x,y,z,a,b,c) { return [(z-b)*x-0.5*y, 0.5*x+(z-b)*y, c+a*z-z*z*z/3-(x*x+y*y)*(1+0.25*z)+0.1*z*x*x*x] },
  dadras: function(x,y,z,a,b,c) { return [y-a*x+b*y*z, c*y-x*z+z, 2*x*y-9*z] },
};
var presets = {
  lorenz: {a:10,b:28,c:2.667,dt:0.005,vs:5,init:[0.1,0,0],sn:50},
  rossler: {a:0.2,b:0.2,c:5.7,dt:0.01,vs:4,init:[1,1,0],sn:15},
  halvorsen: {a:1.89,b:0,c:0,dt:0.005,vs:4,init:[-1.48,-1.51,2.04],sn:30},
  thomas: {a:0.208186,b:0,c:0,dt:0.03,vs:0.8,init:[1.1,1.1,-0.01],sn:2},
  aizawa: {a:0.95,b:0.7,c:0.6,dt:0.01,vs:0.6,init:[0.1,0,0.1],sn:5},
  dadras: {a:3,b:2.7,c:1.7,dt:0.002,vs:6,init:[1,1,0],sn:40},
};

var typeIdx = Math.round(inputs.attractorType || 0);
var typeNames = ['lorenz','rossler','halvorsen','thomas','aizawa','dadras'];
var typeName = typeNames[typeIdx] || 'lorenz';
var fn = attractors[typeName] || attractors.lorenz;
var p = presets[typeName] || presets.lorenz;

var mA = inputs.paramA != null ? inputs.paramA : 1;
var mB = inputs.paramB != null ? inputs.paramB : 1;
var mC = inputs.paramC != null ? inputs.paramC : 1;
var trailLength = Math.max(100, Math.min(5000, Math.round(inputs.trailLength || 1000)));
var userDt = inputs.dt || 0.005;
var userScale = inputs.scale || 5;
var colorBySpeed = (inputs.colorBySpeed || 0) > 0.5;
var rotSpeed = inputs.rotationSpeed || 0.1;
var baseHue = inputs.colorHue != null ? inputs.colorHue : 0.55;
var stepsPerFrame = Math.max(1, Math.min(20, Math.round(inputs.stepsPerFrame || 5)));

// Multiplicative params: 1.0 = preset default
var ea = p.a * mA;
var eb = p.b * mB;
var ec = p.c * mC;
var eDt = p.dt * (userDt / 0.005);
var eVs = p.vs * (userScale / 5);
var eSn = p.sn;

// Cross-frame state
var stateKey = nodeId + '_attractor';
var state = ctx.frameState.get(stateKey);
if (!state || state._type !== typeName || state._trail !== trailLength || state._mA !== mA || state._mB !== mB || state._mC !== mC) {
  // Initialize: skip transient
  var x = p.init[0], y = p.init[1], z = p.init[2];
  for (var i = 0; i < 1000; i++) {
    var d = fn(x, y, z, ea, eb, ec);
    x += d[0] * eDt; y += d[1] * eDt; z += d[2] * eDt;
    if (Math.abs(x) > 1000 || Math.abs(y) > 1000 || Math.abs(z) > 1000) {
      x = p.init[0]; y = p.init[1]; z = p.init[2];
    }
  }
  // Fill trail
  var positions = new Float32Array(trailLength * 3);
  var colors = new Float32Array(trailLength * 3);
  for (var i = 0; i < trailLength; i++) {
    var d = fn(x, y, z, ea, eb, ec);
    x += d[0] * eDt; y += d[1] * eDt; z += d[2] * eDt;
    if (Math.abs(x) > 1000 || Math.abs(y) > 1000 || Math.abs(z) > 1000) {
      x = p.init[0]; y = p.init[1]; z = p.init[2];
    }
    positions[i*3] = x / eVs;
    positions[i*3+1] = y / eVs;
    positions[i*3+2] = z / eVs;
    var spd = Math.sqrt(d[0]*d[0] + d[1]*d[1] + d[2]*d[2]);
    var ns = Math.min(spd / eSn, 1);
    var col = helpers.hsl(baseHue - ns * 0.4, 0.8, 0.3 + ns * 0.25);
    colors[i*3] = col[0]; colors[i*3+1] = col[1]; colors[i*3+2] = col[2];
  }
  state = { x: x, y: y, z: z, writeIndex: 0, positions: positions, colors: colors, _type: typeName, _trail: trailLength, _mA: mA, _mB: mB, _mC: mC };
  ctx.frameState.set(stateKey, state);
}

// Advance simulation
for (var s = 0; s < stepsPerFrame; s++) {
  var d = fn(state.x, state.y, state.z, ea, eb, ec);
  state.x += d[0] * eDt; state.y += d[1] * eDt; state.z += d[2] * eDt;
  if (Math.abs(state.x) > 1000 || Math.abs(state.y) > 1000 || Math.abs(state.z) > 1000) {
    state.x = p.init[0]; state.y = p.init[1]; state.z = p.init[2];
  }
  var idx = state.writeIndex % trailLength;

  // Rotate around Y axis
  var angle = ctx.elapsed * rotSpeed;
  var cosA = Math.cos(angle), sinA = Math.sin(angle);
  var tilt = Math.sin(ctx.elapsed * 0.1) * 0.2;
  var cosT = Math.cos(tilt), sinT = Math.sin(tilt);
  var rx = state.x / eVs, ry = state.y / eVs, rz = state.z / eVs;
  var rx2 = rx * cosA + rz * sinA;
  var rz2 = -rx * sinA + rz * cosA;
  var ry2 = ry * cosT - rz2 * sinT;
  var rz3 = ry * sinT + rz2 * cosT;

  state.positions[idx*3] = rx2;
  state.positions[idx*3+1] = ry2;
  state.positions[idx*3+2] = rz3;

  var spd = Math.sqrt(d[0]*d[0] + d[1]*d[1] + d[2]*d[2]);
  var ns = Math.min(spd / eSn, 1);
  var h = colorBySpeed ? baseHue - ns * 0.4 : (state.writeIndex % trailLength) / trailLength;
  var sat = colorBySpeed ? 0.8 : 0.7;
  var lig = colorBySpeed ? 0.3 + ns * 0.25 : 0.45;
  var col = helpers.hsl(h, sat, lig);
  state.colors[idx*3] = col[0]; state.colors[idx*3+1] = col[1]; state.colors[idx*3+2] = col[2];
  state.writeIndex++;
}

return { positions: state.positions, colors: state.colors, drawCount: -1, opacity: inputs.opacity || 0.85 };
`

const attractorDef: CompoundGeneratorDef = {
  id: 'builtin_attractor',
  name: 'Strange Attractor',
  description: 'Lorenz, Rossler, and other strange attractors',
  defaultCameraDistance: 12,
  generatorType: 'attractor_generator',
  outputMode: 'line',
  params: attractorParams,
  inputs: attractorParams.map(p => ({
    name: p.name,
    type: 'number' as const,
    default: p.type === 'bool' ? (p.default ? 1 : 0) : (p.type === 'enum' ? 0 : (p.default as number)),
  })),
  outputs: [
    { name: 'positions', type: 'positions' },
    { name: 'colors', type: 'colors' },
    { name: 'drawCount', type: 'number' },
    { name: 'opacity', type: 'number' },
  ],
  evaluateSource: attractorEvaluateSource,
}

// ─── Spirograph ───────────────────────────────────────────────────────────

const spirographParams: ParamSchemaDef[] = [
  { name: 'curveType', type: 'enum', default: 'rose', description: 'Curve type', enumValues: ['hypotrochoid', 'epitrochoid', 'rose', 'spiralograph'] },
  { name: 'outerRadius', type: 'float', min: 0.5, max: 20, default: 4.2, description: 'Outer radius' },
  { name: 'innerRadius', type: 'float', min: 0.1, max: 15, default: 2.78, description: 'Inner radius' },
  { name: 'penDistance', type: 'float', min: 0.1, max: 15, default: 3.75, description: 'Pen distance' },
  { name: 'pointCount', type: 'int', min: 500, max: 20000, default: 1271, description: 'Point count' },
  { name: 'scale', type: 'float', min: 0.5, max: 20, default: 17.7, description: 'Scale' },
  { name: 'drawSpeed', type: 'float', min: 0.1, max: 10, default: 2.6, description: 'Draw speed' },
  { name: 'animated', type: 'bool', default: true, description: 'Progressive draw' },
  { name: 'colorMode', type: 'enum', default: 'rainbow', description: 'Color mode', enumValues: ['rainbow', 'speed', 'angle', 'solid'] },
  { name: 'lineOpacity', type: 'float', min: 0.1, max: 1, default: 0.72, description: 'Line opacity' },
  { name: 'layerCount', type: 'int', min: 1, max: 5, default: 4, description: 'Layer count' },
  { name: 'layerOffset', type: 'float', min: 0, max: 3, default: 2.3, description: 'Layer offset' },
  { name: 'rotationSpeed', type: 'float', min: 0, max: 2, default: 1.18, description: 'Rotation speed' },
  { name: 'petals', type: 'int', min: 0, max: 20, default: 15, description: 'Petals (rose mode)' },
]

const spirographEvaluateSource = `
var typeIdx = Math.round(inputs.curveType || 0);
var typeNames = ['hypotrochoid','epitrochoid','rose','spiralograph'];
var curveType = typeNames[typeIdx] || 'hypotrochoid';
var R = inputs.outerRadius || 5;
var r = inputs.innerRadius || 3;
var d = inputs.penDistance || 2.5;
var pointCount = Math.max(500, Math.min(20000, Math.round(inputs.pointCount || 8000)));
var scale = inputs.scale || 5;
var drawSpeed = inputs.drawSpeed || 3;
var animated = (inputs.animated || 0) > 0.5;
var colorIdx = Math.round(inputs.colorMode || 0);
var colorModes = ['rainbow','speed','angle','solid'];
var colorMode = colorModes[colorIdx] || 'rainbow';
var layerCount = Math.max(1, Math.min(5, Math.round(inputs.layerCount || 1)));
var layerOffset = inputs.layerOffset || 0.5;
var rotSpeed = inputs.rotationSpeed || 0.1;
var petals = Math.round(inputs.petals || 0);

// Compute LCM revolutions for closure
function gcd(a, b) { a = Math.abs(Math.round(a*1000)); b = Math.abs(Math.round(b*1000)); while(b) { var t=b; b=a%b; a=t; } return a; }
var Ri = Math.abs(Math.round(R*1000));
var ri = Math.abs(Math.round(r*1000));
var lcmRev = ri === 0 ? 1 : ri / gcd(Ri, ri);
var tMax = Math.PI * 2 * lcmRev;

function computePoint(t, R, r, d, type, pet) {
  var x = 0, y = 0;
  if (type === 'epitrochoid') {
    var sum = R + r, ratio = sum / r;
    x = sum * Math.cos(t) - d * Math.cos(ratio * t);
    y = sum * Math.sin(t) - d * Math.sin(ratio * t);
  } else if (type === 'rose') {
    var k = pet > 0 ? pet : (R / r);
    var rr = d * Math.cos(k * t);
    x = rr * Math.cos(t); y = rr * Math.sin(t);
  } else if (type === 'spiralograph') {
    var diff = R - r, ratio = diff / r;
    var spiral = 1 + 0.3 * Math.sin(t * 0.1);
    x = (diff * Math.cos(t) + d * Math.cos(ratio * t)) * spiral;
    y = (diff * Math.sin(t) - d * Math.sin(ratio * t)) * spiral;
  } else {
    var diff = R - r, ratio = diff / r;
    x = diff * Math.cos(t) + d * Math.cos(ratio * t);
    y = diff * Math.sin(t) - d * Math.sin(ratio * t);
  }
  return [x, y];
}

// Progressive draw
var progressKey = nodeId + '_progress';
var progress = ctx.frameState.get(progressKey) || 0;
if (animated) {
  progress += ctx.delta * drawSpeed * 0.05;
  if (progress > 1) progress -= Math.floor(progress);
} else {
  progress = 1;
}
ctx.frameState.set(progressKey, progress);
var drawCount = Math.floor(progress * pointCount);

// Rotation
var rotAngle = ctx.elapsed * rotSpeed;
var cosR = Math.cos(rotAngle), sinR = Math.sin(rotAngle);

var totalPoints = layerCount * drawCount;
var positions = new Float32Array(totalPoints * 3);
var colors = new Float32Array(totalPoints * 3);
var offset = 0;

for (var l = 0; l < layerCount; l++) {
  var rOff = l * layerOffset;
  var lR = R + rOff * 0.3;
  var lRi = r + rOff * 0.2;
  var lD = d + rOff * 0.15;

  for (var i = 0; i < drawCount; i++) {
    var frac = i / (pointCount - 1);
    var t = frac * tMax;
    var pt = computePoint(t, lR, lRi, lD, curveType, petals);
    var x = pt[0] * scale;
    var y = pt[1] * scale;

    // Apply rotation
    var rx = x * cosR - y * sinR;
    var ry = x * sinR + y * cosR;

    var idx = (offset + i) * 3;
    positions[idx] = rx;
    positions[idx + 1] = ry;
    positions[idx + 2] = 0;

    // Color
    var cr = 1, cg = 1, cb = 1;
    if (colorMode === 'rainbow') {
      var col = helpers.hsl(frac, 0.85, 0.55);
      cr = col[0]; cg = col[1]; cb = col[2];
    } else if (colorMode === 'angle') {
      var angle = Math.atan2(ry, rx);
      var h = (angle / (Math.PI * 2) + 0.5) % 1;
      var col = helpers.hsl(h, 0.8, 0.5);
      cr = col[0]; cg = col[1]; cb = col[2];
    } else if (colorMode === 'speed') {
      var dt2 = 0.001;
      var pt2 = computePoint(t + dt2, lR, lRi, lD, curveType, petals);
      var spd = Math.sqrt(Math.pow(pt2[0] - pt[0], 2) + Math.pow(pt2[1] - pt[1], 2)) / dt2;
      var ns = Math.min(spd / (lR + lRi + lD), 1);
      var col = helpers.hsl(0.6 - ns * 0.5, 0.85, 0.4 + ns * 0.25);
      cr = col[0]; cg = col[1]; cb = col[2];
    } else {
      var h = l / Math.max(layerCount, 1);
      var col = helpers.hsl(h, 0.7, 0.55);
      cr = col[0]; cg = col[1]; cb = col[2];
    }

    colors[idx] = cr;
    colors[idx + 1] = cg;
    colors[idx + 2] = cb;
  }
  offset += drawCount;
}

return { positions: positions, colors: colors, drawCount: -1 };
`

const spirographDef: CompoundGeneratorDef = {
  id: 'builtin_spirograph',
  name: 'Spirograph',
  description: 'Hypotrochoid and epitrochoid spirograph curves',
  defaultCameraDistance: 315,
  generatorType: 'spirograph_generator',
  outputMode: 'line',
  params: spirographParams,
  inputs: [
    { name: 'curveType', type: 'number', default: 2 },
    { name: 'outerRadius', type: 'number', default: 4.2 },
    { name: 'innerRadius', type: 'number', default: 2.78 },
    { name: 'penDistance', type: 'number', default: 3.75 },
    { name: 'pointCount', type: 'number', default: 1271 },
    { name: 'scale', type: 'number', default: 17.7 },
    { name: 'drawSpeed', type: 'number', default: 2.6 },
    { name: 'animated', type: 'number', default: 1 },
    { name: 'colorMode', type: 'number', default: 0 },
    { name: 'lineOpacity', type: 'number', default: 0.72 },
    { name: 'layerCount', type: 'number', default: 4 },
    { name: 'layerOffset', type: 'number', default: 2.3 },
    { name: 'rotationSpeed', type: 'number', default: 1.18 },
    { name: 'petals', type: 'number', default: 15 },
  ],
  outputs: [
    { name: 'positions', type: 'positions' },
    { name: 'colors', type: 'colors' },
    { name: 'drawCount', type: 'number' },
  ],
  evaluateSource: spirographEvaluateSource,
}

// ─── Sphere Spirals ───────────────────────────────────────────────────────

const sphereSpiralsParams: ParamSchemaDef[] = [
  { name: 'spiralCount', type: 'int', min: 1, max: 30, default: 8, description: 'Number of spirals' },
  { name: 'pointsPerSpiral', type: 'int', min: 100, max: 2000, default: 500, description: 'Points per spiral' },
  { name: 'radius', type: 'float', min: 0.5, max: 20, default: 5, description: 'Sphere radius' },
  { name: 'turns', type: 'float', min: 1, max: 20, default: 5, description: 'Turns' },
  { name: 'rotationSpeed', type: 'float', min: 0, max: 2, default: 0.3, description: 'Rotation speed' },
  { name: 'wobble', type: 'float', min: 0, max: 5, default: 0.5, description: 'Wobble amount' },
  { name: 'wobbleSpeed', type: 'float', min: 0, max: 3, default: 0.5, description: 'Wobble speed' },
  { name: 'colorMode', type: 'enum', default: 'spiral', description: 'Color mode', enumValues: ['spiral', 'height', 'angle', 'speed'] },
  { name: 'noiseDistort', type: 'float', min: 0, max: 5, default: 0, description: 'Noise distortion' },
  { name: 'noiseFreq', type: 'float', min: 0.5, max: 10, default: 2, description: 'Noise frequency' },
  { name: 'pulseAmplitude', type: 'float', min: 0, max: 3, default: 0, description: 'Pulse amplitude' },
  { name: 'pulseSpeed', type: 'float', min: 0, max: 5, default: 1, description: 'Pulse speed' },
  { name: 'flatten', type: 'float', min: 0, max: 1, default: 0, description: 'Flatten amount' },
]

const sphereSpiralsEvaluateSource = `
var spiralCount = Math.max(1, Math.min(30, Math.round(inputs.spiralCount || 8)));
var pointsPerSpiral = Math.max(100, Math.min(2000, Math.round(inputs.pointsPerSpiral || 500)));
var radius = inputs.radius || 5;
var turns = inputs.turns || 5;
var rotSpeed = inputs.rotationSpeed || 0.3;
var wobble = inputs.wobble || 0.5;
var wobbleSpeed = inputs.wobbleSpeed || 0.5;
var colorIdx = Math.round(inputs.colorMode || 0);
var colorModes = ['spiral','height','angle','speed'];
var colorMode = colorModes[colorIdx] || 'spiral';
var noiseDistort = inputs.noiseDistort || 0;
var noiseFreq = inputs.noiseFreq || 2;
var pulseAmp = inputs.pulseAmplitude || 0;
var pulseSpd = inputs.pulseSpeed || 1;
var flatten = inputs.flatten || 0;

function noise3(x, y, z) {
  var n = Math.sin(x*1.3+y*0.7)*Math.cos(y*1.1+z*0.9) + Math.sin(z*1.7+x*0.5)*Math.cos(x*0.8+y*1.4) + Math.sin(y*2.1+z*0.3)*0.5;
  return n / 2.5;
}

var t = ctx.elapsed;
var totalPoints = spiralCount * pointsPerSpiral;
var positions = new Float32Array(totalPoints * 3);
var colors = new Float32Array(totalPoints * 3);

// Rotation
var rotY = t * rotSpeed;
var rotX = Math.sin(t * 0.15) * 0.3;
var cosY = Math.cos(rotY), sinY = Math.sin(rotY);
var cosX = Math.cos(rotX), sinX = Math.sin(rotX);

for (var s = 0; s < spiralCount; s++) {
  var spiralOffset = (s / spiralCount) * Math.PI * 2;
  for (var i = 0; i < pointsPerSpiral; i++) {
    var frac = i / pointsPerSpiral;
    var phi = frac * Math.PI * turns + spiralOffset;
    var theta = frac * Math.PI;

    var bx = Math.sin(theta) * Math.cos(phi);
    var by = Math.sin(theta) * Math.sin(phi) * (1 - flatten);
    var bz = Math.cos(theta);

    var wobbleAmount = wobble * Math.sin(t * wobbleSpeed + phi * 2 + theta * 3) * 0.2;
    var noiseVal = noiseDistort > 0 ? noise3(bx*noiseFreq+t*0.3, by*noiseFreq, bz*noiseFreq+t*0.2)*noiseDistort : 0;
    var pulseVal = pulseAmp > 0 ? Math.sin(t*pulseSpd + frac*Math.PI*4)*pulseAmp*0.15 : 0;

    var r = radius + wobbleAmount + noiseVal + pulseVal;
    var x = r * bx, y = r * by, z = r * bz;

    // Apply rotation (Y then X)
    var rx = x * cosY + z * sinY;
    var rz = -x * sinY + z * cosY;
    var ry = y * cosX - rz * sinX;
    var rz2 = y * sinX + rz * cosX;

    var idx = (s * pointsPerSpiral + i) * 3;
    positions[idx] = rx;
    positions[idx+1] = ry;
    positions[idx+2] = rz2;

    var cr = 1, cg = 1, cb = 1;
    if (colorMode === 'spiral') {
      var col = helpers.hsl(s / spiralCount, 0.8, 0.6);
      cr = col[0]; cg = col[1]; cb = col[2];
    } else if (colorMode === 'height') {
      var col = helpers.hsl(0.55 + (bz)*0.3, 0.7, 0.5);
      cr = col[0]; cg = col[1]; cb = col[2];
    } else if (colorMode === 'angle') {
      var col = helpers.hsl((phi / (Math.PI * 2)) % 1, 0.8, 0.5);
      cr = col[0]; cg = col[1]; cb = col[2];
    } else {
      var speed = Math.abs(Math.sin(theta*3 + phi*2));
      var col = helpers.hsl(0.55 - speed*0.4, 0.85, 0.4 + speed*0.3);
      cr = col[0]; cg = col[1]; cb = col[2];
    }
    colors[idx] = cr; colors[idx+1] = cg; colors[idx+2] = cb;
  }
}

return { positions: positions, colors: colors, drawCount: -1 };
`

const sphereSpiralsDef: CompoundGeneratorDef = {
  id: 'builtin_sphereSpirals',
  name: 'Sphere Spirals',
  description: 'Spiraling lines on a sphere',
  defaultCameraDistance: 18,
  generatorType: 'sphereSpirals_generator',
  outputMode: 'line',
  params: sphereSpiralsParams,
  inputs: [
    { name: 'spiralCount', type: 'number', default: 8 },
    { name: 'pointsPerSpiral', type: 'number', default: 500 },
    { name: 'radius', type: 'number', default: 5 },
    { name: 'turns', type: 'number', default: 5 },
    { name: 'rotationSpeed', type: 'number', default: 0.3 },
    { name: 'wobble', type: 'number', default: 0.5 },
    { name: 'wobbleSpeed', type: 'number', default: 0.5 },
    { name: 'colorMode', type: 'number', default: 0 },
    { name: 'noiseDistort', type: 'number', default: 0 },
    { name: 'noiseFreq', type: 'number', default: 2 },
    { name: 'pulseAmplitude', type: 'number', default: 0 },
    { name: 'pulseSpeed', type: 'number', default: 1 },
    { name: 'flatten', type: 'number', default: 0 },
  ],
  outputs: [
    { name: 'positions', type: 'positions' },
    { name: 'colors', type: 'colors' },
    { name: 'drawCount', type: 'number' },
  ],
  evaluateSource: sphereSpiralsEvaluateSource,
}

// ─── Space-Filling Curve ──────────────────────────────────────────────────

const spaceFillingCurveParams: ParamSchemaDef[] = [
  { name: 'curveType', type: 'enum', default: 'hilbert', description: 'Curve type', enumValues: ['hilbert', 'moore'] },
  { name: 'depth', type: 'int', min: 1, max: 7, default: 5, description: 'Recursion depth' },
  { name: 'scale', type: 'float', min: 1, max: 50, default: 15, description: 'Scale' },
  { name: 'drawSpeed', type: 'float', min: 0.1, max: 20, default: 5, description: 'Draw speed' },
  { name: 'animated', type: 'bool', default: true, description: 'Animated draw' },
  { name: 'colorProgression', type: 'enum', default: 'rainbow', description: 'Color mode', enumValues: ['rainbow', 'depth', 'direction'] },
  { name: 'waveAmplitude', type: 'float', min: 0, max: 5, default: 0, description: 'Wave amplitude' },
  { name: 'waveFrequency', type: 'float', min: 0.5, max: 10, default: 3, description: 'Wave frequency' },
  { name: 'waveSpeed', type: 'float', min: 0, max: 5, default: 1, description: 'Wave speed' },
  { name: 'spiralTwist', type: 'float', min: 0, max: 5, default: 0, description: 'Spiral twist' },
]

const spaceFillingCurveEvaluateSource = `
var typeIdx = Math.round(inputs.curveType || 0);
var curveTypes = ['hilbert','moore'];
var curveType = curveTypes[typeIdx] || 'hilbert';
var depth = Math.max(1, Math.min(7, Math.round(inputs.depth || 5)));
var scale = inputs.scale || 15;
var drawSpeed = inputs.drawSpeed || 5;
var animated = (inputs.animated || 0) > 0.5;
var colorIdx = Math.round(inputs.colorProgression || 0);
var colorModes = ['rainbow','depth','direction'];
var colorMode = colorModes[colorIdx] || 'rainbow';
var waveAmp = inputs.waveAmplitude || 0;
var waveFreq = inputs.waveFrequency || 3;
var waveSpd = inputs.waveSpeed || 1;
var spiralTwist = inputs.spiralTwist || 0;
var t = ctx.elapsed;

// Generate Hilbert curve points using d2xy algorithm
function d2xy(n, d) {
  var rx, ry, s;
  var x = 0, y = 0;
  var dd = d;
  for (s = 1; s < n; s *= 2) {
    rx = (dd & 2) > 0 ? 1 : 0;
    ry = ((dd & 1) === 0 ? 1 : 0) ^ rx ? 0 : 1;
    if (ry === 0) {
      if (rx === 1) { x = s - 1 - x; y = s - 1 - y; }
      var tmp = x; x = y; y = tmp;
    }
    x += s * rx;
    y += s * ry;
    dd = Math.floor(dd / 4);
  }
  return {x: x, y: y};
}
function hilbert(depth) {
  var n = 1 << depth;
  var total = n * n;
  var points = [];
  for (var i = 0; i < total; i++) {
    var p = d2xy(n, i);
    points.push({x: (p.x + 0.5) / n, y: (p.y + 0.5) / n});
  }
  return points;
}

var rawPoints;
if (curveType === 'moore' && depth >= 2) {
  // Moore curve: 4 rotated copies of depth-1 Hilbert curve
  var subPoints = hilbert(depth - 1);
  var n = subPoints.length;
  rawPoints = [];
  // BL: rotate 90 CW
  for (var i = 0; i < n; i++) rawPoints.push({x: subPoints[i].y * 0.5, y: (1 - subPoints[i].x) * 0.5});
  // TL: no rotation
  for (var i = 0; i < n; i++) rawPoints.push({x: subPoints[i].x * 0.5, y: 0.5 + subPoints[i].y * 0.5});
  // TR: no rotation
  for (var i = 0; i < n; i++) rawPoints.push({x: 0.5 + subPoints[i].x * 0.5, y: 0.5 + subPoints[i].y * 0.5});
  // BR: rotate 90 CCW
  for (var i = 0; i < n; i++) rawPoints.push({x: 0.5 + (1 - subPoints[i].y) * 0.5, y: subPoints[i].x * 0.5});
} else {
  rawPoints = hilbert(depth);
}

if (spiralTwist > 0) {
  for (var i = 0; i < rawPoints.length; i++) {
    var cx = rawPoints[i].x - 0.5, cy = rawPoints[i].y - 0.5;
    var r = Math.sqrt(cx*cx + cy*cy);
    var theta = Math.atan2(cy, cx) + r * spiralTwist * Math.PI * 2;
    rawPoints[i] = {x: 0.5 + r*Math.cos(theta), y: 0.5 + r*Math.sin(theta)};
  }
}

var totalPoints = rawPoints.length;
var positions = new Float32Array(totalPoints * 3);
var colors = new Float32Array(totalPoints * 3);

for (var i = 0; i < totalPoints; i++) {
  var x = (rawPoints[i].x - 0.5) * scale;
  var y = (rawPoints[i].y - 0.5) * scale;

  if (waveAmp > 0) {
    var wavePhase = (i/totalPoints)*waveFreq*Math.PI*2;
    var waveVal = Math.sin(wavePhase + t*waveSpd) * waveAmp;
    var nx=0, ny=1;
    if (i > 0 && i < totalPoints-1) {
      var dx2 = (rawPoints[i+1].x - rawPoints[i-1].x)*scale;
      var dy2 = (rawPoints[i+1].y - rawPoints[i-1].y)*scale;
      var len = Math.sqrt(dx2*dx2 + dy2*dy2);
      if (len > 0.001) { nx = -dy2/len; ny = dx2/len; }
    }
    x += nx * waveVal;
    y += ny * waveVal;
  }

  positions[i*3] = x; positions[i*3+1] = y; positions[i*3+2] = 0;

  var frac = i / totalPoints;
  var cr = 1, cg = 1, cb = 1;
  if (colorMode === 'rainbow') {
    var col = helpers.hsl(frac, 0.8, 0.6);
    cr = col[0]; cg = col[1]; cb = col[2];
  } else if (colorMode === 'depth') {
    var cx2 = rawPoints[i].x - 0.5, cy2 = rawPoints[i].y - 0.5;
    var dist = Math.sqrt(cx2*cx2 + cy2*cy2) * 2;
    var col = helpers.hsl(dist * 0.8, 0.8, 0.5);
    cr = col[0]; cg = col[1]; cb = col[2];
  } else if (colorMode === 'direction' && i > 0) {
    var dx = rawPoints[i].x - rawPoints[i-1].x;
    var dy = rawPoints[i].y - rawPoints[i-1].y;
    var angle = (Math.atan2(dy, dx) / (Math.PI*2) + 1) % 1;
    var col = helpers.hsl(angle, 0.9, 0.55);
    cr = col[0]; cg = col[1]; cb = col[2];
  }
  colors[i*3] = cr; colors[i*3+1] = cg; colors[i*3+2] = cb;
}

var drawCount = totalPoints;
if (animated) {
  drawCount = Math.floor((t * drawSpeed * 50) % totalPoints);
  drawCount = Math.max(2, drawCount);
}

return { positions: positions, colors: colors, drawCount: drawCount };
`

const spaceFillingCurveDef: CompoundGeneratorDef = {
  id: 'builtin_spaceFillingCurve',
  name: 'Space-Filling Curve',
  description: 'Animated space-filling curves (Hilbert, Moore, etc.)',
  defaultCameraDistance: 36,
  generatorType: 'spaceFillingCurve_generator',
  outputMode: 'line',
  params: spaceFillingCurveParams,
  inputs: [
    { name: 'curveType', type: 'number', default: 0 },
    { name: 'depth', type: 'number', default: 5 },
    { name: 'scale', type: 'number', default: 15 },
    { name: 'drawSpeed', type: 'number', default: 5 },
    { name: 'animated', type: 'number', default: 1 },
    { name: 'colorProgression', type: 'number', default: 0 },
    { name: 'waveAmplitude', type: 'number', default: 0 },
    { name: 'waveFrequency', type: 'number', default: 3 },
    { name: 'waveSpeed', type: 'number', default: 1 },
    { name: 'spiralTwist', type: 'number', default: 0 },
  ],
  outputs: [
    { name: 'positions', type: 'positions' },
    { name: 'colors', type: 'colors' },
    { name: 'drawCount', type: 'number' },
  ],
  evaluateSource: spaceFillingCurveEvaluateSource,
}

// ─── L-Systems ────────────────────────────────────────────────────────────

const lSystemsParams: ParamSchemaDef[] = [
  { name: 'preset', type: 'enum', default: 'tree', description: 'L-System preset', enumValues: ['tree', 'koch', 'sierpinski', 'dragon', 'fern', 'bush', 'fractalPlant'] },
  { name: 'iterations', type: 'int', min: 1, max: 8, default: 4, description: 'Iterations' },
  { name: 'angle', type: 'float', min: 1, max: 120, default: 52.17, description: 'Branch angle' },
  { name: 'scale', type: 'float', min: 0.5, max: 20, default: 0.7925, description: 'Scale' },
  { name: 'lengthFactor', type: 'float', min: 0.3, max: 1, default: 0.468, description: 'Length factor' },
  { name: 'colorMode', type: 'enum', default: 'rainbow', description: 'Color mode', enumValues: ['depth', 'rainbow', 'spring'] },
  { name: 'windStrength', type: 'float', min: 0, max: 3, default: 0.665, description: 'Wind strength' },
  { name: 'windSpeed', type: 'float', min: 0, max: 5, default: 3.125, description: 'Wind speed' },
  { name: 'animated', type: 'bool', default: true, description: 'Progressive draw' },
  { name: 'drawSpeed', type: 'float', min: 0.1, max: 10, default: 6.436, description: 'Draw speed' },
  { name: 'symmetry', type: 'int', min: 1, max: 8, default: 5, description: 'Symmetry folds' },
]

const lSystemsEvaluateSource = `
var PRESETS = {
  tree: {axiom:'F', rules:{F:'FF+[+F-F-F]-[-F+F+F]'}, defaultAngle:25},
  koch: {axiom:'F', rules:{F:'F+F-F-F+F'}, defaultAngle:90},
  sierpinski: {axiom:'F-G-G', rules:{F:'F-G+F+G-F',G:'GG'}, defaultAngle:120},
  dragon: {axiom:'FX', rules:{X:'X+YF+',Y:'-FX-Y'}, defaultAngle:90},
  fern: {axiom:'X', rules:{X:'F+[[X]-X]-F[-FX]+X',F:'FF'}, defaultAngle:25},
  bush: {axiom:'F', rules:{F:'FF+[+F-F-F]-[-F+F+F]'}, defaultAngle:22.5},
  fractalPlant: {axiom:'X', rules:{X:'F-[[X]+X]+F[+FX]-X',F:'FF'}, defaultAngle:25},
};

var presetIdx = Math.round(inputs.preset || 0);
var presetNames = ['tree','koch','sierpinski','dragon','fern','bush','fractalPlant'];
var presetName = presetNames[presetIdx] || 'tree';
var presetData = PRESETS[presetName] || PRESETS.tree;

var iterations = Math.max(1, Math.min(8, Math.round(inputs.iterations || 5)));
var userAngle = inputs.angle || 25;
var scale = inputs.scale || 5;
var lengthFactor = inputs.lengthFactor || 0.7;
var colorIdx = Math.round(inputs.colorMode || 0);
var colorModes = ['depth','rainbow','spring'];
var colorMode = colorModes[colorIdx] || 'depth';
var windStr = inputs.windStrength || 0.3;
var windSpd = inputs.windSpeed || 1;
var animated = (inputs.animated || 0) > 0.5;
var drawSpeed = inputs.drawSpeed || 3;
var symmetry = Math.max(1, Math.min(8, Math.round(inputs.symmetry || 1)));
var t = ctx.elapsed;

var effectiveAngle = userAngle > 0 ? userAngle : presetData.defaultAngle;

// Expand L-system
var current = presetData.axiom;
for (var iter = 0; iter < iterations; iter++) {
  var next = '';
  for (var ci = 0; ci < current.length; ci++) {
    var ch = current[ci];
    next += presetData.rules[ch] || ch;
  }
  current = next;
  if (current.length > 500000) break;
}

// Turtle interpretation
var angleRad = effectiveAngle * Math.PI / 180;
var stack = [];
var x = 0, y = 0, hx = 0, hy = 1, depth = 0;
var segments = [];
var length = 1;

for (var ci = 0; ci < current.length; ci++) {
  var ch = current[ci];
  if (ch === 'F' || ch === 'G') {
    var len = length * Math.pow(lengthFactor, depth);
    var nx = x + hx * len, ny = y + hy * len;
    segments.push({x1:x, y1:y, x2:nx, y2:ny, depth:depth});
    x = nx; y = ny;
  } else if (ch === '+') {
    var cosA = Math.cos(angleRad), sinA = Math.sin(angleRad);
    var nhx = hx*cosA - hy*sinA, nhy = hx*sinA + hy*cosA;
    hx = nhx; hy = nhy;
  } else if (ch === '-') {
    var cosA = Math.cos(-angleRad), sinA = Math.sin(-angleRad);
    var nhx = hx*cosA - hy*sinA, nhy = hx*sinA + hy*cosA;
    hx = nhx; hy = nhy;
  } else if (ch === '[') {
    stack.push({x:x, y:y, hx:hx, hy:hy, depth:depth});
    depth++;
  } else if (ch === ']') {
    if (stack.length > 0) {
      var s = stack.pop();
      x = s.x; y = s.y; hx = s.hx; hy = s.hy; depth = s.depth;
    }
  }
}

var maxD = 0;
for (var i = 0; i < segments.length; i++) {
  if (segments[i].depth > maxD) maxD = segments[i].depth;
}

var totalSegs = segments.length * symmetry;
var positions = new Float32Array(totalSegs * 6);
var colors = new Float32Array(totalSegs * 6);

for (var sym = 0; sym < symmetry; sym++) {
  var rotAngle = (sym / symmetry) * Math.PI * 2;
  var cosR = Math.cos(rotAngle), sinR = Math.sin(rotAngle);
  for (var i = 0; i < segments.length; i++) {
    var seg = segments[i];
    var idx = (sym * segments.length + i) * 6;

    var sx1 = seg.x1, sy1 = seg.y1, sx2 = seg.x2, sy2 = seg.y2;
    if (symmetry > 1) {
      var rx1 = sx1*cosR - sy1*sinR, ry1 = sx1*sinR + sy1*cosR;
      var rx2 = sx2*cosR - sy2*sinR, ry2 = sx2*sinR + sy2*cosR;
      sx1 = rx1; sy1 = ry1; sx2 = rx2; sy2 = ry2;
    }

    var windFactor = windStr * (seg.depth / (maxD || 1));
    var windOffset = Math.sin(t * windSpd * 2 + seg.y1 * 0.5) * windFactor * scale * 0.1;
    positions[idx] = sx1*scale + windOffset; positions[idx+1] = sy1*scale; positions[idx+2] = 0;
    positions[idx+3] = sx2*scale + windOffset; positions[idx+4] = sy2*scale; positions[idx+5] = 0;

    var td = maxD > 0 ? seg.depth / maxD : 0;
    var cr, cg, cb;
    if (colorMode === 'depth') {
      var col = helpers.hsl(0.08 + td * 0.25, 0.6, 0.35 + td * 0.2);
      cr = col[0]; cg = col[1]; cb = col[2];
    } else if (colorMode === 'rainbow') {
      var col = helpers.hsl((i / segments.length) % 1, 0.8, 0.5);
      cr = col[0]; cg = col[1]; cb = col[2];
    } else {
      var col = helpers.hsl(0.25 + td * 0.15, 0.7, 0.35 + td * 0.25);
      cr = col[0]; cg = col[1]; cb = col[2];
    }
    colors[idx]=cr; colors[idx+1]=cg; colors[idx+2]=cb;
    colors[idx+3]=cr; colors[idx+4]=cg; colors[idx+5]=cb;
  }
}

var stateKey = nodeId + '_lsys';
var state = ctx.frameState.get(stateKey);
if (!state) { state = {drawn: animated ? 0 : totalSegs*2}; ctx.frameState.set(stateKey, state); }
if (animated && state.drawn < totalSegs*2) {
  state.drawn = Math.min(state.drawn + Math.ceil(drawSpeed*10)*2, totalSegs*2);
}

return { positions: positions, colors: colors, drawCount: Math.min(state.drawn, totalSegs*2) };
`

const lSystemsDef: CompoundGeneratorDef = {
  id: 'builtin_lSystems',
  name: 'L-Systems',
  description: 'Fractal trees and branching structures',
  defaultCameraDistance: 25,
  generatorType: 'lSystems_generator',
  outputMode: 'line',
  params: lSystemsParams,
  inputs: [
    { name: 'preset', type: 'number', default: 0 },
    { name: 'iterations', type: 'number', default: 4 },
    { name: 'angle', type: 'number', default: 52.17 },
    { name: 'scale', type: 'number', default: 0.7925 },
    { name: 'lengthFactor', type: 'number', default: 0.468 },
    { name: 'colorMode', type: 'number', default: 1 },
    { name: 'windStrength', type: 'number', default: 0.665 },
    { name: 'windSpeed', type: 'number', default: 3.125 },
    { name: 'animated', type: 'number', default: 1 },
    { name: 'drawSpeed', type: 'number', default: 6.436 },
    { name: 'symmetry', type: 'number', default: 5 },
  ],
  outputs: [
    { name: 'positions', type: 'positions' },
    { name: 'colors', type: 'colors' },
    { name: 'drawCount', type: 'number' },
  ],
  evaluateSource: lSystemsEvaluateSource,
}

// ─── Flow Field ───────────────────────────────────────────────────────────

const flowFieldParams: ParamSchemaDef[] = [
  { name: 'particleCount', type: 'int', min: 100, max: 20000, default: 5000, description: 'Particle count' },
  { name: 'noiseScale', type: 'float', min: 0.001, max: 0.05, default: 0.005, description: 'Noise scale' },
  { name: 'noiseSpeed', type: 'float', min: 0, max: 2, default: 0.2, description: 'Noise speed' },
  { name: 'particleSpeed', type: 'float', min: 0.1, max: 10, default: 2, description: 'Particle speed' },
  { name: 'particleLife', type: 'float', min: 10, max: 500, default: 100, description: 'Particle life' },
  { name: 'fieldStrength', type: 'float', min: 0.1, max: 5, default: 1, description: 'Field strength' },
  { name: 'fadeRate', type: 'float', min: 0, max: 0.5, default: 0.05, description: 'Fade rate' },
]

const flowFieldEvaluateSource = `
var particleCount = Math.max(100, Math.min(20000, Math.round(inputs.particleCount || 5000)));
var noiseScale = inputs.noiseScale || 0.005;
var noiseSpeed = inputs.noiseSpeed || 0.2;
var particleSpeed = inputs.particleSpeed || 2;
var particleLife = inputs.particleLife || 100;
var fieldStrength = inputs.fieldStrength || 1;
var fadeRate = inputs.fadeRate || 0.05;
var t = ctx.elapsed;
var SPREAD = 400;

// Simple noise function (value noise with smooth interpolation)
function hash(x, y) {
  var n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}
function smoothNoise(x, y) {
  var ix = Math.floor(x), iy = Math.floor(y);
  var fx = x - ix, fy = y - iy;
  fx = fx*fx*(3-2*fx); fy = fy*fy*(3-2*fy);
  var a = hash(ix, iy), b = hash(ix+1, iy);
  var c = hash(ix, iy+1), d = hash(ix+1, iy+1);
  return a*(1-fx)*(1-fy) + b*fx*(1-fy) + c*(1-fx)*fy + d*fx*fy;
}
function fbm(x, y, octaves) {
  var val = 0, amp = 0.5, freq = 1;
  for (var i = 0; i < octaves; i++) {
    val += amp * smoothNoise(x*freq, y*freq);
    amp *= 0.5; freq *= 2;
  }
  return val;
}

var stateKey = nodeId + '_flowfield';
var state = ctx.frameState.get(stateKey);
if (!state || state.count !== particleCount) {
  var pos = new Float32Array(particleCount * 3);
  var cols = new Float32Array(particleCount * 3);
  var ages = new Float32Array(particleCount);
  var maxAges = new Float32Array(particleCount);
  var palette = [[0.13,0.83,0.93],[0.85,0.27,0.94],[0.98,0.75,0.15],[0.13,0.93,0.53]];
  for (var i = 0; i < particleCount; i++) {
    pos[i*3] = (Math.random()-0.5)*SPREAD;
    pos[i*3+1] = (Math.random()-0.5)*SPREAD;
    pos[i*3+2] = 0;
    ages[i] = Math.random()*particleLife;
    maxAges[i] = particleLife*(0.5+Math.random()*0.5);
    var ci = Math.floor(Math.random()*(palette.length-1));
    var f = Math.random();
    var c0 = palette[ci], c1 = palette[Math.min(ci+1,palette.length-1)];
    cols[i*3]=c0[0]*(1-f)+c1[0]*f;
    cols[i*3+1]=c0[1]*(1-f)+c1[1]*f;
    cols[i*3+2]=c0[2]*(1-f)+c1[2]*f;
  }
  var trailPos = new Float32Array(particleCount * 6);
  var trailCols = new Float32Array(particleCount * 6);
  state = {pos:pos, cols:cols, ages:ages, maxAges:maxAges, trailPos:trailPos, trailCols:trailCols, count:particleCount, SPREAD:SPREAD};
  ctx.frameState.set(stateKey, state);
}

for (var i = 0; i < particleCount; i++) {
  var prevX = state.pos[i*3], prevY = state.pos[i*3+1];
  var x = prevX, y = prevY;

  // Curl noise approximation via FBM gradient
  var eps = 1;
  var n0 = fbm(x*noiseScale, y*noiseScale + t*noiseSpeed, 4);
  var nx = fbm((x+eps)*noiseScale, y*noiseScale + t*noiseSpeed, 4);
  var ny = fbm(x*noiseScale, (y+eps)*noiseScale + t*noiseSpeed, 4);
  var vx = -(ny - n0) * fieldStrength * 100;
  var vy = (nx - n0) * fieldStrength * 100;

  state.pos[i*3] += vx * particleSpeed * 0.016;
  state.pos[i*3+1] += vy * particleSpeed * 0.016;
  state.ages[i] += 1;

  if (state.ages[i] > state.maxAges[i] ||
      Math.abs(state.pos[i*3]) > SPREAD*0.5 ||
      Math.abs(state.pos[i*3+1]) > SPREAD*0.5) {
    state.pos[i*3] = (Math.random()-0.5)*SPREAD;
    state.pos[i*3+1] = (Math.random()-0.5)*SPREAD;
    prevX = state.pos[i*3]; prevY = state.pos[i*3+1];
    state.ages[i] = 0;
    state.maxAges[i] = particleLife*(0.5+Math.random()*0.5);
  }

  var lifeFrac = 1 - state.ages[i]/state.maxAges[i];
  var alpha = lifeFrac * (1 - fadeRate);

  state.trailPos[i*6] = prevX; state.trailPos[i*6+1] = prevY; state.trailPos[i*6+2] = 0;
  state.trailPos[i*6+3] = state.pos[i*3]; state.trailPos[i*6+4] = state.pos[i*3+1]; state.trailPos[i*6+5] = 0;
  state.trailCols[i*6] = state.cols[i*3]*alpha; state.trailCols[i*6+1] = state.cols[i*3+1]*alpha; state.trailCols[i*6+2] = state.cols[i*3+2]*alpha;
  state.trailCols[i*6+3] = state.cols[i*3]*alpha; state.trailCols[i*6+4] = state.cols[i*3+1]*alpha; state.trailCols[i*6+5] = state.cols[i*3+2]*alpha;
}

return {
  positions: state.trailPos, colors: state.trailCols, drawCount: particleCount * 2,
  pointPositions: state.pos, pointColors: state.cols, pointDrawCount: particleCount, pointSize: 2
};
`

const flowFieldDef: CompoundGeneratorDef = {
  id: 'builtin_flowField',
  name: 'Flow Field',
  description: 'Particles following a vector field derived from noise',
  defaultCameraDistance: 350,
  generatorType: 'flowField_generator',
  outputMode: 'lineSegments_and_points',
  params: flowFieldParams,
  inputs: [
    { name: 'particleCount', type: 'number', default: 5000 },
    { name: 'noiseScale', type: 'number', default: 0.005 },
    { name: 'noiseSpeed', type: 'number', default: 0.2 },
    { name: 'particleSpeed', type: 'number', default: 2 },
    { name: 'particleLife', type: 'number', default: 100 },
    { name: 'fieldStrength', type: 'number', default: 1 },
    { name: 'fadeRate', type: 'number', default: 0.05 },
  ],
  outputs: [
    { name: 'positions', type: 'positions' },
    { name: 'colors', type: 'colors' },
    { name: 'drawCount', type: 'number' },
    { name: 'pointPositions', type: 'positions' },
    { name: 'pointColors', type: 'colors' },
    { name: 'pointDrawCount', type: 'number' },
    { name: 'pointSize', type: 'number' },
  ],
  evaluateSource: flowFieldEvaluateSource,
}

// ─── Export all definitions ───────────────────────────────────────────────

export const BUILTIN_GENERATORS: CompoundGeneratorDef[] = [
  lissajousDef,
  attractorDef,
  spirographDef,
  sphereSpiralsDef,
  spaceFillingCurveDef,
  lSystemsDef,
  flowFieldDef,
  ...SHADER_GENERATORS,
  ...REMAINING_GENERATORS,
  ...NEW_SHADER_PATTERNS,
  ...FABLE_PHYSARUM_GENERATORS,
  ...FABLE_PETRI_GENERATORS,
  ...FABLE_CONTINUUM_GENERATORS,
  ...FABLE_INK_GENERATORS,
  ...FABLE_DREAMSCAPE_GENERATORS,
  ...FABLE_PHYSARUM_XL_GENERATORS,
  ...FABLE_FIREWORKS_GENERATORS,
]
