/**
 * Client-side genome mutation and evolution.
 * Ported from backend/services/evolution.go — no server round-trips needed.
 */
import type { Genome, Layer } from '../types/genome'
import { getParameterSchema } from '../patterns/PatternRegistry'
import type { ParamSchemaEntry } from '../patterns/PatternRegistry'

// ─── Helpers ──────────────────────────────────────────────────────

function clampFloat(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function randDelta(min: number, max: number, strength: number): number {
  const range = (max - min) * strength * 0.3
  return (Math.random() * 2 - 1) * range
}

function toNumber(v: unknown): number {
  if (typeof v === 'number') return v
  return 0
}

function clampByte(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)))
}

function hexToByte(s: string): number {
  return parseInt(s, 16) || 0
}

function byteToHex(b: number): string {
  return b.toString(16).padStart(2, '0')
}

function mutateColor(hex: string, strength: number): string {
  if (typeof hex !== 'string' || hex.length !== 7 || hex[0] !== '#') return hex
  const r = hexToByte(hex.slice(1, 3))
  const g = hexToByte(hex.slice(3, 5))
  const b = hexToByte(hex.slice(5, 7))

  const maxShift = Math.max(1, Math.round(strength * 60))
  const nr = clampByte(r + Math.floor(Math.random() * (2 * maxShift + 1)) - maxShift)
  const ng = clampByte(g + Math.floor(Math.random() * (2 * maxShift + 1)) - maxShift)
  const nb = clampByte(b + Math.floor(Math.random() * (2 * maxShift + 1)) - maxShift)

  return '#' + byteToHex(nr) + byteToHex(ng) + byteToHex(nb)
}

// ─── Schema inference (fallback when no registered schema) ──────

function inferSchema(params: Record<string, unknown>): ParamSchemaEntry[] {
  const schema: ParamSchemaEntry[] = []
  for (const [name, value] of Object.entries(params)) {
    if (name.startsWith('__')) continue
    if (typeof value === 'number') {
      const absVal = Math.abs(value)
      const max = absVal < 1 ? 1 : absVal < 10 ? 10 : absVal < 100 ? 100 : absVal < 1000 ? 1000 : 10000
      const isInt = Number.isInteger(value)
      schema.push({
        name,
        type: isInt && absVal > 1 ? 'int' : 'float',
        min: value < 0 ? -max : 0,
        max,
        default: value,
      })
    } else if (typeof value === 'boolean') {
      schema.push({ name, type: 'bool', default: value })
    } else if (typeof value === 'string') {
      if (/^#[0-9a-fA-F]{6}$/.test(value)) {
        schema.push({ name, type: 'color', default: value })
      }
    }
  }
  return schema
}

// ─── Single-param mutation ──────────────────────────────────────

function mutateParam(ps: ParamSchemaEntry, val: unknown, strength: number): unknown {
  switch (ps.type) {
    case 'float': {
      const f = toNumber(val)
      const delta = randDelta(ps.min ?? 0, ps.max ?? 1, strength)
      return clampFloat(f + delta, ps.min ?? 0, ps.max ?? 1)
    }
    case 'int': {
      const f = toNumber(val)
      const delta = randDelta(ps.min ?? 0, ps.max ?? 100, strength)
      return Math.round(clampFloat(f + delta, ps.min ?? 0, ps.max ?? 100))
    }
    case 'bool': {
      if (Math.random() < 0.3 * strength && typeof val === 'boolean') {
        return !val
      }
      return val
    }
    case 'enum': {
      if (ps.enumValues && ps.enumValues.length > 0 && Math.random() < 0.5 * strength) {
        return ps.enumValues[Math.floor(Math.random() * ps.enumValues.length)]
      }
      return val
    }
    case 'color': {
      if (typeof val === 'string') return mutateColor(val, strength)
      return val
    }
    default:
      return val
  }
}

// ─── Deep clone helpers ─────────────────────────────────────────

function cloneLayer(l: Layer): Layer {
  return { ...l, params: { ...l.params } }
}

function cloneGenome(g: Genome): Genome {
  return {
    ...g,
    layers: g.layers.map(cloneLayer),
    globalParams: {
      ...g.globalParams,
      colorPalette: {
        ...g.globalParams.colorPalette,
        colors: [...(g.globalParams.colorPalette.colors || [])],
      },
      animation: { ...g.globalParams.animation },
      mouseInteraction: { ...g.globalParams.mouseInteraction },
      parallax: { ...g.globalParams.parallax },
    },
  }
}

// ─── Public API ─────────────────────────────────────────────────

