import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, useParams, useNavigate } from 'react-router-dom'
import useStore from './store/useStore'
import * as api from './api/client'
import type { PatternSchema } from './types/genome'

import AppCanvas from './components/Canvas'
import TopBar from './components/TopBar'
import LayerPanel from './components/LayerPanel'
import ParameterPanel from './components/ParameterPanel'
import EvolutionGrid from './components/EvolutionGrid'
import Gallery from './components/Gallery'
import { lazy, Suspense } from 'react'
const NodeEditor = lazy(() => import('./components/NodeEditor/NodeEditor'))
import { getDefaultParams, getDefaultCameraDistance, getAllPatternTypes, registerUserPatterns, registerBuiltinNodeGraphs, getParameterSchema } from './patterns/PatternRegistry'
import { loadUserPatterns, setBuiltinGraphs } from './nodes/storage'
import { registerNodeDef, compileEvaluate } from './nodes/types'
import { buildGraphFromGenerator } from './nodes/generatorGraphFactory'
import { BUILTIN_GENERATORS } from './nodes/builtinGenerators'
import type { Scene } from './types/genome'

function makeDefaultScene(
  patternType: string,
  params: Record<string, unknown>,
  cameraDistance: number,
): Scene {
  // Merge registry defaults so migrated patterns get __graphId
  const registryDefaults = getDefaultParams(patternType)
  const mergedParams = { ...registryDefaults, ...params }
  return {
    id: '',
    name: 'Untitled',
    description: '',
    genome: {
      schemaVersion: 1,
      layers: [
        {
          patternType,
          enabled: true,
          blendMode: 'additive',
          opacity: 1,
          params: mergedParams,
        },
      ],
      globalParams: {
        backgroundColor: '#0a0a0f',
        bloomStrength: 1.0,
        bloomRadius: 0.4,
        bloomThreshold: 0.2,
        cameraDistance,
        cameraAzimuth: 0,
        cameraPolar: 90,
        cameraTargetX: 0,
        cameraTargetY: 0,
        cameraTargetZ: 0,
        mouseInteraction: {
          enabled: true,
          mode: 'attract',
          strength: 1,
          radius: 100,
        },
        parallax: {
          enabled: false,
          strength: 0.5,
          layers: 3,
        },
        colorPalette: {
          type: 'custom',
          colors: ['#22d3ee', '#d946ef', '#fbbf24'],
        },
        animation: {
          speed: 1,
          timeScale: 1,
        },
      },
    },
    thumbnail: '',
    authorType: 'anonymous',
    authorId: '',
    lineage: {
      parents: [],
      mutationType: '',
      generation: 0,
    },
    ratings: {
      human: { sum: 0, count: 0 },
      agent: { sum: 0, count: 0 },
    },
    tags: [],
    visibility: 'private',
    exportCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function Editor() {
  const currentScene = useStore((s) => s.currentScene)
  const setScene = useStore((s) => s.setScene)

  // Create a default scene if none loaded — uses curated kaleidoscope params
  useEffect(() => {
    if (!currentScene) {
      const dt = 'user_builtin_kaleidoscope'
      const defaultKaleidoscopeParams = {
        __graphId: 'builtin_kaleidoscope',
        colorPalette: 'fire',
        colorSpeed: 2.1,
        complexity: 3.7,
        distortion: 1.91,
        innerPattern: 'spiral',
        pulseAmount: 0.51,
        rotationSpeed: 1.06,
        segments: 7,
        symmetryMode: 'radial',
        zoom: 3.3,
      }
      setScene(makeDefaultScene(dt, defaultKaleidoscopeParams, getDefaultCameraDistance(dt)))
    }
  }, [currentScene, setScene])

  const fullscreen = useStore((s) => s.fullscreen)
  const toggleFullscreen = useStore((s) => s.toggleFullscreen)
  const [showEscHint, setShowEscHint] = useState(false)

  // Sync browser fullscreen API with store state
  useEffect(() => {
    if (fullscreen) {
      document.documentElement.requestFullscreen?.().catch(() => {})
      setShowEscHint(true)
      const timer = setTimeout(() => setShowEscHint(false), 5000)
      return () => clearTimeout(timer)
    } else {
      setShowEscHint(false)
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {})
      }
    }
  }, [fullscreen])

  // Listen for browser fullscreen exit (Escape / F11 / etc.) to sync store
  useEffect(() => {
    const onFsChange = () => {
      const isBrowserFs = !!document.fullscreenElement
      const storeFs = useStore.getState().fullscreen
      if (storeFs && !isBrowserFs) toggleFullscreen()
    }
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [toggleFullscreen])

  return (
    <div className="relative w-full h-full">
      <AppCanvas />
      {/* UI panels — hidden but still mounted in fullscreen so timers (slideshow) keep running */}
      <div className={fullscreen ? 'hidden' : ''}>
        <TopBar />
        <LayerPanel />
        <ParameterPanel />
        <EvolutionGrid />
        <button
          onClick={toggleFullscreen}
          className="absolute z-50 bottom-9 left-2 px-2 py-1 text-[10px] text-gray-400 hover:text-white bg-black/40 border border-white/10 rounded hover:bg-black/60 transition-all"
          title="Full screen (hides UI)"
        >
          Full Screen
        </button>
        <div className="absolute z-40 bottom-0 left-0 right-0 flex items-center justify-center gap-3 py-1.5 text-[11px] text-gray-600">
          <span>&copy; 2026{' '}
            <a href="https://metavert.io" target="_blank" rel="noopener noreferrer" className="hover:text-gray-400 transition-colors">Metavert LLC</a>
            {' '}- MIT Licensed Software
          </span>
          <span className="text-gray-700">|</span>
          <a href="https://metavert.io/terms-of-service" target="_blank" rel="noopener noreferrer" className="hover:text-gray-400 transition-colors">Terms of Service</a>
          <span className="text-gray-700">|</span>
          <a href="https://metavert.io/privacy-policy" target="_blank" rel="noopener noreferrer" className="hover:text-gray-400 transition-colors">Privacy</a>
        </div>
      </div>
      {/* Escape hint — fades out after 5 seconds */}
      {showEscHint && (
        <div className="absolute z-50 top-6 left-1/2 -translate-x-1/2 px-4 py-2 text-sm text-white/80 bg-black/60 rounded-lg backdrop-blur-sm animate-fade-out pointer-events-none">
          Press Escape to Exit
        </div>
      )}
    </div>
  )
}

function SharedView() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const setScene = useStore((s) => s.setScene)

  useEffect(() => {
    if (!code) {
      navigate('/')
      return
    }
    api
      .getShare(code)
      .then((share) => {
        const scene = makeDefaultScene(share.patternType, share.params as Record<string, unknown>, share.cameraDistance)
        if (share.name) scene.name = share.name
        setScene(scene)
        navigate('/', { replace: true })
      })
      .catch(() => {
        navigate('/')
      })
  }, [code, navigate, setScene])

  return (
    <div className="flex items-center justify-center w-full h-full">
      <span className="text-sm text-gray-500">Loading shared pattern...</span>
    </div>
  )
}

