import { lazy, type ComponentType } from 'react'

export interface ParamSchemaEntry {
  name: string
  type: string
  min?: number
  max?: number
  default: unknown
  description?: string
  enumValues?: string[]
}

interface PatternRegistryEntry {
  component: ComponentType<{ params: Record<string, unknown> }>
  defaultParams: Record<string, unknown>
  defaultCameraDistance: number
  label: string
  description: string
  parameterSchema?: ParamSchemaEntry[]
  isUserPattern?: boolean
  isNodeGraph?: boolean
  readOnly?: boolean
}

const UserPatternComponent = lazy(() => import('./UserPattern'))

const registry: Record<string, PatternRegistryEntry> = {
  networkGraph: {
    component: lazy(() => import('./NetworkGraph')),
    defaultParams: {
      nodeCount: 80, edgeDistance: 120, nodeSize: 2, edgeOpacity: 0.3, pulseSpeed: 1,
      clusterCount: 3, repulsionForce: 30, attractionForce: 0.5, damping: 0.9, is3D: false,
      colorMode: 'cluster', connectionDensity: 0.3, maxConnections: 5, distanceBias: 1.5,
      longRangeChance: 0.05, travelerCount: 30, travelerSpeed: 1,
    },
    defaultCameraDistance: 300,
    label: 'Network Graph',
    description: 'Dynamic network graph with nodes and animated edges',
  },
  physarum: {
    component: lazy(() => import('./Physarum')),
    defaultParams: {
      agentCount: 100000, sensorAngle: 30, sensorDistance: 20, turnSpeed: 45, moveSpeed: 1.5,
      decayRate: 0.02, depositAmount: 5, diffuseSpeed: 0.5, stepsPerFrame: 4,
      spawnPattern: 'center', trailColor: '#00ff88', contrast: 1.5, brightness: 1.2,
      randomStrength: 0.5, simResolution: 512,
    },
    defaultCameraDistance: 1730,
    label: 'Physarum',
    description: 'Slime mold simulation with emergent network patterns',
  },
  flowField: {
    component: lazy(() => import('./FlowField')),
    defaultParams: {
      particleCount: 5000, noiseScale: 0.005, noiseSpeed: 0.2, particleSpeed: 2,
      particleLife: 100, trailLength: 10, noiseType: 'perlin', fieldStrength: 1,
      fadeRate: 0.05, lineWidth: 1,
    },
    defaultCameraDistance: 350,
    label: 'Flow Field',
    description: 'Particles following a vector field derived from noise',
  },
  spaceFillingCurve: {
    component: lazy(() => import('./SpaceFillingCurve')),
    defaultParams: {
      curveType: 'hilbert', depth: 5, lineWidth: 2, drawSpeed: 5, colorProgression: 'rainbow',
      animated: true, rotation: 0, scale: 15, waveAmplitude: 0, waveFrequency: 3, waveSpeed: 1,
      spiralTwist: 0, pointMode: false, pointSize: 3, glowTrail: true, glowLength: 0.05,
      mirrorX: false, mirrorY: false, breathe: 0, breatheSpeed: 0.5,
    },
    defaultCameraDistance: 72,
    label: 'Space-Filling Curve',
    description: 'Animated space-filling curves (Hilbert, Moore, etc.)',
  },
  reactionDiffusion: {
    component: lazy(() => import('./ReactionDiffusion')),
    defaultParams: {
      feed: 0.055, kill: 0.062, diffusionA: 1, diffusionB: 0.5, timeStep: 1,
      stepsPerFrame: 8, resolution: 256, seedPattern: 'center',
      colorMapA: '#000000', colorMapB: '#ffffff',
    },
    defaultCameraDistance: 1730,
    label: 'Reaction-Diffusion',
    description: 'Gray-Scott reaction-diffusion organic patterns',
  },
  attractor: {
    component: lazy(() => import('./Attractors')),
    defaultParams: {
      attractorType: 'lorenz', pointCount: 50000, dt: 0.005, trailLength: 1000, pointSize: 1,
      rotationSpeed: 0.1, scale: 5, colorBySpeed: true, paramA: 10, paramB: 28, paramC: 2.667,
    },
    defaultCameraDistance: 12,
    label: 'Strange Attractor',
    description: 'Lorenz, Rossler, and other strange attractors',
  },
  truchetTiling: {
    component: lazy(() => import('./TruchetTiling')),
    defaultParams: {
      tileType: 'quarter-circle', gridSize: 16, lineWidth: 2, animateRotation: true,
      rotationSpeed: 0.2, fillMode: 'stroke', randomSeed: 42, colorA: '#000000',
      colorB: '#ffffff', rounded: true, colorCycleSpeed: 0, noiseWarp: 0, zoom: 1,
      multiScale: false, scaleLevels: 2, invert: false, edgeFade: 0, animateColors: false,
      waveDistort: 0, waveFreq: 3, contrast: 1, thickness: 1,
    },
    defaultCameraDistance: 1730,
    label: 'Truchet Tiling',
    description: 'Animated Truchet tile patterns',
  },
  sphereSpirals: {
    component: lazy(() => import('./SphereSpirals')),
    defaultParams: {
      spiralCount: 8, pointsPerSpiral: 500, radius: 5, turns: 5, lineWidth: 1.5,
      rotationSpeed: 0.3, wobble: 0.5, wobbleSpeed: 0.5, colorMode: 'spiral',
      wireframe: false, noiseDistort: 0, noiseFreq: 2, pulseAmplitude: 0, pulseSpeed: 1,
      flatten: 0, spread: 0, trailGlow: false, autoMorph: false, morphSpeed: 0.5,
    },
    defaultCameraDistance: 18,
    label: 'Sphere Spirals',
    description: 'Spiraling lines on a sphere',
  },
  voronoi: {
    component: lazy(() => import('./Voronoi')),
    defaultParams: {
      seedCount: 30, motionType: 'brownian', motionSpeed: 0.5, colorMode: 'random',
      borderWidth: 2, borderColor: '#ffffff', cellOpacity: 0.8, distortAmount: 0,
      distortFreq: 2, metric: 'euclidean', showSeeds: false, seedSize: 3, pulseSpeed: 0,
      invertColors: false, blendEdges: 0, rotationSpeed: 0,
    },
    defaultCameraDistance: 1730,
    label: 'Voronoi',
    description: 'Animated Voronoi tessellation with moving seeds',
  },
  lissajous: {
    component: lazy(() => import('./Lissajous')),
    defaultParams: {
      curveCount: 3, freqA: 3, freqB: 2, freqC: 5, phaseShift: 0, damping: 0,
      pointCount: 5000, scale: 8, drawSpeed: 2, animated: true, colorMode: 'rainbow',
      lineOpacity: 0.85, is3D: false, rotationSpeed: 0.2, phaseAnimate: true, phaseSpeed: 0.3,
      thickness: 1, trailGlow: true, glowLength: 0.05, freqRatio: 1, symmetry: 1,
    },
    defaultCameraDistance: 22,
    label: 'Lissajous',
    description: 'Animated Lissajous and harmonograph curves',
  },
  cellularAutomata: {
    component: lazy(() => import('./CellularAutomata')),
    defaultParams: {
      ruleSet: 'life', gridSize: 512, fillDensity: 0.3, stepsPerFrame: 1,
      aliveColor: '#00ff88', deadColor: '#050510', dyingColor: '#ff4444',
      wireColor: '#ffaa00', zoom: 1, wrap: true, colorByAge: false, ageColorSpeed: 0.1,
      seedPattern: 'random', drawSize: 3, showGrid: false, invertRules: false,
    },
    defaultCameraDistance: 1730,
    label: 'Cellular Automata',
    description: "Conway's Life, Brian's Brain, and other cellular automata",
  },
  fractal: {
    component: lazy(() => import('./Fractal')),
    defaultParams: {
      fractalType: 'mandelbrot', maxIterations: 200, power: 2, centerX: -0.5, centerY: 0,
      zoom: 1, juliaReal: -0.7, juliaImag: 0.27015, colorPalette: 'rainbow', colorSpeed: 2,
      colorOffset: 0, animateJulia: true, juliaSpeed: 0.3, autoZoom: false, autoZoomSpeed: 0.1,
      interiorColor: '#000000', glowAmount: 0.3, orbitTrap: false, trapShape: 'circle',
      smoothColoring: true,
    },
    defaultCameraDistance: 1730,
    label: 'Fractal',
    description: 'Mandelbrot, Julia sets, and other fractals',
  },
  waveInterference: {
    component: lazy(() => import('./WaveInterference')),
    defaultParams: {
      sourceCount: 3, frequency: 5, amplitude: 1, speed: 1, damping: 0, waveType: 'circular',
      displayMode: 'amplitude', colorScheme: 'blueRed', sourceMotion: 'orbit', motionSpeed: 0.5,
      sourceSpacing: 0.3, phaseOffset: 0, wavelength: 0.1, contrast: 1.5, brightness: 1,
      backgroundDark: true, rippleDecay: 0.5, interference: 'both',
    },
    defaultCameraDistance: 1730,
    label: 'Wave Interference',
    description: 'Superposition of multiple wave sources',
  },
  lSystems: {
    component: lazy(() => import('./LSystems')),
    defaultParams: {
      preset: 'tree', iterations: 5, angle: 25, length: 1, lengthFactor: 0.7, widthFactor: 0.7,
      scale: 5, drawSpeed: 3, animated: true, colorMode: 'depth', windStrength: 0.3,
      windSpeed: 1, randomVariation: 0, is3D: false, rotationSpeed: 0.2, branchTaper: true,
      leafSize: 0, leafColor: '#44ff44', symmetry: 1, lineOpacity: 0.9,
    },
    defaultCameraDistance: 25,
    label: 'L-Systems',
    description: 'Fractal trees and branching structures',
  },
  circlePacking: {
    component: lazy(() => import('./CirclePacking')),
    defaultParams: {
      maxCircles: 500, minRadius: 0.1, maxRadius: 3, growSpeed: 2, packingMode: 'random',
      colorMode: 'size', borderWidth: 0.02, borderColor: '#ffffff', fillOpacity: 0.8,
      animated: true, respawn: false, respawnSpeed: 0.5, spacing: 0.5, scale: 15,
      bobAmount: 0, bobSpeed: 0.5, rotateCircles: false, is3D: false, depthSpread: 0,
      pulseAmount: 0,
    },
    defaultCameraDistance: 35,
    label: 'Circle Packing',
    description: 'Progressive circle packing with animated growth',
  },
  magneticPendulum: {
    component: lazy(() => import('./MagneticPendulum')),
    defaultParams: {
      magnetCount: 3, friction: 0.1, magnetStrength: 1, gravity: 0.5, maxIterations: 150,
      zoom: 1, centerX: 0, centerY: 0, colorSaturation: 0.8, colorBrightness: 0.7,
      showMagnets: true, magnetSize: 3, animateMagnets: true, animateSpeed: 0.2,
      magnetRadius: 0.3, settleThreshold: 0.01, colorByTime: false, timeColorSpeed: 1,
      pendulumHeight: 0.5, contrast: 1.5,
    },
    defaultCameraDistance: 1730,
    label: 'Magnetic Pendulum',
    description: 'Fractal basin boundaries of a magnetic pendulum',
  },
  domainWarping: {
    component: lazy(() => import('./DomainWarping')),
    defaultParams: {
      warpLayers: 2, warpStrength: 1.5, noiseScale: 2, octaves: 5, lacunarity: 2, gain: 0.5,
      speed: 0.3, colorPalette: 'marble', colorContrast: 1.5, colorOffset: 0, colorCycles: 1,
      zoom: 1, rotation: 0, rotationSpeed: 0, ridged: false, turbulence: false, sharpness: 0,
      brightness: 1, mixMode: 'normal', secondaryWarp: 0,
    },
    defaultCameraDistance: 1730,
    label: 'Domain Warping',
    description: 'Self-referential noise distortion — marble, smoke, and alien textures',
  },
  spirograph: {
    component: lazy(() => import('./Spirograph')),
    defaultParams: {
      curveType: 'hypotrochoid', outerRadius: 5, innerRadius: 3, penDistance: 2.5,
      pointCount: 8000, scale: 5, drawSpeed: 3, animated: true, colorMode: 'rainbow',
      lineOpacity: 0.85, layerCount: 1, layerOffset: 0.5, rotationSpeed: 0.1, evolveSpeed: 0,
      trailGlow: true, glowLength: 0.05, petals: 0, mirrorX: false, mirrorY: false,
      thickness: 1, colorCycleSpeed: 0,
    },
    defaultCameraDistance: 45,
    label: 'Spirograph',
    description: 'Hypotrochoid and epitrochoid spirograph curves',
  },
  cloth: {
    component: lazy(() => import('./Cloth')),
    defaultParams: {
      gridWidth: 40, gridHeight: 40, spacing: 0.3, gravity: 0.5, windStrength: 1,
      windDirection: 0, windTurbulence: 0.5, damping: 0.97, stiffness: 1,
      constraintIterations: 3, pinMode: 'topEdge', colorMode: 'stress', colorA: '#22d3ee',
      colorB: '#d946ef', wireframe: false, meshOpacity: 0.9, lightIntensity: 1, mouseForce: 2,
      wave: 0, waveSpeed: 1, rotationSpeed: 0.1,
    },
    defaultCameraDistance: 18,
    label: 'Cloth',
    description: 'Soft-body cloth simulation with wind and physics',
  },
  electricField: {
    component: lazy(() => import('./ElectricField')),
    defaultParams: {
      chargeCount: 4, chargePattern: 'dipole', displayMode: 'magnitude', colorPalette: 'electric',
      fieldScale: 1, logScale: true, contourLines: true, contourCount: 15, contourWidth: 1.5,
      animateCharges: true, animateSpeed: 0.3, chargeStrength: 1, alternatePolarity: true,
      zoom: 1, brightness: 1, contrast: 1.5, showCharges: true, chargeSize: 5,
      vectorField: false, vectorDensity: 20,
    },
    defaultCameraDistance: 1730,
    label: 'Electric Field',
    description: 'Electric field visualization from point charges',
  },
  voxelLandscape: {
    component: lazy(() => import('./VoxelLandscape')),
    defaultParams: {
      worldSize: 32, heightScale: 8, noiseScale: 0.06, noiseOctaves: 4, waterLevel: -2,
      snowLevel: 12, treeDensity: 0.3, rotationSpeed: 0.05, caveThreshold: 0.15,
      terrainSeed: 42,
    },
    defaultCameraDistance: 40,
    label: 'Voxel Landscape',
    description: 'Minecraft-style procedural voxel terrain with trees and caves',
  },
}

