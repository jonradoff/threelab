import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { hslToRgb } from '../utils/colorPalette'

interface Props {
  params: Record<string, unknown>
}

type AttractorFn = (
  x: number, y: number, z: number,
  a: number, b: number, c: number,
) => [number, number, number]

const attractors: Record<string, AttractorFn> = {
  lorenz: (x, y, z, sigma, rho, beta) => [
    sigma * (y - x),
    x * (rho - z) - y,
    x * y - beta * z,
  ],
  rossler: (x, y, z, a, b, c) => [
    -(y + z),
    x + a * y,
    b + z * (x - c),
  ],
  halvorsen: (x, y, z, a, _b, _c) => [
    -a * x - 4 * y - 4 * z - y * y,
    -a * y - 4 * z - 4 * x - z * z,
    -a * z - 4 * x - 4 * y - x * x,
  ],
  thomas: (x, y, z, b, _a, _c) => [
    Math.sin(y) - b * x,
    Math.sin(z) - b * y,
    Math.sin(x) - b * z,
  ],
  aizawa: (x, y, z, a, b, c) => {
    const e = 0.25
    const d = 0.5
    const f = 0.1
    return [
      (z - b) * x - d * y,
      d * x + (z - b) * y,
      c + a * z - (z * z * z) / 3 - (x * x + y * y) * (1 + e * z) + f * z * x * x * x,
    ]
  },
  dadras: (x, y, z, a, b, c) => {
    const d = 2
    const e = 9
    return [
      y - a * x + b * y * z,
      c * y - x * z + z,
      d * x * y - e * z,
    ]
  },
}

// Per-type canonical parameters, integration settings, and slider sensitivity.
// At default slider values (paramA=10, paramB=28, paramC=2.667),
// each type produces its canonical interesting attractor.
// Moving sliders perturbs around those values at type-appropriate sensitivity.
const typePresets: Record<string, {
  a: number; b: number; c: number
  aSens: number; bSens: number; cSens: number
  dt: number; vizScale: number
  init: [number, number, number]
  speedNorm: number  // normalizer for speed-based coloring
}> = {
  lorenz: {
    a: 10, b: 28, c: 2.667,
    aSens: 1, bSens: 1, cSens: 1,
    dt: 0.005, vizScale: 5,
    init: [0.1, 0, 0],
    speedNorm: 50,
  },
  rossler: {
    a: 0.2, b: 0.2, c: 5.7,
    aSens: 0.01, bSens: 0.005, cSens: 0.2,
    dt: 0.01, vizScale: 4,
    init: [1, 1, 0],
    speedNorm: 15,
  },
  halvorsen: {
    a: 1.89, b: 0, c: 0,
    aSens: 0.05, bSens: 0, cSens: 0,
    dt: 0.005, vizScale: 4,
    init: [-1.48, -1.51, 2.04],
    speedNorm: 30,
  },
  thomas: {
    a: 0.208186, b: 0, c: 0,
    aSens: 0.005, bSens: 0, cSens: 0,
    dt: 0.03, vizScale: 0.8,
    init: [1.1, 1.1, -0.01],
    speedNorm: 2,
  },
  aizawa: {
    a: 0.95, b: 0.7, c: 0.6,
    aSens: 0.02, bSens: 0.01, cSens: 0.05,
    dt: 0.01, vizScale: 0.6,
    init: [0.1, 0, 0.1],
    speedNorm: 5,
  },
  dadras: {
    a: 3, b: 2.7, c: 1.7,
    aSens: 0.1, bSens: 0.05, cSens: 0.05,
    dt: 0.002, vizScale: 6,
    init: [1, 1, 0],
    speedNorm: 40,
  },
}

// Default slider values (Lorenz canonical)
const DEFAULT_A = 10
const DEFAULT_B = 28
const DEFAULT_C = 2.667

function getEffectiveParams(
  type: string, paramA: number, paramB: number, paramC: number,
  userDt: number, userScale: number,
) {
  const preset = typePresets[type] || typePresets.lorenz
  return {
    a: preset.a + (paramA - DEFAULT_A) * preset.aSens,
    b: preset.b + (paramB - DEFAULT_B) * preset.bSens,
    c: preset.c + (paramC - DEFAULT_C) * preset.cSens,
    dt: preset.dt * (userDt / 0.005),
    vizScale: preset.vizScale * (userScale / 5),
    init: preset.init,
    speedNorm: preset.speedNorm,
  }
}

