import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { hslToRgb, interpolateColors } from '../utils/colorPalette'

interface Props {
  params: Record<string, unknown>
}

interface CircleData {
  x: number
  y: number
  z: number
  radius: number
  order: number
}

function packCircles(
  maxCircles: number,
  minRadius: number,
  maxRadius: number,
  spacing: number,
  scale: number,
  packingMode: string,
  depthSpread: number,
): CircleData[] {
  const circles: CircleData[] = []
  const halfScale = scale / 2
  const maxAttempts = maxCircles * 50

  const overlaps = (cx: number, cy: number, r: number): boolean => {
    for (let i = 0; i < circles.length; i++) {
      const c = circles[i]
      const dx = cx - c.x
      const dy = cy - c.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < r + c.radius + spacing) return true
    }
    return false
  }

  const inBounds = (cx: number, cy: number, r: number): boolean => {
    return (
      cx - r >= -halfScale &&
      cx + r <= halfScale &&
      cy - r >= -halfScale &&
      cy + r <= halfScale
    )
  }

  const growCircle = (cx: number, cy: number): number => {
    let r = minRadius
    const step = 0.05
    while (r < maxRadius) {
      const next = r + step
      if (!inBounds(cx, cy, next)) return r
      // Check overlap with existing circles
      let blocked = false
      for (let i = 0; i < circles.length; i++) {
        const c = circles[i]
        const dx = cx - c.x
        const dy = cy - c.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < next + c.radius + spacing) {
          blocked = true
          break
        }
      }
      if (blocked) return r
      r = next
    }
    return r
  }

  // Seeded pseudo-random for deterministic packing
  let seed = 12345
  const rand = (): number => {
    seed = (seed * 16807 + 0) % 2147483647
    return (seed - 1) / 2147483646
  }

  if (packingMode === 'spiral') {
    const goldenAngle = Math.PI * (3 - Math.sqrt(5))
    for (let i = 0; i < maxAttempts && circles.length < maxCircles; i++) {
      const angle = i * goldenAngle
      const dist = Math.sqrt(i / maxAttempts) * halfScale * 0.9
      const cx = Math.cos(angle) * dist
      const cy = Math.sin(angle) * dist
      if (!inBounds(cx, cy, minRadius)) continue
      if (overlaps(cx, cy, minRadius)) continue
      const r = growCircle(cx, cy)
      if (r >= minRadius) {
        const z = depthSpread > 0 ? (rand() - 0.5) * depthSpread : 0
        circles.push({ x: cx, y: cy, z, radius: r, order: circles.length })
      }
    }
  } else if (packingMode === 'grid') {
    const cellSize = minRadius * 2 + spacing
    const cols = Math.floor(scale / cellSize)
    const rows = Math.floor(scale / cellSize)
    const offsetX = -halfScale + cellSize / 2
    const offsetY = -halfScale + cellSize / 2
    // Shuffle grid indices
    const indices: number[] = []
    for (let i = 0; i < cols * rows; i++) indices.push(i)
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1))
      ;[indices[i], indices[j]] = [indices[j], indices[i]]
    }
    for (let idx = 0; idx < indices.length && circles.length < maxCircles; idx++) {
      const gi = indices[idx]
      const col = gi % cols
      const row = Math.floor(gi / cols)
      const cx = offsetX + col * cellSize + (rand() - 0.5) * cellSize * 0.3
      const cy = offsetY + row * cellSize + (rand() - 0.5) * cellSize * 0.3
      if (!inBounds(cx, cy, minRadius)) continue
      if (overlaps(cx, cy, minRadius)) continue
      const r = growCircle(cx, cy)
      if (r >= minRadius) {
        const z = depthSpread > 0 ? (rand() - 0.5) * depthSpread : 0
        circles.push({ x: cx, y: cy, z, radius: r, order: circles.length })
      }
    }
  } else if (packingMode === 'concentric') {
    // Place circles along concentric rings
    let ringRadius = 0
    const ringStep = minRadius * 2 + spacing
    while (circles.length < maxCircles && ringRadius < halfScale) {
      if (ringRadius === 0) {
        const r = growCircle(0, 0)
        if (r >= minRadius) {
          const z = depthSpread > 0 ? (rand() - 0.5) * depthSpread : 0
          circles.push({ x: 0, y: 0, z, radius: r, order: circles.length })
        }
        ringRadius += ringStep + maxRadius
        continue
      }
      const circumference = 2 * Math.PI * ringRadius
      const count = Math.floor(circumference / (minRadius * 2 + spacing))
      for (let i = 0; i < count && circles.length < maxCircles; i++) {
        const angle = (i / count) * Math.PI * 2 + rand() * 0.1
        const cx = Math.cos(angle) * ringRadius
        const cy = Math.sin(angle) * ringRadius
        if (!inBounds(cx, cy, minRadius)) continue
        if (overlaps(cx, cy, minRadius)) continue
        const r = growCircle(cx, cy)
        if (r >= minRadius) {
          const z = depthSpread > 0 ? (rand() - 0.5) * depthSpread : 0
          circles.push({ x: cx, y: cy, z, radius: r, order: circles.length })
        }
      }
      ringRadius += ringStep
    }
  } else {
    // random
    for (let attempt = 0; attempt < maxAttempts && circles.length < maxCircles; attempt++) {
      const cx = (rand() - 0.5) * scale * 0.9
      const cy = (rand() - 0.5) * scale * 0.9
      if (!inBounds(cx, cy, minRadius)) continue
      if (overlaps(cx, cy, minRadius)) continue
      const r = growCircle(cx, cy)
      if (r >= minRadius) {
        const z = depthSpread > 0 ? (rand() - 0.5) * depthSpread : 0
        circles.push({ x: cx, y: cy, z, radius: r, order: circles.length })
      }
    }
  }

  return circles
}

