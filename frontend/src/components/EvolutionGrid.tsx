import { Suspense, useState, useRef } from 'react'
import { Canvas as R3FCanvas, useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import useStore from '../store/useStore'
import type { Genome, Layer } from '../types/genome'
import { getPatternComponent, getDefaultParams } from '../patterns/PatternRegistry'
import { mutateGenome, generateCandidates } from '../utils/mutateGenome'

/** Tiny live 3D preview of a genome's layers */
function MiniPreview({ genome }: { genome: Genome }) {
  const bg = genome.globalParams.backgroundColor ?? '#0a0a0f'
  const distance = genome.globalParams.cameraDistance ?? 500

  return (
    <R3FCanvas
      camera={{ position: [0, 0, distance], fov: 60, near: 0.1, far: 10000 }}
      gl={{
        antialias: false,
        toneMapping: THREE.NoToneMapping,
        outputColorSpace: THREE.SRGBColorSpace,
        powerPreference: 'low-power',
      }}
      frameloop="demand"
      style={{ background: bg }}
      resize={{ debounce: 0 }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} />
      {genome.layers.map((layer: Layer, idx: number) => {
        if (!layer.enabled) return null
        const PatternComponent = getPatternComponent(layer.patternType)
        if (!PatternComponent) return null
        const defaults = getDefaultParams(layer.patternType)
        const params = defaults.__graphId && !layer.params.__graphId
          ? { ...defaults, ...layer.params }
          : layer.params
        return (
          <group key={`${layer.patternType}-${idx}`} renderOrder={idx}>
            <Suspense fallback={null}>
              <PatternComponent params={{ ...params, __layerIndex: idx }} />
            </Suspense>
          </group>
        )
      })}
      <AutoRender />
    </R3FCanvas>
  )
}

/** Triggers a few renders then stops (frameloop="demand") */
function AutoRender() {
  const { invalidate } = useThree()
  const frameCount = useRef(0)
  useFrame(() => {
    if (frameCount.current < 10) {
      frameCount.current++
      invalidate()
    }
  })
  return null
}

interface Candidate {
  id: string
  genome: Genome
  mutationType: string
}

export default function EvolutionGrid() {
  const currentScene = useStore((s) => s.currentScene)
  const setScene = useStore((s) => s.setScene)

  const [mutationStrength, setMutationStrength] = useState(0.5)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showGrid, setShowGrid] = useState(false)

  if (!currentScene) return null

  const handleMutate = () => {
    const mutated = mutateGenome(currentScene.genome, mutationStrength)
    setScene({
      ...currentScene,
      genome: mutated,
      lineage: {
        ...currentScene.lineage,
        generation: currentScene.lineage.generation + 1,
        mutationType: 'mutation',
      },
    })
  }

  const handleGenerateCandidates = () => {
    const genomes = generateCandidates(currentScene.genome, 6, 'mix')
    const newCandidates: Candidate[] = genomes.map((g, i) => ({
      id: `candidate-${Date.now()}-${i}`,
      genome: g,
      mutationType: 'mix',
    }))
    setCandidates(newCandidates)
    setSelectedIds(new Set())
    setShowGrid(true)
  }

  const toggleCandidate = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSelectFavorite = () => {
    if (selectedIds.size === 0) return
    const firstId = Array.from(selectedIds)[0]
    const chosen = candidates.find((c) => c.id === firstId)
    if (chosen) {
      setScene({
        ...currentScene,
        genome: chosen.genome,
        lineage: {
          ...currentScene.lineage,
          generation: currentScene.lineage.generation + 1,
          mutationType: chosen.mutationType,
        },
      })
    }
    setShowGrid(false)
    setCandidates([])
  }

  return (
    <>
      {/* Bottom bar */}
      <div className="glass-panel absolute bottom-7 left-1/2 -translate-x-1/2 rounded-lg px-4 py-2 flex items-center gap-4 z-40">
        {/* Lineage info */}
        <div className="text-[10px] text-gray-500">
          Gen {currentScene.lineage.generation}
          {currentScene.lineage.parents.length > 0 && (
            <span>
              {' '}
              | {currentScene.lineage.mutationType || 'original'}
            </span>
          )}
        </div>

        <div className="h-4 w-px bg-white/10" />

        {/* Mutation strength */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500">Strength</span>
          <input
            type="range"
            min={0.05}
            max={1}
            step={0.05}
            value={mutationStrength}
            onChange={(e) => setMutationStrength(parseFloat(e.target.value))}
            className="w-20"
          />
          <span className="text-[10px] text-gray-500 font-mono w-6">
            {mutationStrength.toFixed(2)}
          </span>
        </div>

        <button
          onClick={handleMutate}
          className="text-xs px-3 py-1 rounded bg-fuchsia-500/20 text-fuchsia-400 hover:bg-fuchsia-500/30 transition-colors"
        >
          Mutate
        </button>

        <button
          onClick={handleGenerateCandidates}
          className="text-xs px-3 py-1 rounded bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors"
        >
          Evolve (6)
        </button>
      </div>

      {/* Candidate grid overlay */}
      {showGrid && candidates.length > 0 && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100]">
          <div className="glass-panel-solid rounded-lg p-6 max-w-3xl w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-200">
                Evolution Candidates
              </h3>
              <button
                onClick={() => setShowGrid(false)}
                className="text-gray-500 hover:text-gray-300"
              >
                {'\u2715'}
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              {candidates.map((c) => (
                <button
                  key={c.id}
                  onClick={() => toggleCandidate(c.id)}
                  className={`rounded-lg border overflow-hidden text-left transition-all ${
                    selectedIds.has(c.id)
                      ? 'border-cyan-400/50 bg-cyan-500/10 ring-1 ring-cyan-400/30'
                      : 'border-white/10 bg-white/5 hover:border-white/20'
                  }`}
                >
                  <div className="w-full aspect-square relative">
                    <MiniPreview genome={c.genome} />
                    {selectedIds.has(c.id) && (
                      <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-cyan-500 flex items-center justify-center text-white text-[10px] font-bold">
                        {'\u2713'}
                      </div>
                    )}
                  </div>
                  <div className="px-2 py-1.5">
                    <div className="text-[10px] text-gray-500">
                      {c.mutationType}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-500">
                {selectedIds.size} selected
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowGrid(false)}
                  className="text-xs px-3 py-1.5 rounded bg-white/5 text-gray-400 hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSelectFavorite}
                  disabled={selectedIds.size === 0}
                  className="text-xs px-3 py-1.5 rounded bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors disabled:opacity-40"
                >
                  Apply Selection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