function SharedFavoritesView() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const setScene = useStore((s) => s.setScene)
  const setBrowseFavorites = useStore((s) => s.setBrowseFavorites)

  useEffect(() => {
    if (!code) {
      navigate('/')
      return
    }
    api
      .getFavoritesShare(code)
      .then((share) => {
        if (share.favorites.length === 0) {
          navigate('/')
          return
        }
        // Replace favorites with the shared ones and enter browse mode
        useStore.setState({ favorites: share.favorites.map((f) => ({
          id: f.id,
          patternType: f.patternType,
          params: f.params,
          cameraDistance: f.cameraDistance,
          cameraAzimuth: f.cameraAzimuth,
          cameraPolar: f.cameraPolar,
          cameraTargetX: f.cameraTargetX,
          cameraTargetY: f.cameraTargetY,
          cameraTargetZ: f.cameraTargetZ,
          createdAt: f.createdAt,
        }))})

        // Load the first favorite as the scene
        const fav = share.favorites[0]
        const scene = makeDefaultScene(fav.patternType, fav.params, fav.cameraDistance)
        const gp = scene.genome.globalParams
        gp.cameraAzimuth = fav.cameraAzimuth ?? 0
        gp.cameraPolar = fav.cameraPolar ?? 90
        gp.cameraTargetX = fav.cameraTargetX ?? 0
        gp.cameraTargetY = fav.cameraTargetY ?? 0
        gp.cameraTargetZ = fav.cameraTargetZ ?? 0
        setScene(scene)
        setBrowseFavorites(true)
        navigate('/', { replace: true })
      })
      .catch(() => {
        navigate('/')
      })
  }, [code, navigate, setScene, setBrowseFavorites])

  return (
    <div className="flex items-center justify-center w-full h-full">
      <span className="text-sm text-gray-500">Loading shared slideshow...</span>
    </div>
  )
}

