export function linear(t: number): number {
  return t
}

export function cubic(t: number): number {
  return t * t * t
}

export function cubicInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

export function tanhEasing(t: number): number {
  return (Math.tanh(3 * (2 * t - 1)) + 1) / 2
}

export function elastic(t: number): number {
  if (t === 0 || t === 1) return t
  const c4 = (2 * Math.PI) / 3
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1
}

export function bounce(t: number): number {
  const n1 = 7.5625
  const d1 = 2.75
  let tt = t
  if (tt < 1 / d1) {
    return n1 * tt * tt
  } else if (tt < 2 / d1) {
    tt -= 1.5 / d1
    return n1 * tt * tt + 0.75
  } else if (tt < 2.5 / d1) {
    tt -= 2.25 / d1
    return n1 * tt * tt + 0.9375
  } else {
    tt -= 2.625 / d1
    return n1 * tt * tt + 0.984375
  }
}
