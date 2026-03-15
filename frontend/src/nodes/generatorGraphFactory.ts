import type { Node, Edge } from '@xyflow/react'
import type { PortDef } from './types'
import type { UserPatternGraph, ParamSchemaDef, SerializedNodeDef } from './storage'

export interface CompoundGeneratorDef {
  id: string
  name: string
  description: string
  defaultCameraDistance: number
  generatorType: string
  /** Which output node type to use */
  outputMode: 'line' | 'lineSegments' | 'points' | 'mesh' | 'line_and_points' | 'lineSegments_and_points' | 'shader'
  /** Parameters exposed via param_input nodes */
  params: ParamSchemaDef[]
  /** The evaluate function body as a string */
  evaluateSource: string
  /** Generator node inputs */
  inputs: PortDef[]
  /** Generator node outputs */
  outputs: PortDef[]
  /** Node category (defaults to 'generator') */
  category?: 'generator' | 'transform' | 'color'
  /** For shader patterns: GLSL vertex shader */
  vertexShader?: string
  /** For shader patterns: GLSL fragment shader */
  fragmentShader?: string
  /** For multi-pass shader patterns: named GLSL sources */
  shaderSources?: Record<string, string>
  /** For multi-pass shader patterns: render target definitions */
  renderTargetDefs?: Record<string, {
    width: number
    height: number
    type?: string
    filter?: string
    wrap?: string
    pingPong?: boolean
  }>
  /** For multi-pass shader patterns: initialization source (function body returning data per target) */
  initSource?: string
}

const PARAM_COL_WIDTH = 220
const PARAM_ROW_HEIGHT = 100
const MAX_PARAMS_PER_COL = 12

function paramTypeToNodeType(type: ParamSchemaDef['type']): string {
  switch (type) {
    case 'float': return 'float'
    case 'int': return 'int'
    case 'bool': return 'bool'
    case 'enum': return 'enum'
    default: return 'float'
  }
}

function paramDefaultToNumber(def: ParamSchemaDef): number {
  if (def.type === 'bool') return def.default ? 1 : 0
  if (def.type === 'enum') return 0 // index
  return (def.default as number) ?? 0
}

/**
 * Build a complete UserPatternGraph from a compound generator definition.
 * Auto-generates param_input nodes, the generator node, output node(s), and all edges.
 */
