import type { CompoundGeneratorDef } from './generatorGraphFactory'
import type { ParamSchemaDef } from './storage'

// ═══════════════════════════════════════════════════════════════════════════
// CLOTH SIMULATION
// ═══════════════════════════════════════════════════════════════════════════

const clothParams: ParamSchemaDef[] = [
  { name: 'gridWidth', type: 'int', min: 4, max: 80, default: 40, description: 'Grid columns' },
  { name: 'gridHeight', type: 'int', min: 4, max: 80, default: 40, description: 'Grid rows' },
  { name: 'spacing', type: 'float', min: 0.05, max: 1, default: 0.3, description: 'Particle spacing' },
  { name: 'gravity', type: 'float', min: 0, max: 2, default: 0.5, description: 'Gravity strength' },
  { name: 'windStrength', type: 'float', min: 0, max: 5, default: 1, description: 'Wind strength' },
  { name: 'windDirection', type: 'float', min: 0, max: 360, default: 0, description: 'Wind direction (degrees)' },
  { name: 'windTurbulence', type: 'float', min: 0, max: 3, default: 0.5, description: 'Wind turbulence' },
  { name: 'damping', type: 'float', min: 0.8, max: 1, default: 0.97, description: 'Velocity damping' },
  { name: 'stiffness', type: 'float', min: 0.1, max: 2, default: 1, description: 'Constraint stiffness' },
  { name: 'constraintIterations', type: 'int', min: 1, max: 10, default: 3, description: 'Solver iterations' },
  { name: 'pinMode', type: 'enum', default: 'topEdge', enumValues: ['topEdge', 'corners', 'topCorners', 'none'], description: 'Pin mode' },
  { name: 'colorMode', type: 'enum', default: 'stress', enumValues: ['stress', 'height', 'uv', 'palette'], description: 'Color mode' },
  { name: 'wireframe', type: 'bool', default: false, description: 'Wireframe rendering' },
  { name: 'meshOpacity', type: 'float', min: 0, max: 1, default: 0.9, description: 'Mesh opacity' },
]

const clothEvaluateSource = `
var gw = Math.round(inputs.gridWidth);
var gh = Math.round(inputs.gridHeight);
var sp = inputs.spacing;
var gravity = inputs.gravity;
var windStr = inputs.windStrength;
var windDir = inputs.windDirection;
var windTurb = inputs.windTurbulence;
var damp = inputs.damping;
var stiff = inputs.stiffness;
var iters = Math.round(inputs.constraintIterations);
var pinM = Math.round(inputs.pinMode);
var colM = Math.round(inputs.colorMode);
var wf = inputs.wireframe;
var opacity = inputs.meshOpacity;
var vertCount = gw * gh;
var stateKey = nodeId + '_cloth';
var state = ctx.frameState.get(stateKey);

if (!state || state.gw !== gw || state.gh !== gh || state.sp !== sp || state.pinM !== pinM) {
  var pos = new Float32Array(vertCount * 3);
  var prev = new Float32Array(vertCount * 3);
  var pinned = new Uint8Array(vertCount);
  for (var j = 0; j < gh; j++) {
    for (var i = 0; i < gw; i++) {
      var idx = j * gw + i;
      var x = (i - (gw - 1) / 2) * sp;
      var y = ((gh - 1) / 2 - j) * sp;
      pos[idx * 3] = x; pos[idx * 3 + 1] = y; pos[idx * 3 + 2] = 0;
      prev[idx * 3] = x; prev[idx * 3 + 1] = y; prev[idx * 3 + 2] = 0;
      var pin = false;
      if (pinM === 0) pin = j === 0;
      else if (pinM === 1) pin = (j === 0 && i === 0) || (j === 0 && i === gw - 1) || (j === gh - 1 && i === 0) || (j === gh - 1 && i === gw - 1);
      else if (pinM === 2) pin = (j === 0 && i === 0) || (j === 0 && i === gw - 1);
      pinned[idx] = pin ? 1 : 0;
    }
  }
  var constraints = [];
  for (var j = 0; j < gh; j++) {
    for (var i = 0; i < gw; i++) {
      var idx = j * gw + i;
      if (i < gw - 1) constraints.push(idx, idx + 1, sp);
      if (j < gh - 1) constraints.push(idx, idx + gw, sp);
      if (i < gw - 1 && j < gh - 1) {
        var dl = sp * Math.SQRT2;
        constraints.push(idx, idx + gw + 1, dl);
        constraints.push(idx + 1, idx + gw, dl);
      }
    }
  }
  var segW = gw - 1, segH = gh - 1;
  var indices = new Uint32Array(segW * segH * 6);
  var ti = 0;
  for (var j = 0; j < segH; j++) {
    for (var i = 0; i < segW; i++) {
      var a = j * gw + i;
      indices[ti++] = a; indices[ti++] = a + gw; indices[ti++] = a + 1;
      indices[ti++] = a + 1; indices[ti++] = a + gw; indices[ti++] = a + gw + 1;
    }
  }
  state = { gw: gw, gh: gh, sp: sp, pinM: pinM, pos: pos, prev: prev, pinned: pinned, constraints: constraints, indices: indices };
  ctx.frameState.set(stateKey, state);
}

var p = state.pos;
var pv = state.prev;
var pn = state.pinned;
var cons = state.constraints;
var t = ctx.elapsed;
var windRad = windDir * Math.PI / 180;
var windX = Math.cos(windRad) * windStr;
var windZ = Math.sin(windRad) * windStr;

for (var i = 0; i < vertCount; i++) {
  if (pn[i]) continue;
  var i3 = i * 3;
  var vx = (p[i3] - pv[i3]) * damp;
  var vy = (p[i3 + 1] - pv[i3 + 1]) * damp;
  var vz = (p[i3 + 2] - pv[i3 + 2]) * damp;
  pv[i3] = p[i3]; pv[i3 + 1] = p[i3 + 1]; pv[i3 + 2] = p[i3 + 2];
  var dt2 = 1.0 / 60;
  p[i3 + 1] += vy - gravity * dt2 * dt2 * 60;
  var turbX = Math.sin(t * 2.3 + p[i3] * 0.1 + p[i3 + 1] * 0.07) * windTurb;
  var turbZ = Math.cos(t * 1.7 + p[i3 + 1] * 0.1 + p[i3] * 0.05) * windTurb;
  p[i3] += vx + (windX + turbX) * dt2 * dt2 * 60;
  p[i3 + 2] += vz + (windZ + turbZ) * dt2 * dt2 * 60;
}

for (var iter = 0; iter < iters; iter++) {
  for (var c = 0; c < cons.length; c += 3) {
    var ia = cons[c], ib = cons[c + 1], rl = cons[c + 2];
    var ia3 = ia * 3, ib3 = ib * 3;
    var dx = p[ib3] - p[ia3], dy = p[ib3 + 1] - p[ia3 + 1], dz = p[ib3 + 2] - p[ia3 + 2];
    var dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < 0.0001) continue;
    var diff = (rl - dist) / dist * stiff * 0.5;
    var ox = dx * diff, oy = dy * diff, oz = dz * diff;
    if (!pn[ia]) { p[ia3] -= ox; p[ia3 + 1] -= oy; p[ia3 + 2] -= oz; }
    if (!pn[ib]) { p[ib3] += ox; p[ib3 + 1] += oy; p[ib3 + 2] += oz; }
  }
}

var normals = new Float32Array(vertCount * 3);
var inds = state.indices;
for (var f = 0; f < inds.length; f += 3) {
  var i0 = inds[f], i1 = inds[f + 1], i2 = inds[f + 2];
  var i03 = i0 * 3, i13 = i1 * 3, i23 = i2 * 3;
  var ax = p[i13] - p[i03], ay = p[i13 + 1] - p[i03 + 1], az = p[i13 + 2] - p[i03 + 2];
  var bx = p[i23] - p[i03], by = p[i23 + 1] - p[i03 + 1], bz = p[i23 + 2] - p[i03 + 2];
  var nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
  normals[i03] += nx; normals[i03 + 1] += ny; normals[i03 + 2] += nz;
  normals[i13] += nx; normals[i13 + 1] += ny; normals[i13 + 2] += nz;
  normals[i23] += nx; normals[i23 + 1] += ny; normals[i23 + 2] += nz;
}
for (var i = 0; i < vertCount; i++) {
  var i3 = i * 3;
  var len = Math.sqrt(normals[i3] * normals[i3] + normals[i3 + 1] * normals[i3 + 1] + normals[i3 + 2] * normals[i3 + 2]);
  if (len > 0.0001) { normals[i3] /= len; normals[i3 + 1] /= len; normals[i3 + 2] /= len; }
}

var colors = new Float32Array(vertCount * 3);
var maxStress = 0.001;
if (colM === 0) {
  for (var i = 0; i < vertCount; i++) {
    var i3 = i * 3;
    var svx = p[i3] - pv[i3], svy = p[i3 + 1] - pv[i3 + 1], svz = p[i3 + 2] - pv[i3 + 2];
    var s = Math.sqrt(svx * svx + svy * svy + svz * svz);
    if (s > maxStress) maxStress = s;
  }
}
for (var i = 0; i < vertCount; i++) {
  var i3 = i * 3;
  var row = Math.floor(i / gw), col = i % gw;
  var r = 0.5, g = 0.5, b = 0.5;
  if (colM === 0) {
    var svx = p[i3] - pv[i3], svy = p[i3 + 1] - pv[i3 + 1], svz = p[i3 + 2] - pv[i3 + 2];
    var stress = Math.min(Math.sqrt(svx * svx + svy * svy + svz * svz) / maxStress * 3, 1);
    var c1 = helpers.hsl(0.52, 0.85, 0.55); var c2 = helpers.hsl(0.83, 0.75, 0.55);
    r = c1[0] * (1 - stress) + c2[0] * stress; g = c1[1] * (1 - stress) + c2[1] * stress; b = c1[2] * (1 - stress) + c2[2] * stress;
  } else if (colM === 1) {
    var normY = (p[i3 + 1] + gh * sp / 2) / (gh * sp);
    var cl = Math.max(0, Math.min(1, normY));
    var c1 = helpers.hsl(0.83, 0.75, 0.55); var c2 = helpers.hsl(0.52, 0.85, 0.55);
    r = c1[0] * cl + c2[0] * (1 - cl); g = c1[1] * cl + c2[1] * (1 - cl); b = c1[2] * cl + c2[2] * (1 - cl);
  } else if (colM === 2) {
    var hc = helpers.hsl(col / (gw - 1) * 0.8, 0.7, 0.5 + row / (gh - 1) * 0.2);
    r = hc[0]; g = hc[1]; b = hc[2];
  } else {
    var phase = (Math.sin(t * 0.5 + col * 0.1 + row * 0.1) + 1) * 0.5;
    var c1 = helpers.hsl(0.52, 0.85, 0.55); var c2 = helpers.hsl(0.83, 0.75, 0.55);
    r = c1[0] * (1 - phase) + c2[0] * phase; g = c1[1] * (1 - phase) + c2[1] * phase; b = c1[2] * (1 - phase) + c2[2] * phase;
  }
  colors[i3] = r; colors[i3 + 1] = g; colors[i3 + 2] = b;
}

return { positions: p, indices: state.indices, normals: normals, colors: colors, drawCount: state.indices.length, opacity: opacity, wireframe: wf > 0.5 ? 1 : 0 };
`

