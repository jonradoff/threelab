import type {
  Scene,
  Preset,
  User,
  LineageNode,
  EvolutionSession,
} from '../types/genome'

const BASE_URL = import.meta.env.VITE_API_URL || '/api'

function getToken(): string | null {
  return localStorage.getItem('threelab_token')
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(body.error || `HTTP ${res.status}`)
  }

  return res.json()
}

// Scenes
export function listScenes(params?: {
  tags?: string
  visibility?: string
  authorType?: string
  patternType?: string
  limit?: number
  skip?: number
}): Promise<Scene[]> {
  const qs = new URLSearchParams()
  if (params?.tags) qs.set('tags', params.tags)
  if (params?.visibility) qs.set('visibility', params.visibility)
  if (params?.authorType) qs.set('authorType', params.authorType)
  if (params?.patternType) qs.set('patternType', params.patternType)
  if (params?.limit) qs.set('limit', String(params.limit))
  if (params?.skip) qs.set('skip', String(params.skip))
  const q = qs.toString()
  return request<Scene[]>(`/scenes${q ? '?' + q : ''}`)
}

export function getScene(id: string): Promise<Scene> {
  return request<Scene>(`/scenes/${id}`)
}

export function createScene(scene: Partial<Scene>): Promise<Scene> {
  return request<Scene>('/scenes', {
    method: 'POST',
    body: JSON.stringify(scene),
  })
}

export function updateScene(
  id: string,
  updates: Partial<Scene>,
): Promise<Scene> {
  return request<Scene>(`/scenes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  })
}

export function deleteScene(id: string): Promise<{ status: string }> {
  return request<{ status: string }>(`/scenes/${id}`, { method: 'DELETE' })
}

export function rateScene(
  id: string,
  score: number,
): Promise<Scene['ratings']> {
  return request<Scene['ratings']>(`/scenes/${id}/rate`, {
    method: 'POST',
    body: JSON.stringify({ score }),
  })
}

export function exportScene(
  id: string,
  format: 'html' | 'react' | 'json' = 'json',
): Promise<Response> {
  const token = getToken()
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  return fetch(`${BASE_URL}/scenes/${id}/export?format=${format}`, { headers })
}

export function updateThumbnail(
  id: string,
  thumbnail: string,
): Promise<{ status: string }> {
  return request<{ status: string }>(`/scenes/${id}/thumbnail`, {
    method: 'PUT',
    body: JSON.stringify({ thumbnail }),
  })
}

// Evolution
export function mutateScene(
  id: string,
  strength: number,
): Promise<Scene> {
  return request<Scene>(`/evolution/mutate/${id}`, {
    method: 'POST',
    body: JSON.stringify({ strength }),
  })
}

export function crossoverScenes(
  sceneIdA: string,
  sceneIdB: string,
): Promise<Scene> {
  return request<Scene>('/evolution/crossover', {
    method: 'POST',
    body: JSON.stringify({ sceneIdA, sceneIdB }),
  })
}

export function generateCandidates(
  id: string,
  count: number,
  strategy: string,
): Promise<{ session: EvolutionSession; candidates: Scene[] }> {
  return request<{ session: EvolutionSession; candidates: Scene[] }>(
    `/evolution/candidates/${id}`,
    {
      method: 'POST',
      body: JSON.stringify({ count, strategy }),
    },
  )
}

export function selectFavorites(
  sessionId: string,
  selectedIds: string[],
): Promise<{ status: string; selectedIds: string[] }> {
  return request<{ status: string; selectedIds: string[] }>(
    '/evolution/select',
    {
      method: 'POST',
      body: JSON.stringify({ sessionId, selectedIds }),
    },
  )
}

// Presets
export function listPresets(patternType?: string): Promise<Preset[]> {
  const q = patternType ? `?patternType=${patternType}` : ''
  return request<Preset[]>(`/presets${q}`)
}

export function createPreset(preset: Partial<Preset>): Promise<Preset> {
  return request<Preset>('/presets', {
    method: 'POST',
    body: JSON.stringify(preset),
  })
}

export function getPreset(id: string): Promise<Preset> {
  return request<Preset>(`/presets/${id}`)
}

// Gallery
export function listGallery(params?: {
  sort?: string
  limit?: number
  skip?: number
}): Promise<{ scenes: Scene[]; total: number; limit: number; skip: number }> {
  const qs = new URLSearchParams()
  if (params?.sort) qs.set('sort', params.sort)
  if (params?.limit) qs.set('limit', String(params.limit))
  if (params?.skip) qs.set('skip', String(params.skip))
  const q = qs.toString()
  return request<{
    scenes: Scene[]
    total: number
    limit: number
    skip: number
  }>(`/gallery${q ? '?' + q : ''}`)
}

export function getTrending(): Promise<Scene[]> {
  return request<Scene[]>('/gallery/trending')
}

export function getLineage(id: string): Promise<LineageNode> {
  return request<LineageNode>(`/gallery/lineage/${id}`)
}

// Auth
export function register(
  username: string,
  email: string,
  password: string,
): Promise<{ token: string; user: User }> {
  return request<{ token: string; user: User }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, email, password }),
  })
}

export function login(
  email: string,
  password: string,
): Promise<{ token: string; user: User }> {
  return request<{ token: string; user: User }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export function getMe(): Promise<User> {
  return request<User>('/auth/me')
}

export function generateAPIKey(): Promise<{ apiKey: string }> {
  return request<{ apiKey: string }>('/auth/api-key', { method: 'POST' })
}

// Shares
export interface ShareLink {
  id: string
  code: string
  patternType: string
  params: Record<string, unknown>
  cameraDistance: number
  views: number
  createdAt: string
}

export function createShare(data: {
  patternType: string
  params: Record<string, unknown>
  cameraDistance: number
}): Promise<ShareLink> {
  return request<ShareLink>('/shares', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function getShare(code: string): Promise<ShareLink> {
  return request<ShareLink>(`/shares/${code}`)
}

// Schemas
interface BackendPatternSchema {
  patternType: string
  description: string
  params: {
    name: string
    type: string
    min?: number
    max?: number
    default: unknown
    description: string
    enumValues?: string[]
  }[]
}

export function getPatternSchemas(): Promise<BackendPatternSchema[]> {
  return request<BackendPatternSchema[]>('/schemas')
}
