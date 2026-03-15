import type { Node, Edge } from '@xyflow/react'
import type { ParamSchemaDef } from './storage'

/**
 * Pre-built Lissajous node graph that demonstrates the pattern designer.
 * Uses param_input nodes for ALL parameters matching the built-in Lissajous,
 * wired into a single lissajous_generator node.
 */

// Helper to create param_input nodes compactly
function paramNode(
  id: string, y: number, col: number,
  paramName: string, paramType: string, defaultValue: number,
  min: number, max: number, enumValues?: string,
): Node {
  return {
    id,
    type: 'param_input',
    position: { x: col === 0 ? -20 : 200, y },
    data: { paramName, paramType, defaultValue, min, max, enumValues: enumValues ?? '' },
  }
}

export const LISSAJOUS_EXAMPLE_NODES: Node[] = [
  // ── Column 1: core params ──
  paramNode('p_pointCount',   0,   0, 'pointCount',    'int',   5000, 100,  20000),
  paramNode('p_curveCount',   100, 0, 'curveCount',    'int',   3,    1,    10),
  paramNode('p_freqA',        200, 0, 'freqA',         'float', 3,    0.1,  20),
  paramNode('p_freqB',        300, 0, 'freqB',         'float', 2,    0.1,  20),
  paramNode('p_freqC',        400, 0, 'freqC',         'float', 5,    0.1,  20),
  paramNode('p_phaseShift',   500, 0, 'phaseShift',    'float', 0,    0,    360),
  paramNode('p_damping',      600, 0, 'damping',       'float', 0,    0,    1),
  paramNode('p_scale',        700, 0, 'scale',         'float', 8,    0.5,  32),
  paramNode('p_is3D',         800, 0, 'is3D',          'bool',  0,    0,    1),
  paramNode('p_freqRatio',    900, 0, 'freqRatio',     'float', 1,    0.1,  5),
  paramNode('p_symmetry',    1000, 0, 'symmetry',      'int',   1,    1,    8),

  // ── Column 2: visual + animation params ──
  paramNode('p_colorMode',    0,   1, 'colorMode',     'enum',  0,    0, 1, 'rainbow,speed,solid,palette'),
  paramNode('p_lineOpacity',  100, 1, 'lineOpacity',   'float', 0.85, 0,    1),
  paramNode('p_thickness',    200, 1, 'thickness',     'float', 1,    0.1,  5),
  paramNode('p_animated',     300, 1, 'animated',      'bool',  1,    0,    1),
  paramNode('p_drawSpeed',    400, 1, 'drawSpeed',     'float', 2,    0,    10),
  paramNode('p_phaseAnimate', 500, 1, 'phaseAnimate',  'bool',  1,    0,    1),
  paramNode('p_phaseSpeed',   600, 1, 'phaseSpeed',    'float', 0.3,  0,    3),
  paramNode('p_rotationSpeed',700, 1, 'rotationSpeed', 'float', 0.2,  0,    2),
  paramNode('p_trailGlow',    800, 1, 'trailGlow',     'bool',  1,    0,    1),
  paramNode('p_glowLength',   900, 1, 'glowLength',    'float', 0.05, 0,    0.5),

  // ── Lissajous generator ──
  {
    id: 'lissajous',
    type: 'lissajous_generator',
    position: { x: 500, y: 350 },
    data: {},
  },

  // ── Line output ──
  {
    id: 'lineOut',
    type: 'line_output',
    position: { x: 820, y: 400 },
    data: {},
  },
]

export const LISSAJOUS_EXAMPLE_EDGES: Edge[] = [
  // Column 1 → lissajous_generator
  { id: 'e01', source: 'p_pointCount',    sourceHandle: 'value', target: 'lissajous', targetHandle: 'pointCount' },
  { id: 'e02', source: 'p_curveCount',    sourceHandle: 'value', target: 'lissajous', targetHandle: 'curveCount' },
  { id: 'e03', source: 'p_freqA',         sourceHandle: 'value', target: 'lissajous', targetHandle: 'freqA' },
  { id: 'e04', source: 'p_freqB',         sourceHandle: 'value', target: 'lissajous', targetHandle: 'freqB' },
  { id: 'e05', source: 'p_freqC',         sourceHandle: 'value', target: 'lissajous', targetHandle: 'freqC' },
  { id: 'e06', source: 'p_phaseShift',    sourceHandle: 'value', target: 'lissajous', targetHandle: 'phaseShift' },
  { id: 'e07', source: 'p_damping',       sourceHandle: 'value', target: 'lissajous', targetHandle: 'damping' },
  { id: 'e08', source: 'p_scale',         sourceHandle: 'value', target: 'lissajous', targetHandle: 'scale' },
  { id: 'e09', source: 'p_is3D',          sourceHandle: 'value', target: 'lissajous', targetHandle: 'is3D' },
  { id: 'e10', source: 'p_freqRatio',     sourceHandle: 'value', target: 'lissajous', targetHandle: 'freqRatio' },
  { id: 'e11', source: 'p_symmetry',      sourceHandle: 'value', target: 'lissajous', targetHandle: 'symmetry' },

  // Column 2 → lissajous_generator (animation/visual)
  { id: 'e12', source: 'p_colorMode',     sourceHandle: 'value', target: 'lissajous', targetHandle: 'colorMode' },
  { id: 'e13', source: 'p_animated',      sourceHandle: 'value', target: 'lissajous', targetHandle: 'animated' },
  { id: 'e14', source: 'p_drawSpeed',     sourceHandle: 'value', target: 'lissajous', targetHandle: 'drawSpeed' },
  { id: 'e15', source: 'p_phaseAnimate',  sourceHandle: 'value', target: 'lissajous', targetHandle: 'phaseAnimate' },
  { id: 'e16', source: 'p_phaseSpeed',    sourceHandle: 'value', target: 'lissajous', targetHandle: 'phaseSpeed' },
  { id: 'e17', source: 'p_rotationSpeed', sourceHandle: 'value', target: 'lissajous', targetHandle: 'rotationSpeed' },

  // Lissajous generator → line output
  { id: 'e18', source: 'lissajous', sourceHandle: 'positions',  target: 'lineOut', targetHandle: 'positions' },
  { id: 'e19', source: 'lissajous', sourceHandle: 'colors',     target: 'lineOut', targetHandle: 'colors' },
  { id: 'e20', source: 'lissajous', sourceHandle: 'drawCount',  target: 'lineOut', targetHandle: 'drawCount' },

  // Opacity + thickness → line output
  { id: 'e21', source: 'p_lineOpacity', sourceHandle: 'value', target: 'lineOut', targetHandle: 'opacity' },
  { id: 'e22', source: 'p_thickness',   sourceHandle: 'value', target: 'lineOut', targetHandle: 'thickness' },
]