const clothDef: CompoundGeneratorDef = {
  id: 'builtin_cloth',
  name: 'Cloth',
  description: 'Verlet-integrated cloth simulation with wind, gravity, and constraint solving',
  defaultCameraDistance: 15,
  generatorType: 'cloth_generator',
  outputMode: 'mesh',
  params: clothParams,
  inputs: clothParams.map(p => ({
    name: p.name,
    type: 'number' as const,
    default: p.type === 'bool' ? (p.default ? 1 : 0) : (p.type === 'enum' ? 0 : (p.default as number)),
  })),
  outputs: [
    { name: 'positions', type: 'positions' as const },
    { name: 'indices', type: 'array' as const },
    { name: 'normals', type: 'positions' as const },
    { name: 'colors', type: 'colors' as const },
    { name: 'drawCount', type: 'number' as const },
    { name: 'opacity', type: 'number' as const },
    { name: 'wireframe', type: 'number' as const },
  ],
  evaluateSource: clothEvaluateSource,
}

// ═══════════════════════════════════════════════════════════════════════════
// NETWORK GRAPH
// ═══════════════════════════════════════════════════════════════════════════

const networkGraphParams: ParamSchemaDef[] = [
  { name: 'nodeCount', type: 'int', min: 10, max: 300, default: 80, description: 'Number of nodes' },
  { name: 'edgeDistance', type: 'float', min: 20, max: 400, default: 120, description: 'Edge distance threshold' },
  { name: 'nodeSize', type: 'float', min: 0.5, max: 10, default: 2, description: 'Node size' },
  { name: 'edgeOpacity', type: 'float', min: 0, max: 1, default: 0.3, description: 'Edge opacity' },
  { name: 'pulseSpeed', type: 'float', min: 0, max: 5, default: 1, description: 'Pulse speed' },
  { name: 'clusterCount', type: 'int', min: 1, max: 10, default: 3, description: 'Number of clusters' },
  { name: 'connectionDensity', type: 'float', min: 0, max: 1, default: 0.3, description: 'Connection density' },
  { name: 'maxConnections', type: 'int', min: 1, max: 20, default: 5, description: 'Max connections per node' },
  { name: 'distanceBias', type: 'float', min: 0.5, max: 4, default: 1.5, description: 'Distance falloff bias' },
  { name: 'longRangeChance', type: 'float', min: 0, max: 0.3, default: 0.05, description: 'Long-range edge chance' },
  { name: 'travelerCount', type: 'int', min: 0, max: 100, default: 30, description: 'Traveling particles' },
  { name: 'travelerSpeed', type: 'float', min: 0, max: 5, default: 1, description: 'Traveler speed' },
  { name: 'repulsionForce', type: 'float', min: 0, max: 100, default: 30, description: 'Node repulsion' },
  { name: 'damping', type: 'float', min: 0.8, max: 1, default: 0.9, description: 'Velocity damping' },
  { name: 'mouseForce', type: 'float', min: 0, max: 5, default: 1.5, description: 'Mouse interaction force' },
]

