/** Inigo Quilez cosine palette: color(t) = a + b * cos(2*PI*(c*t+d)) */
export function cosineGradient(
  t: number,
  a: [number, number, number],
  b: [number, number, number],
  c: [number, number, number],
  d: [number, number, number],
): [number, number, number] {
  const TAU = Math.PI * 2
  return [
    Math.max(0, Math.min(1, a[0] + b[0] * Math.cos(TAU * (c[0] * t + d[0])))),
    Math.max(0, Math.min(1, a[1] + b[1] * Math.cos(TAU * (c[1] * t + d[1])))),
    Math.max(0, Math.min(1, a[2] + b[2] * Math.cos(TAU * (c[2] * t + d[2])))),
  ]
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.substring(0, 2), 16) / 255,
    parseInt(h.substring(2, 4), 16) / 255,
    parseInt(h.substring(4, 6), 16) / 255,
  ]
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) =>
    Math.round(Math.max(0, Math.min(1, v)) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

export function hslToRgb(
  h: number,
  s: number,
  l: number,
): [number, number, number] {
  if (s === 0) return [l, l, l]
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t
    if (tt < 0) tt += 1
    if (tt > 1) tt -= 1
    if (tt < 1 / 6) return p + (q - p) * 6 * tt
    if (tt < 1 / 2) return q
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
    return p
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return [hue2rgb(p, q, h + 1 / 3), hue2rgb(p, q, h), hue2rgb(p, q, h - 1 / 3)]
}

export function rgbToHsl(
  r: number,
  g: number,
  b: number,
): [number, number, number] {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6
  return [h, s, l]
}

/** Interpolate through an array of hex colors at position t (0-1) */
export function interpolateColors(colors: string[], t: number): [number, number, number] {
  if (colors.length === 0) return [1, 1, 1]
  if (colors.length === 1) return hexToRgb(colors[0])

  const clamped = Math.max(0, Math.min(1, t))
  const scaledT = clamped * (colors.length - 1)
  const index = Math.floor(scaledT)
  const frac = scaledT - index

  if (index >= colors.length - 1) return hexToRgb(colors[colors.length - 1])

  const c0 = hexToRgb(colors[index])
  const c1 = hexToRgb(colors[index + 1])
  return [
    c0[0] + (c1[0] - c0[0]) * frac,
    c0[1] + (c1[1] - c0[1]) * frac,
    c0[2] + (c1[2] - c0[2]) * frac,
  ]
}
