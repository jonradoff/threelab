import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import { getDefaultCameraDistance, getDefaultParams, getPatternLabel } from '../patterns/PatternRegistry'
import * as api from '../api/client'
import ExportModal from './ExportModal'
import PatternManager from './PatternManager'

export default function TopBar() {
  const currentScene = useStore((s) => s.currentScene)
  const setScene = useStore((s) => s.setScene)
  const favorites = useStore((s) => s.favorites)
  const favoritesViewIndex = useStore((s) => s.favoritesViewIndex)
  const setFavoritesViewIndex = useStore((s) => s.setFavoritesViewIndex)
  const browseFavorites = useStore((s) => s.browseFavorites)
  const setBrowseFavorites = useStore((s) => s.setBrowseFavorites)
  const removeFavorite = useStore((s) => s.removeFavorite)
  const navigate = useNavigate()

  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState('')
  const [showExport, setShowExport] = useState(false)
  const [showPatterns, setShowPatterns] = useState(false)
  const [slideshowActive, setSlideshowActive] = useState(false)
  const [slideshowInterval, setSlideshowInterval] = useState(8)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [shareLoading, setShareLoading] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const slideshowTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  const loadFavorite = useCallback(
    (index: number) => {
      if (!currentScene || index < 0 || index >= favorites.length) return
      const fav = favorites[index]
      // Merge registry defaults (includes __graphId for migrated patterns)
      // so old favorites created before node-graph migration still work
      const registryDefaults = getDefaultParams(fav.patternType)
      const mergedParams = { ...registryDefaults, ...fav.params }
      setScene({
        ...currentScene,
        genome: {
          ...currentScene.genome,
          layers: [
            {
              patternType: fav.patternType,
              enabled: true,
              blendMode: 'normal',
              opacity: 1,
              params: mergedParams,
            },
          ],
          globalParams: {
            ...currentScene.genome.globalParams,
            cameraDistance: fav.cameraDistance,
            cameraAzimuth: fav.cameraAzimuth ?? 0,
            cameraPolar: fav.cameraPolar ?? 90,
            cameraTargetX: fav.cameraTargetX ?? 0,
            cameraTargetY: fav.cameraTargetY ?? 0,
            cameraTargetZ: fav.cameraTargetZ ?? 0,
          },
        },
      })
      setFavoritesViewIndex(index)
    },
    [currentScene, favorites, setScene, setFavoritesViewIndex],
  )

  const favPrev = useCallback(() => {
    const idx = (favoritesViewIndex - 1 + favorites.length) % favorites.length
    loadFavorite(idx)
  }, [favoritesViewIndex, favorites.length, loadFavorite])

  const favNext = useCallback(() => {
    const idx = (favoritesViewIndex + 1) % favorites.length
    loadFavorite(idx)
  }, [favoritesViewIndex, favorites.length, loadFavorite])

  // Slideshow auto-advance
  useEffect(() => {
    if (slideshowTimerRef.current) {
      clearInterval(slideshowTimerRef.current)
      slideshowTimerRef.current = null
    }
    if (slideshowActive && browseFavorites && favorites.length > 1) {
      slideshowTimerRef.current = setInterval(() => {
        favNext()
      }, slideshowInterval * 1000)
    }
    return () => {
      if (slideshowTimerRef.current) {
        clearInterval(slideshowTimerRef.current)
        slideshowTimerRef.current = null
      }
    }
  }, [slideshowActive, browseFavorites, favorites.length, slideshowInterval, favNext])

  // Stop slideshow when exiting browse mode
  useEffect(() => {
    if (!browseFavorites) setSlideshowActive(false)
  }, [browseFavorites])

  const startNameEdit = () => {
    setNameValue(currentScene?.name || '')
    setEditingName(true)
    setTimeout(() => nameInputRef.current?.focus(), 10)
  }

  const finishNameEdit = () => {
    setEditingName(false)
    if (currentScene && nameValue.trim()) {
      setScene({ ...currentScene, name: nameValue.trim() })
    }
  }

  const handleShareFavorites = async () => {
    if (favorites.length === 0) return
    setShareLoading(true)
    setShareCopied(false)
    try {
      const resp = await api.createFavoritesShare(favorites)
      const url = `${window.location.origin}/favorites/${resp.code}`
      setShareUrl(url)
    } catch (err) {
      console.error('Failed to share favorites:', err)
    } finally {
      setShareLoading(false)
    }
  }

  const handleCopyShareUrl = async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2000)
    } catch {
      // fallback
      const ta = document.createElement('textarea')
      ta.value = shareUrl
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2000)
    }
  }

  return (
    <>
      <div className="glass-panel absolute top-0 left-0 right-0 h-12 flex items-center px-4 z-50">
        {/* Logo */}
        <button
          onClick={() => navigate('/')}
          className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-fuchsia-500 bg-clip-text text-transparent mr-6 hover:opacity-80 transition-opacity"
        >
          Threelab
        </button>

        {/* Scene name */}
        {currentScene && (
          <div className="flex items-center gap-2">
            {editingName ? (
              <input
                ref={nameInputRef}
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onBlur={finishNameEdit}
                onKeyDown={(e) => e.key === 'Enter' && finishNameEdit()}
                className="bg-transparent border border-white/20 rounded px-2 py-0.5 text-sm text-gray-200 outline-none focus:border-cyan-400/50"
              />
            ) : (
              <span
                onClick={startNameEdit}
                className="text-sm text-gray-300 cursor-pointer hover:text-white transition-colors"
              >
                {currentScene.name || 'Untitled'}
              </span>
            )}
          </div>
        )}

        <div className="flex-1" />

        {/* Actions */}
        <div className="flex items-center gap-3">
          {currentScene && (
            <button
              onClick={() => setShowExport(true)}
              className="text-xs px-3 py-1.5 rounded bg-fuchsia-500/20 text-fuchsia-400 hover:bg-fuchsia-500/30 transition-colors"
            >
              Export
            </button>
          )}
          <button
            onClick={() => {
              if (favorites.length === 0) return
              if (browseFavorites) {
                setBrowseFavorites(false)
              } else {
                setBrowseFavorites(true)
                loadFavorite(0)
              }
            }}
            className={`text-xs px-3 py-1.5 rounded transition-colors ${
              browseFavorites
                ? 'bg-amber-500/20 text-amber-400'
                : favorites.length > 0
                  ? 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200'
                  : 'bg-white/5 text-gray-600 cursor-default'
            }`}
            title={favorites.length === 0 ? 'No favorites yet — star a pattern to add one' : `${favorites.length} favorite${favorites.length === 1 ? '' : 's'}`}
          >
            {'\u2605'} {favorites.length > 0 ? favorites.length : ''}
          </button>
          <button
            onClick={() => setShowPatterns(true)}
            className="text-xs px-3 py-1.5 rounded bg-purple-500/15 text-purple-400 hover:bg-purple-500/25 transition-colors"
          >
            Patterns
          </button>
        </div>
      </div>

      {/* Favorites browse bar */}
      {browseFavorites && favorites.length > 0 && (
        <div className="glass-panel absolute top-12 left-1/2 -translate-x-1/2 h-10 flex items-center gap-3 px-4 rounded-b-lg z-50">
          <button
            onClick={favPrev}
            className="text-sm text-gray-400 hover:text-white transition-colors px-1"
            title="Previous favorite"
          >
            {'\u25C0'}
          </button>
          <span className="text-xs text-gray-300 min-w-[120px] text-center">
            <span className="text-amber-400">{'\u2605'}</span>
            {' '}
            {favoritesViewIndex + 1} / {favorites.length}
            {' \u2014 '}
            <span className="text-gray-400">
              {getPatternLabel(favorites[favoritesViewIndex]?.patternType ?? '')}
            </span>
          </span>
          <button
            onClick={favNext}
            className="text-sm text-gray-400 hover:text-white transition-colors px-1"
            title="Next favorite"
          >
            {'\u25B6'}
          </button>
          <button
            onClick={() => {
              const fav = favorites[favoritesViewIndex]
              if (fav) {
                removeFavorite(fav.id)
                if (favorites.length <= 1) {
                  setBrowseFavorites(false)
                } else {
                  const nextIdx = Math.min(favoritesViewIndex, favorites.length - 2)
                  // Need to defer since state updates async
                  setTimeout(() => loadFavorite(nextIdx), 0)
                }
              }
            }}
            className="text-[10px] text-gray-500 hover:text-red-400 transition-colors ml-1"
            title="Remove from favorites"
          >
            {'\u2715'}
          </button>
          <div className="w-px h-5 bg-white/10 mx-1" />
          <button
            onClick={() => setSlideshowActive((v) => !v)}
            className={`text-sm px-1 transition-colors ${
              slideshowActive
                ? 'text-amber-400 hover:text-amber-300'
                : 'text-gray-400 hover:text-white'
            }`}
            title={slideshowActive ? 'Pause slideshow' : 'Start slideshow'}
          >
            {slideshowActive ? '\u23F8' : '\u25B6\uFE0E'}
          </button>
          {slideshowActive && (
            <select
              value={slideshowInterval}
              onChange={(e) => setSlideshowInterval(Number(e.target.value))}
              className="text-[10px] bg-black/40 border border-white/10 rounded px-1 py-0.5 text-gray-400 outline-none"
              title="Seconds per slide"
            >
              <option value={3}>3s</option>
              <option value={5}>5s</option>
              <option value={8}>8s</option>
              <option value={12}>12s</option>
              <option value={20}>20s</option>
              <option value={30}>30s</option>
            </select>
          )}
          <button
            onClick={handleShareFavorites}
            disabled={shareLoading}
            className={`text-[10px] transition-colors ${shareLoading ? 'text-gray-600' : 'text-gray-500 hover:text-cyan-400'}`}
            title="Share slideshow link"
          >
            {shareLoading ? 'Sharing...' : 'Share'}
          </button>
          <button
            onClick={() => {
              setSlideshowActive(false)
              setBrowseFavorites(false)
            }}
            className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors ml-1"
            title="Exit favorites"
          >
            Done
          </button>
        </div>
      )}

      {/* Export Modal */}
      {showExport && currentScene && (
        <ExportModal
          sceneName={currentScene.name}
          onClose={() => setShowExport(false)}
        />
      )}

      {/* Pattern Manager */}
      {showPatterns && (
        <PatternManager onClose={() => setShowPatterns(false)} />
      )}

      {/* Share Slideshow Modal */}
      {shareUrl && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]"
          onClick={() => setShareUrl(null)}
        >
          <div
            className="glass-panel-solid rounded-lg p-6 w-[440px] flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-200">Share Slideshow</h3>
              <button
                onClick={() => setShareUrl(null)}
                className="text-gray-500 hover:text-gray-300"
              >
                {'\u2715'}
              </button>
            </div>
            <p className="text-xs text-gray-400">
              Anyone with this link can view your {favorites.length} favorite{favorites.length === 1 ? '' : 's'} as a slideshow.
            </p>
            <div className="flex gap-2">
              <input
                readOnly
                value={shareUrl}
                className="flex-1 bg-black/40 border border-white/10 rounded px-3 py-2 text-xs text-gray-300 font-mono outline-none select-all"
                onFocus={(e) => e.target.select()}
              />
              <button
                onClick={handleCopyShareUrl}
                className={`px-4 py-2 rounded text-xs transition-colors ${
                  shareCopied
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30'
                }`}
              >
                {shareCopied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