const networkGraphEvaluateSource = `
var nc = Math.round(inputs.nodeCount);
var edgeDist = inputs.edgeDistance;
var nodeSize = inputs.nodeSize;
var edgeOpac = inputs.edgeOpacity;
var pulseSpd = inputs.pulseSpeed;
var clusters = Math.round(inputs.clusterCount);
var connDens = inputs.connectionDensity;
var maxConn = Math.round(inputs.maxConnections);
var distBias = inputs.distanceBias;
var lrc = inputs.longRangeChance;
var travCount = Math.round(inputs.travelerCount);
var travSpd = inputs.travelerSpeed;
var repForce = inputs.repulsionForce;
var damp = inputs.damping;
var mouseF = inputs.mouseForce;
var t = ctx.elapsed;
var stateKey = nodeId + '_netgraph';
var state = ctx.frameState.get(stateKey);

if (!state || state.nc !== nc || state.clusters !== clusters || state.edgeDist !== edgeDist) {
  var seed = 42;
  var rng = function() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  var palette = [[0.13,0.83,0.93],[0.85,0.27,0.94],[0.98,0.75,0.15],[0.13,0.93,0.53],[0.93,0.35,0.35],[0.35,0.55,0.93],[0.93,0.53,0.13],[0.53,0.93,0.13],[0.93,0.13,0.73],[0.13,0.53,0.93]];
  var scale = edgeDist * 2;
  var centers = [];
  for (var c = 0; c < clusters; c++) centers.push([(rng() - 0.5) * scale, (rng() - 0.5) * scale]);
  var nodePos = new Float32Array(nc * 3);
  var nodeCol = new Float32Array(nc * 3);
  var nodeVel = new Float32Array(nc * 3);
  for (var i = 0; i < nc; i++) {
    var ci = Math.floor(rng() * clusters);
    var cen = centers[ci];
    var spread = edgeDist * 0.6;
    nodePos[i * 3] = cen[0] + (rng() - 0.5) * spread;
    nodePos[i * 3 + 1] = cen[1] + (rng() - 0.5) * spread;
    nodePos[i * 3 + 2] = 0;
    var col = palette[ci % palette.length];
    nodeCol[i * 3] = col[0]; nodeCol[i * 3 + 1] = col[1]; nodeCol[i * 3 + 2] = col[2];
  }
  var connCounts = new Int32Array(nc);
  var edgeSet = {};
  var edgeList = [];
  for (var i = 0; i < nc; i++) {
    var cands = [];
    for (var j = 0; j < nc; j++) {
      if (j === i) continue;
      var dx = nodePos[i * 3] - nodePos[j * 3], dy = nodePos[i * 3 + 1] - nodePos[j * 3 + 1];
      cands.push([j, Math.sqrt(dx * dx + dy * dy)]);
    }
    cands.sort(function(a, b) { return a[1] - b[1]; });
    for (var k = 0; k < cands.length; k++) {
      if (connCounts[i] >= maxConn) break;
      var cj = cands[k][0], cd = cands[k][1];
      if (connCounts[cj] >= maxConn) continue;
      var key = Math.min(i, cj) + ':' + Math.max(i, cj);
      if (edgeSet[key]) continue;
      var prob = cd <= edgeDist ? connDens * Math.pow(1 - cd / edgeDist, distBias) : lrc * Math.exp(-cd / (edgeDist * 3));
      if (rng() < prob) { edgeList.push([i, cj]); edgeSet[key] = 1; connCounts[i]++; connCounts[cj]++; }
    }
  }
  var travEdges = new Int32Array(travCount);
  var travProg = new Float32Array(travCount);
  for (var i = 0; i < travCount; i++) {
    travEdges[i] = Math.floor(rng() * Math.max(1, edgeList.length));
    travProg[i] = rng();
  }
  state = { nc: nc, clusters: clusters, edgeDist: edgeDist, nodePos: nodePos, nodeCol: nodeCol, nodeVel: nodeVel, edgeList: edgeList, travEdges: travEdges, travProg: travProg };
  ctx.frameState.set(stateKey, state);
}

var np = state.nodePos;
var nv = state.nodeVel;
var el = state.edgeList;
var edgeCount = el.length;

// Force-directed physics
for (var i = 0; i < nc; i++) {
  // Repulsion between nodes
  for (var j = i + 1; j < nc; j++) {
    var dx = np[i * 3] - np[j * 3], dy = np[i * 3 + 1] - np[j * 3 + 1];
    var d2 = dx * dx + dy * dy;
    if (d2 < 1) d2 = 1;
    var d = Math.sqrt(d2);
    var f = repForce / d2;
    var fx = (dx / d) * f, fy = (dy / d) * f;
    nv[i * 3] += fx; nv[i * 3 + 1] += fy;
    nv[j * 3] -= fx; nv[j * 3 + 1] -= fy;
  }
}
// Spring forces along edges
for (var e = 0; e < edgeCount; e++) {
  var ei = el[e][0], ej = el[e][1];
  var dx = np[ej * 3] - np[ei * 3], dy = np[ej * 3 + 1] - np[ei * 3 + 1];
  var d = Math.sqrt(dx * dx + dy * dy);
  if (d > 0.1) {
    var f = (d - edgeDist * 0.3) * 0.005;
    var fx = (dx / d) * f, fy = (dy / d) * f;
    nv[ei * 3] += fx; nv[ei * 3 + 1] += fy;
    nv[ej * 3] -= fx; nv[ej * 3 + 1] -= fy;
  }
}
// Mouse repulsion
if (mouseF > 0 && ctx.mouse) {
  var scale2 = edgeDist * 2;
  var mx = ctx.mouse.x * scale2 * 0.65;
  var my = ctx.mouse.y * scale2 * 0.65;
  var mouseRadius = 80;
  for (var i = 0; i < nc; i++) {
    var dx = np[i * 3] - mx, dy = np[i * 3 + 1] - my;
    var md = Math.sqrt(dx * dx + dy * dy);
    if (md < mouseRadius && md > 0.1) {
      var f = mouseF * 0.5 / md;
      nv[i * 3] += dx * f; nv[i * 3 + 1] += dy * f;
    }
  }
}
// Apply velocities
for (var i = 0; i < nc; i++) {
  nv[i * 3] *= damp; nv[i * 3 + 1] *= damp;
  np[i * 3] += nv[i * 3]; np[i * 3 + 1] += nv[i * 3 + 1];
}

// Update travelers
var tp = state.travProg;
var te = state.travEdges;
for (var i = 0; i < travCount; i++) {
  tp[i] += travSpd * 0.01;
  if (tp[i] > 1) { tp[i] = 0; te[i] = Math.floor(Math.random() * Math.max(1, edgeCount)); }
}

// Build edge line positions
var edgeVerts = edgeCount * 2;
var positions = new Float32Array(edgeVerts * 3);
var colors = new Float32Array(edgeVerts * 3);

for (var e = 0; e < edgeCount; e++) {
  var ei = el[e][0], ej = el[e][1];
  var off = e * 6;
  positions[off] = np[ei * 3]; positions[off + 1] = np[ei * 3 + 1]; positions[off + 2] = 0;
  positions[off + 3] = np[ej * 3]; positions[off + 4] = np[ej * 3 + 1]; positions[off + 5] = 0;
  var pulse = (Math.sin(t * pulseSpd + e * 0.5) + 1) * 0.5;
  var alpha = edgeOpac * (0.3 + pulse * 0.7);
  var ci2 = el[e][0], cj2 = el[e][1];
  colors[off] = state.nodeCol[ci2 * 3] * alpha; colors[off + 1] = state.nodeCol[ci2 * 3 + 1] * alpha; colors[off + 2] = state.nodeCol[ci2 * 3 + 2] * alpha;
  colors[off + 3] = state.nodeCol[cj2 * 3] * alpha; colors[off + 4] = state.nodeCol[cj2 * 3 + 1] * alpha; colors[off + 5] = state.nodeCol[cj2 * 3 + 2] * alpha;
}

// Build point positions: nodes + travelers
var ptCount = nc + travCount;
var ptPos = new Float32Array(ptCount * 3);
var ptCol = new Float32Array(ptCount * 3);

// Nodes
for (var i = 0; i < nc; i++) {
  ptPos[i * 3] = np[i * 3]; ptPos[i * 3 + 1] = np[i * 3 + 1]; ptPos[i * 3 + 2] = 0;
  ptCol[i * 3] = state.nodeCol[i * 3]; ptCol[i * 3 + 1] = state.nodeCol[i * 3 + 1]; ptCol[i * 3 + 2] = state.nodeCol[i * 3 + 2];
}

// Travelers: interpolate along their edge
for (var i = 0; i < travCount; i++) {
  var idx = nc + i;
  var eIdx = te[i];
  if (eIdx >= 0 && eIdx < edgeCount) {
    var ea = el[eIdx][0], eb = el[eIdx][1];
    var prog = tp[i];
    ptPos[idx * 3] = np[ea * 3] * (1 - prog) + np[eb * 3] * prog;
    ptPos[idx * 3 + 1] = np[ea * 3 + 1] * (1 - prog) + np[eb * 3 + 1] * prog;
    ptPos[idx * 3 + 2] = 0.1;
    // White-ish bright color for travelers
    ptCol[idx * 3] = 1; ptCol[idx * 3 + 1] = 1; ptCol[idx * 3 + 2] = 1;
  }
}

return { positions: positions, colors: colors, drawCount: edgeVerts, opacity: 0.85, thickness: 1, pointPositions: ptPos, pointColors: ptCol, pointDrawCount: ptCount, pointSize: nodeSize * 3, pointOpacity: 0.9 };
`

const networkGraphDef: CompoundGeneratorDef = {
  id: 'builtin_networkGraph',
  name: 'Network Graph',
  description: 'Force-directed network with clustered nodes and pulsing edges',
  defaultCameraDistance: 300,
  generatorType: 'network_graph_generator',
  outputMode: 'line_and_points',
  params: networkGraphParams,
  inputs: networkGraphParams.map(p => ({
    name: p.name,
    type: 'number' as const,
    default: p.type === 'bool' ? (p.default ? 1 : 0) : (p.type === 'enum' ? 0 : (p.default as number)),
  })),
  outputs: [
    { name: 'positions', type: 'positions' as const },
    { name: 'colors', type: 'colors' as const },
    { name: 'drawCount', type: 'number' as const },
    { name: 'opacity', type: 'number' as const },
    { name: 'thickness', type: 'number' as const },
    { name: 'pointPositions', type: 'positions' as const },
    { name: 'pointColors', type: 'colors' as const },
    { name: 'pointDrawCount', type: 'number' as const },
    { name: 'pointSize', type: 'number' as const },
    { name: 'pointOpacity', type: 'number' as const },
  ],
  evaluateSource: networkGraphEvaluateSource,
}

// ═══════════════════════════════════════════════════════════════════════════
// CIRCLE PACKING
// ═══════════════════════════════════════════════════════════════════════════