function CirclePackingInner({
  maxCircles, minRadius, maxRadius, growSpeed, packingMode,
  colorMode, borderWidth, borderColor, fillOpacity,
  animated, respawn, respawnSpeed, spacing, scale,
  bobAmount, bobSpeed, rotateCircles, is3D, depthSpread,
  pulseAmount,
}: {
  maxCircles: number; minRadius: number; maxRadius: number;
  growSpeed: number; packingMode: string; colorMode: string;
  borderWidth: number; borderColor: string; fillOpacity: number;
  animated: boolean; respawn: boolean; respawnSpeed: number;
  spacing: number; scale: number; bobAmount: number;
  bobSpeed: number; rotateCircles: boolean; is3D: boolean;
  depthSpread: number; pulseAmount: number;
}) {
  const fillMeshRef = useRef<THREE.InstancedMesh>(null)
  const borderMeshRef = useRef<THREE.InstancedMesh>(null)
  const mouseRef = useRef(new THREE.Vector2(9999, 9999))
  const growthRef = useRef<Float32Array | null>(null)
  const respawnTimerRef = useRef<Float32Array | null>(null)
  const dummyMatrix = useMemo(() => new THREE.Matrix4(), [])
  const dummyColor = useMemo(() => new THREE.Color(), [])

  const palette = ['#22d3ee', '#d946ef', '#fbbf24', '#4ade80', '#f87171', '#818cf8']

  const circleData = useMemo(() => {
    return packCircles(maxCircles, minRadius, maxRadius, spacing, scale, packingMode, depthSpread)
  }, [maxCircles, minRadius, maxRadius, spacing, scale, packingMode, depthSpread])

  const count = circleData.length

  // Precompute colors
  const colors = useMemo(() => {
    const maxR = circleData.reduce((m, c) => Math.max(m, c.radius), 0) || 1
    const halfScale = scale / 2

    return circleData.map((c, _i) => {
      let r = 1, g = 1, b = 1
      const t = c.order / Math.max(1, circleData.length - 1)

      if (colorMode === 'size') {
        const h = 0.55 - (c.radius / maxR) * 0.45
        ;[r, g, b] = hslToRgb(h, 0.8, 0.55)
      } else if (colorMode === 'position') {
        const px = (c.x + halfScale) / scale
        const py = (c.y + halfScale) / scale
        ;[r, g, b] = hslToRgb(px * 0.8, 0.7, 0.3 + py * 0.4)
      } else if (colorMode === 'order') {
        ;[r, g, b] = hslToRgb(t * 0.8, 0.75, 0.5)
      } else if (colorMode === 'palette') {
        ;[r, g, b] = interpolateColors(palette, t)
      } else if (colorMode === 'rainbow') {
        ;[r, g, b] = hslToRgb(t, 0.85, 0.55)
      } else if (colorMode === 'random') {
        // Deterministic "random" based on order
        const h = ((c.order * 137.508) % 360) / 360
        ;[r, g, b] = hslToRgb(h, 0.75, 0.55)
      }

      return [r, g, b] as [number, number, number]
    })
  }, [circleData, colorMode, scale])

  // Initialize growth and respawn timers
  useEffect(() => {
    growthRef.current = new Float32Array(count)
    respawnTimerRef.current = new Float32Array(count)
    if (!animated) {
      growthRef.current.fill(1)
    }
  }, [count, animated])

  // Set instance colors
  useEffect(() => {
    const fillMesh = fillMeshRef.current
    const borderMesh = borderMeshRef.current
    if (!fillMesh) return

    for (let i = 0; i < count; i++) {
      dummyColor.setRGB(colors[i][0], colors[i][1], colors[i][2])
      fillMesh.setColorAt(i, dummyColor)
    }
    if (fillMesh.instanceColor) fillMesh.instanceColor.needsUpdate = true

    if (borderMesh && borderWidth > 0) {
      const bc = new THREE.Color(borderColor)
      for (let i = 0; i < count; i++) {
        borderMesh.setColorAt(i, bc)
      }
      if (borderMesh.instanceColor) borderMesh.instanceColor.needsUpdate = true
    }
  }, [count, colors, borderWidth, borderColor, dummyColor])

  // Track mouse in normalized coordinates
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      // Convert to rough world coordinates based on viewport
      const nx = (e.clientX / window.innerWidth) * 2 - 1
      const ny = -(e.clientY / window.innerHeight) * 2 + 1
      mouseRef.current.set(nx * scale * 0.6, ny * scale * 0.6)
    }
    window.addEventListener('mousemove', handler)
    return () => window.removeEventListener('mousemove', handler)
  }, [scale])

  useFrame(({ clock }) => {
    const fillMesh = fillMeshRef.current
    const borderMesh = borderMeshRef.current
    const growth = growthRef.current
    if (!fillMesh || !growth) return

    const t = clock.getElapsedTime()
    const dt = Math.min(1 / 30, 0.016) // cap delta

    for (let i = 0; i < count; i++) {
      const c = circleData[i]

      // Growth animation
      if (animated && growth[i] < 1) {
        growth[i] = Math.min(1, growth[i] + dt * growSpeed * (0.5 + Math.random() * 0.01))
      }

      // Respawn: once fully grown, timer counts up, then reset
      if (respawn && growth[i] >= 1 && respawnTimerRef.current) {
        respawnTimerRef.current[i] += dt * respawnSpeed
        if (respawnTimerRef.current[i] > 2 + i * 0.01) {
          growth[i] = 0
          respawnTimerRef.current[i] = 0
        }
      }

      const g = growth[i]
      // Eased growth (ease-out cubic)
      const eased = 1 - Math.pow(1 - g, 3)

      let currentRadius = c.radius * eased

      // Pulse
      if (pulseAmount > 0) {
        currentRadius *= 1 + Math.sin(t * 2 + c.order * 0.3) * pulseAmount * 0.1
      }

      // Mouse repulsion
      const mx = mouseRef.current.x
      const my = mouseRef.current.y
      const dx = c.x - mx
      const dy = c.y - my
      const mouseDist = Math.sqrt(dx * dx + dy * dy)
      const repelRadius = 3
      let offsetX = 0, offsetY = 0
      if (mouseDist < repelRadius && mouseDist > 0.01) {
        const force = (1 - mouseDist / repelRadius) * 1.5
        offsetX = (dx / mouseDist) * force
        offsetY = (dy / mouseDist) * force
      }

      // Bob
      const bobY = bobAmount > 0
        ? Math.sin(t * bobSpeed + c.order * 0.5) * bobAmount * 0.2
        : 0

      const px = c.x + offsetX
      const py = c.y + offsetY + bobY
      const pz = c.z

      // Fill circle
      dummyMatrix.identity()

      if (rotateCircles) {
        const rotZ = t * 0.5 + c.order * 0.1
        dummyMatrix.makeRotationZ(rotZ)
      }

      dummyMatrix.setPosition(px, py, pz)
      const scaleVal = currentRadius
      dummyMatrix.scale(new THREE.Vector3(scaleVal, scaleVal, is3D ? scaleVal : 1))
      fillMesh.setMatrixAt(i, dummyMatrix)

      // Border circle (slightly larger)
      if (borderMesh && borderWidth > 0) {
        const borderScale = currentRadius + borderWidth
        dummyMatrix.identity()
        if (rotateCircles) {
          dummyMatrix.makeRotationZ(t * 0.5 + c.order * 0.1)
        }
        dummyMatrix.setPosition(px, py, pz - 0.001)
        dummyMatrix.scale(new THREE.Vector3(borderScale, borderScale, is3D ? borderScale : 1))
        borderMesh.setMatrixAt(i, dummyMatrix)
      }
    }

    fillMesh.instanceMatrix.needsUpdate = true
    if (borderMesh && borderWidth > 0) {
      borderMesh.instanceMatrix.needsUpdate = true
    }
  })

  const fillGeometry = useMemo(() => {
    if (is3D) {
      return new THREE.SphereGeometry(1, 16, 16)
    }
    return new THREE.CircleGeometry(1, 32)
  }, [is3D])

  const borderGeometry = useMemo(() => {
    if (is3D) {
      return new THREE.SphereGeometry(1, 16, 16)
    }
    return new THREE.CircleGeometry(1, 32)
  }, [is3D])

  return (
    <group>
      {/* Border layer behind fills */}
      {borderWidth > 0 && (
        <instancedMesh
          ref={borderMeshRef}
          args={[borderGeometry, undefined, count]}
          frustumCulled={false}
        >
          <meshBasicMaterial
            color={borderColor}
            transparent
            opacity={1}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </instancedMesh>
      )}

      {/* Fill circles */}
      <instancedMesh
        ref={fillMeshRef}
        args={[fillGeometry, undefined, count]}
        frustumCulled={false}
      >
        <meshBasicMaterial
          transparent
          opacity={fillOpacity}
          depthWrite={false}
          side={THREE.DoubleSide}
          vertexColors={false}
        />
      </instancedMesh>
    </group>
  )
}

