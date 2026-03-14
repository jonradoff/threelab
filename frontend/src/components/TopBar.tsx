import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import { getDefaultCameraDistance } from '../patterns/PatternRegistry'
import * as api from '../api/client'
import ExportModal from './ExportModal'

export default function TopBar() {
  const currentScene = useStore((s) => s.currentScene)
  const isModified = useStore((s) => s.isModified)
  const user = useStore((s) => s.user)
  const authToken = useStore((s) => s.authToken)
  const setScene = useStore((s) => s.setScene)
  const setAuth = useStore((s) => s.setAuth)
  const logout = useStore((s) => s.logout)
  const markSaved = useStore((s) => s.markSaved)
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
  const [showAuth, setShowAuth] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authUsername, setAuthUsername] = useState('')
  const [authError, setAuthError] = useState('')
  const [saving, setSaving] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  const handleSave = async () => {
    if (!currentScene) return
    setSaving(true)
    try {
      if (currentScene.id) {
        const updated = await api.updateScene(currentScene.id, {
          name: currentScene.name,
          genome: currentScene.genome,
          tags: currentScene.tags,
          visibility: currentScene.visibility,
        })
        setScene(updated)
      } else {
        const created = await api.createScene({
          name: currentScene.name || 'Untitled',
          genome: currentScene.genome,
          tags: currentScene.tags || [],
          visibility: 'private',
        })
        setScene(created)
      }
      markSaved()
    } catch (err) {
      console.error('Save failed:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleAuth = async () => {
    setAuthError('')
    try {
      if (authMode === 'register') {
        const resp = await api.register(authUsername, authEmail, authPassword)
        setAuth(resp.token, resp.user)
      } else {
        const resp = await api.login(authEmail, authPassword)
        setAuth(resp.token, resp.user)
      }
      setShowAuth(false)
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Auth failed')
    }
  }

  const loadFavorite = useCallback(
    (index: number) => {
      if (!currentScene || index < 0 || index >= favorites.length) return
      const fav = favorites[index]
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
              params: { ...fav.params },
            },
          ],
          globalParams: {
            ...currentScene.genome.globalParams,
            cameraDistance: fav.cameraDistance,
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
            {isModified && (
              <span className="text-[10px] text-amber-400">unsaved</span>
            )}
          </div>
        )}

        <div className="flex-1" />

        {/* Actions */}
        <div className="flex items-center gap-3">
          {currentScene && (
            <>
              <button
                onClick={handleSave}
                disabled={saving || !authToken}
                className="text-xs px-3 py-1.5 rounded bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors disabled:opacity-40"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => setShowExport(true)}
                className="text-xs px-3 py-1.5 rounded bg-fuchsia-500/20 text-fuchsia-400 hover:bg-fuchsia-500/30 transition-colors"
              >
                Export
              </button>
            </>
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
            onClick={() => navigate('/gallery')}
            className="text-xs px-3 py-1.5 rounded bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200 transition-colors"
          >
            Gallery
          </button>

          {/* Auth */}
          {authToken && user ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">{user.username}</span>
              <button
                onClick={logout}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                Logout
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAuth(true)}
              className="text-xs px-3 py-1.5 rounded bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200 transition-colors"
            >
              Login
            </button>
          )}
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
              {favorites[favoritesViewIndex]?.patternType}
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
          <button
            onClick={() => setBrowseFavorites(false)}
            className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors ml-1"
            title="Exit favorites"
          >
            Done
          </button>
        </div>
      )}

      {/* Auth Modal */}
      {showAuth && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]"
          onClick={() => setShowAuth(false)}
        >
          <div
            className="glass-panel-solid rounded-lg p-6 w-80"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-medium text-gray-200 mb-4">
              {authMode === 'login' ? 'Login' : 'Register'}
            </h3>
            {authMode === 'register' && (
              <input
                value={authUsername}
                onChange={(e) => setAuthUsername(e.target.value)}
                placeholder="Username"
                className="w-full mb-2 px-3 py-1.5 bg-black/40 border border-white/10 rounded text-sm text-gray-200 outline-none focus:border-cyan-400/50"
              />
            )}
            <input
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              placeholder="Email"
              type="email"
              className="w-full mb-2 px-3 py-1.5 bg-black/40 border border-white/10 rounded text-sm text-gray-200 outline-none focus:border-cyan-400/50"
            />
            <input
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              placeholder="Password"
              type="password"
              className="w-full mb-3 px-3 py-1.5 bg-black/40 border border-white/10 rounded text-sm text-gray-200 outline-none focus:border-cyan-400/50"
              onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
            />
            {authError && (
              <p className="text-xs text-red-400 mb-2">{authError}</p>
            )}
            <button
              onClick={handleAuth}
              className="w-full py-1.5 rounded bg-cyan-500/20 text-cyan-400 text-sm hover:bg-cyan-500/30 transition-colors mb-2"
            >
              {authMode === 'login' ? 'Login' : 'Register'}
            </button>
            <button
              onClick={() =>
                setAuthMode(authMode === 'login' ? 'register' : 'login')
              }
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              {authMode === 'login'
                ? 'Need an account? Register'
                : 'Already have an account? Login'}
            </button>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExport && currentScene && (
        <ExportModal
          sceneId={currentScene.id}
          sceneName={currentScene.name}
          onClose={() => setShowExport(false)}
        />
      )}
    </>
  )
}