const circlePackingParams: ParamSchemaDef[] = [
  { name: 'maxCircles', type: 'int', min: 50, max: 1000, default: 500, description: 'Maximum circles' },
  { name: 'minRadius', type: 'float', min: 0.05, max: 0.5, default: 0.1, description: 'Minimum radius' },
  { name: 'maxRadius', type: 'float', min: 1, max: 10, default: 3, description: 'Maximum radius' },
  { name: 'growSpeed', type: 'float', min: 0.1, max: 10, default: 2, description: 'Growth speed' },
  { name: 'packingMode', type: 'enum', default: 'random', enumValues: ['random', 'spiral', 'grid', 'concentric'], description: 'Packing strategy' },
  { name: 'colorMode', type: 'enum', default: 'size', enumValues: ['size', 'position', 'order', 'rainbow', 'random'], description: 'Color mode' },
  { name: 'fillOpacity', type: 'float', min: 0.2, max: 1, default: 0.8, description: 'Fill opacity' },
  { name: 'borderWidth', type: 'float', min: 0, max: 0.5, default: 0.08, description: 'Border width' },
  { name: 'spacing', type: 'float', min: 0, max: 0.8, default: 0.5, description: 'Circle spacing' },
  { name: 'scale', type: 'float', min: 8, max: 40, default: 15, description: 'World scale' },
  { name: 'bobAmount', type: 'float', min: 0, max: 2, default: 0, description: 'Bob amount' },
  { name: 'bobSpeed', type: 'float', min: 0, max: 3, default: 0.5, description: 'Bob speed' },
  { name: 'pulseAmount', type: 'float', min: 0, max: 1, default: 0, description: 'Pulse amount' },
  { name: 'mouseRepel', type: 'float', min: 0, max: 5, default: 1.5, description: 'Mouse repel strength' },
]

const circlePackingEvaluateSource = `
var maxCirc = Math.round(inputs.maxCircles);
var minR = inputs.minRadius;
var maxR = Math.max(inputs.maxRadius, minR + 0.1);
var growSpd = inputs.growSpeed;
var packM = Math.round(inputs.packingMode);
var colM = Math.round(inputs.colorMode);
var fillOp = inputs.fillOpacity;
var borderW = inputs.borderWidth;
var spacing = inputs.spacing;
var scale = inputs.scale;
var bobAmt = inputs.bobAmount;
var bobSpd = inputs.bobSpeed;
var pulseAmt = inputs.pulseAmount;
var mouseRepel = inputs.mouseRepel;
var t = ctx.elapsed;

var stateKey = nodeId + '_circpack';
var state = ctx.frameState.get(stateKey);

if (!state || state.maxCirc !== maxCirc || state.scale !== scale || state.packM !== packM || state.minR !== minR || state.maxR !== maxR) {
  var seed = 42;
  var rng = function() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  var circles = [];
  for (var i = 0; i < maxCirc; i++) {
    var cx, cy;
    if (packM === 1) { // spiral
      var angle = i * 2.4;
      var radius = Math.sqrt(i / maxCirc) * scale * 0.9;
      cx = Math.cos(angle) * radius;
      cy = Math.sin(angle) * radius;
    } else if (packM === 2) { // grid
      var cols = Math.ceil(Math.sqrt(maxCirc));
      var cellSize = scale * 2 / cols;
      cx = (i % cols - cols / 2 + 0.5) * cellSize + (rng() - 0.5) * cellSize * 0.3;
      cy = (Math.floor(i / cols) - cols / 2 + 0.5) * cellSize + (rng() - 0.5) * cellSize * 0.3;
    } else if (packM === 3) { // concentric
      var ring = Math.floor(Math.sqrt(i));
      var inRing = i - ring * ring;
      var ringCount = ring * 2 + 1;
      var angle = inRing / ringCount * Math.PI * 2;
      var radius = (ring + 1) * scale / Math.sqrt(maxCirc) * 2;
      cx = Math.cos(angle) * radius;
      cy = Math.sin(angle) * radius;
    } else { // random
      cx = (rng() - 0.5) * scale * 1.8;
      cy = (rng() - 0.5) * scale * 1.8;
    }
    var h = rng(); // deterministic random hue for 'random' color mode
    circles.push({ x: cx, y: cy, ox: cx, oy: cy, r: minR, maxR: minR + rng() * (maxR - minR), growth: 0, h: h });
  }
  state = { maxCirc: maxCirc, scale: scale, packM: packM, minR: minR, maxR: maxR, circles: circles };
  ctx.frameState.set(stateKey, state);
}

var circs = state.circles;
var n = circs.length;

// Grow circles
for (var i = 0; i < n; i++) {
  var c = circs[i];
  if (c.r >= c.maxR) continue;
  c.growth += growSpd * 0.01;
  if (c.growth > 1) c.growth = 1;
  var eased = 1 - Math.pow(1 - c.growth, 3);
  var targetR = minR + (c.maxR - minR) * eased;
  var blocked = false;
  for (var j = 0; j < n; j++) {
    if (j === i) continue;
    var dx = c.x - circs[j].x, dy = c.y - circs[j].y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < targetR + circs[j].r + spacing) { blocked = true; break; }
  }
  if (!blocked) c.r = targetR;
}

// Mouse repulsion
if (mouseRepel > 0 && ctx.mouse) {
  // Map NDC (-1..1) to world space: approximate visible half-width from camera
  // Default camera distance 35, FOV 75° → visible half-width ≈ 27
  var camHalfW = scale * 1.8;
  var mx = ctx.mouse.x * camHalfW;
  var my = ctx.mouse.y * camHalfW;
  var repelRadius = scale * 0.2;
  for (var i = 0; i < n; i++) {
    var c = circs[i];
    var dx = c.x - mx, dy = c.y - my;
    var md = Math.sqrt(dx * dx + dy * dy);
    if (md < repelRadius && md > 0.01) {
      var force = (1 - md / repelRadius) * mouseRepel;
      c.x += (dx / md) * force * 0.3;
      c.y += (dy / md) * force * 0.3;
    } else {
      // Slowly return to original position
      c.x += (c.ox - c.x) * 0.02;
      c.y += (c.oy - c.y) * 0.02;
    }
  }
}

// Build mesh: fill circles + border rings
var SEGS = 32;
var hasBorder = borderW > 0;
var vertsPerCirc = SEGS * 3;
var borderVertsPerCirc = hasBorder ? SEGS * 6 : 0; // ring = 2 triangles per segment
var totalVerts = n * (vertsPerCirc + borderVertsPerCirc);
var positions = new Float32Array(totalVerts * 3);
var colors = new Float32Array(totalVerts * 3);
var idx = 0;

for (var i = 0; i < n; i++) {
  var c = circs[i];
  var px = c.x;
  var py = c.y + (bobAmt > 0 ? Math.sin(t * bobSpd + i * 0.5) * bobAmt * 0.2 : 0);
  var r = c.r * (1 + pulseAmt * Math.sin(t * 2 + i * 0.3) * 0.1);

  // Color
  var cr, cg, cb;
  if (colM === 0) { // size
    var sizeT = (c.r - minR) / Math.max(0.01, maxR - minR);
    var hc = helpers.hsl(0.55 - sizeT * 0.45, 0.8, 0.55);
    cr = hc[0]; cg = hc[1]; cb = hc[2];
  } else if (colM === 1) { // position
    var px2 = (c.ox / scale + 0.5);
    var py2 = (c.oy / scale + 0.5);
    var hc = helpers.hsl(px2 * 0.8, 0.7, 0.3 + py2 * 0.4);
    cr = hc[0]; cg = hc[1]; cb = hc[2];
  } else if (colM === 2) { // order
    var hc = helpers.hsl(i / n * 0.8, 0.75, 0.5);
    cr = hc[0]; cg = hc[1]; cb = hc[2];
  } else if (colM === 3) { // rainbow
    var hc = helpers.hsl((i / n + t * 0.05) % 1, 0.85, 0.55);
    cr = hc[0]; cg = hc[1]; cb = hc[2];
  } else { // random (deterministic)
    var hc = helpers.hsl(c.h, 0.75, 0.55);
    cr = hc[0]; cg = hc[1]; cb = hc[2];
  }

  // Border ring (behind fill, slightly dimmer)
  if (hasBorder) {
    var bOuter = r + borderW;
    var bInner = r;
    var bcr = cr * 0.4, bcg = cg * 0.4, bcb = cb * 0.4;
    for (var s = 0; s < SEGS; s++) {
      var a0 = s / SEGS * Math.PI * 2;
      var a1 = (s + 1) / SEGS * Math.PI * 2;
      var c0 = Math.cos(a0), s0 = Math.sin(a0);
      var c1 = Math.cos(a1), s1 = Math.sin(a1);
      // tri 1: inner0, outer0, outer1
      positions[idx*3]=px+c0*bInner; positions[idx*3+1]=py+s0*bInner; positions[idx*3+2]=-0.01;
      colors[idx*3]=bcr; colors[idx*3+1]=bcg; colors[idx*3+2]=bcb; idx++;
      positions[idx*3]=px+c0*bOuter; positions[idx*3+1]=py+s0*bOuter; positions[idx*3+2]=-0.01;
      colors[idx*3]=bcr; colors[idx*3+1]=bcg; colors[idx*3+2]=bcb; idx++;
      positions[idx*3]=px+c1*bOuter; positions[idx*3+1]=py+s1*bOuter; positions[idx*3+2]=-0.01;
      colors[idx*3]=bcr; colors[idx*3+1]=bcg; colors[idx*3+2]=bcb; idx++;
      // tri 2: inner0, outer1, inner1
      positions[idx*3]=px+c0*bInner; positions[idx*3+1]=py+s0*bInner; positions[idx*3+2]=-0.01;
      colors[idx*3]=bcr; colors[idx*3+1]=bcg; colors[idx*3+2]=bcb; idx++;
      positions[idx*3]=px+c1*bOuter; positions[idx*3+1]=py+s1*bOuter; positions[idx*3+2]=-0.01;
      colors[idx*3]=bcr; colors[idx*3+1]=bcg; colors[idx*3+2]=bcb; idx++;
      positions[idx*3]=px+c1*bInner; positions[idx*3+1]=py+s1*bInner; positions[idx*3+2]=-0.01;
      colors[idx*3]=bcr; colors[idx*3+1]=bcg; colors[idx*3+2]=bcb; idx++;
    }
  }

  // Fill circle (triangle fan)
  for (var s = 0; s < SEGS; s++) {
    var a0 = s / SEGS * Math.PI * 2;
    var a1 = (s + 1) / SEGS * Math.PI * 2;
    // center (bright)
    positions[idx*3]=px; positions[idx*3+1]=py; positions[idx*3+2]=0;
    colors[idx*3]=cr; colors[idx*3+1]=cg; colors[idx*3+2]=cb; idx++;
    // edge vertices (slightly darker for subtle gradient)
    positions[idx*3]=px+Math.cos(a0)*r; positions[idx*3+1]=py+Math.sin(a0)*r; positions[idx*3+2]=0;
    colors[idx*3]=cr*0.75; colors[idx*3+1]=cg*0.75; colors[idx*3+2]=cb*0.75; idx++;
    positions[idx*3]=px+Math.cos(a1)*r; positions[idx*3+1]=py+Math.sin(a1)*r; positions[idx*3+2]=0;
    colors[idx*3]=cr*0.75; colors[idx*3+1]=cg*0.75; colors[idx*3+2]=cb*0.75; idx++;
  }
}

return { positions: positions, colors: colors, drawCount: idx, opacity: fillOp };
`

