import { getNodeDef, compileEvaluate, type ExecutionContext } from './types'
import type { Node, Edge } from '@xyflow/react'

export interface ShaderPass {
  name: string
  vertexShader?: string
  fragmentShader: string
  uniforms: Record<string, unknown>
  target?: string | null
  readFrom?: Record<string, string>
  /** 'quad' (default) = fullscreen quad, 'deposit' = render points from agent texture with additive blending */
  mode?: 'quad' | 'deposit'
  /** For deposit mode: name of render target containing agent positions (RGBA = posX, posY, angle, speed) */
  agentTarget?: string
  /** For deposit mode: side length of agent texture (agents = agentRes^2) */
  agentRes?: number
  /** If true, render on top of the current target contents without clearing */
  noClear?: boolean
}

export interface RenderTargetDef {
  width: number
  height: number
  type?: string
  filter?: string
  wrap?: string
  pingPong?: boolean
}

export interface GraphOutputData {
  __output: true
  __mode: 'line' | 'lineSegments' | 'points' | 'mesh' | 'shader'
  positions: Float32Array
  colors: Float32Array
  opacity: number
  thickness?: number
  pointSize?: number
  drawCount: number
  // Mesh mode
  indices?: Uint32Array | null
  normals?: Float32Array | null
  wireframe?: boolean
  // Shader mode - single pass
  uniforms?: Record<string, unknown>
  vertexShader?: string
  fragmentShader?: string
  // Shader mode - multi pass
  passes?: ShaderPass[]
  renderTargetDefs?: Record<string, RenderTargetDef>
  stepsPerFrame?: number
  initData?: Record<string, Float32Array>
}

/**
 * Topological sort of nodes via DFS from output nodes backward.
 * Returns node IDs in execution order (dependencies first).
 */
export function topologicalSort(nodes: Node[], edges: Edge[]): string[] {
  const incomingEdges = new Map<string, Set<string>>()
  for (const node of nodes) incomingEdges.set(node.id, new Set())
  for (const edge of edges) {
    incomingEdges.get(edge.target)?.add(edge.source)
  }

  const sorted: string[] = []
  const visited = new Set<string>()
  const visiting = new Set<string>()

  function visit(id: string) {
    if (visited.has(id)) return
    if (visiting.has(id)) return
    visiting.add(id)
    const deps = incomingEdges.get(id)
    if (deps) {
      for (const dep of deps) visit(dep)
    }
    visiting.delete(id)
    visited.add(id)
    sorted.push(id)
  }

  for (const node of nodes) visit(node.id)
  return sorted
}

function buildEdgeMap(edges: Edge[]): Map<string, { sourceId: string; sourceHandle: string }> {
  const map = new Map<string, { sourceId: string; sourceHandle: string }>()
  for (const edge of edges) {
    const key = `${edge.target}.${edge.targetHandle}`
    map.set(key, {
      sourceId: edge.source,
      sourceHandle: edge.sourceHandle ?? 'value',
    })
  }
  return map
}

/**
 * Execute the graph for one frame. Returns output data from all output nodes.
 * Supports dynamic evaluate functions via node.data.__evaluateSource.
 */
export function executeGraph(
  nodes: Node[],
  edges: Edge[],
  sortedIds: string[],
  ctx: ExecutionContext,
): GraphOutputData[] {
  const edgeMap = buildEdgeMap(edges)
  const nodeMap = new Map<string, Node>()
  for (const node of nodes) nodeMap.set(node.id, node)

  const outputs = new Map<string, Record<string, unknown>>()
  const results: GraphOutputData[] = []

  for (const nodeId of sortedIds) {
    const node = nodeMap.get(nodeId)
    if (!node) continue
    const def = getNodeDef(node.type ?? '')
    if (!def) continue

    // Resolve inputs from connected edges or defaults
    const resolvedInputs: Record<string, unknown> = {}
    for (const inputDef of def.inputs) {
      const edgeKey = `${nodeId}.${inputDef.name}`
      const connection = edgeMap.get(edgeKey)
      if (connection) {
        const sourceOutputs = outputs.get(connection.sourceId)
        resolvedInputs[inputDef.name] = sourceOutputs?.[connection.sourceHandle] ?? inputDef.default ?? 0
      } else {
        const nodeData = (node.data ?? {}) as Record<string, unknown>
        resolvedInputs[inputDef.name] = nodeData[inputDef.name] ?? inputDef.default ?? 0
      }
    }

    // Determine evaluate function: dynamic source overrides static def
    const nodeData = (node.data ?? {}) as Record<string, unknown>
    let evaluateFn = def.evaluate
    if (typeof nodeData.__evaluateSource === 'string' && nodeData.__evaluateSource) {
      evaluateFn = compileEvaluate(nodeData.__evaluateSource)
    }

    const result = evaluateFn(resolvedInputs, nodeData, ctx, nodeId)
    outputs.set(nodeId, result)

    if (result.__output) {
      results.push(result as unknown as GraphOutputData)
    }
  }

  return results
}
