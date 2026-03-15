import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type OnConnect,
  type OnSelectionChangeFunc,
  BackgroundVariant,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Canvas as R3FCanvas } from '@react-three/fiber'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import { useNavigate, useParams } from 'react-router-dom'

import PatternNode from './PatternNode'
import NodePalette from './NodePalette'
import NodePatternRenderer from './NodePatternRenderer'
import CodeEditor from './CodeEditor'
import useNodeEditorStore from '../../store/useNodeEditorStore'
import { InteractionContext } from '../../systems/InteractionManager'
import { loadUserPatterns, generatePatternId, saveUserPattern, type UserPatternGraph } from '../../nodes/storage'
import { NODE_DEF_MAP, registerNodeDef, compileEvaluate } from '../../nodes/types'
import { HexColorPicker } from 'react-colorful'

const nodeTypes = Object.fromEntries(
  Object.keys(NODE_DEF_MAP).map((type) => [type, PatternNode]),
)

// ── Types for the preview parameter panel ──
interface ParamInfo {
  name: string
  type: 'float' | 'int' | 'bool' | 'enum' | 'color'
  default: number | string | boolean
  min: number
  max: number
  enumValues: string[]
}

function extractParamInfoFromNodes(nodes: any[]): ParamInfo[] {
  return nodes
    .filter((n) => n.type === 'param_input')
    .map((n) => {
      const d = n.data as Record<string, unknown>
      const paramType = (d.paramType as string) ?? 'float'
      const enumStr = (d.enumValues as string) ?? ''
      return {
        name: (d.paramName as string) ?? 'param',
        type: paramType as ParamInfo['type'],
        default: paramType === 'enum'
          ? enumStr.split(',').map((s) => s.trim()).filter(Boolean)[0] ?? ''
          : paramType === 'bool'
            ? ((d.defaultValue as number) ?? 0) > 0.5
            : (d.defaultValue as number) ?? 0,
        min: (d.min as number) ?? 0,
        max: (d.max as number) ?? 1,
        enumValues: enumStr.split(',').map((s) => s.trim()).filter(Boolean),
      }
    })
}

function randomHexColor(): string {
  return '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')
}