const circlePackingDef: CompoundGeneratorDef = {
  id: 'builtin_circlePacking',
  name: 'Circle Packing',
  description: 'Animated circle packing with growth, collision detection, and multiple packing strategies',
  defaultCameraDistance: 35,
  generatorType: 'circle_packing_generator',
  outputMode: 'mesh',
  params: circlePackingParams,
  inputs: circlePackingParams.map(p => ({
    name: p.name,
    type: 'number' as const,
    default: p.type === 'bool' ? (p.default ? 1 : 0) : (p.type === 'enum' ? 0 : (p.default as number)),
  })),
  outputs: [
    { name: 'positions', type: 'positions' as const },
    { name: 'colors', type: 'colors' as const },
    { name: 'drawCount', type: 'number' as const },
    { name: 'opacity', type: 'number' as const },
  ],
  evaluateSource: circlePackingEvaluateSource,
}

// ═══════════════════════════════════════════════════════════════════════════
// VOXEL LANDSCAPE
// ═══════════════════════════════════════════════════════════════════════════

const voxelLandscapeParams: ParamSchemaDef[] = [
  { name: 'worldSize', type: 'int', min: 8, max: 48, default: 24, description: 'World size' },
  { name: 'heightScale', type: 'float', min: 1, max: 16, default: 8, description: 'Height scale' },
  { name: 'noiseScale', type: 'float', min: 0.01, max: 0.2, default: 0.06, description: 'Noise scale' },
  { name: 'waterLevel', type: 'float', min: -5, max: 5, default: -2, description: 'Water level' },
  { name: 'snowLevel', type: 'float', min: 5, max: 20, default: 12, description: 'Snow level' },
  { name: 'treeDensity', type: 'float', min: 0, max: 1, default: 0.3, description: 'Tree density' },
  { name: 'caveThreshold', type: 'float', min: 0, max: 0.5, default: 0.15, description: 'Cave threshold' },
  { name: 'terrainSeed', type: 'int', min: 1, max: 999, default: 42, description: 'Terrain seed' },
  { name: 'rotationSpeed', type: 'float', min: 0, max: 2, default: 0.3, description: 'Rotation speed' },
]

