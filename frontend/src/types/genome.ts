export interface Scene {
  id: string
  name: string
  description: string
  genome: Genome
  thumbnail?: string
  authorType: string
  authorId: string
  lineage: Lineage
  ratings: Ratings
  tags: string[]
  visibility: string
  exportCount: number
  createdAt: string
  updatedAt: string
}

export interface Genome {
  schemaVersion: number
  seed?: number
  layers: Layer[]
  globalParams: GlobalParams
}

export interface Layer {
  patternType: string
  enabled: boolean
  blendMode: string
  opacity: number
  params: Record<string, unknown>
}

export interface GlobalParams {
  backgroundColor: string
  bloomStrength: number
  bloomRadius: number
  bloomThreshold: number
  cameraDistance: number
  cameraAzimuth: number    // horizontal orbit angle in degrees (0 = front)
  cameraPolar: number      // vertical orbit angle in degrees (90 = equator, 0 = top)
  cameraTargetX: number    // look-at target X
  cameraTargetY: number    // look-at target Y
  cameraTargetZ: number    // look-at target Z
  mouseInteraction: MouseInteraction
  parallax: Parallax
  colorPalette: ColorPalette
  animation: Animation
}

export interface MouseInteraction {
  enabled: boolean
  mode: string
  strength: number
  radius: number
}

export interface Parallax {
  enabled: boolean
  strength: number
  layers: number
}

export interface ColorPalette {
  type: string
  colors: string[]
  cosineParams?: CosineParams
}

export interface CosineParams {
  a: [number, number, number]
  b: [number, number, number]
  c: [number, number, number]
  d: [number, number, number]
}

export interface Animation {
  speed: number
  timeScale: number
}

export interface Lineage {
  parents: string[]
  mutationType: string
  generation: number
}

export interface RatingData {
  sum: number
  count: number
}

export interface Ratings {
  human: RatingData
  agent: RatingData
}

export interface ParameterSchema {
  name: string
  type: 'int' | 'float' | 'bool' | 'enum' | 'color' | 'colors' | 'text'
  min?: number
  max?: number
  default: unknown
  description: string
  enumValues?: string[]
}

export interface PatternSchema {
  patternType: string
  label: string
  description: string
  parameters: ParameterSchema[]
}

export interface User {
  id: string
  username: string
  email: string
  apiKey?: string
  createdAt: string
}

export interface Preset {
  id: string
  name: string
  patternType: string
  params: Record<string, unknown>
  authorType: string
  authorId: string
  tags: string[]
  createdAt: string
}

export interface EvolutionSession {
  id: string
  parentScenes: string[]
  candidates: string[]
  selectedIds: string[]
  generation: number
  authorType: string
  authorId: string
  createdAt: string
}

export interface LineageNode {
  id: string
  name: string
  generation: number
  mutationType: string
  parents?: LineageNode[]
}