export const LISSAJOUS_PARAM_SCHEMA: ParamSchemaDef[] = [
  { name: 'pointCount',    type: 'int',   min: 100,  max: 20000, default: 5000,  description: 'Number of points per curve' },
  { name: 'curveCount',    type: 'int',   min: 1,    max: 10,    default: 3,     description: 'Number of curves' },
  { name: 'freqA',         type: 'float', min: 0.1,  max: 20,    default: 3,     description: 'Frequency A' },
  { name: 'freqB',         type: 'float', min: 0.1,  max: 20,    default: 2,     description: 'Frequency B' },
  { name: 'freqC',         type: 'float', min: 0.1,  max: 20,    default: 5,     description: 'Frequency C (3D)' },
  { name: 'phaseShift',    type: 'float', min: 0,    max: 360,   default: 0,     description: 'Phase shift in degrees' },
  { name: 'damping',       type: 'float', min: 0,    max: 1,     default: 0,     description: 'Exponential decay' },
  { name: 'scale',         type: 'float', min: 0.5,  max: 32,    default: 8,     description: 'Curve scale' },
  { name: 'is3D',          type: 'bool',                          default: false, description: 'Enable 3D mode' },
  { name: 'freqRatio',     type: 'float', min: 0.1,  max: 5,     default: 1,     description: 'Frequency B multiplier' },
  { name: 'symmetry',      type: 'int',   min: 1,    max: 8,     default: 1,     description: 'Rotational symmetry' },
  { name: 'colorMode',     type: 'enum',                          default: 'rainbow', description: 'Color mode', enumValues: ['rainbow', 'speed', 'solid', 'palette'] },
  { name: 'lineOpacity',   type: 'float', min: 0,    max: 1,     default: 0.85,  description: 'Line opacity' },
  { name: 'thickness',     type: 'float', min: 0.1,  max: 5,     default: 1,     description: 'Line thickness' },
  { name: 'animated',      type: 'bool',                          default: true,  description: 'Progressive draw animation' },
  { name: 'drawSpeed',     type: 'float', min: 0,    max: 10,    default: 2,     description: 'Draw animation speed' },
  { name: 'phaseAnimate',  type: 'bool',                          default: true,  description: 'Animate phase' },
  { name: 'phaseSpeed',    type: 'float', min: 0,    max: 3,     default: 0.3,   description: 'Phase animation speed' },
  { name: 'rotationSpeed', type: 'float', min: 0,    max: 2,     default: 0.2,   description: '3D rotation speed' },
  { name: 'trailGlow',     type: 'bool',                          default: true,  description: 'Trail glow effect' },
  { name: 'glowLength',    type: 'float', min: 0,    max: 0.5,   default: 0.05,  description: 'Glow trail length' },
]

export const LISSAJOUS_EXAMPLE = {
  id: 'example_lissajous',
  name: 'Lissajous (Custom)',
  description: 'Lissajous curve built with the node pattern designer — all parameters match the built-in version',
  nodes: LISSAJOUS_EXAMPLE_NODES,
  edges: LISSAJOUS_EXAMPLE_EDGES,
  defaultParams: {
    pointCount: 5000,
    curveCount: 3,
    freqA: 3,
    freqB: 2,
    freqC: 5,
    phaseShift: 0,
    damping: 0,
    scale: 8,
    is3D: false,
    freqRatio: 1,
    symmetry: 1,
    colorMode: 'rainbow',
    lineOpacity: 0.85,
    thickness: 1,
    animated: true,
    drawSpeed: 2,
    phaseAnimate: true,
    phaseSpeed: 0.3,
    rotationSpeed: 0.2,
    trailGlow: true,
    glowLength: 0.05,
  },
  parameterSchema: LISSAJOUS_PARAM_SCHEMA,
  defaultCameraDistance: 22,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}
