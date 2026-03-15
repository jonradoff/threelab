// Port types for node connections
export type PortType = 'number' | 'array' | 'positions' | 'colors' | 'color' | 'string'

export interface PortDef {
  name: string
  type: PortType
  default?: unknown
  label?: string
}

export interface NodeData {
  [key: string]: unknown
}

export type Category = 'input' | 'math' | 'generator' | 'transform' | 'color' | 'animation' | 'output' | 'shader'

export const CATEGORY_COLORS: Record<Category, string> = {
  input: '#22c55e',
  math: '#6366f1',
  generator: '#14b8a6',
  transform: '#3b82f6',
  color: '#ec4899',
  animation: '#f97316',
  output: '#ef4444',
  shader: '#f59e0b',
}

export const PORT_TYPE_COLORS: Record<PortType, string> = {
  number: '#a78bfa',
  array: '#60a5fa',
  positions: '#34d399',
  colors: '#fbbf24',
  color: '#f472b6',
  string: '#f59e0b',
}

// Compatible types for connections
export function canConnect(source: PortType, target: PortType): boolean {
  if (source === target) return true
  if (source === 'color' && target === 'positions') return false
  if (source === 'positions' && target === 'color') return false
  // number can feed into array (broadcast)
  if (source === 'number' && target === 'array') return true
  if (source === 'string' && target === 'array') return true
  return false
}

export interface ExecutionContext {
  elapsed: number
  delta: number
  params: Record<string, unknown>
  frameState: Map<string, unknown>
  resolution?: [number, number]
  /** Mouse position in NDC (-1 to 1), if available */
  mouse?: { x: number; y: number }
  /** Mouse velocity in NDC per frame */
  mouseVelocity?: { x: number; y: number }
}

export interface PatternNodeDef {
  type: string
  label: string
  category: Category
  inputs: PortDef[]
  outputs: PortDef[]
  // data fields editable on the node itself (inline controls)
  dataFields?: { name: string; type: 'number' | 'string' | 'color'; default: unknown; label?: string; min?: number; max?: number }[]
  evaluate: (
    inputs: Record<string, unknown>,
    data: Record<string, unknown>,
    ctx: ExecutionContext,
    nodeId: string,
  ) => Record<string, unknown>
  /** Source code of the evaluate function body (for code editor display/editing) */
  evaluateSource?: string
}

// ─── Dynamic code compilation ───────────────────────────────────

/** Helper functions injected into evaluate scope */
const EVAL_HELPERS = {
  hsl: (h: number, s: number, l: number): [number, number, number] => {
    const c = (1 - Math.abs(2 * l - 1)) * s
    const x = c * (1 - Math.abs(((h * 6) % 2) - 1))
    const m = l - c / 2
    let r = 0, g = 0, b = 0
    const hp = h * 6
    if (hp < 1) { r = c; g = x }
    else if (hp < 2) { r = x; g = c }
    else if (hp < 3) { g = c; b = x }
    else if (hp < 4) { g = x; b = c }
    else if (hp < 5) { r = x; b = c }
    else { r = c; b = x }
    return [r + m, g + m, b + m]
  },
}

const compiledCache = new Map<string, PatternNodeDef['evaluate']>()

export function compileEvaluate(source: string): PatternNodeDef['evaluate'] {
  const cached = compiledCache.get(source)
  if (cached) return cached
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function('inputs', 'data', 'ctx', 'nodeId', 'helpers', source) as (
      inputs: Record<string, unknown>,
      data: Record<string, unknown>,
      ctx: ExecutionContext,
      nodeId: string,
      helpers: typeof EVAL_HELPERS,
    ) => Record<string, unknown>
    const wrapped: PatternNodeDef['evaluate'] = (inputs, data, ctx, nodeId) => {
      try {
        return fn(inputs, data, ctx, nodeId, EVAL_HELPERS)
      } catch (e) {
        console.warn('Node evaluate error:', e)
        return { __error: String(e) }
      }
    }
    compiledCache.set(source, wrapped)
    return wrapped
  } catch (e) {
    console.warn('Node compile error:', e)
    const errFn: PatternNodeDef['evaluate'] = () => ({ __error: String(e) })
    return errFn
  }
}

export function clearCompileCache() {
  compiledCache.clear()
}

// ─── Node Definitions ────────────────────────────────────────────