function AttractorInner({
  attractorType, trailLength, dt, scale, colorBySpeed,
  paramA, paramB, paramC, pointSize, rotationSpeed,
}: {
  attractorType: string; trailLength: number; dt: number;
  scale: number; colorBySpeed: boolean; paramA: number;
  paramB: number; paramC: number; pointSize: number;
  rotationSpeed: number;
}) {
  const pointsRef = useRef<THREE.Points>(null)
  const groupRef = useRef<THREE.Group>(null)
  const liveRef = useRef({ x: 0.1, y: 0, z: 0, writeIndex: 0 })

  const eff = getEffectiveParams(attractorType, paramA, paramB, paramC, dt, scale)

  // Pre-fill trail on mount
  useEffect(() => {
    if (!pointsRef.current) return
    const fn = attractors[attractorType] || attractors.lorenz
    const posAttr = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute
    const colAttr = pointsRef.current.geometry.attributes.color as THREE.BufferAttribute

    let x = eff.init[0], y = eff.init[1], z = eff.init[2]
    // Skip transient
    for (let i = 0; i < 1000; i++) {
      const [dx, dy, dz] = fn(x, y, z, eff.a, eff.b, eff.c)
      x += dx * eff.dt; y += dy * eff.dt; z += dz * eff.dt
      if (Math.abs(x) > 1000 || Math.abs(y) > 1000 || Math.abs(z) > 1000) {
        x = eff.init[0]; y = eff.init[1]; z = eff.init[2]
      }
    }

    for (let i = 0; i < trailLength; i++) {
      const [dx, dy, dz] = fn(x, y, z, eff.a, eff.b, eff.c)
      x += dx * eff.dt; y += dy * eff.dt; z += dz * eff.dt
      if (Math.abs(x) > 1000 || Math.abs(y) > 1000 || Math.abs(z) > 1000) {
        x = eff.init[0]; y = eff.init[1]; z = eff.init[2]
      }
      posAttr.setXYZ(i, x / eff.vizScale, y / eff.vizScale, z / eff.vizScale)
      const speed = Math.sqrt(dx * dx + dy * dy + dz * dz)
      const ns = Math.min(speed / eff.speedNorm, 1)
      const h = 0.55 - ns * 0.4
      const [r, g, b] = hslToRgb(h, 0.8, 0.4 + ns * 0.3)
      colAttr.setXYZ(i, r, g, b)
    }
    posAttr.needsUpdate = true
    colAttr.needsUpdate = true
    liveRef.current = { x, y, z, writeIndex: 0 }
  }, [attractorType, trailLength, eff.dt, eff.vizScale, eff.a, eff.b, eff.c,
      eff.init, eff.speedNorm])

  useFrame(({ clock }) => {
    if (!pointsRef.current || !groupRef.current) return

    const fn = attractors[attractorType] || attractors.lorenz
    const live = liveRef.current
    const posAttr = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute
    const colAttr = pointsRef.current.geometry.attributes.color as THREE.BufferAttribute

    const stepsPerFrame = 5
    for (let s = 0; s < stepsPerFrame; s++) {
      const [dx, dy, dz] = fn(live.x, live.y, live.z, eff.a, eff.b, eff.c)
      live.x += dx * eff.dt
      live.y += dy * eff.dt
      live.z += dz * eff.dt

      if (Math.abs(live.x) > 1000 || Math.abs(live.y) > 1000 || Math.abs(live.z) > 1000) {
        live.x = eff.init[0]; live.y = eff.init[1]; live.z = eff.init[2]
      }

      const idx = live.writeIndex % trailLength
      posAttr.setXYZ(idx, live.x / eff.vizScale, live.y / eff.vizScale, live.z / eff.vizScale)

      const speed = Math.sqrt(dx * dx + dy * dy + dz * dz)
      const ns = Math.min(speed / eff.speedNorm, 1)
      const h = colorBySpeed ? 0.55 - ns * 0.4 : (live.writeIndex % trailLength) / trailLength
      const sat = colorBySpeed ? 0.8 : 0.7
      const lig = colorBySpeed ? 0.4 + ns * 0.3 : 0.5
      const [r, g, b] = hslToRgb(h, sat, lig)
      colAttr.setXYZ(idx, r, g, b)

      live.writeIndex++
    }

    posAttr.needsUpdate = true
    colAttr.needsUpdate = true

    groupRef.current.rotation.y = clock.getElapsedTime() * rotationSpeed
    groupRef.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.1) * 0.2
  })

  // Pre-allocate buffers at fixed size
  const buffers = useMemo(() => ({
    positions: new Float32Array(trailLength * 3),
    colors: new Float32Array(trailLength * 3),
  }), [trailLength])

  return (
    <group ref={groupRef}>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            array={buffers.positions}
            count={trailLength}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            array={buffers.colors}
            count={trailLength}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={pointSize * 0.05}
          vertexColors
          transparent
          opacity={0.8}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          sizeAttenuation
        />
      </points>
    </group>
  )
}

export default function Attractors({ params }: Props) {
  const attractorType = (params.attractorType as string) ?? 'lorenz'
  const pointCount = Math.min((params.pointCount as number) ?? 50000, 100000)
  const dt = (params.dt as number) ?? 0.005
  const trailLength = Math.min((params.trailLength as number) ?? 1000, Math.min(pointCount, 5000))
  const pointSize = (params.pointSize as number) ?? 1
  const rotationSpeed = (params.rotationSpeed as number) ?? 0.1
  const scale = (params.scale as number) ?? 5
  const colorBySpeed = (params.colorBySpeed as boolean) ?? true
  const paramA = (params.paramA as number) ?? 10
  const paramB = (params.paramB as number) ?? 28
  const paramC = (params.paramC as number) ?? 2.667

  return (
    <AttractorInner
      key={`${attractorType}-${trailLength}`}
      attractorType={attractorType}
      trailLength={trailLength}
      dt={dt}
      scale={scale}
      colorBySpeed={colorBySpeed}
      paramA={paramA}
      paramB={paramB}
      paramC={paramC}
      pointSize={pointSize}
      rotationSpeed={rotationSpeed}
    />
  )
}
