import { useEffect } from 'react'
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
import { getDefaultParams, getDefaultCameraDistance, getAllPatternTypes } from './patterns/PatternRegistry'
import type { Scene } from './types/genome'

function makeDefaultScene(
  patternType: string,
  params: Record<string, unknown>,
  cameraDistance: number,
): Scene {
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
          params,
        },
      ],
      globalParams: {
        backgroundColor: '#0a0a0f',
        bloomStrength: 1.0,
        bloomRadius: 0.4,
        bloomThreshold: 0.2,
        cameraDistance,
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

  // Create a default scene if none loaded
  useEffect(() => {
    if (!currentScene) {
      setScene(makeDefaultScene('flowField', getDefaultParams('flowField'), getDefaultCameraDistance('flowField')))
    }
  }, [currentScene, setScene])

  return (
    <div className="relative w-full h-full">
      <AppCanvas />
      <TopBar />
      <LayerPanel />
      <ParameterPanel />
      <EvolutionGrid />
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
        setScene(
          makeDefaultScene(share.patternType, share.params as Record<string, unknown>, share.cameraDistance),
        )
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

function buildFallbackSchemas(setPatternSchemas: (schemas: Record<string, PatternSchema>) => void) {
  const allTypes = getAllPatternTypes()
  const fallback: Record<string, PatternSchema> = {}
  for (const t of allTypes) {
    fallback[t.type] = buildFallbackSchema(t.type, t.label, t.description, getDefaultParams(t.type))
  }
  setPatternSchemas(fallback)
}

function App() {
  const setPatternSchemas = useStore((s) => s.setPatternSchemas)
  const setAuth = useStore((s) => s.setAuth)
  const authToken = useStore((s) => s.authToken)

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
            const defaults = getDefaultParams(t.type)
            mapped[t.type] = buildFallbackSchema(t.type, t.label, t.description, defaults)
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
        <Route path="/gallery" element={<Gallery />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
