export interface Point {
  x: number
  y: number
}

/** Generate 2D Hilbert curve points for given order (depth). Returns 4^order points in [0,1] range. */
export function hilbertCurve(order: number): Point[] {
  const n = 1 << order // 2^order
  const total = n * n
  const points: Point[] = []

  for (let i = 0; i < total; i++) {
    const p = d2xy(n, i)
    points.push({
      x: (p.x + 0.5) / n,
      y: (p.y + 0.5) / n,
    })
  }

  return points
}

function d2xy(n: number, d: number): { x: number; y: number } {
  let rx: number, ry: number, s: number
  let x = 0, y = 0
  let dd = d
  for (s = 1; s < n; s *= 2) {
    rx = (dd & 2) > 0 ? 1 : 0
    ry = ((dd & 1) === 0 ? 1 : 0) ^ rx ? 0 : 1
    if (ry === 0) {
      if (rx === 1) {
        x = s - 1 - x
        y = s - 1 - y
      }
      const tmp = x
      x = y
      y = tmp
    }
    x += s * rx
    y += s * ry
    dd = Math.floor(dd / 4)
  }
  return { x, y }
}

/** Generate Moore curve points. A Moore curve is a variant of the Hilbert curve that forms a closed loop. */
export function mooreCurve(order: number): Point[] {
  if (order < 2) return hilbertCurve(order)

  const hilbert = hilbertCurve(order - 1)
  const n = hilbert.length
  const result: Point[] = []

  // Moore curve = 4 rotated/reflected copies of the Hilbert curve
  // Quadrant BL (bottom-left): rotate 90 CW
  for (let i = 0; i < n; i++) {
    const p = hilbert[i]
    result.push({ x: p.y * 0.5, y: (1 - p.x) * 0.5 })
  }
  // Quadrant TL (top-left): no rotation
  for (let i = 0; i < n; i++) {
    const p = hilbert[i]
    result.push({ x: p.x * 0.5, y: 0.5 + p.y * 0.5 })
  }
  // Quadrant TR (top-right): no rotation
  for (let i = 0; i < n; i++) {
    const p = hilbert[i]
    result.push({ x: 0.5 + p.x * 0.5, y: 0.5 + p.y * 0.5 })
  }
  // Quadrant BR (bottom-right): rotate 90 CCW
  for (let i = 0; i < n; i++) {
    const p = hilbert[i]
    result.push({ x: 0.5 + (1 - p.y) * 0.5, y: p.x * 0.5 })
  }

  return result
}