function buildFallbackSchema(
  patternType: string, label: string, description: string,
  defaults: Record<string, unknown>,
): PatternSchema {
  const parameters: PatternSchema['parameters'] = []
  for (const [name, val] of Object.entries(defaults)) {
    if (typeof val === 'boolean') {
      parameters.push({ name, type: 'bool', default: val, description: name })
    } else if (typeof val === 'number') {
      const isInt = Number.isInteger(val) && !name.toLowerCase().includes('speed')
        && !name.toLowerCase().includes('opacity') && !name.toLowerCase().includes('strength')
      if (isInt) {
        parameters.push({ name, type: 'int', min: 0, max: Math.max(Math.round(val * 4), 10), default: val, description: name })
      } else {
        const absVal = Math.abs(val)
        const min = val < 0 ? val * 2 : 0
        const max = absVal < 0.01 ? 1 : absVal < 1 ? Math.max(absVal * 5, 1) : absVal * 4
        parameters.push({ name, type: 'float', min, max, default: val, description: name })
      }
    } else if (typeof val === 'string' && val.startsWith('#')) {
      parameters.push({ name, type: 'color', default: val, description: name })
    } else if (typeof val === 'string') {
      parameters.push({ name, type: 'enum', default: val, enumValues: [val], description: name })
    }
  }
  return { patternType, label, description, parameters }
}

function buildSchemaForType(type: string, label: string, description: string): PatternSchema {
  // User patterns with explicit parameter schema take priority
  const registrySchema = getParameterSchema(type)
  if (registrySchema && registrySchema.length > 0) {
    return {
      patternType: type,
      label,
      description,
      parameters: registrySchema.map((p) => ({
        name: p.name,
        type: p.type as PatternSchema['parameters'][number]['type'],
        min: p.min,
        max: p.max,
        default: p.default,
        description: p.description ?? p.name,
        enumValues: p.enumValues,
      })),
    }
  }
  // Fall back to inferring from defaults
  return buildFallbackSchema(type, label, description, getDefaultParams(type))
}

function buildFallbackSchemas(setPatternSchemas: (schemas: Record<string, PatternSchema>) => void) {
  const allTypes = getAllPatternTypes()
  const fallback: Record<string, PatternSchema> = {}
  for (const t of allTypes) {
    fallback[t.type] = buildSchemaForType(t.type, t.label, t.description)
  }
  setPatternSchemas(fallback)
}