const voxelLandscapeEvaluateSource = `
var ws = Math.min(48, Math.round(inputs.worldSize));
var hs = inputs.heightScale;
var ns = inputs.noiseScale;
var wl = inputs.waterLevel;
var sl = inputs.snowLevel;
var td = inputs.treeDensity;
var ct = inputs.caveThreshold;
var sd = Math.round(inputs.terrainSeed);
var t = ctx.elapsed;
var stateKey = nodeId + '_voxel';
var state = ctx.frameState.get(stateKey);

if (!state || state.ws !== ws || state.hs !== hs || state.ns !== ns || state.sd !== sd || state.wl !== wl || state.sl !== sl || state.td !== td || state.ct !== ct) {
  // Simple noise function
  var perm = new Uint8Array(512);
  var s = sd;
  for (var i = 0; i < 256; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; perm[i] = s & 255; perm[i + 256] = perm[i]; }
  function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  function lerp(a, b, t) { return a + t * (b - a); }
  function grad(h, x, y, z) {
    var v = h & 15;
    var u = v < 8 ? x : y;
    var w = v < 4 ? y : v === 12 || v === 14 ? x : z;
    return ((v & 1) === 0 ? u : -u) + ((v & 2) === 0 ? w : -w);
  }
  function noise3(x, y, z) {
    var X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
    x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
    var u = fade(x), v = fade(y), w = fade(z);
    var A = perm[X] + Y, AA = perm[A] + Z, AB = perm[A + 1] + Z;
    var B = perm[X + 1] + Y, BA = perm[B] + Z, BB = perm[B + 1] + Z;
    return lerp(lerp(lerp(grad(perm[AA], x, y, z), grad(perm[BA], x - 1, y, z), u),
      lerp(grad(perm[AB], x, y - 1, z), grad(perm[BB], x - 1, y - 1, z), u), v),
      lerp(lerp(grad(perm[AA + 1], x, y, z - 1), grad(perm[BA + 1], x - 1, y, z - 1), u),
      lerp(grad(perm[AB + 1], x, y - 1, z - 1), grad(perm[BB + 1], x - 1, y - 1, z - 1), u), v), w);
  }
  function fbm(x, y, z, octaves) {
    var val = 0, amp = 1, freq = 1, max = 0;
    for (var o = 0; o < octaves; o++) { val += noise3(x * freq, y * freq, z * freq) * amp; max += amp; amp *= 0.5; freq *= 2; }
    return val / max;
  }

  // Generate terrain
  var half = ws / 2;
  var blocks = []; // [x, y, z, colorR, colorG, colorB]
  var grassC = [0.29, 0.55, 0.16], dirtC = [0.54, 0.41, 0.08], stoneC = [0.48, 0.48, 0.48];
  var sandC = [0.83, 0.73, 0.42], waterC = [0.16, 0.42, 0.69], snowC = [0.91, 0.91, 0.94];
  var deepC = [0.31, 0.31, 0.31], woodC = [0.42, 0.26, 0.15], leafC = [0.18, 0.43, 0.12];

  for (var bx = 0; bx < ws; bx++) {
    for (var bz = 0; bz < ws; bz++) {
      var nx = (bx - half) * ns;
      var nz = (bz - half) * ns;
      var surfaceY = Math.round(fbm(nx, 0, nz, 4) * hs);
      var biomeN = noise3((bx - half) * 0.02 + sd + 100, (bz - half) * 0.02 + sd + 100, 0) * 0.5 + 0.5;
      var minY = surfaceY - 6;
      var maxY = Math.max(surfaceY, Math.round(wl));

      for (var by = minY; by <= maxY; by++) {
        // Cave check
        if (by < surfaceY && ct > 0) {
          var caveN = (noise3(bx * 0.08, by * 0.08, bz * 0.08) + 1) * 0.5;
          if (caveN < ct) continue;
        }
        var col;
        if (by > surfaceY) col = waterC;
        else if (by === surfaceY) {
          if (surfaceY >= sl) col = snowC;
          else if (surfaceY <= wl + 1 && biomeN > 0.3) col = sandC;
          else col = grassC;
        } else if (by >= surfaceY - 2) col = dirtC;
        else if (by >= surfaceY - 5) col = stoneC;
        else col = deepC;

        // Slight color variation
        var vari = noise3(bx * 0.5, by * 0.5, bz * 0.5) * 0.1;
        blocks.push(bx - half, by, bz - half, col[0] + vari, col[1] + vari, col[2] + vari);
      }

      // Trees
      if (td > 0 && surfaceY > wl + 1 && surfaceY < sl && biomeN < 0.7) {
        var treeN = (noise3((bx - half) * 1.5 + sd + 50, (bz - half) * 1.5 + sd + 50, 0) + 1) * 0.5;
        if (treeN > 1 - td * 0.5) {
          var trunkH = 3 + Math.round(treeN * 3);
          for (var ty = 1; ty <= trunkH; ty++) blocks.push(bx - half, surfaceY + ty, bz - half, woodC[0], woodC[1], woodC[2]);
          var canopyY = surfaceY + trunkH;
          for (var ly = -2; ly <= 2; ly++) {
            for (var lx = -2; lx <= 2; lx++) {
              for (var lz = -2; lz <= 2; lz++) {
                if (lx * lx + ly * ly + lz * lz <= 5) {
                  blocks.push(bx - half + lx, canopyY + ly, bz - half + lz, leafC[0] + noise3(bx + lx, canopyY + ly, bz + lz) * 0.08, leafC[1] + noise3(bx + lx + 50, canopyY + ly, bz + lz) * 0.08, leafC[2]);
                }
              }
            }
          }
        }
      }
    }
  }

  // Convert blocks to cube mesh (6 faces, 2 tris each = 36 verts per cube)
  var cubeCount = blocks.length / 6;
  var totalVerts = cubeCount * 36;
  var positions = new Float32Array(totalVerts * 3);
  var normals = new Float32Array(totalVerts * 3);
  var colors = new Float32Array(totalVerts * 3);

  var faces = [
    [0,1,0, [0,0,1,1,0,1, 0,0,1,1,1,0]], // +Y top
    [0,-1,0, [0,0,1,1,1,0, 0,0,0,1,0,1]], // -Y bottom
    [1,0,0, [0,0,1,0,1,1, 0,0,0,0,1,0]], // +X
    [-1,0,0, [0,0,0,0,1,0, 0,0,1,0,1,1]], // -X
    [0,0,1, [0,0,1,0,1,1, 0,0,0,0,1,0]], // +Z
    [0,0,-1, [0,0,0,0,1,0, 0,0,1,0,1,1]], // -Z
  ];
  var faceVerts = [
    // +Y: y+0.5
    [[-.5,.5,-.5],[.5,.5,-.5],[.5,.5,.5],[-.5,.5,-.5],[.5,.5,.5],[-.5,.5,.5]],
    // -Y: y-0.5
    [[-.5,-.5,.5],[.5,-.5,.5],[.5,-.5,-.5],[-.5,-.5,.5],[.5,-.5,-.5],[-.5,-.5,-.5]],
    // +X
    [[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5],[.5,-.5,-.5],[.5,.5,.5],[.5,-.5,.5]],
    // -X
    [[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5],[-.5,-.5,.5],[-.5,.5,-.5],[-.5,-.5,-.5]],
    // +Z
    [[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]],
    // -Z
    [[.5,-.5,-.5],[-.5,-.5,-.5],[-.5,.5,-.5],[.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5]],
  ];
  var faceNormals = [[0,1,0],[0,-1,0],[1,0,0],[-1,0,0],[0,0,1],[0,0,-1]];

  var vi = 0;
  for (var ci = 0; ci < cubeCount; ci++) {
    var bx = blocks[ci * 6], by = blocks[ci * 6 + 1], bz = blocks[ci * 6 + 2];
    var cr = blocks[ci * 6 + 3], cg = blocks[ci * 6 + 4], cb = blocks[ci * 6 + 5];
    for (var f = 0; f < 6; f++) {
      var fn = faceNormals[f];
      var fv = faceVerts[f];
      for (var v = 0; v < 6; v++) {
        positions[vi * 3] = bx + fv[v][0]; positions[vi * 3 + 1] = by + fv[v][1]; positions[vi * 3 + 2] = bz + fv[v][2];
        normals[vi * 3] = fn[0]; normals[vi * 3 + 1] = fn[1]; normals[vi * 3 + 2] = fn[2];
        // Darken sides slightly
        var shade = f === 0 ? 1.0 : f === 1 ? 0.6 : f <= 3 ? 0.8 : 0.75;
        colors[vi * 3] = Math.min(1, cr * shade); colors[vi * 3 + 1] = Math.min(1, cg * shade); colors[vi * 3 + 2] = Math.min(1, cb * shade);
        vi++;
      }
    }
  }

  state = { ws: ws, hs: hs, ns: ns, sd: sd, wl: wl, sl: sl, td: td, ct: ct, basePositions: positions, baseNormals: normals, colors: colors, vertCount: vi,
    outPositions: new Float32Array(positions.length), outNormals: new Float32Array(normals.length) };
  ctx.frameState.set(stateKey, state);
}

// Apply tilt (look down at ~40 degrees around X) + animated Y rotation
var tiltAngle = -0.7; // ~40 degrees down
var cosT = Math.cos(tiltAngle), sinT = Math.sin(tiltAngle);
var yAngle = t * inputs.rotationSpeed;
var cosY = Math.cos(yAngle), sinY = Math.sin(yAngle);
var bp = state.basePositions, bn = state.baseNormals;
var op = state.outPositions, on = state.outNormals;
for (var ri = 0; ri < state.vertCount; ri++) {
  var i3 = ri * 3;
  var px = bp[i3], py = bp[i3+1], pz = bp[i3+2];
  // Y rotation first
  var rx = px * cosY + pz * sinY, ry = py, rz = -px * sinY + pz * cosY;
  // Then X tilt
  op[i3] = rx; op[i3+1] = ry * cosT - rz * sinT; op[i3+2] = ry * sinT + rz * cosT;
  // Same for normals
  var nx = bn[i3], ny = bn[i3+1], nz = bn[i3+2];
  var rnx = nx * cosY + nz * sinY, rny = ny, rnz = -nx * sinY + nz * cosY;
  on[i3] = rnx; on[i3+1] = rny * cosT - rnz * sinT; on[i3+2] = rny * sinT + rnz * cosT;
}

return { positions: state.outPositions, normals: state.outNormals, colors: state.colors, drawCount: state.vertCount, opacity: 0.95, wireframe: 0 };
`

const voxelLandscapeDef: CompoundGeneratorDef = {
  id: 'builtin_voxelLandscape',
  name: 'Voxel Landscape',
  description: 'Procedural voxel terrain with biomes, caves, trees, and water',
  defaultCameraDistance: 30,
  generatorType: 'voxel_landscape_generator',
  outputMode: 'mesh',
  params: voxelLandscapeParams,
  inputs: voxelLandscapeParams.map(p => ({
    name: p.name,
    type: 'number' as const,
    default: p.type === 'bool' ? (p.default ? 1 : 0) : (p.type === 'enum' ? 0 : (p.default as number)),
  })),
  outputs: [
    { name: 'positions', type: 'positions' as const },
    { name: 'normals', type: 'positions' as const },
    { name: 'colors', type: 'colors' as const },
    { name: 'drawCount', type: 'number' as const },
    { name: 'opacity', type: 'number' as const },
    { name: 'wireframe', type: 'number' as const },
  ],
  evaluateSource: voxelLandscapeEvaluateSource,
}

// ═══════════════════════════════════════════════════════════════════════════
// PHYSARUM (Slime Mold Simulation)
// ═══════════════════════════════════════════════════════════════════════════

// Full physarum pipeline matching the original built-in:
// - agentState texture: each pixel = one agent (RGBA = posX, posY, angle, speed)
// - pheromone texture: spatial pheromone concentration
// Pass 1: Agent update (fullscreen quad) — sense pheromone, steer, move
// Pass 2: Diffuse + decay pheromone (fullscreen quad)
// Pass 3: Deposit (GL_POINTS with additive blending) — agents scatter deposits
// Pass 4: Display — multi-layer tone mapping for organic vein look