/** Mutate a genome's parameters in-place (returns new clone). */
export function mutateGenome(genome: Genome, strength: number): Genome {
  const result = cloneGenome(genome)

  // Optionally mutate global params
  if (Math.random() < 0.3 * strength) {
    result.globalParams.bloomStrength = clampFloat(
      result.globalParams.bloomStrength + randDelta(0, 3, strength), 0, 3,
    )
  }
  if (Math.random() < 0.3 * strength) {
    result.globalParams.bloomRadius = clampFloat(
      result.globalParams.bloomRadius + randDelta(0, 1, strength), 0, 1,
    )
  }
  if (Math.random() < 0.3 * strength) {
    result.globalParams.animation.speed = clampFloat(
      result.globalParams.animation.speed + randDelta(0, 5, strength), 0, 5,
    )
  }
  if (Math.random() < 0.3 * strength) {
    result.globalParams.animation.timeScale = clampFloat(
      result.globalParams.animation.timeScale + randDelta(0.1, 5, strength), 0.1, 5,
    )
  }

  // Mutate each layer's params
  for (let i = 0; i < result.layers.length; i++) {
    const layer = result.layers[i]
    let schema = getParameterSchema(layer.patternType)
    if (!schema || schema.length === 0) {
      schema = inferSchema(layer.params)
    }
    if (!schema || schema.length === 0) continue

    const mutatedParams: Record<string, unknown> = { ...layer.params }
    for (const ps of schema) {
      const val = mutatedParams[ps.name]
      if (val === undefined) continue
      if (Math.random() > strength) continue
      mutatedParams[ps.name] = mutateParam(ps, val, strength)
    }
    result.layers[i].params = mutatedParams

    // Occasionally mutate opacity
    if (Math.random() < 0.2 * strength) {
      result.layers[i].opacity = clampFloat(
        result.layers[i].opacity + randDelta(0, 1, strength * 0.3), 0, 1,
      )
    }
  }

  return result
}

/** Crossover two genomes, taking traits from each. */
export function crossoverGenomes(a: Genome, b: Genome): Genome {
  const result = cloneGenome(a)

  if (Math.random() < 0.5) result.globalParams.backgroundColor = b.globalParams.backgroundColor
  if (Math.random() < 0.5) {
    result.globalParams.bloomStrength = b.globalParams.bloomStrength
    result.globalParams.bloomRadius = b.globalParams.bloomRadius
    result.globalParams.bloomThreshold = b.globalParams.bloomThreshold
  }
  if (Math.random() < 0.5) {
    result.globalParams.colorPalette = {
      ...b.globalParams.colorPalette,
      colors: [...(b.globalParams.colorPalette.colors || [])],
    }
  }
  if (Math.random() < 0.5) result.globalParams.animation = { ...b.globalParams.animation }
  if (Math.random() < 0.5) result.globalParams.mouseInteraction = { ...b.globalParams.mouseInteraction }

  // Layer crossover
  const maxLayers = Math.max(a.layers.length, b.layers.length)
  const crossedLayers: Layer[] = []

  for (let i = 0; i < maxLayers; i++) {
    if (i < a.layers.length && i < b.layers.length) {
      const la = a.layers[i]
      const lb = b.layers[i]
      if (la.patternType === lb.patternType) {
        const crossed = cloneLayer(la)
        for (const [k, v] of Object.entries(lb.params)) {
          if (Math.random() < 0.5) crossed.params[k] = v
        }
        if (Math.random() < 0.5) crossed.opacity = lb.opacity
        if (Math.random() < 0.5) crossed.blendMode = lb.blendMode
        crossedLayers.push(crossed)
      } else {
        crossedLayers.push(Math.random() < 0.5 ? cloneLayer(la) : cloneLayer(lb))
      }
    } else if (i < a.layers.length) {
      if (Math.random() < 0.7) crossedLayers.push(cloneLayer(a.layers[i]))
    } else if (i < b.layers.length) {
      if (Math.random() < 0.7) crossedLayers.push(cloneLayer(b.layers[i]))
    }
  }
  result.layers = crossedLayers
  return result
}

/** Generate count candidate genomes using the specified strategy. */
export function generateCandidates(
  source: Genome,
  count: number,
  strategy: 'mutate' | 'crossover' | 'random' | 'mix' = 'mix',
): Genome[] {
  const candidates: Genome[] = []

  for (let i = 0; i < count; i++) {
    switch (strategy) {
      case 'mutate': {
        const strength = 0.2 + Math.random() * 0.6
        candidates.push(mutateGenome(source, strength))
        break
      }
      case 'crossover': {
        const a = mutateGenome(source, 0.3)
        const b = mutateGenome(source, 0.3)
        candidates.push(crossoverGenomes(a, b))
        break
      }
      case 'random':
        candidates.push(mutateGenome(source, 1.0))
        break
      case 'mix':
      default: {
        const r = Math.random()
        if (r < 0.5) {
          const strength = 0.2 + Math.random() * 0.6
          candidates.push(mutateGenome(source, strength))
        } else if (r < 0.8) {
          const a = mutateGenome(source, 0.3)
          const b = mutateGenome(source, 0.3)
          candidates.push(crossoverGenomes(a, b))
        } else {
          candidates.push(mutateGenome(source, 1.0))
        }
        break
      }
    }
  }

  return candidates
}