// ─── Initialize built-in node-graph patterns at module load ──────────
;(() => {
  const builtinGraphs = BUILTIN_GENERATORS.map((gen) => {
    const graph = buildGraphFromGenerator(gen)
    // Register the compound generator node def so the executor knows about it
    if (graph.customNodeDefs) {
      for (const cnd of graph.customNodeDefs) {
        if (!cnd.evaluateSource) continue // skip if using existing static def
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
    return graph
  })
  setBuiltinGraphs(builtinGraphs)

  // Register all patterns (builtin + user) so they're available before any useEffect fires
  registerUserPatterns(loadUserPatterns())

  // Register backward-compat entries for old saved scenes that reference patterns by old type keys
  registerBuiltinNodeGraphs(
    builtinGraphs.map((g) => {
      // Find the original registry key by matching name
      const originalTypeMap: Record<string, string> = {
        'Lissajous': 'lissajous',
        'Strange Attractor': 'attractor',
        'Spirograph': 'spirograph',
        'Sphere Spirals': 'sphereSpirals',
        'Space-Filling Curve': 'spaceFillingCurve',
        'L-Systems': 'lSystems',
        'Flow Field': 'flowField',
        'Fractal': 'fractal',
        'Domain Warping': 'domainWarping',
        'Truchet Tiling': 'truchetTiling',
        'Magnetic Pendulum': 'magneticPendulum',
        'Electric Field': 'electricField',
        'Voronoi': 'voronoi',
        'Wave Interference': 'waveInterference',
        'Reaction Diffusion': 'reactionDiffusion',
        'Cellular Automata': 'cellularAutomata',
        'Cloth': 'cloth',
        'Network Graph': 'networkGraph',
        'Circle Packing': 'circlePacking',
        'Voxel Landscape': 'voxelLandscape',
        'Physarum': 'physarum',
        'Fable Physarum': 'fablePhysarum',
        'Fable Petri': 'fablePetri',
        'Fable Continuum': 'fableContinuum',
        'Fable Ink': 'fableInk',
        'Fable Dreamscape': 'fableDreamscape',
        'Fable Physarum XL': 'fablePhysarumXL',
        'Fable Fireworks': 'fableFireworks',
        'Fable Hyperspace': 'fableHyperspace',
        'Fable Mirrorworld': 'fableMirrorworld',
        'Fable Caustics': 'fableCaustics',
        'Fable Cajal': 'fableCajal',
        'Fable Cymatics': 'fableCymatics',
        'Fable Type': 'fableType',
        'Fable Lower Thirds': 'fableLowerThirds',
        'Fable Type 3D': 'fableType3D',
        'Fable Ticker': 'fableTicker',
        'Fable Neon Sign': 'fableNeonSign',
        'Fable Title Card': 'fableTitleCard',
        'Fable Credits Roll': 'fableCredits',
        'Kaleidoscope': 'kaleidoscope',
        'Slime Mold': 'slimeMold',
        'Starfield': 'starfield',
        'Planet': 'planet',
        'Lightning Storm': 'lightningStorm',
        'Aurora Borealis': 'auroraBorealis',
        'Psychedelic': 'psychedelic',
      }
      return {
        originalType: originalTypeMap[g.name] ?? g.id,
        id: g.id,
        name: g.name,
        description: g.description,
        defaultParams: g.defaultParams,
        parameterSchema: g.parameterSchema,
        defaultCameraDistance: g.defaultCameraDistance,
      }
    }),
  )
})()

function App() {
  const setPatternSchemas = useStore((s) => s.setPatternSchemas)
  const setAuth = useStore((s) => s.setAuth)
  const authToken = useStore((s) => s.authToken)

  // Register user patterns on mount + when they change
  useEffect(() => {
    const refresh = () => {
      registerUserPatterns(loadUserPatterns())
      // Rebuild schemas so ParameterPanel picks up user pattern parameters
      buildFallbackSchemas(setPatternSchemas)
    }
    refresh()
    window.addEventListener('user-patterns-changed', refresh)
    return () => window.removeEventListener('user-patterns-changed', refresh)
  }, [setPatternSchemas])

  // Fetch pattern schemas on mount
  useEffect(() => {
    api
      .getPatternSchemas()
      .then((schemas) => {
        const mapped: Record<string, PatternSchema> = {}
        for (const s of schemas) {
          mapped[s.patternType] = {
            patternType: s.patternType,
            label: s.patternType,
            description: s.description,
            parameters: s.params.map((p) => ({
              name: p.name,
              type: p.type as PatternSchema['parameters'][number]['type'],
              min: p.min,
              max: p.max,
              default: p.default,
              description: p.description,
              enumValues: p.enumValues,
            })),
          }
        }
        // Merge in client-side fallbacks for any patterns the backend doesn't know about yet
        const allTypes = getAllPatternTypes()
        for (const t of allTypes) {
          if (!mapped[t.type]) {
            mapped[t.type] = buildSchemaForType(t.type, t.label, t.description)
          }
        }
        setPatternSchemas(mapped)
      })
      .catch(() => {
        // Fallback: build schemas from registry default params
        console.warn('Could not fetch schemas from backend, using client-side defaults')
        buildFallbackSchemas(setPatternSchemas)
      })
  }, [setPatternSchemas])

  // Restore user session
  useEffect(() => {
    if (authToken) {
      api
        .getMe()
        .then((user) => setAuth(authToken, user))
        .catch(() => {
          // Token expired
          localStorage.removeItem('threelab_token')
        })
    }
  }, [authToken, setAuth])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Editor />} />
        <Route path="/s/:code" element={<SharedView />} />
        <Route path="/favorites/:code" element={<SharedFavoritesView />} />
        <Route path="/gallery" element={<Gallery />} />
        <Route path="/designer/:id?" element={<Suspense fallback={<div className="flex items-center justify-center w-full h-full"><span className="text-sm text-gray-500">Loading designer...</span></div>}><NodeEditor /></Suspense>} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
