import { create } from 'zustand'
import type {
  Scene,
  Layer,
  GlobalParams,
  PatternSchema,
  User,
} from '../types/genome'

export interface Favorite {
  id: string
  patternType: string
  params: Record<string, unknown>
  cameraDistance: number
  createdAt: string
}

function loadFavorites(): Favorite[] {
  try {
    const raw = localStorage.getItem('threelab_favorites')
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveFavorites(favs: Favorite[]) {
  localStorage.setItem('threelab_favorites', JSON.stringify(favs))
}

interface ThreelabState {
  currentScene: Scene | null
  selectedLayerIndex: number
  isModified: boolean
  patternSchemas: Record<string, PatternSchema>
  authToken: string | null
  user: User | null
  favorites: Favorite[]
  favoritesViewIndex: number
  browseFavorites: boolean

  setScene: (scene: Scene | null) => void
  updateLayer: (index: number, updates: Partial<Layer>) => void
  updateLayerParams: (index: number, params: Record<string, unknown>) => void
  updateGlobalParams: (updates: Partial<GlobalParams>) => void
  addLayer: (layer: Layer) => void
  removeLayer: (index: number) => void
  reorderLayers: (fromIndex: number, toIndex: number) => void
  selectLayer: (index: number) => void
  setPatternSchemas: (schemas: Record<string, PatternSchema>) => void
  setAuth: (token: string, user: User) => void
  logout: () => void
  markSaved: () => void
  addFavorite: (fav: Omit<Favorite, 'id' | 'createdAt'>) => void
  removeFavorite: (id: string) => void
  setFavoritesViewIndex: (index: number) => void
  setBrowseFavorites: (on: boolean) => void
}

const useStore = create<ThreelabState>((set) => ({
  currentScene: null,
  selectedLayerIndex: 0,
  isModified: false,
  patternSchemas: {},
  authToken: localStorage.getItem('threelab_token'),
  user: null,
  favorites: loadFavorites(),
  favoritesViewIndex: 0,
  browseFavorites: false,

  setScene: (scene) =>
    set({
      currentScene: scene,
      selectedLayerIndex: 0,
      isModified: false,
    }),

  updateLayer: (index, updates) =>
    set((state) => {
      if (!state.currentScene) return state
      const layers = [...state.currentScene.genome.layers]
      if (index < 0 || index >= layers.length) return state
      layers[index] = { ...layers[index], ...updates }
      return {
        currentScene: {
          ...state.currentScene,
          genome: { ...state.currentScene.genome, layers },
        },
        isModified: true,
      }
    }),

  updateLayerParams: (index, params) =>
    set((state) => {
      if (!state.currentScene) return state
      const layers = [...state.currentScene.genome.layers]
      if (index < 0 || index >= layers.length) return state
      layers[index] = {
        ...layers[index],
        params: { ...layers[index].params, ...params },
      }
      return {
        currentScene: {
          ...state.currentScene,
          genome: { ...state.currentScene.genome, layers },
        },
        isModified: true,
      }
    }),

  updateGlobalParams: (updates) =>
    set((state) => {
      if (!state.currentScene) return state
      return {
        currentScene: {
          ...state.currentScene,
          genome: {
            ...state.currentScene.genome,
            globalParams: {
              ...state.currentScene.genome.globalParams,
              ...updates,
            },
          },
        },
        isModified: true,
      }
    }),

  addLayer: (layer) =>
    set((state) => {
      if (!state.currentScene) return state
      const layers = [...state.currentScene.genome.layers, layer]
      return {
        currentScene: {
          ...state.currentScene,
          genome: { ...state.currentScene.genome, layers },
        },
        selectedLayerIndex: layers.length - 1,
        isModified: true,
      }
    }),

  removeLayer: (index) =>
    set((state) => {
      if (!state.currentScene) return state
      const layers = state.currentScene.genome.layers.filter(
        (_, i) => i !== index,
      )
      const newSelected = Math.min(
        state.selectedLayerIndex,
        Math.max(0, layers.length - 1),
      )
      return {
        currentScene: {
          ...state.currentScene,
          genome: { ...state.currentScene.genome, layers },
        },
        selectedLayerIndex: newSelected,
        isModified: true,
      }
    }),

  reorderLayers: (fromIndex, toIndex) =>
    set((state) => {
      if (!state.currentScene) return state
      const layers = [...state.currentScene.genome.layers]
      const [removed] = layers.splice(fromIndex, 1)
      layers.splice(toIndex, 0, removed)
      let newSelected = state.selectedLayerIndex
      if (state.selectedLayerIndex === fromIndex) {
        newSelected = toIndex
      }
      return {
        currentScene: {
          ...state.currentScene,
          genome: { ...state.currentScene.genome, layers },
        },
        selectedLayerIndex: newSelected,
        isModified: true,
      }
    }),

  selectLayer: (index) => set({ selectedLayerIndex: index }),

  setPatternSchemas: (schemas) => set({ patternSchemas: schemas }),

  setAuth: (token, user) => {
    localStorage.setItem('threelab_token', token)
    set({ authToken: token, user })
  },

  logout: () => {
    localStorage.removeItem('threelab_token')
    set({ authToken: null, user: null })
  },

  markSaved: () => set({ isModified: false }),

  addFavorite: (fav) =>
    set((state) => {
      const newFav: Favorite = {
        ...fav,
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        createdAt: new Date().toISOString(),
      }
      const updated = [...state.favorites, newFav]
      saveFavorites(updated)
      return { favorites: updated }
    }),

  removeFavorite: (id) =>
    set((state) => {
      const updated = state.favorites.filter((f) => f.id !== id)
      saveFavorites(updated)
      return {
        favorites: updated,
        favoritesViewIndex: Math.min(
          state.favoritesViewIndex,
          Math.max(0, updated.length - 1),
        ),
      }
    }),

  setFavoritesViewIndex: (index) => set({ favoritesViewIndex: index }),

  setBrowseFavorites: (on) => set({ browseFavorites: on, favoritesViewIndex: 0 }),
}))

export default useStore