export function buildGraphFromGenerator(def: CompoundGeneratorDef): UserPatternGraph {
  const nodes: Node[] = []
  const edges: Edge[] = []

  // 1. Create param_input nodes in columns
  const numCols = Math.ceil(def.params.length / MAX_PARAMS_PER_COL)
  def.params.forEach((param, i) => {
    const col = Math.floor(i / MAX_PARAMS_PER_COL)
    const row = i % MAX_PARAMS_PER_COL
    const x = col * PARAM_COL_WIDTH
    const y = row * PARAM_ROW_HEIGHT

    const nodeId = `p_${param.name}`
    const data: Record<string, unknown> = {
      paramName: param.name,
      paramType: paramTypeToNodeType(param.type),
      defaultValue: paramDefaultToNumber(param),
      min: param.min ?? 0,
      max: param.max ?? 1,
    }
    if (param.type === 'enum' && param.enumValues) {
      data.enumValues = param.enumValues.join(',')
    }

    nodes.push({
      id: nodeId,
      type: 'param_input',
      position: { x, y },
      data,
    })
  })

  // 2. Create GLSL shader nodes (positioned above param columns)
  const shaderInputs: PortDef[] = []
  const SHADER_COL_X = -300 // Left of param columns
  let shaderNodeY = 0
  const SHADER_NODE_SPACING = 120

  if (def.fragmentShader) {
    // Single-pass: one fragment shader node
    const nodeId = 'shader_frag'
    nodes.push({
      id: nodeId,
      type: 'glsl_fragment',
      position: { x: SHADER_COL_X, y: shaderNodeY },
      data: { code: def.fragmentShader },
    })
    shaderInputs.push({ name: 'fragmentShader', type: 'string' as const })
    shaderNodeY += SHADER_NODE_SPACING
  }
  if (def.vertexShader && !def.shaderSources) {
    // Single-pass vertex shader
    const nodeId = 'shader_vert'
    nodes.push({
      id: nodeId,
      type: 'glsl_vertex',
      position: { x: SHADER_COL_X, y: shaderNodeY },
      data: { code: def.vertexShader },
    })
    shaderInputs.push({ name: 'vertexShader', type: 'string' as const })
    shaderNodeY += SHADER_NODE_SPACING
  }
  if (def.shaderSources) {
    // Multi-pass: one node per shader source
    for (const [name, code] of Object.entries(def.shaderSources)) {
      const isVertex = name.toLowerCase().includes('vert')
      const nodeId = `shader_${name}`
      nodes.push({
        id: nodeId,
        type: isVertex ? 'glsl_vertex' : 'glsl_fragment',
        position: { x: SHADER_COL_X, y: shaderNodeY },
        data: { code },
      })
      const inputName = `${name}Shader`
      shaderInputs.push({ name: inputName, type: 'string' as const })
      shaderNodeY += SHADER_NODE_SPACING
    }
  }

  // 2b. Create the compound generator node
  const genX = numCols * PARAM_COL_WIDTH + 100
  const genY = Math.min(def.params.length, MAX_PARAMS_PER_COL) * PARAM_ROW_HEIGHT / 2 - 50
  const genNodeId = 'generator'

  const genData: Record<string, unknown> = {}

  nodes.push({
    id: genNodeId,
    type: def.generatorType,
    position: { x: genX, y: genY },
    data: genData,
  })

  // 3. Create output node(s)
  const outX = genX + 350
  const outY = genY

  if (def.outputMode === 'line' || def.outputMode === 'line_and_points') {
    nodes.push({
      id: 'lineOut',
      type: 'line_output',
      position: { x: outX, y: outY },
      data: {},
    })
  }
  if (def.outputMode === 'lineSegments' || def.outputMode === 'lineSegments_and_points') {
    nodes.push({
      id: 'lineSegOut',
      type: 'lineSegments_output',
      position: { x: outX, y: outY },
      data: {},
    })
  }
  if (def.outputMode === 'points' || def.outputMode === 'line_and_points' || def.outputMode === 'lineSegments_and_points') {
    const needsOffset = def.outputMode === 'line_and_points' || def.outputMode === 'lineSegments_and_points'
    nodes.push({
      id: 'pointsOut',
      type: 'points_output',
      position: { x: outX, y: outY + (needsOffset ? 200 : 0) },
      data: {},
    })
  }
  if (def.outputMode === 'mesh') {
    nodes.push({
      id: 'meshOut',
      type: 'mesh_output',
      position: { x: outX, y: outY },
      data: {},
    })
  }
  if (def.outputMode === 'shader') {
    nodes.push({
      id: 'shaderOut',
      type: 'shader_output',
      position: { x: outX, y: outY },
      data: {},
    })
  }

  // 4. Wire param_input → generator
  let edgeIdx = 0
  for (const param of def.params) {
    const paramNodeId = `p_${param.name}`
    // Only wire if the generator has a matching input
    if (def.inputs.some((inp) => inp.name === param.name)) {
      edges.push({
        id: `e${++edgeIdx}`,
        source: paramNodeId,
        sourceHandle: 'value',
        target: genNodeId,
        targetHandle: param.name,
      })
    }
  }

  // 4b. Wire shader nodes → generator
  if (def.fragmentShader) {
    edges.push({
      id: `e${++edgeIdx}`,
      source: 'shader_frag',
      sourceHandle: 'code',
      target: genNodeId,
      targetHandle: 'fragmentShader',
    })
  }
  if (def.vertexShader && !def.shaderSources) {
    edges.push({
      id: `e${++edgeIdx}`,
      source: 'shader_vert',
      sourceHandle: 'code',
      target: genNodeId,
      targetHandle: 'vertexShader',
    })
  }
  if (def.shaderSources) {
    for (const name of Object.keys(def.shaderSources)) {
      const inputName = `${name}Shader`
      edges.push({
        id: `e${++edgeIdx}`,
        source: `shader_${name}`,
        sourceHandle: 'code',
        target: genNodeId,
        targetHandle: inputName,
      })
    }
  }

  // 5. Wire generator → output
  if (def.outputMode === 'shader') {
    // Shader mode: single wire from generator's shaderConfig output to shader_output's shaderConfig input
    edges.push({
      id: `e${++edgeIdx}`,
      source: genNodeId,
      sourceHandle: 'shaderConfig',
      target: 'shaderOut',
      targetHandle: 'shaderConfig',
    })
  } else {
    for (const output of def.outputs) {
      const targetNodeId =
        def.outputMode === 'mesh' ? 'meshOut' :
        def.outputMode === 'points' ? 'pointsOut' :
        (def.outputMode === 'lineSegments' || def.outputMode === 'lineSegments_and_points') ? 'lineSegOut' : 'lineOut'

      // Map generator outputs to output node inputs
      if (['positions', 'colors', 'drawCount', 'opacity', 'thickness', 'pointSize', 'indices', 'normals', 'wireframe'].includes(output.name)) {
        edges.push({
          id: `e${++edgeIdx}`,
          source: genNodeId,
          sourceHandle: output.name,
          target: targetNodeId,
          targetHandle: output.name,
        })
      }
    }
  }

  // If line_and_points or lineSegments_and_points, also wire to points output
  if (def.outputMode === 'line_and_points' || def.outputMode === 'lineSegments_and_points') {
    // Check if generator has dedicated point* outputs (pointPositions→positions, etc.)
    const pointOutputMap: Record<string, string> = {
      pointPositions: 'positions',
      pointColors: 'colors',
      pointDrawCount: 'drawCount',
      pointSize: 'pointSize',
      pointOpacity: 'opacity',
    }
    let hasDedicatedPointOutputs = false
    for (const output of def.outputs) {
      if (output.name in pointOutputMap) {
        hasDedicatedPointOutputs = true
        edges.push({
          id: `e${++edgeIdx}`,
          source: genNodeId,
          sourceHandle: output.name,
          target: 'pointsOut',
          targetHandle: pointOutputMap[output.name],
        })
      }
    }
    // Fallback: wire same positions/colors/drawCount to points output
    if (!hasDedicatedPointOutputs) {
      for (const output of def.outputs) {
        if (['positions', 'colors', 'drawCount'].includes(output.name)) {
          edges.push({
            id: `e${++edgeIdx}`,
            source: genNodeId,
            sourceHandle: output.name,
            target: 'pointsOut',
            targetHandle: output.name,
          })
        }
      }
    }
  }

  // Build the serialized node def for this compound generator
  // Include shader code inputs alongside parameter inputs
  const allInputs = [...def.inputs, ...shaderInputs]
  const customNodeDef: SerializedNodeDef = {
    type: def.generatorType,
    label: def.name,
    category: def.category ?? 'generator',
    inputs: allInputs,
    outputs: def.outputs,
    evaluateSource: def.evaluateSource,
  }

  // Build defaultParams and parameterSchema
  const defaultParams: Record<string, unknown> = {}
  const parameterSchema: ParamSchemaDef[] = []
  for (const p of def.params) {
    if (p.type === 'enum' && p.enumValues) {
      defaultParams[p.name] = p.default ?? p.enumValues[0]
    } else if (p.type === 'bool') {
      defaultParams[p.name] = !!p.default
    } else {
      defaultParams[p.name] = p.default
    }
    parameterSchema.push({ ...p })
  }

  return {
    id: def.id,
    name: def.name,
    description: def.description,
    nodes,
    edges,
    defaultParams,
    parameterSchema,
    defaultCameraDistance: def.defaultCameraDistance,
    readOnly: true,
    builtinVersion: 1,
    customNodeDefs: [customNodeDef],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}
