import { useMemo, useEffect } from 'react'
import NodePatternRenderer from '../components/NodeEditor/NodePatternRenderer'
import { loadUserPatterns } from '../nodes/storage'
import { registerNodeDef, compileEvaluate, type PatternNodeDef } from '../nodes/types'

interface Props {
  params: Record<string, unknown>
}

export default function UserPattern({ params }: Props) {
  const graphId = (params.__graphId as string) ?? ''

  const graph = useMemo(() => {
    const patterns = loadUserPatterns()
    return patterns.find((p) => p.id === graphId)
  }, [graphId])

  // Register any custom node definitions bundled with this graph
  useEffect(() => {
    if (!graph?.customNodeDefs) return
    for (const cnd of graph.customNodeDefs) {
      // Skip if evaluateSource is empty — the node uses a static definition already registered
      if (!cnd.evaluateSource) continue
      const def: PatternNodeDef = {
        type: cnd.type,
        label: cnd.label,
        category: cnd.category,
        inputs: cnd.inputs,
        outputs: cnd.outputs,
        dataFields: cnd.dataFields,
        evaluate: compileEvaluate(cnd.evaluateSource),
        evaluateSource: cnd.evaluateSource,
      }
      registerNodeDef(def)
    }
  }, [graph])

  if (!graph) return null

  const layerIndex = typeof params.__layerIndex === 'number' ? params.__layerIndex : undefined

  return (
    <NodePatternRenderer
      nodes={graph.nodes}
      edges={graph.edges}
      params={params}
      renderOrder={layerIndex !== undefined ? 1000 + layerIndex : undefined}
      layerOpacity={typeof params.__opacity === 'number' ? params.__opacity : 1}
      layerBlendMode={typeof params.__blendMode === 'string' ? params.__blendMode : 'normal'}
    />
  )
}
