import { useState } from 'react'
import useStore from '../store/useStore'
import * as api from '../api/client'
import type { Scene } from '../types/genome'

export default function EvolutionGrid() {
  const currentScene = useStore((s) => s.currentScene)
  const setScene = useStore((s) => s.setScene)
  const authToken = useStore((s) => s.authToken)

  const [mutationStrength, setMutationStrength] = useState(0.5)
  const [candidates, setCandidates] = useState<Scene[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showGrid, setShowGrid] = useState(false)
  const [loading, setLoading] = useState(false)

  if (!currentScene) return null

  const handleMutate = async () => {
    if (!currentScene.id || !authToken) return
    setLoading(true)
    try {
      const mutated = await api.mutateScene(currentScene.id, mutationStrength)
      setScene(mutated)
    } catch (err) {
      console.error('Mutation failed:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateCandidates = async () => {
    if (!currentScene.id || !authToken) return
    setLoading(true)
    try {
      const result = await api.generateCandidates(
        currentScene.id,
        6,
        'mix',
      )
      setCandidates(result.candidates)
      setSessionId(result.session.id)
      setSelectedIds(new Set())
      setShowGrid(true)
    } catch (err) {
      console.error('Generate candidates failed:', err)
    } finally {
      setLoading(false)
    }
  }

  const toggleCandidate = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleSelectFavorites = async () => {
    if (!sessionId) return
    try {
      await api.selectFavorites(sessionId, Array.from(selectedIds))
      // Load the first selected as current
      if (selectedIds.size > 0) {
        const firstId = Array.from(selectedIds)[0]
        const scene = await api.getScene(firstId)
        setScene(scene)
      }
      setShowGrid(false)
      setCandidates([])
    } catch (err) {
      console.error('Select favorites failed:', err)
    }
  }

  return (
    <>
      {/* Bottom bar */}
      <div className="glass-panel absolute bottom-3 left-1/2 -translate-x-1/2 rounded-lg px-4 py-2 flex items-center gap-4 z-40">
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
          disabled={loading || !authToken || !currentScene.id}
          className="text-xs px-3 py-1 rounded bg-fuchsia-500/20 text-fuchsia-400 hover:bg-fuchsia-500/30 transition-colors disabled:opacity-40"
        >
          Mutate
        </button>

        <button
          onClick={handleGenerateCandidates}
          disabled={loading || !authToken || !currentScene.id}
          className="text-xs px-3 py-1 rounded bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors disabled:opacity-40"
        >
          Evolve (6)
        </button>
      </div>

      {/* Candidate grid overlay */}
      {showGrid && candidates.length > 0 && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100]">
          <div className="glass-panel-solid rounded-lg p-6 max-w-2xl w-full">
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
                  className={`p-3 rounded-lg border text-left transition-all ${
                    selectedIds.has(c.id)
                      ? 'border-cyan-400/50 bg-cyan-500/10'
                      : 'border-white/10 bg-white/5 hover:border-white/20'
                  }`}
                >
                  <div className="text-xs text-gray-300 truncate mb-1">
                    {c.name}
                  </div>
                  <div className="text-[10px] text-gray-500">
                    {c.genome.layers.length} layer
                    {c.genome.layers.length !== 1 ? 's' : ''} | Gen{' '}
                    {c.lineage.generation}
                  </div>
                  <div className="text-[10px] text-gray-600 mt-1">
                    {c.genome.layers.map((l) => l.patternType).join(', ')}
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
                  onClick={handleSelectFavorites}
                  disabled={selectedIds.size === 0}
                  className="text-xs px-3 py-1.5 rounded bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors disabled:opacity-40"
                >
                  Select Favorites
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