export function getPatternComponent(
  patternType: string,
): ComponentType<{ params: Record<string, unknown> }> | null {
  return registry[patternType]?.component ?? null
}

export function getDefaultParams(patternType: string): Record<string, unknown> {
  return registry[patternType]?.defaultParams ?? {}
}

export function getDefaultCameraDistance(patternType: string): number {
  return registry[patternType]?.defaultCameraDistance ?? 500
}

export function getPatternLabel(patternType: string): string {
  return registry[patternType]?.label ?? patternType
}

export function getAllPatternTypes(): {
  type: string
  label: string
  description: string
  isUserPattern?: boolean
  isNodeGraph?: boolean
  readOnly?: boolean
}[] {
  return Object.entries(registry)
    .filter(([, entry]) => entry.isNodeGraph)
    .map(([type, entry]) => ({
      type,
      label: entry.label,
      description: entry.description,
      isUserPattern: entry.isUserPattern,
      isNodeGraph: entry.isNodeGraph,
      readOnly: entry.readOnly,
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

export function getParameterSchema(patternType: string): ParamSchemaEntry[] | undefined {
  return registry[patternType]?.parameterSchema
}

/**
 * Register user-created patterns from the node designer.
 * Called on app startup and when patterns are saved/deleted.
 */
export function registerUserPatterns(patterns: {
  id: string
  name: string
  description: string
  defaultParams: Record<string, unknown>
  parameterSchema?: ParamSchemaEntry[]
  defaultCameraDistance: number
  readOnly?: boolean
}[]) {
  // Remove old user patterns (prefixed with user_)
  for (const key of Object.keys(registry)) {
    if (key.startsWith('user_')) delete registry[key]
  }
  // Add current user patterns
  for (const p of patterns) {
    const graphId = p.id
    registry[`user_${graphId}`] = {
      component: UserPatternComponent,
      defaultParams: { __graphId: graphId, ...p.defaultParams },
      defaultCameraDistance: p.defaultCameraDistance,
      label: p.name,
      description: p.description,
      parameterSchema: p.parameterSchema,
      isUserPattern: true,
      isNodeGraph: true,
      readOnly: p.readOnly,
    }
  }
}

/**
 * Register built-in patterns that have been converted to node graphs.
 * These REPLACE the original React component entries.
 */
export function registerBuiltinNodeGraphs(patterns: {
  originalType: string
  id: string
  name: string
  description: string
  defaultParams: Record<string, unknown>
  parameterSchema?: ParamSchemaEntry[]
  defaultCameraDistance: number
}[]) {
  for (const p of patterns) {
    // Override old React component entry for backward compat (old saved scenes).
    // NOT marked isNodeGraph so it won't appear in the picker — the user_* version
    // from registerUserPatterns is the visible one.
    registry[p.originalType] = {
      component: UserPatternComponent,
      defaultParams: { __graphId: p.id, ...p.defaultParams },
      defaultCameraDistance: p.defaultCameraDistance,
      label: p.name,
      description: p.description,
      parameterSchema: p.parameterSchema,
      readOnly: true,
    }
  }
}
