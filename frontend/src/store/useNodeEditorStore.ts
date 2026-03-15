import { create } from 'zustand'
import type { Node, Edge } from '@xyflow/react'
import { saveUserPattern, generatePatternId, loadUserPatterns, type UserPatternGraph, type ParamSchemaDef, type SerializedNodeDef } from '../nodes/storage'

interface NodeEditorState {
  graphId: string | null
  graphName: string
  nodes: Node[]
  edges: Edge[]
  isDirty: boolean
  readOnly: boolean
  customNodeDefs?: SerializedNodeDef[]

  setGraph: (graph: UserPatternGraph) => void
  newGraph: () => void
  setNodes: (nodes: Node[]) => void
  setEdges: (edges: Edge[]) => void
  updateNodeData: (nodeId: string, field: string, value: unknown) => void
  setGraphName: (name: string) => void
  save: () => UserPatternGraph
  loadExample: () => void
}

const useNodeEditorStore = create<NodeEditorState>((set, get) => ({
  graphId: null,
  graphName: 'Untitled Pattern',
  nodes: [],
  edges: [],
  isDirty: false,
  readOnly: false,
  customNodeDefs: undefined,

  setGraph: (graph) => set({
    graphId: graph.id,
    graphName: graph.name,
    nodes: graph.nodes,
    edges: graph.edges,
    isDirty: false,
    readOnly: graph.readOnly ?? false,
    customNodeDefs: graph.customNodeDefs,
  }),

  newGraph: () => set({
    graphId: generatePatternId(),
    graphName: 'Untitled Pattern',
    nodes: [
      {
        id: 'output_1',
        type: 'line_output',
        position: { x: 600, y: 200 },
        data: {},
      },
    ],
    edges: [],
    isDirty: false,
    readOnly: false,
    customNodeDefs: undefined,
  }),

  setNodes: (nodes) => set({ nodes, isDirty: true }),
  setEdges: (edges) => set({ edges, isDirty: true }),

  updateNodeData: (nodeId, field, value) => set((state) => ({
    nodes: state.nodes.map((n) =>
      n.id === nodeId ? { ...n, data: { ...n.data, [field]: value } } : n
    ),
    isDirty: true,
  })),

  setGraphName: (name) => set({ graphName: name, isDirty: true }),

  save: () => {
    const state = get()
    if (state.readOnly) return {} as UserPatternGraph // safety: shouldn't be called for readOnly

    const graph: UserPatternGraph = {
      id: state.graphId ?? generatePatternId(),
      name: state.graphName,
      description: '',
      nodes: state.nodes,
      edges: state.edges,
      defaultParams: {},
      defaultCameraDistance: 22,
      customNodeDefs: state.customNodeDefs,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // Collect param_input nodes to build defaultParams and schema
    const schema: ParamSchemaDef[] = []
    for (const node of state.nodes) {
      if (node.type === 'param_input') {
        const d = node.data as Record<string, unknown>
        const name = (d.paramName as string) ?? 'myParam'
        const paramType = (d.paramType as string) ?? 'float'
        const defaultValue = (d.defaultValue as number) ?? 0
        const min = (d.min as number) ?? 0
        const max = (d.max as number) ?? 1

        if (paramType === 'enum') {
          const enumStr = (d.enumValues as string) ?? ''
          const enumVals = enumStr.split(',').map((s: string) => s.trim()).filter(Boolean)
          const defaultEnum = enumVals[defaultValue] ?? enumVals[0] ?? ''
          graph.defaultParams[name] = defaultEnum
          schema.push({ name, type: 'enum', default: defaultEnum, description: name, enumValues: enumVals })
        } else if (paramType === 'bool') {
          graph.defaultParams[name] = !!defaultValue
          schema.push({ name, type: 'bool', default: !!defaultValue, description: name })
        } else {
          graph.defaultParams[name] = defaultValue
          schema.push({ name, type: paramType as 'float' | 'int', min, max, default: defaultValue, description: name })
        }
      }
    }
    graph.parameterSchema = schema

    saveUserPattern(graph)
    set({ graphId: graph.id, isDirty: false })
    return graph
  },

  loadExample: () => {
    const patterns = loadUserPatterns()
    if (patterns.length > 0) {
      const first = patterns[0]
      set({
        graphId: first.id,
        graphName: first.name,
        nodes: [...first.nodes],
        edges: [...first.edges],
        isDirty: false,
        readOnly: first.readOnly ?? false,
        customNodeDefs: first.customNodeDefs,
      })
    }
  },
}))

export default useNodeEditorStore