export default function CirclePacking({ params }: Props) {
  const maxCircles = (params.maxCircles as number) ?? 500
  const minRadius = (params.minRadius as number) ?? 0.1
  const maxRadius = (params.maxRadius as number) ?? 3
  const growSpeed = (params.growSpeed as number) ?? 2
  const packingMode = (params.packingMode as string) ?? 'random'
  const colorMode = (params.colorMode as string) ?? 'size'
  const borderWidth = (params.borderWidth as number) ?? 0.02
  const borderColor = (params.borderColor as string) ?? '#ffffff'
  const fillOpacity = (params.fillOpacity as number) ?? 0.8
  const animated = (params.animated as boolean) ?? true
  const respawn = (params.respawn as boolean) ?? false
  const respawnSpeed = (params.respawnSpeed as number) ?? 0.5
  const spacing = (params.spacing as number) ?? 0.5
  const scale = (params.scale as number) ?? 15
  const bobAmount = (params.bobAmount as number) ?? 0
  const bobSpeed = (params.bobSpeed as number) ?? 0.5
  const rotateCircles = (params.rotateCircles as boolean) ?? false
  const is3D = (params.is3D as boolean) ?? false
  const depthSpread = (params.depthSpread as number) ?? 0
  const pulseAmount = (params.pulseAmount as number) ?? 0

  return (
    <CirclePackingInner
      key={`${maxCircles}-${packingMode}-${is3D}`}
      maxCircles={maxCircles}
      minRadius={minRadius}
      maxRadius={maxRadius}
      growSpeed={growSpeed}
      packingMode={packingMode}
      colorMode={colorMode}
      borderWidth={borderWidth}
      borderColor={borderColor}
      fillOpacity={fillOpacity}
      animated={animated}
      respawn={respawn}
      respawnSpeed={respawnSpeed}
      spacing={spacing}
      scale={scale}
      bobAmount={bobAmount}
      bobSpeed={bobSpeed}
      rotateCircles={rotateCircles}
      is3D={is3D}
      depthSpread={depthSpread}
      pulseAmount={pulseAmount}
    />
  )
}
