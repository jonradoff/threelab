import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import * as api from '../api/client'
import useStore from '../store/useStore'
import type { Scene } from '../types/genome'

type SortMode = 'newest' | 'rating' | 'popularity' | 'oldest'

export default function Gallery() {
  const [scenes, setScenes] = useState<Scene[]>([])
  const [total, setTotal] = useState(0)
  const [sort, setSort] = useState<SortMode>('newest')
  const [skip, setSkip] = useState(0)
  const [loading, setLoading] = useState(false)
  const setScene = useStore((s) => s.setScene)
  const navigate = useNavigate()

  const LIMIT = 24

  const fetchGallery = useCallback(async () => {
    setLoading(true)
    try {
      const result = await api.listGallery({ sort, limit: LIMIT, skip })
      setScenes(result.scenes)
      setTotal(result.total)
    } catch (err) {
      console.error('Gallery fetch failed:', err)
    } finally {
      setLoading(false)
    }
  }, [sort, skip])

  useEffect(() => {
    fetchGallery()
  }, [fetchGallery])

  const loadScene = async (id: string) => {
    try {
      const scene = await api.getScene(id)
      setScene(scene)
      navigate('/')
    } catch (err) {
      console.error('Failed to load scene:', err)
    }
  }

  const forkScene = async (scene: Scene) => {
    try {
      const forked = await api.createScene({
        name: scene.name + ' (fork)',
        genome: scene.genome,
        tags: scene.tags,
      })
      setScene(forked)
      navigate('/')
    } catch (err) {
      console.error('Fork failed:', err)
    }
  }

  const avgRating = (scene: Scene) => {
    const r = scene.ratings.human
    return r.count > 0 ? (r.sum / r.count).toFixed(1) : '-'
  }

  return (
    <div className="h-screen bg-[#0a0a0f] overflow-y-auto">
      {/* Header */}
      <div className="glass-panel sticky top-0 z-10 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-fuchsia-500 bg-clip-text text-transparent hover:opacity-80 transition-opacity"
          >
            Threelab
          </button>
          <span className="text-sm text-gray-400">Gallery</span>
        </div>

        <div className="flex gap-2">
          {(['newest', 'rating', 'popularity', 'oldest'] as SortMode[]).map(
            (s) => (
              <button
                key={s}
                onClick={() => {
                  setSort(s)
                  setSkip(0)
                }}
                className={`text-xs px-3 py-1 rounded transition-colors ${
                  sort === s
                    ? 'bg-cyan-500/20 text-cyan-400'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ),
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="p-6">
        {loading && scenes.length === 0 ? (
          <div className="text-center text-gray-500 py-20">Loading...</div>
        ) : scenes.length === 0 ? (
          <div className="text-center text-gray-500 py-20">
            <p className="text-lg mb-2">No scenes in the gallery yet</p>
            <button
              onClick={() => navigate('/')}
              className="text-cyan-400 hover:text-cyan-300 text-sm"
            >
              Create one
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {scenes.map((scene) => (
                <div
                  key={scene.id}
                  className="group rounded-lg overflow-hidden bg-white/5 border border-white/5 hover:border-cyan-400/20 transition-all"
                >
                  {/* Thumbnail */}
                  <button
                    onClick={() => loadScene(scene.id)}
                    className="w-full aspect-square bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center"
                  >
                    {scene.thumbnail ? (
                      <img
                        src={scene.thumbnail}
                        alt={scene.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-[10px] text-gray-600">
                        {scene.genome.layers
                          .map((l) => l.patternType)
                          .join(', ') || 'empty'}
                      </div>
                    )}
                  </button>

                  {/* Info */}
                  <div className="p-2">
                    <div className="text-xs text-gray-300 truncate mb-1">
                      {scene.name}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-500">
                        {'\u2605'} {avgRating(scene)}
                      </span>
                      <button
                        onClick={() => forkScene(scene)}
                        className="text-[10px] text-gray-600 hover:text-cyan-400 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        Fork
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {total > LIMIT && (
              <div className="flex items-center justify-center gap-3 mt-6">
                <button
                  onClick={() => setSkip(Math.max(0, skip - LIMIT))}
                  disabled={skip === 0}
                  className="text-xs text-gray-500 hover:text-gray-300 disabled:opacity-30"
                >
                  Previous
                </button>
                <span className="text-[10px] text-gray-600">
                  {skip + 1}-{Math.min(skip + LIMIT, total)} of {total}
                </span>
                <button
                  onClick={() => setSkip(skip + LIMIT)}
                  disabled={skip + LIMIT >= total}
                  className="text-xs text-gray-500 hover:text-gray-300 disabled:opacity-30"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