// Agent update: sense pheromone field, turn toward highest concentration, move
const physarumAgentFrag = `precision highp float;
uniform sampler2D agentTex;
uniform sampler2D pheromoneTex;
uniform float sensorAngle;
uniform float sensorDist;
uniform float turnSpeed;
uniform float moveSpeed;
uniform vec2 resolution;
uniform float time;
uniform float randomStrength;
varying vec2 vUv;

float rand(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec4 agent = texture2D(agentTex, vUv);
  vec2 pos = agent.xy;
  float angle = agent.z;
  float speed = agent.w;

  float sa = sensorAngle * 3.14159 / 180.0;
  float sd = sensorDist / resolution.x;

  vec2 frontSensor = pos + vec2(cos(angle), sin(angle)) * sd;
  vec2 leftSensor  = pos + vec2(cos(angle + sa), sin(angle + sa)) * sd;
  vec2 rightSensor = pos + vec2(cos(angle - sa), sin(angle - sa)) * sd;

  float frontVal = texture2D(pheromoneTex, fract(frontSensor)).r;
  float leftVal  = texture2D(pheromoneTex, fract(leftSensor)).r;
  float rightVal = texture2D(pheromoneTex, fract(rightSensor)).r;

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
  pos += vec2(cos(angle), sin(angle)) * ms * speed;
  pos = fract(pos);

  gl_FragColor = vec4(pos, angle, speed);
}`

// Deposit: render agents as GL_POINTS at their positions with additive blending
const physarumDepositVert = `attribute vec2 agentUV;
uniform sampler2D agentTex;
uniform float depositAmount;
varying float vDeposit;

void main() {
  vec4 agent = texture2D(agentTex, agentUV);
  vec2 pos = agent.xy;
  gl_Position = vec4(pos * 2.0 - 1.0, 0.0, 1.0);
  gl_PointSize = 1.0;
  vDeposit = depositAmount;
}`

const physarumDepositFrag = `precision highp float;
varying float vDeposit;
void main() {
  gl_FragColor = vec4(vDeposit * 0.05, 0.0, 0.0, 1.0);
}`

// Diffuse + decay pheromone field (weighted 3x3 Gaussian, center-heavy for tight trails)
const physarumDiffuseFrag = `precision highp float;
uniform sampler2D pheromoneTex;
uniform float decayRate;
uniform float diffuseSpeed;
uniform vec2 resolution;
varying vec2 vUv;

void main() {
  vec2 texel = 1.0 / resolution;
  float center = texture2D(pheromoneTex, vUv).r;
  float sum = center * 4.0;
  sum += texture2D(pheromoneTex, vUv + vec2(-1.0, 0.0) * texel).r;
  sum += texture2D(pheromoneTex, vUv + vec2(1.0, 0.0) * texel).r;
  sum += texture2D(pheromoneTex, vUv + vec2(0.0, -1.0) * texel).r;
  sum += texture2D(pheromoneTex, vUv + vec2(0.0, 1.0) * texel).r;
  sum += texture2D(pheromoneTex, vUv + vec2(-1.0, -1.0) * texel).r * 0.5;
  sum += texture2D(pheromoneTex, vUv + vec2(1.0, -1.0) * texel).r * 0.5;
  sum += texture2D(pheromoneTex, vUv + vec2(-1.0, 1.0) * texel).r * 0.5;
  sum += texture2D(pheromoneTex, vUv + vec2(1.0, 1.0) * texel).r * 0.5;
  float totalWeight = 4.0 + 4.0 + 2.0;
  float diffused = sum / totalWeight;

  float blended = mix(center, diffused, diffuseSpeed);
  float decayed = blended * (1.0 - decayRate);

  gl_FragColor = vec4(min(decayed, 1.0), 0.0, 0.0, 1.0);
}`

// Display: multi-mode coloring with organic vein structure
const physarumDisplayFrag = `precision highp float;
uniform sampler2D pheromoneTex;
uniform vec3 trailColor;
uniform vec3 secondaryColor;
uniform vec3 bgColor;
uniform float contrast;
uniform float brightness;
uniform vec2 resolution;
uniform float colorMode;
uniform float edgeGlow;
uniform float hotspotIntensity;
varying vec2 vUv;

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
  float val = texture2D(pheromoneTex, vUv).r;
  vec2 texel = 1.0 / resolution;

  // Compute gradient for flow mode and edge glow
  float dx = texture2D(pheromoneTex, vUv + vec2(texel.x, 0.0)).r -
             texture2D(pheromoneTex, vUv - vec2(texel.x, 0.0)).r;
  float dy = texture2D(pheromoneTex, vUv + vec2(0.0, texel.y)).r -
             texture2D(pheromoneTex, vUv - vec2(0.0, texel.y)).r;
  float gradMag = length(vec2(dx, dy));
  float gradAngle = atan(dy, dx);

  // Multi-layer tone mapping
  float tendrils = smoothstep(0.005, 0.08, val);
  float veins = smoothstep(0.03, 0.25, val);
  float hotspots = smoothstep(0.15, 0.6, val);

  vec3 col = bgColor;
  float cm = floor(colorMode + 0.5);

  if (cm < 0.5) {
    // Single color — classic organic look
    col = mix(col, trailColor * 0.4, tendrils * 0.6);
    col = mix(col, trailColor * brightness, veins);
    col += vec3(0.8, 0.9, 1.0) * hotspots * hotspotIntensity;
  } else if (cm < 1.5) {
    // Gradient — blend between trailColor (low) and secondaryColor (high)
    vec3 lo = trailColor * 0.4;
    vec3 hi = secondaryColor * brightness;
    col = mix(col, lo, tendrils * 0.6);
    col = mix(col, mix(lo, hi, veins), veins);
    col += vec3(1.0) * hotspots * hotspotIntensity;
  } else if (cm < 2.5) {
    // Flow — gradient direction mapped to hue, magnitude to brightness
    float hue = gradAngle / 6.28318 + 0.5;
    float flowBright = clamp(gradMag * 15.0, 0.0, 1.0);
    vec3 flowCol = hsv2rgb(vec3(hue, 0.85, flowBright * brightness));
    col = mix(col, flowCol * 0.5, tendrils * 0.8);
    col = mix(col, flowCol, veins);
    col += secondaryColor * hotspots * hotspotIntensity;
  } else if (cm < 3.5) {
    // Rainbow — concentration through full spectrum
    float hue = pow(val * brightness, 1.0 / max(contrast, 0.1)) * 0.8;
    vec3 rainbowCol = hsv2rgb(vec3(hue, 0.9, 1.0));
    col = mix(col, rainbowCol * 0.3, tendrils * 0.6);
    col = mix(col, rainbowCol, veins);
    col += vec3(1.0) * hotspots * hotspotIntensity * 0.5;
  } else {
    // Heat — black → red → orange → yellow → white
    vec3 heat;
    float v = clamp(val * brightness * 3.0, 0.0, 1.0);
    if (v < 0.33) heat = mix(vec3(0.0), vec3(0.8, 0.0, 0.0), v * 3.0);
    else if (v < 0.66) heat = mix(vec3(0.8, 0.0, 0.0), vec3(1.0, 0.6, 0.0), (v - 0.33) * 3.0);
    else heat = mix(vec3(1.0, 0.6, 0.0), vec3(1.0, 1.0, 0.8), (v - 0.66) * 3.0);
    col = mix(col, heat * 0.4, tendrils * 0.6);
    col = mix(col, heat, veins);
    col += vec3(1.0, 1.0, 0.9) * hotspots * hotspotIntensity;
  }

  // Edge glow from gradient magnitude
  float edge = gradMag * 3.0 * edgeGlow;
  col += trailColor * edge * 0.2;

  // Contrast adjustment on final output
  col = pow(max(col, vec3(0.0)), vec3(1.0 / max(contrast, 0.1)));

  gl_FragColor = vec4(col, 1.0);
}`