const NODE_DEFS: PatternNodeDef[] = [
  // ── Input ──
  {
    type: 'time',
    label: 'Time',
    category: 'input',
    inputs: [],
    outputs: [{ name: 'elapsed', type: 'number' }, { name: 'delta', type: 'number' }],
    evaluate: (_inputs, _data, ctx) => ({
      elapsed: ctx.elapsed,
      delta: ctx.delta,
    }),
  },
  {
    type: 'float_const',
    label: 'Float',
    category: 'input',
    inputs: [],
    outputs: [{ name: 'value', type: 'number' }],
    dataFields: [{ name: 'value', type: 'number', default: 0, label: 'Value', min: -1000, max: 1000 }],
    evaluate: (_inputs, data) => ({
      value: (data.value as number) ?? 0,
    }),
  },
  {
    type: 'int_const',
    label: 'Integer',
    category: 'input',
    inputs: [],
    outputs: [{ name: 'value', type: 'number' }],
    dataFields: [{ name: 'value', type: 'number', default: 100, label: 'Value', min: 1, max: 50000 }],
    evaluate: (_inputs, data) => ({
      value: Math.round((data.value as number) ?? 100),
    }),
  },
  {
    type: 'param_input',
    label: 'Parameter',
    category: 'input',
    inputs: [],
    outputs: [{ name: 'value', type: 'number' }],
    dataFields: [
      { name: 'paramName', type: 'string', default: 'myParam', label: 'Name' },
      { name: 'paramType', type: 'string', default: 'float', label: 'Type' },
      { name: 'defaultValue', type: 'number', default: 0, label: 'Default' },
      { name: 'min', type: 'number', default: 0, label: 'Min' },
      { name: 'max', type: 'number', default: 1, label: 'Max' },
      { name: 'enumValues', type: 'string', default: '', label: 'Enum Values' },
    ],
    evaluate: (_inputs, data, ctx) => {
      const name = (data.paramName as string) ?? 'myParam'
      const paramType = (data.paramType as string) ?? 'float'
      const def = (data.defaultValue as number) ?? 0
      const val = ctx.params[name]
      if (paramType === 'enum') {
        // Enum: value stored as string in params, output as index
        const enumStr = (data.enumValues as string) ?? ''
        const enumVals = enumStr.split(',').map((s) => s.trim()).filter(Boolean)
        if (typeof val === 'string') {
          const idx = enumVals.indexOf(val)
          return { value: idx >= 0 ? idx : 0 }
        }
        return { value: typeof val === 'number' ? val : def }
      }
      if (paramType === 'bool') {
        if (val !== undefined) {
          return { value: val ? 1 : 0 }
        }
        return { value: def ? 1 : 0 }
      }
      if (paramType === 'int') {
        const v = typeof val === 'number' ? val : def
        return { value: Math.round(v) }
      }
      return { value: typeof val === 'number' ? val : def }
    },
  },

  // ── Math ──
  {
    type: 'sin',
    label: 'Sin',
    category: 'math',
    inputs: [{ name: 'x', type: 'number', default: 0 }],
    outputs: [{ name: 'result', type: 'number' }],
    evaluate: (inputs) => {
      const x = inputs.x
      if (x instanceof Float32Array) {
        const out = new Float32Array(x.length)
        for (let i = 0; i < x.length; i++) out[i] = Math.sin(x[i])
        return { result: out }
      }
      return { result: Math.sin((x as number) ?? 0) }
    },
  },
  {
    type: 'cos',
    label: 'Cos',
    category: 'math',
    inputs: [{ name: 'x', type: 'number', default: 0 }],
    outputs: [{ name: 'result', type: 'number' }],
    evaluate: (inputs) => {
      const x = inputs.x
      if (x instanceof Float32Array) {
        const out = new Float32Array(x.length)
        for (let i = 0; i < x.length; i++) out[i] = Math.cos(x[i])
        return { result: out }
      }
      return { result: Math.cos((x as number) ?? 0) }
    },
  },
  {
    type: 'add',
    label: 'Add',
    category: 'math',
    inputs: [
      { name: 'a', type: 'number', default: 0 },
      { name: 'b', type: 'number', default: 0 },
    ],
    outputs: [{ name: 'result', type: 'number' }],
    evaluate: (inputs) => {
      const a = inputs.a
      const b = inputs.b
      if (a instanceof Float32Array && b instanceof Float32Array) {
        const len = Math.min(a.length, b.length)
        const out = new Float32Array(len)
        for (let i = 0; i < len; i++) out[i] = a[i] + b[i]
        return { result: out }
      }
      if (a instanceof Float32Array) {
        const bv = (b as number) ?? 0
        const out = new Float32Array(a.length)
        for (let i = 0; i < a.length; i++) out[i] = a[i] + bv
        return { result: out }
      }
      if (b instanceof Float32Array) {
        const av = (a as number) ?? 0
        const out = new Float32Array(b.length)
        for (let i = 0; i < b.length; i++) out[i] = av + b[i]
        return { result: out }
      }
      return { result: ((a as number) ?? 0) + ((b as number) ?? 0) }
    },
  },
  {
    type: 'multiply',
    label: 'Multiply',
    category: 'math',
    inputs: [
      { name: 'a', type: 'number', default: 0 },
      { name: 'b', type: 'number', default: 1 },
    ],
    outputs: [{ name: 'result', type: 'number' }],
    evaluate: (inputs) => {
      const a = inputs.a
      const b = inputs.b
      if (a instanceof Float32Array && b instanceof Float32Array) {
        const len = Math.min(a.length, b.length)
        const out = new Float32Array(len)
        for (let i = 0; i < len; i++) out[i] = a[i] * b[i]
        return { result: out }
      }
      if (a instanceof Float32Array) {
        const bv = (b as number) ?? 1
        const out = new Float32Array(a.length)
        for (let i = 0; i < a.length; i++) out[i] = a[i] * bv
        return { result: out }
      }
      if (b instanceof Float32Array) {
        const av = (a as number) ?? 0
        const out = new Float32Array(b.length)
        for (let i = 0; i < b.length; i++) out[i] = av * b[i]
        return { result: out }
      }
      return { result: ((a as number) ?? 0) * ((b as number) ?? 1) }
    },
  },
  {
    type: 'divide',
    label: 'Divide',
    category: 'math',
    inputs: [
      { name: 'a', type: 'number', default: 0 },
      { name: 'b', type: 'number', default: 1 },
    ],
    outputs: [{ name: 'result', type: 'number' }],
    evaluate: (inputs) => {
      const a = inputs.a
      const b = inputs.b
      const safeDiv = (x: number, y: number) => y === 0 ? 0 : x / y
      if (a instanceof Float32Array) {
        const bv = (b as number) ?? 1
        const out = new Float32Array(a.length)
        for (let i = 0; i < a.length; i++) out[i] = safeDiv(a[i], bv)
        return { result: out }
      }
      return { result: safeDiv((a as number) ?? 0, (b as number) ?? 1) }
    },
  },
  {
    type: 'remap',
    label: 'Remap',
    category: 'math',
    inputs: [{ name: 'x', type: 'number', default: 0 }],
    outputs: [{ name: 'result', type: 'number' }],
    dataFields: [
      { name: 'inMin', type: 'number', default: 0, label: 'In Min' },
      { name: 'inMax', type: 'number', default: 1, label: 'In Max' },
      { name: 'outMin', type: 'number', default: 0, label: 'Out Min' },
      { name: 'outMax', type: 'number', default: 1, label: 'Out Max' },
    ],
    evaluate: (inputs, data) => {
      const inMin = (data.inMin as number) ?? 0
      const inMax = (data.inMax as number) ?? 1
      const outMin = (data.outMin as number) ?? 0
      const outMax = (data.outMax as number) ?? 1
      const remap = (v: number) => {
        const t = inMax === inMin ? 0 : (v - inMin) / (inMax - inMin)
        return outMin + t * (outMax - outMin)
      }
      const x = inputs.x
      if (x instanceof Float32Array) {
        const out = new Float32Array(x.length)
        for (let i = 0; i < x.length; i++) out[i] = remap(x[i])
        return { result: out }
      }
      return { result: remap((x as number) ?? 0) }
    },
  },
  {
    type: 'negate',
    label: 'Negate',
    category: 'math',
    inputs: [{ name: 'x', type: 'number', default: 0 }],
    outputs: [{ name: 'result', type: 'number' }],
    evaluate: (inputs) => {
      const x = inputs.x
      if (x instanceof Float32Array) {
        const out = new Float32Array(x.length)
        for (let i = 0; i < x.length; i++) out[i] = -x[i]
        return { result: out }
      }
      return { result: -((x as number) ?? 0) }
    },
  },

  // ── Generator ──
  {
    type: 'range',
    label: 'Range',
    category: 'generator',
    inputs: [{ name: 'count', type: 'number', default: 1000 }],
    outputs: [{ name: 'values', type: 'array' }],
    dataFields: [
      { name: 'start', type: 'number', default: 0, label: 'Start' },
      { name: 'end', type: 'number', default: 50, label: 'End' },
    ],
    evaluate: (inputs, data) => {
      const count = Math.max(2, Math.min(50000, Math.round((inputs.count as number) ?? 1000)))
      const start = (data.start as number) ?? 0
      const end = (data.end as number) ?? 50
      const values = new Float32Array(count)
      for (let i = 0; i < count; i++) {
        values[i] = start + (end - start) * (i / (count - 1))
      }
      return { values }
    },
  },
  {
    type: 'parametric_xy',
    label: 'Parametric XY',
    category: 'generator',
    inputs: [
      { name: 't', type: 'array' },
      { name: 'freqA', type: 'number', default: 3 },
      { name: 'freqB', type: 'number', default: 2 },
      { name: 'scale', type: 'number', default: 8 },
      { name: 'phase', type: 'number', default: 0 },
    ],
    outputs: [{ name: 'positions', type: 'positions' }],
    evaluate: (inputs) => {
      const t = inputs.t as Float32Array | null
      if (!t || !(t instanceof Float32Array)) {
        return { positions: new Float32Array(0) }
      }
      const freqA = (inputs.freqA as number) ?? 3
      const freqB = (inputs.freqB as number) ?? 2
      const scale = (inputs.scale as number) ?? 8
      const phase = (inputs.phase as number) ?? 0
      const positions = new Float32Array(t.length * 3)
      for (let i = 0; i < t.length; i++) {
        positions[i * 3] = Math.sin(freqA * t[i] + phase) * scale
        positions[i * 3 + 1] = Math.sin(freqB * t[i]) * scale
        positions[i * 3 + 2] = 0
      }
      return { positions }
    },
  },

  // ── Transform ──
  {
    type: 'scale_positions',
    label: 'Scale',
    category: 'transform',
    inputs: [
      { name: 'positions', type: 'positions' },
      { name: 'factor', type: 'number', default: 1 },
    ],
    outputs: [{ name: 'positions', type: 'positions' }],
    evaluate: (inputs) => {
      const pos = inputs.positions as Float32Array | null
      if (!pos || !(pos instanceof Float32Array)) return { positions: new Float32Array(0) }
      const factor = (inputs.factor as number) ?? 1
      const out = new Float32Array(pos.length)
      for (let i = 0; i < pos.length; i++) out[i] = pos[i] * factor
      return { positions: out }
    },
  },
  {
    type: 'damping_envelope',
    label: 'Damping',
    category: 'transform',
    inputs: [
      { name: 'positions', type: 'positions' },
      { name: 'amount', type: 'number', default: 0.01 },
    ],
    outputs: [{ name: 'positions', type: 'positions' }],
    evaluate: (inputs) => {
      const pos = inputs.positions as Float32Array | null
      if (!pos || !(pos instanceof Float32Array)) return { positions: new Float32Array(0) }
      const amount = (inputs.amount as number) ?? 0.01
      const count = pos.length / 3
      const out = new Float32Array(pos.length)
      for (let i = 0; i < count; i++) {
        const decay = Math.exp(-amount * i)
        out[i * 3] = pos[i * 3] * decay
        out[i * 3 + 1] = pos[i * 3 + 1] * decay
        out[i * 3 + 2] = pos[i * 3 + 2] * decay
      }
      return { positions: out }
    },
  },

  // ── Color ──
  {
    type: 'rainbow_gradient',
    label: 'Rainbow',
    category: 'color',
    inputs: [{ name: 't', type: 'array' }],
    outputs: [{ name: 'colors', type: 'colors' }],
    dataFields: [{ name: 'speed', type: 'number', default: 1, label: 'Speed', min: 0.1, max: 10 }],
    evaluate: (inputs, data) => {
      const t = inputs.t as Float32Array | null
      if (!t || !(t instanceof Float32Array)) return { colors: new Float32Array(0) }
      const speed = (data.speed as number) ?? 1
      const tMax = t[t.length - 1] || 1
      const colors = new Float32Array(t.length * 3)
      for (let i = 0; i < t.length; i++) {
        const frac = ((t[i] / tMax) * speed) % 1
        const h = frac * 360
        // HSL to RGB (s=1, l=0.5)
        const c = 1
        const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
        let r = 0, g = 0, b = 0
        if (h < 60) { r = c; g = x }
        else if (h < 120) { r = x; g = c }
        else if (h < 180) { g = c; b = x }
        else if (h < 240) { g = x; b = c }
        else if (h < 300) { r = x; b = c }
        else { r = c; b = x }
        colors[i * 3] = r
        colors[i * 3 + 1] = g
        colors[i * 3 + 2] = b
      }
      return { colors }
    },
  },
  {
    type: 'solid_color',
    label: 'Solid Color',
    category: 'color',
    inputs: [{ name: 'count', type: 'number', default: 100 }],
    outputs: [{ name: 'colors', type: 'colors' }],
    dataFields: [{ name: 'color', type: 'color', default: '#22d3ee', label: 'Color' }],
    evaluate: (inputs, data) => {
      const count = Math.max(1, Math.round((inputs.count as number) ?? 100))
      const hex = (data.color as string) ?? '#22d3ee'
      const r = parseInt(hex.slice(1, 3), 16) / 255
      const g = parseInt(hex.slice(3, 5), 16) / 255
      const b = parseInt(hex.slice(5, 7), 16) / 255
      const colors = new Float32Array(count * 3)
      for (let i = 0; i < count; i++) {
        colors[i * 3] = r
        colors[i * 3 + 1] = g
        colors[i * 3 + 2] = b
      }
      return { colors }
    },
  },
  {
    type: 'color_by_speed',
    label: 'Color by Speed',
    category: 'color',
    inputs: [{ name: 'positions', type: 'positions' }],
    outputs: [{ name: 'colors', type: 'colors' }],
    evaluate: (inputs) => {
      const pos = inputs.positions as Float32Array | null
      if (!pos || !(pos instanceof Float32Array) || pos.length < 6) {
        return { colors: new Float32Array(0) }
      }
      const count = pos.length / 3
      const speeds = new Float32Array(count)
      let maxSpeed = 0
      for (let i = 1; i < count; i++) {
        const dx = pos[i * 3] - pos[(i - 1) * 3]
        const dy = pos[i * 3 + 1] - pos[(i - 1) * 3 + 1]
        speeds[i] = Math.sqrt(dx * dx + dy * dy)
        if (speeds[i] > maxSpeed) maxSpeed = speeds[i]
      }
      speeds[0] = speeds[1]
      const colors = new Float32Array(count * 3)
      for (let i = 0; i < count; i++) {
        const t = maxSpeed > 0 ? speeds[i] / maxSpeed : 0
        // Blue(slow) → Cyan → Yellow → Red(fast)
        colors[i * 3] = t
        colors[i * 3 + 1] = 1 - Math.abs(t - 0.5) * 2
        colors[i * 3 + 2] = 1 - t
      }
      return { colors }
    },
  },

  // ── Animation ──
  {
    type: 'progressive_draw',
    label: 'Progressive Draw',
    category: 'animation',
    inputs: [
      { name: 'totalCount', type: 'number', default: 1000 },
      { name: 'speed', type: 'number', default: 2 },
    ],
    outputs: [{ name: 'drawCount', type: 'number' }],
    evaluate: (inputs, _data, ctx, nodeId) => {
      const total = (inputs.totalCount as number) ?? 1000
      const speed = (inputs.speed as number) ?? 2
      const key = `${nodeId}_progress`
      let progress = (ctx.frameState.get(key) as number) ?? 0
      progress += ctx.delta * speed * 0.5
      if (progress > 1) progress -= Math.floor(progress)
      ctx.frameState.set(key, progress)
      return { drawCount: Math.floor(progress * total) }
    },
  },
  {
    type: 'phase_animate',
    label: 'Phase Animate',
    category: 'animation',
    inputs: [{ name: 'speed', type: 'number', default: 0.3 }],
    outputs: [{ name: 'phase', type: 'number' }],
    evaluate: (inputs, _data, ctx) => {
      const speed = (inputs.speed as number) ?? 0.3
      return { phase: ctx.elapsed * speed }
    },
  },

  // ── Compound generators ──
  {
    type: 'lissajous_generator',
    label: 'Lissajous',
    category: 'generator',
    inputs: [
      { name: 'pointCount', type: 'number', default: 5000 },
      { name: 'curveCount', type: 'number', default: 3 },
      { name: 'freqA', type: 'number', default: 3 },
      { name: 'freqB', type: 'number', default: 2 },
      { name: 'freqC', type: 'number', default: 5 },
      { name: 'phaseShift', type: 'number', default: 0 },
      { name: 'damping', type: 'number', default: 0 },
      { name: 'scale', type: 'number', default: 8 },
      { name: 'is3D', type: 'number', default: 0 },
      { name: 'freqRatio', type: 'number', default: 1 },
      { name: 'symmetry', type: 'number', default: 1 },
      { name: 'colorMode', type: 'number', default: 0 },
      { name: 'phaseAnimate', type: 'number', default: 1 },
      { name: 'phaseSpeed', type: 'number', default: 0.3 },
      { name: 'animated', type: 'number', default: 1 },
      { name: 'drawSpeed', type: 'number', default: 2 },
      { name: 'rotationSpeed', type: 'number', default: 0.2 },
    ],
    outputs: [
      { name: 'positions', type: 'positions' },
      { name: 'colors', type: 'colors' },
      { name: 'drawCount', type: 'number' },
    ],
    evaluate: (inputs, _data, ctx, nodeId) => {
      const pointCount = Math.max(2, Math.min(50000, Math.round((inputs.pointCount as number) ?? 5000)))
      const curveCount = Math.max(1, Math.min(10, Math.round((inputs.curveCount as number) ?? 3)))
      const freqA = (inputs.freqA as number) ?? 3
      const freqB = (inputs.freqB as number) ?? 2
      const freqC = (inputs.freqC as number) ?? 5
      const phaseShift = (inputs.phaseShift as number) ?? 0
      const damping = (inputs.damping as number) ?? 0
      const scale = (inputs.scale as number) ?? 8
      const is3D = ((inputs.is3D as number) ?? 0) > 0.5
      const freqRatio = (inputs.freqRatio as number) ?? 1
      const symmetry = Math.max(1, Math.min(8, Math.round((inputs.symmetry as number) ?? 1)))
      const colorMode = Math.round((inputs.colorMode as number) ?? 0) // 0=rainbow, 1=speed, 2=solid, 3=palette
      const phaseAnimate = ((inputs.phaseAnimate as number) ?? 1) > 0.5
      const phaseSpeed = (inputs.phaseSpeed as number) ?? 0.3
      const animated = ((inputs.animated as number) ?? 1) > 0.5
      const drawSpeed = (inputs.drawSpeed as number) ?? 2
      const rotationSpeed = (inputs.rotationSpeed as number) ?? 0.2

      // Progressive draw
      const progressKey = `${nodeId}_progress`
      let progress = (ctx.frameState.get(progressKey) as number) ?? 0
      if (animated) {
        progress += ctx.delta * drawSpeed * 0.05
        if (progress > 1) progress -= Math.floor(progress)
      } else {
        progress = 1
      }
      ctx.frameState.set(progressKey, progress)
      const drawCount = Math.floor(progress * pointCount)

      // Phase animation
      const phaseOffset = phaseAnimate ? ctx.elapsed * phaseSpeed * 0.5 : 0
      const deltaRad = (phaseShift * Math.PI) / 180
      const effectiveFreqB = freqB * freqRatio

      // 3D rotation
      const rotAngle = is3D ? ctx.elapsed * rotationSpeed : 0
      const cosR = Math.cos(rotAngle)
      const sinR = Math.sin(rotAngle)
      const tiltAngle = is3D ? Math.sin(ctx.elapsed * 0.12) * 0.2 : 0
      const cosT = Math.cos(tiltAngle)
      const sinT = Math.sin(tiltAngle)

      const totalCurves = curveCount * symmetry
      // Only output drawCount points per curve
      const totalPoints = totalCurves * drawCount
      const positions = new Float32Array(totalPoints * 3)
      const colors = new Float32Array(totalPoints * 3)

      // HSL to RGB helper (inline)
      const hsl = (h: number, s: number, l: number): [number, number, number] => {
        const c = (1 - Math.abs(2 * l - 1)) * s
        const x = c * (1 - Math.abs(((h * 6) % 2) - 1))
        const m = l - c / 2
        let r = 0, g = 0, b = 0
        const hp = h * 6
        if (hp < 1) { r = c; g = x }
        else if (hp < 2) { r = x; g = c }
        else if (hp < 3) { g = c; b = x }
        else if (hp < 4) { g = x; b = c }
        else if (hp < 5) { r = x; b = c }
        else { r = c; b = x }
        return [r + m, g + m, b + m]
      }

      let offset = 0
      for (let c = 0; c < totalCurves; c++) {
        const curveIdx = c % curveCount
        const symIdx = Math.floor(c / curveCount)
        const symAngle = (symIdx / symmetry) * Math.PI * 2

        const freqOffsetA = freqA + curveIdx * 0.1
        const freqOffsetB = effectiveFreqB + curveIdx * 0.15
        const freqOffsetC = freqC + curveIdx * 0.12
        const curvePhase = deltaRad + (curveIdx / curveCount) * Math.PI * 0.5 + phaseOffset

        let prevX = 0, prevY = 0, prevZ = 0

        for (let i = 0; i < drawCount; i++) {
          const t = (i / pointCount) * Math.PI * 2 * 8
          const decay = damping > 0 ? Math.exp(-damping * t * 0.01) : 1

          const A = scale * 0.5 * decay
          const B = scale * 0.5 * decay
          const C = scale * 0.5 * decay

          let x = A * Math.sin(freqOffsetA * t + curvePhase)
          let y = B * Math.sin(freqOffsetB * t + phaseOffset * 0.3)
          let z = is3D ? C * Math.sin(freqOffsetC * t + curvePhase * 0.7) : 0

          // Symmetry rotation
          if (symIdx > 0) {
            const cosA = Math.cos(symAngle)
            const sinA = Math.sin(symAngle)
            const rx = x * cosA - y * sinA
            const ry = x * sinA + y * cosA
            x = rx
            y = ry
          }

          // 3D rotation (Y-axis then X-axis tilt)
          if (is3D) {
            const rx = x * cosR + z * sinR
            const rz = -x * sinR + z * cosR
            x = rx
            z = rz
            const ry = y * cosT - z * sinT
            const rz2 = y * sinT + z * cosT
            y = ry
            z = rz2
          }

          const idx = (offset + i) * 3
          positions[idx] = x
          positions[idx + 1] = y
          positions[idx + 2] = z

          // Color
          const frac = i / pointCount
          let r = 1, g = 1, b = 1
          if (colorMode === 0) {
            // Rainbow
            ;[r, g, b] = hsl(frac, 0.8, 0.55)
          } else if (colorMode === 1) {
            // Speed-based
            const dx = x - prevX
            const dy = y - prevY
            const dz = z - prevZ
            const speed = Math.sqrt(dx * dx + dy * dy + dz * dz)
            const ns = Math.min(1, speed / (scale * 0.3))
            ;[r, g, b] = hsl(0.6 - ns * 0.5, 0.85, 0.4 + ns * 0.3)
          } else if (colorMode === 2) {
            // Solid per-curve hue
            const hue = curveIdx / curveCount
            ;[r, g, b] = hsl(hue, 0.8, 0.6)
          } else {
            // Palette
            const palColors: [number, number, number][] = [
              [0.133, 0.827, 0.933], [0.851, 0.275, 0.937], [0.984, 0.749, 0.141],
              [0.290, 0.855, 0.498], [0.973, 0.443, 0.443], [0.506, 0.549, 0.973],
            ]
            const fi = frac * (palColors.length - 1)
            const lo = Math.floor(fi)
            const hi = Math.min(lo + 1, palColors.length - 1)
            const tt = fi - lo
            r = palColors[lo][0] * (1 - tt) + palColors[hi][0] * tt
            g = palColors[lo][1] * (1 - tt) + palColors[hi][1] * tt
            b = palColors[lo][2] * (1 - tt) + palColors[hi][2] * tt
          }

          colors[idx] = r
          colors[idx + 1] = g
          colors[idx + 2] = b

          prevX = x
          prevY = y
          prevZ = z
        }
        offset += drawCount
      }

      return { positions, colors, drawCount: -1 }
    },
  },

  // ── Output ──
  {
    type: 'line_output',
    label: 'Line Output',
    category: 'output',
    inputs: [
      { name: 'positions', type: 'positions' },
      { name: 'colors', type: 'colors' },
      { name: 'opacity', type: 'number', default: 0.85 },
      { name: 'thickness', type: 'number', default: 1 },
      { name: 'drawCount', type: 'number', default: -1 },
    ],
    outputs: [],
    evaluate: (inputs) => ({
      __output: true,
      __mode: 'line',
      positions: inputs.positions ?? new Float32Array(0),
      colors: inputs.colors ?? new Float32Array(0),
      opacity: (inputs.opacity as number) ?? 0.85,
      thickness: (inputs.thickness as number) ?? 1,
      drawCount: (inputs.drawCount as number) ?? -1,
    }),
  },
  {
    type: 'lineSegments_output',
    label: 'Line Segments Output',
    category: 'output',
    inputs: [
      { name: 'positions', type: 'positions' },
      { name: 'colors', type: 'colors' },
      { name: 'opacity', type: 'number', default: 0.85 },
      { name: 'drawCount', type: 'number', default: -1 },
    ],
    outputs: [],
    evaluate: (inputs) => ({
      __output: true,
      __mode: 'lineSegments',
      positions: inputs.positions ?? new Float32Array(0),
      colors: inputs.colors ?? new Float32Array(0),
      opacity: (inputs.opacity as number) ?? 0.85,
      drawCount: (inputs.drawCount as number) ?? -1,
    }),
  },
  {
    type: 'points_output',
    label: 'Points Output',
    category: 'output',
    inputs: [
      { name: 'positions', type: 'positions' },
      { name: 'colors', type: 'colors' },
      { name: 'opacity', type: 'number', default: 0.6 },
      { name: 'pointSize', type: 'number', default: 2 },
      { name: 'drawCount', type: 'number', default: -1 },
    ],
    outputs: [],
    evaluate: (inputs) => ({
      __output: true,
      __mode: 'points',
      positions: inputs.positions ?? new Float32Array(0),
      colors: inputs.colors ?? new Float32Array(0),
      opacity: (inputs.opacity as number) ?? 0.6,
      pointSize: (inputs.pointSize as number) ?? 2,
      drawCount: (inputs.drawCount as number) ?? -1,
    }),
  },
  {
    type: 'mesh_output',
    label: 'Mesh Output',
    category: 'output',
    inputs: [
      { name: 'positions', type: 'positions' },
      { name: 'indices', type: 'array' },
      { name: 'normals', type: 'positions' },
      { name: 'colors', type: 'colors' },
      { name: 'opacity', type: 'number', default: 0.9 },
      { name: 'wireframe', type: 'number', default: 0 },
    ],
    outputs: [],
    evaluate: (inputs) => ({
      __output: true,
      __mode: 'mesh',
      positions: inputs.positions ?? new Float32Array(0),
      indices: inputs.indices ?? null,
      normals: inputs.normals ?? null,
      colors: inputs.colors ?? new Float32Array(0),
      opacity: (inputs.opacity as number) ?? 0.9,
      wireframe: ((inputs.wireframe as number) ?? 0) > 0.5,
    }),
  },
  // ── Shader ──
  {
    type: 'glsl_fragment',
    label: 'GLSL Fragment',
    category: 'shader',
    inputs: [],
    outputs: [{ name: 'code', type: 'string' }],
    dataFields: [{ name: 'code', type: 'string', default: '', label: 'GLSL Code' }],
    evaluate: (_inputs, data) => ({
      code: (data.code as string) ?? '',
    }),
  },
  {
    type: 'glsl_vertex',
    label: 'GLSL Vertex',
    category: 'shader',
    inputs: [],
    outputs: [{ name: 'code', type: 'string' }],
    dataFields: [{ name: 'code', type: 'string', default: '', label: 'GLSL Code' }],
    evaluate: (_inputs, data) => ({
      code: (data.code as string) ?? '',
    }),
  },
  {
    type: 'shader_output',
    label: 'Shader Output',
    category: 'output',
    inputs: [
      { name: 'shaderConfig', type: 'array' },
    ],
    outputs: [],
    evaluate: (inputs) => {
      const config = inputs.shaderConfig as Record<string, unknown> | null
      if (!config) {
        return { __output: true, __mode: 'shader' }
      }
      return {
        __output: true,
        __mode: 'shader',
        ...config,
      }
    },
  },
]

// Build lookup map
export const NODE_DEF_MAP: Record<string, PatternNodeDef> = {}
for (const def of NODE_DEFS) {
  NODE_DEF_MAP[def.type] = def
}

/** Register a node definition dynamically (for compound generator nodes from built-in patterns) */
export function registerNodeDef(def: PatternNodeDef) {
  NODE_DEF_MAP[def.type] = def
  // Also add to NODE_DEFS array if not already there
  if (!NODE_DEFS.some((d) => d.type === def.type)) {
    NODE_DEFS.push(def)
  }
}

export function getNodeDef(type: string): PatternNodeDef | undefined {
  return NODE_DEF_MAP[type]
}

export function getNodeDefsByCategory(): Record<Category, PatternNodeDef[]> {
  const result: Record<Category, PatternNodeDef[]> = {
    input: [], math: [], generator: [], transform: [], color: [], animation: [], output: [], shader: [],
  }
  for (const def of NODE_DEFS) {
    result[def.category].push(def)
  }
  return result
}

export { NODE_DEFS }