function PreviewParamPanel({
  params,
  paramInfos,
  lockedParams,
  onParamChange,
  onToggleLock,
  onShuffle,
}: {
  params: Record<string, unknown>
  paramInfos: ParamInfo[]
  lockedParams: Record<string, boolean>
  onParamChange: (name: string, value: unknown) => void
  onToggleLock: (name: string) => void
  onShuffle: () => void
}) {
  const [activeColorPicker, setActiveColorPicker] = useState<string | null>(null)

  if (paramInfos.length === 0) return null

  return (
    <div className="absolute top-8 right-2 w-52 z-10 max-h-[calc(100%-48px)] overflow-y-auto rounded-lg"
      style={{ background: 'rgba(10,10,24,0.92)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-white/5">
        <span className="text-[9px] uppercase tracking-wider text-gray-500 font-medium">Parameters</span>
        <button
          onClick={onShuffle}
          className="px-2 py-0.5 text-[9px] font-medium text-cyan-400 bg-cyan-400/10 rounded hover:bg-cyan-400/20 transition-colors"
        >
          Shuffle
        </button>
      </div>
      <div className="px-2 py-1.5">
        {paramInfos.map((p) => {
          const val = params[p.name] ?? p.default
          const isLocked = !!lockedParams[p.name]
          const lockBtn = (
            <button
              onClick={() => onToggleLock(p.name)}
              className={`w-3.5 h-3.5 flex-shrink-0 text-[8px] leading-none flex items-center justify-center rounded transition-all ${
                isLocked ? 'text-cyan-400 opacity-100' : 'text-gray-500 opacity-40 hover:opacity-80'
              }`}
              title={isLocked ? 'Unlock' : 'Lock'}
            >
              {isLocked ? '\uD83D\uDD12' : '\uD83D\uDD13'}
            </button>
          )

          if (p.type === 'float' || p.type === 'int') {
            const numVal = typeof val === 'number' ? val : Number(p.default)
            const step = p.type === 'int' ? 1 : (p.max - p.min) / 200
            return (
              <div key={p.name} className={`mb-2 ${isLocked ? 'opacity-40' : ''}`}>
                <div className="flex items-center justify-between mb-0.5">
                  <div className="flex items-center gap-0.5">
                    {lockBtn}
                    <span className="text-[10px] text-gray-400">{p.name}</span>
                  </div>
                  <span className="text-[9px] text-gray-500 font-mono">
                    {p.type === 'int' ? Math.round(numVal) : numVal.toFixed(3)}
                  </span>
                </div>
                <input
                  type="range"
                  min={p.min}
                  max={p.max}
                  step={step}
                  value={numVal}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    const v = parseFloat(e.target.value)
                    onParamChange(p.name, p.type === 'int' ? Math.round(v) : v)
                  }}
                  className="w-full"
                />
              </div>
            )
          }

          if (p.type === 'bool') {
            const boolVal = typeof val === 'boolean' ? val : Boolean(p.default)
            return (
              <div key={p.name} className={`mb-2 flex items-center justify-between ${isLocked ? 'opacity-40' : ''}`}>
                <div className="flex items-center gap-0.5">
                  {lockBtn}
                  <span className="text-[10px] text-gray-400">{p.name}</span>
                </div>
                <button
                  onClick={() => onParamChange(p.name, !boolVal)}
                  className={`w-7 h-3.5 rounded-full transition-colors relative ${boolVal ? 'bg-cyan-500/40' : 'bg-white/10'}`}
                >
                  <div className={`absolute top-0.5 w-2.5 h-2.5 rounded-full transition-all ${boolVal ? 'left-3.5 bg-cyan-400' : 'left-0.5 bg-gray-500'}`} />
                </button>
              </div>
            )
          }

          if (p.type === 'enum') {
            const strVal = typeof val === 'string' ? val : String(p.default)
            return (
              <div key={p.name} className={`mb-2 ${isLocked ? 'opacity-40' : ''}`}>
                <div className="flex items-center gap-0.5 mb-0.5">
                  {lockBtn}
                  <span className="text-[10px] text-gray-400">{p.name}</span>
                </div>
                <select
                  value={strVal}
                  onChange={(e) => onParamChange(p.name, e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded px-1.5 py-0.5 text-[10px] text-gray-300 outline-none focus:border-cyan-400/30"
                >
                  {p.enumValues.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            )
          }

          if (p.type === 'color') {
            const colorVal = typeof val === 'string' ? val : '#ffffff'
            const isActive = activeColorPicker === p.name
            return (
              <div key={p.name} className={`mb-2 relative ${isLocked ? 'opacity-40' : ''}`}>
                <div className="flex items-center gap-0.5 mb-0.5">
                  {lockBtn}
                  <span className="text-[10px] text-gray-400">{p.name}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setActiveColorPicker(isActive ? null : p.name)}
                    className="w-5 h-5 rounded border border-white/10"
                    style={{ backgroundColor: colorVal }}
                  />
                  <span className="text-[9px] text-gray-500 font-mono">{colorVal}</span>
                </div>
                {isActive && (
                  <div className="absolute z-50 mt-1 left-0">
                    <div className="fixed inset-0" onClick={() => setActiveColorPicker(null)} />
                    <div className="relative z-10">
                      <HexColorPicker color={colorVal} onChange={(c) => onParamChange(p.name, c)} />
                    </div>
                  </div>
                )}
              </div>
            )
          }

          return null
        })}
      </div>
    </div>
  )
}

function PreviewCanvas({ nodes, edges, params }: { nodes: any[]; edges: any[]; params: Record<string, unknown> }) {
  const mouseRef = useRef({ x: 0, y: 0 })
  const velRef = useRef({ x: 0, y: 0 })
  const [interaction, setInteraction] = useState({
    mouse: { x: 0, y: 0 },
    mouseVelocity: { x: 0, y: 0 },
    scrollY: 0,
  })

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1
    const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1
    const vx = nx - mouseRef.current.x
    const vy = ny - mouseRef.current.y
    mouseRef.current = { x: nx, y: ny }
    velRef.current = { x: vx, y: vy }
    setInteraction({ mouse: { x: nx, y: ny }, mouseVelocity: { x: vx, y: vy }, scrollY: 0 })
  }, [])

  return (
    <InteractionContext.Provider value={interaction}>
      <R3FCanvas
        camera={{ position: [0, 0, 22], fov: 60, near: 0.1, far: 10000 }}
        gl={{
          antialias: true,
          toneMapping: THREE.NoToneMapping,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
        style={{ background: '#0a0a0f' }}
        onPointerMove={handlePointerMove}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} />
        <NodePatternRenderer nodes={nodes} edges={edges} params={params} />
        <EffectComposer>
          <Bloom intensity={1.0} luminanceThreshold={0.2} luminanceSmoothing={0.4} mipmapBlur />
        </EffectComposer>
      </R3FCanvas>
    </InteractionContext.Provider>
  )
}

export default function NodeEditor() {
  const { id: paramId } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const store = useNodeEditorStore()

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [palettePos, setPalettePos] = useState<{ x: number; y: number } | null>(null)
  const [loadMenuOpen, setLoadMenuOpen] = useState(false)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [showCodeInspector, setShowCodeInspector] = useState(false)
  const [previewParams, setPreviewParams] = useState<Record<string, unknown>>({})
  const [previewLockedParams, setPreviewLockedParams] = useState<Record<string, boolean>>({})
  const flowRef = useRef<any>(null)
  const syncingFromStore = useRef(false)

  const isReadOnly = store.readOnly

  const onSelectionChange: OnSelectionChangeFunc = useCallback(({ nodes: sel }) => {
    setSelectedNodeId(sel.length === 1 ? sel[0].id : null)
  }, [])

  const selectedNodeDef = useMemo(() => {
    if (!selectedNodeId) return null
    const node = nodes.find((n) => n.id === selectedNodeId)
    if (!node?.type) return null
    return NODE_DEF_MAP[node.type] ?? null
  }, [selectedNodeId, nodes])

  // Detect if the selected node is a GLSL shader node
  const selectedNodeIsShader = useMemo(() => {
    if (!selectedNodeId) return false
    const node = nodes.find((n) => n.id === selectedNodeId)
    return node?.type === 'glsl_fragment' || node?.type === 'glsl_vertex'
  }, [selectedNodeId, nodes])

  // Get the code string for the selected node
  const selectedNodeCode = useMemo(() => {
    if (!selectedNodeDef) return ''
    if (selectedNodeId) {
      const node = nodes.find((n) => n.id === selectedNodeId)
      const nodeData = node?.data as Record<string, unknown>
      // For GLSL shader nodes, show the shader code from data.code
      if (node?.type === 'glsl_fragment' || node?.type === 'glsl_vertex') {
        return (nodeData?.code as string) ?? ''
      }
      // Check for dynamic evaluateSource on the node data first
      const src = nodeData?.__evaluateSource
      if (typeof src === 'string') return src
    }
    // Fall back to the def's evaluateSource or toString()
    if (selectedNodeDef.evaluateSource) return selectedNodeDef.evaluateSource
    return selectedNodeDef.evaluate.toString()
  }, [selectedNodeDef, selectedNodeId, nodes])

  // Initialize graph on mount / when paramId changes
  useEffect(() => {
    let graphToLoad: UserPatternGraph | undefined

    if (paramId) {
      const patterns = loadUserPatterns()
      graphToLoad = patterns.find((p) => p.id === paramId)
    }

    if (graphToLoad) {
      // Register any custom node definitions bundled with this graph
      if (graphToLoad.customNodeDefs) {
        for (const cnd of graphToLoad.customNodeDefs) {
          if (!cnd.evaluateSource) continue
          registerNodeDef({
            type: cnd.type,
            label: cnd.label,
            category: cnd.category,
            inputs: cnd.inputs,
            outputs: cnd.outputs,
            dataFields: cnd.dataFields,
            evaluate: compileEvaluate(cnd.evaluateSource),
            evaluateSource: cnd.evaluateSource,
          })
        }
      }
      store.setGraph(graphToLoad)
      // Reset preview params to graph defaults
      setPreviewParams(graphToLoad.defaultParams ? { ...graphToLoad.defaultParams } : {})
      setPreviewLockedParams({})
    } else {
      store.loadExample()
      setPreviewParams({})
      setPreviewLockedParams({})
    }

    syncingFromStore.current = true
    const s = useNodeEditorStore.getState()
    setNodes(s.nodes)
    setEdges(s.edges)
    syncingFromStore.current = false
  }, [paramId])

  // Sync local state back to store (skip when we're pushing from store)
  useEffect(() => {
    if (syncingFromStore.current) return
    store.setNodes(nodes)
  }, [nodes])

  useEffect(() => {
    if (syncingFromStore.current) return
    store.setEdges(edges)
  }, [edges])

  // Listen for node data changes from PatternNode inline controls
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.nodeId && detail?.field !== undefined) {
        setNodes((nds) =>
          nds.map((n) =>
            n.id === detail.nodeId
              ? { ...n, data: { ...n.data, [detail.field]: detail.value } }
              : n,
          ),
        )
      }
    }
    window.addEventListener('node-data-change', handler)
    return () => window.removeEventListener('node-data-change', handler)
  }, [setNodes])

  const onConnect: OnConnect = useCallback(
    (params: Connection) => {
      if (isReadOnly) return
      setEdges((eds) => addEdge(params, eds))
    },
    [setEdges, isReadOnly],
  )

  const handleAddNode = useCallback(
    (type: string, screenPos: { x: number; y: number }) => {
      if (isReadOnly) return
      const id = type + '_' + Date.now().toString(36)
      const def = NODE_DEF_MAP[type]
      const defaultData: Record<string, unknown> = {}
      if (def?.dataFields) {
        for (const f of def.dataFields) {
          defaultData[f.name] = f.default
        }
      }
      const newNode = {
        id,
        type,
        position: { x: screenPos.x - 100, y: screenPos.y - 100 },
        data: defaultData,
      }
      setNodes((nds) => [...nds, newNode])
    },
    [setNodes, isReadOnly],
  )

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    if (!isReadOnly) setPalettePos({ x: e.clientX, y: e.clientY })
  }, [isReadOnly])

  const handleSave = useCallback(() => {
    if (isReadOnly) return
    store.save()
    window.dispatchEvent(new CustomEvent('user-patterns-changed'))
  }, [store, isReadOnly])

  const handleBack = useCallback(() => {
    if (!isReadOnly && store.isDirty) {
      store.save()
      window.dispatchEvent(new CustomEvent('user-patterns-changed'))
    }
    navigate('/')
  }, [store, navigate, isReadOnly])

  const handleFork = useCallback(() => {
    const s = useNodeEditorStore.getState()
    const forked: UserPatternGraph = {
      id: generatePatternId(),
      name: `${s.graphName} (Fork)`,
      description: '',
      nodes: JSON.parse(JSON.stringify(s.nodes)),
      edges: JSON.parse(JSON.stringify(s.edges)),
      defaultParams: {},
      defaultCameraDistance: 22,
      readOnly: false,
      customNodeDefs: s.customNodeDefs ? [...s.customNodeDefs] : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    saveUserPattern(forked)
    window.dispatchEvent(new CustomEvent('user-patterns-changed'))
    store.setGraph(forked)
    syncingFromStore.current = true
    setNodes(forked.nodes)
    setEdges(forked.edges)
    syncingFromStore.current = false
    navigate(`/designer/${forked.id}`, { replace: true })
  }, [store, setNodes, setEdges, navigate])

  const handleLoadGraph = useCallback((graph: UserPatternGraph) => {
    store.setGraph(graph)
    setNodes(graph.nodes)
    setEdges(graph.edges)
    setLoadMenuOpen(false)
    navigate(`/designer/${graph.id}`, { replace: true })
  }, [store, setNodes, setEdges, navigate])

  const handleCodeChange = useCallback((newCode: string) => {
    if (isReadOnly || !selectedNodeId) return
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== selectedNodeId) return n
        // For GLSL shader nodes, update data.code instead of __evaluateSource
        if (n.type === 'glsl_fragment' || n.type === 'glsl_vertex') {
          return { ...n, data: { ...n.data, code: newCode } }
        }
        return { ...n, data: { ...n.data, __evaluateSource: newCode } }
      }),
    )
  }, [selectedNodeId, isReadOnly, setNodes])

  // Extract parameter info from param_input nodes for the preview panel
  const paramInfos = useMemo(() => extractParamInfoFromNodes(nodes), [nodes])

  // Initialize preview params from defaults when graph loads or param nodes change
  useEffect(() => {
    setPreviewParams((prev) => {
      const next = { ...prev }
      for (const p of paramInfos) {
        if (!(p.name in next)) {
          next[p.name] = p.default
        }
      }
      return next
    })
  }, [paramInfos])

  const handlePreviewParamChange = useCallback((name: string, value: unknown) => {
    setPreviewParams((prev) => ({ ...prev, [name]: value }))
  }, [])

  const handlePreviewToggleLock = useCallback((name: string) => {
    setPreviewLockedParams((prev) => ({ ...prev, [name]: !prev[name] }))
  }, [])

  const handlePreviewShuffle = useCallback(() => {
    setPreviewParams((prev) => {
      const next = { ...prev }
      for (const p of paramInfos) {
        if (previewLockedParams[p.name]) continue
        switch (p.type) {
          case 'float':
            next[p.name] = p.min + Math.random() * (p.max - p.min)
            break
          case 'int':
            next[p.name] = Math.round(p.min + Math.random() * (p.max - p.min))
            break
          case 'bool':
            next[p.name] = Math.random() < 0.5
            break
          case 'enum':
            if (p.enumValues.length > 0) {
              next[p.name] = p.enumValues[Math.floor(Math.random() * p.enumValues.length)]
            }
            break
          case 'color':
            next[p.name] = randomHexColor()
            break
        }
      }
      return next
    })
  }, [paramInfos, previewLockedParams])

  const savedPatterns = loadUserPatterns()

  return (
    <div className="w-full h-full flex flex-col bg-[#0a0a18]">
      {/* Top bar */}
      <div className="h-10 flex items-center px-3 gap-3 border-b border-white/10 bg-black/40 flex-shrink-0">
        <button
          onClick={handleBack}
          className="text-xs text-gray-400 hover:text-white transition-colors"
        >
          &larr; Back
        </button>
        <input
          type="text"
          value={store.graphName}
          onChange={(e) => !isReadOnly && store.setGraphName(e.target.value)}
          readOnly={isReadOnly}
          className="bg-transparent text-sm text-gray-200 outline-none border-b border-transparent focus:border-cyan-400/30 px-1"
        />
        {isReadOnly && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 uppercase tracking-wider font-medium">
            Read Only
          </span>
        )}
        <div className="flex-1" />

        {/* Load menu */}
        <div className="relative">
          <button
            onClick={() => setLoadMenuOpen(!loadMenuOpen)}
            className="px-2 py-1 text-[10px] font-medium text-gray-400 bg-white/5 rounded hover:bg-white/10 transition-colors"
          >
            Load
          </button>
          {loadMenuOpen && (
            <div className="absolute right-0 top-full mt-1 w-52 rounded-lg overflow-hidden shadow-2xl z-50"
              style={{ background: '#12122a', border: '1px solid rgba(255,255,255,0.1)' }}>
              {savedPatterns.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleLoadGraph(p)}
                  className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-white/5 transition-colors border-b border-white/5 flex items-center gap-2"
                >
                  {p.name}
                  {p.readOnly && <span className="text-[8px] text-amber-400/60">RO</span>}
                </button>
              ))}
              {savedPatterns.length === 0 && (
                <div className="px-3 py-3 text-xs text-gray-600 text-center">No saved patterns</div>
              )}
            </div>
          )}
        </div>

        {isReadOnly ? (
          <button
            onClick={handleFork}
            className="px-3 py-1 text-[10px] font-medium rounded transition-colors text-purple-400 bg-purple-500/15 hover:bg-purple-500/25"
          >
            Fork to Edit
          </button>
        ) : (
          <>
            <button
              onClick={handleSave}
              className={`px-3 py-1 text-[10px] font-medium rounded transition-colors ${
                store.isDirty
                  ? 'text-black bg-cyan-400 hover:bg-cyan-300'
                  : 'text-gray-500 bg-white/5'
              }`}
            >
              Save
            </button>
            <button
              onClick={() => {
                store.newGraph()
                const s = useNodeEditorStore.getState()
                setNodes(s.nodes)
                setEdges(s.edges)
              }}
              className="px-2 py-1 text-[10px] font-medium text-gray-400 bg-white/5 rounded hover:bg-white/10 transition-colors"
            >
              New
            </button>
          </>
        )}
      </div>

      {/* Main content: graph editor + preview */}
      <div className="flex-1 flex">
        {/* Graph editor */}
        <div className="flex-[3] relative" onContextMenu={handleContextMenu}>
          <ReactFlow
            ref={flowRef}
            nodes={nodes}
            edges={edges}
            onNodesChange={isReadOnly ? undefined : onNodesChange}
            onEdgesChange={isReadOnly ? undefined : onEdgesChange}
            onConnect={onConnect}
            onSelectionChange={onSelectionChange}
            nodeTypes={nodeTypes}
            nodesDraggable={!isReadOnly}
            nodesConnectable={!isReadOnly}
            elementsSelectable={true}
            fitView
            deleteKeyCode={isReadOnly ? [] : ['Delete', 'Backspace']}
            colorMode="dark"
            defaultEdgeOptions={{
              animated: true,
              style: { stroke: '#6366f1', strokeWidth: 2 },
            }}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#ffffff08" />
            <Controls
              showInteractive={false}
              style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)' }}
            />
            <MiniMap
              style={{ background: '#0a0a18', border: '1px solid rgba(255,255,255,0.1)' }}
              maskColor="rgba(0,0,0,0.6)"
              nodeColor="#6366f1"
            />
          </ReactFlow>

          {/* Top buttons */}
          <div className="absolute top-3 left-3 flex items-center gap-2 z-10">
            {!isReadOnly && (
              <button
                onClick={(e) => setPalettePos({ x: e.clientX, y: e.clientY })}
                className="px-3 py-1.5 text-xs font-medium text-cyan-400 bg-cyan-400/10 rounded-lg hover:bg-cyan-400/20 transition-colors"
              >
                + Add Node
              </button>
            )}
            {selectedNodeId && !isReadOnly && (
              <button
                onClick={() => {
                  setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId))
                  setEdges((eds) => eds.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId))
                  setSelectedNodeId(null)
                }}
                className="px-3 py-1.5 text-xs font-medium text-red-400 bg-red-500/10 rounded-lg hover:bg-red-500/20 transition-colors"
              >
                Delete Node
              </button>
            )}
            {selectedNodeDef && (
              <button
                onClick={() => setShowCodeInspector(!showCodeInspector)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  showCodeInspector
                    ? 'text-amber-400 bg-amber-500/20'
                    : 'text-gray-400 bg-white/5 hover:bg-white/10'
                }`}
              >
                {showCodeInspector ? 'Hide Code' : 'View Code'}
              </button>
            )}
          </div>

          {/* Code inspector with CodeMirror */}
          {showCodeInspector && selectedNodeDef && (
            <div className="absolute bottom-3 left-3 right-3 max-h-[40%] z-10 rounded-lg overflow-hidden"
              style={{ background: '#0d0d1a', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/10">
                <span className="text-[10px] uppercase tracking-wider text-gray-500">
                  {selectedNodeDef.label} — {selectedNodeIsShader ? 'GLSL' : 'evaluate()'}
                  {isReadOnly && <span className="ml-2 text-amber-400/60">(read only)</span>}
                </span>
                <button
                  onClick={() => setShowCodeInspector(false)}
                  className="text-[10px] text-gray-600 hover:text-gray-300 transition-colors"
                >
                  Close
                </button>
              </div>
              <CodeEditor
                code={selectedNodeCode}
                readOnly={isReadOnly}
                onChange={handleCodeChange}
                height="300px"
                language={selectedNodeIsShader ? 'glsl' : 'javascript'}
              />
            </div>
          )}

          {palettePos && !isReadOnly && (
            <NodePalette
              position={palettePos}
              onAdd={handleAddNode}
              onClose={() => setPalettePos(null)}
            />
          )}
        </div>

        {/* Live preview */}
        <div className="flex-[2] border-l border-white/10 relative">
          <div className="absolute top-2 left-2 text-[10px] text-gray-600 uppercase tracking-wider z-10">
            Live Preview
          </div>
          <PreviewParamPanel
            params={previewParams}
            paramInfos={paramInfos}
            lockedParams={previewLockedParams}
            onParamChange={handlePreviewParamChange}
            onToggleLock={handlePreviewToggleLock}
            onShuffle={handlePreviewShuffle}
          />
          <PreviewCanvas nodes={nodes} edges={edges} params={previewParams} />
        </div>
      </div>
    </div>
  )
}