const physarumParams: ParamSchemaDef[] = [
  { name: 'agentCount', type: 'int', min: 1000, max: 262144, default: 100000, description: 'Number of agents' },
  { name: 'sensorAngle', type: 'float', min: 5, max: 90, default: 30, description: 'Sensor angle (degrees)' },
  { name: 'sensorDistance', type: 'float', min: 2, max: 50, default: 20, description: 'Sensor distance' },
  { name: 'turnSpeed', type: 'float', min: 5, max: 180, default: 45, description: 'Turn speed (degrees)' },
  { name: 'moveSpeed', type: 'float', min: 0.1, max: 5, default: 1.5, description: 'Move speed' },
  { name: 'decayRate', type: 'float', min: 0, max: 0.1, default: 0.02, description: 'Trail decay rate' },
  { name: 'depositAmount', type: 'float', min: 0.1, max: 20, default: 5, description: 'Deposit amount' },
  { name: 'diffuseSpeed', type: 'float', min: 0, max: 1, default: 0.5, description: 'Diffusion speed' },
  { name: 'stepsPerFrame', type: 'int', min: 1, max: 16, default: 4, description: 'Simulation steps per frame' },
  { name: 'spawnPattern', type: 'enum', default: 'center', enumValues: ['center', 'ring', 'multi', 'random'], description: 'Agent spawn pattern' },
  { name: 'simResolution', type: 'int', min: 256, max: 1024, default: 512, description: 'Pheromone field resolution' },
  { name: 'colorMode', type: 'enum', default: 'single', enumValues: ['single', 'gradient', 'flow', 'rainbow', 'heat'], description: 'Color mode' },
  { name: 'colorHue', type: 'float', min: 0, max: 360, default: 150, description: 'Trail hue (degrees)' },
  { name: 'colorSaturation', type: 'float', min: 0, max: 1, default: 0.9, description: 'Trail saturation' },
  { name: 'secondaryHue', type: 'float', min: 0, max: 360, default: 30, description: 'Secondary hue (gradient/flow modes)' },
  { name: 'contrast', type: 'float', min: 0.5, max: 3, default: 1.5, description: 'Display contrast' },
  { name: 'brightness', type: 'float', min: 0.5, max: 3, default: 1.2, description: 'Display brightness' },
  { name: 'edgeGlow', type: 'float', min: 0, max: 3, default: 1, description: 'Edge glow intensity' },
  { name: 'hotspotIntensity', type: 'float', min: 0, max: 2, default: 0.5, description: 'Hotspot brightness' },
  { name: 'bgBrightness', type: 'float', min: 0, max: 0.2, default: 0.03, description: 'Background brightness' },
  { name: 'randomStrength', type: 'float', min: 0, max: 2, default: 0.5, description: 'Random jitter' },
]

const physarumEvaluateSource = `
var agentCount = Math.min(262144, Math.max(1000, Math.round(inputs.agentCount)));
var agentSide = Math.min(512, Math.ceil(Math.sqrt(agentCount)));
var simRes = Math.min(1024, Math.max(256, Math.round(inputs.simResolution)));
var spawnIdx = Math.round(inputs.spawnPattern || 0);
var spawnNames = ['center', 'ring', 'multi', 'random'];
var spawn = spawnNames[Math.min(spawnIdx, 3)] || 'center';

var key = nodeId + '_physarum';
var state = ctx.frameState.get(key);
if (!state || state.agentSide !== agentSide || state.spawn !== spawn) {
  var agentData = new Float32Array(agentSide * agentSide * 4);
  var totalAgents = agentSide * agentSide;
  for (var i = 0; i < totalAgents; i++) {
    var px, py, angle;
    if (spawn === 'center') {
      var r = Math.random() * 0.15 + 0.01;
      var theta = Math.random() * Math.PI * 2;
      px = 0.5 + Math.cos(theta) * r;
      py = 0.5 + Math.sin(theta) * r;
      angle = theta + Math.PI + (Math.random() - 0.5) * 1.0;
    } else if (spawn === 'ring') {
      var theta = Math.random() * Math.PI * 2;
      var r = 0.3 + (Math.random() - 0.5) * 0.05;
      px = 0.5 + Math.cos(theta) * r;
      py = 0.5 + Math.sin(theta) * r;
      angle = theta + Math.PI + (Math.random() - 0.5) * 0.8;
    } else if (spawn === 'multi') {
      var cluster = Math.floor(Math.random() * 5);
      var cx = [0.3, 0.7, 0.5, 0.25, 0.75][cluster];
      var cy = [0.3, 0.3, 0.7, 0.6, 0.6][cluster];
      var r = Math.random() * 0.08;
      var theta = Math.random() * Math.PI * 2;
      px = cx + Math.cos(theta) * r;
      py = cy + Math.sin(theta) * r;
      angle = Math.random() * Math.PI * 2;
    } else {
      px = Math.random();
      py = Math.random();
      angle = Math.random() * Math.PI * 2;
    }
    agentData[i * 4] = px;
    agentData[i * 4 + 1] = py;
    agentData[i * 4 + 2] = angle;
    agentData[i * 4 + 3] = 0.8 + Math.random() * 0.4;
  }
  state = { agentSide: agentSide, spawn: spawn, agentData: agentData, simRes: simRes, gen: (state ? state.gen + 1 : 0) };
  ctx.frameState.set(key, state);
}

// HSV to RGB conversion for trail colors
function hsvToRgb(h, s, v) {
  h = ((h % 360) + 360) % 360 / 360;
  var i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  var m = i % 6;
  if (m === 0) return [v, t, p];
  if (m === 1) return [q, v, p];
  if (m === 2) return [p, v, t];
  if (m === 3) return [p, q, v];
  if (m === 4) return [t, p, v];
  return [v, p, q];
}
var tc = hsvToRgb(inputs.colorHue, inputs.colorSaturation, 1.0);
var sc = hsvToRgb(inputs.secondaryHue, inputs.colorSaturation, 1.0);
var bg = inputs.bgBrightness;
var colorModeIdx = Math.round(inputs.colorMode || 0);

return { shaderConfig: {
  passes: [
    { name: 'agents', fragmentShader: inputs.agentsShader, target: 'agentState',
      readFrom: { agentTex: 'agentState', pheromoneTex: 'pheromone' },
      uniforms: {
        sensorAngle: inputs.sensorAngle,
        sensorDist: inputs.sensorDistance,
        turnSpeed: inputs.turnSpeed,
        moveSpeed: inputs.moveSpeed,
        randomStrength: inputs.randomStrength,
        resolution: [simRes, simRes],
        time: ctx.elapsed,
      }
    },
    { name: 'diffuse', fragmentShader: inputs.diffuseShader, target: 'pheromone',
      readFrom: { pheromoneTex: 'pheromone' },
      uniforms: {
        decayRate: inputs.decayRate,
        diffuseSpeed: inputs.diffuseSpeed,
        resolution: [simRes, simRes],
      }
    },
    { name: 'deposit', mode: 'deposit', agentTarget: 'agentState', agentRes: state.agentSide,
      vertexShader: inputs.depositVertShader,
      fragmentShader: inputs.depositFragShader,
      target: 'pheromone', noClear: true,
      uniforms: { depositAmount: inputs.depositAmount }
    },
    { name: 'display', fragmentShader: inputs.displayShader, target: null,
      readFrom: { pheromoneTex: 'pheromone' },
      uniforms: {
        trailColor: tc,
        secondaryColor: sc,
        bgColor: [bg, bg, bg * 1.2],
        contrast: inputs.contrast,
        brightness: inputs.brightness,
        resolution: [simRes, simRes],
        colorMode: colorModeIdx,
        edgeGlow: inputs.edgeGlow,
        hotspotIntensity: inputs.hotspotIntensity,
      }
    },
  ],
  renderTargetDefs: {
    agentState: { width: state.agentSide, height: state.agentSide, type: 'float', filter: 'nearest', pingPong: true, _gen: state.gen },
    pheromone: { width: simRes, height: simRes, type: 'float', filter: 'linear', pingPong: true, _gen: state.gen },
  },
  initData: { agentState: state.agentData },
  stepsPerFrame: Math.min(16, Math.round(inputs.stepsPerFrame)),
}};
`

const physarumDef: CompoundGeneratorDef = {
  id: 'builtin_physarum',
  name: 'Physarum',
  description: 'Slime mold simulation with agent-based pheromone trails',
  defaultCameraDistance: 0,
  generatorType: 'physarum_generator',
  outputMode: 'shader',
  params: physarumParams,
  inputs: physarumParams.map(p => ({
    name: p.name,
    type: 'number' as const,
    default: p.type === 'bool' ? (p.default ? 1 : 0) : (p.type === 'enum' ? 0 : (p.default as number)),
  })),
  outputs: [{ name: 'shaderConfig', type: 'array' as const }],
  evaluateSource: physarumEvaluateSource,
  shaderSources: {
    agents: physarumAgentFrag,
    depositVert: physarumDepositVert,
    depositFrag: physarumDepositFrag,
    diffuse: physarumDiffuseFrag,
    display: physarumDisplayFrag,
  },
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export const REMAINING_GENERATORS: CompoundGeneratorDef[] = [
  clothDef,
  networkGraphDef,
  circlePackingDef,
  voxelLandscapeDef,
  physarumDef,
]
