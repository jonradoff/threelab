import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { hslToRgb, interpolateColors } from '../utils/colorPalette'

interface Props {
  params: Record<string, unknown>
}

function SpirographInner({
  curveType, outerRadius, innerRadius, penDistance,
  pointCount, scale, drawSpeed, animated,
  colorMode, lineOpacity, layerCount, layerOffset,
  rotationSpeed, evolveSpeed, trailGlow, glowLength,
  petals, mirrorX, mirrorY, thickness, colorCycleSpeed,
}: {
  curveType: string; outerRadius: number; innerRadius: number;
  penDistance: number; pointCount: number; scale: number;
  drawSpeed: number; animated: boolean; colorMode: string;
  lineOpacity: number; layerCount: number; layerOffset: number;
  rotationSpeed: number; evolveSpeed: number; trailGlow: boolean;
  glowLength: number; petals: number; mirrorX: boolean;
  mirrorY: boolean; thickness: number; colorCycleSpeed: number;
}) {
  const groupRef = useRef<THREE.Group>(null)
  const linesRef = useRef<(THREE.Line | null)[]>([])
  const glowRef = useRef<THREE.Points>(null)
  const drawProgressRef = useRef(0)

  const palette = ['#22d3ee', '#d946ef', '#fbbf24', '#4ade80', '#f87171', '#818cf8']

  // Calculate the number of full rotations needed for the curve to close
  const lcmRevolutions = useMemo(() => {
    const gcd = (a: number, b: number): number => {
      a = Math.abs(Math.round(a * 1000))
      b = Math.abs(Math.round(b * 1000))
      while (b) { const t = b; b = a % b; a = t }
      return a
    }
    const R = Math.abs(Math.round(outerRadius * 1000))
    const r = Math.abs(Math.round(innerRadius * 1000))
    if (r === 0) return 1
    const g = gcd(R, r)
    return (r / g)
  }, [outerRadius, innerRadius])

  const computePoint = (
    t: number, R: number, r: number, d: number, type: string, pet: number,
  ): [number, number] => {
    let x = 0, y = 0
    switch (type) {
      case 'epitrochoid': {
        const sum = R + r
        const ratio = sum / r
        x = sum * Math.cos(t) - d * Math.cos(ratio * t)
        y = sum * Math.sin(t) - d * Math.sin(ratio * t)
        break
      }
      case 'rose': {
        const k = pet > 0 ? pet : (R / r)
        const rr = d * Math.cos(k * t)
        x = rr * Math.cos(t)
        y = rr * Math.sin(t)
        break
      }
      case 'spiralograph': {
        // Combined: hypotrochoid modulated by a slow spiral
        const diff = R - r
        const ratio = diff / r
        const spiral = 1 + 0.3 * Math.sin(t * 0.1)
        x = (diff * Math.cos(t) + d * Math.cos(ratio * t)) * spiral
        y = (diff * Math.sin(t) - d * Math.sin(ratio * t)) * spiral
        break
      }
      default: {
        // hypotrochoid
        const diff = R - r
        const ratio = diff / r
        x = diff * Math.cos(t) + d * Math.cos(ratio * t)
        y = diff * Math.sin(t) - d * Math.sin(ratio * t)
        break
      }
    }
    return [x, y]
  }

  const layerData = useMemo(() => {
    const layers: { positions: Float32Array; colors: Float32Array }[] = []
    const tMax = Math.PI * 2 * lcmRevolutions

    for (let l = 0; l < layerCount; l++) {
      const positions = new Float32Array(pointCount * 3)
      const colors = new Float32Array(pointCount * 3)

      const rOffset = l * layerOffset
      const R = outerRadius + rOffset * 0.3
      const r = innerRadius + rOffset * 0.2
      const d = penDistance + rOffset * 0.15

      for (let i = 0; i < pointCount; i++) {
        const frac = i / (pointCount - 1)
        const t = frac * tMax

        let [x, y] = computePoint(t, R, r, d, curveType, petals)
        x *= scale
        y *= scale

        positions[i * 3] = x
        positions[i * 3 + 1] = y
        positions[i * 3 + 2] = 0

        // Compute color
        let cr = 1, cg = 1, cb = 1
        if (colorMode === 'rainbow') {
          const h = frac
          ;[cr, cg, cb] = hslToRgb(h, 0.85, 0.55)
        } else if (colorMode === 'palette') {
          ;[cr, cg, cb] = interpolateColors(palette, frac)
        } else if (colorMode === 'angle') {
          const angle = Math.atan2(y, x)
          const h = (angle / (Math.PI * 2) + 0.5) % 1
          ;[cr, cg, cb] = hslToRgb(h, 0.8, 0.5)
        } else if (colorMode === 'speed') {
          // Approximate speed from parameter derivatives
          const dt = 0.001
          const [x2, y2] = computePoint(t + dt, R, r, d, curveType, petals)
          const spd = Math.sqrt((x2 - x / scale) ** 2 + (y2 - y / scale) ** 2) / dt
          const normSpd = Math.min(spd / (R + r + d), 1)
          ;[cr, cg, cb] = hslToRgb(0.6 - normSpd * 0.5, 0.85, 0.4 + normSpd * 0.25)
        } else if (colorMode === 'solid') {
          // Distinct hue per layer
          const h = l / Math.max(layerCount, 1)
          ;[cr, cg, cb] = hslToRgb(h, 0.7, 0.55)
        }

        colors[i * 3] = cr
        colors[i * 3 + 1] = cg
        colors[i * 3 + 2] = cb
      }

      layers.push({ positions, colors })
    }

    // Glow points for trail head
    const glowPointCount = trailGlow ? layerCount * 200 : 0
    const glowPositions = new Float32Array(glowPointCount * 3)
    const glowColors = new Float32Array(glowPointCount * 3)

    return { layers, glowPointCount, glowPositions, glowColors }
  }, [curveType, outerRadius, innerRadius, penDistance, pointCount, scale,
      colorMode, layerCount, layerOffset, petals, trailGlow, lcmRevolutions])

  useFrame(({ clock }, delta) => {
    if (!groupRef.current) return
    const elapsed = clock.getElapsedTime()

    // Rotation
    groupRef.current.rotation.z = elapsed * rotationSpeed

    // Progressive draw animation
    if (animated) {
      drawProgressRef.current = Math.min(1, drawProgressRef.current + delta * drawSpeed * 0.05)
    } else {
      drawProgressRef.current = 1
    }
    const progress = drawProgressRef.current
    const visiblePoints = Math.floor(progress * pointCount)

    // Evolve parameters over time
    const evolveT = evolveSpeed > 0 ? elapsed * evolveSpeed : 0
    const tMax = Math.PI * 2 * lcmRevolutions

    for (let l = 0; l < layerData.layers.length; l++) {
      const line = linesRef.current[l]
      if (!line) continue

      const posAttr = line.geometry.attributes.position as THREE.BufferAttribute
      const colAttr = line.geometry.attributes.color as THREE.BufferAttribute
      const layer = layerData.layers[l]

      const rOffset = l * layerOffset
      const R = outerRadius + rOffset * 0.3 + Math.sin(evolveT * 0.7) * evolveT * 0.1
      const r = innerRadius + rOffset * 0.2 + Math.cos(evolveT * 0.5) * evolveT * 0.05
      const d = penDistance + rOffset * 0.15 + Math.sin(evolveT * 1.1) * evolveT * 0.08

      if (evolveSpeed > 0 || colorCycleSpeed > 0) {
        // Recompute positions when evolving
        for (let i = 0; i < visiblePoints; i++) {
          const frac = i / (pointCount - 1)
          const t = frac * tMax

          let [x, y] = computePoint(t, R, r, d, curveType, petals)
          x *= scale
          y *= scale

          if (mirrorX) x = Math.abs(x)
          if (mirrorY) y = Math.abs(y)

          posAttr.setXYZ(i, x, y, 0)

          // Color cycling
          if (colorCycleSpeed > 0) {
            const shiftedFrac = (frac + elapsed * colorCycleSpeed * 0.1) % 1
            let cr = 1, cg = 1, cb = 1
            if (colorMode === 'rainbow') {
              ;[cr, cg, cb] = hslToRgb(shiftedFrac, 0.85, 0.55)
            } else if (colorMode === 'palette') {
              ;[cr, cg, cb] = interpolateColors(palette, shiftedFrac)
            } else {
              ;[cr, cg, cb] = hslToRgb(shiftedFrac, 0.8, 0.5)
            }
            colAttr.setXYZ(i, cr, cg, cb)
          }
        }
        posAttr.needsUpdate = true
        if (colorCycleSpeed > 0) colAttr.needsUpdate = true
      } else if (progress < 1) {
        // Just apply mirrors on static geometry during draw-in
        for (let i = 0; i < visiblePoints; i++) {
          let x = layer.positions[i * 3]
          let y = layer.positions[i * 3 + 1]
          if (mirrorX) x = Math.abs(x)
          if (mirrorY) y = Math.abs(y)
          posAttr.setXYZ(i, x, y, 0)
        }
        posAttr.needsUpdate = true
      }

      // Hide points beyond draw progress
      if (progress < 1) {
        for (let i = visiblePoints; i < pointCount; i++) {
          posAttr.setXYZ(i, 0, 0, 0)
        }
        posAttr.needsUpdate = true
      }

      // Draw range for proper line rendering
      line.geometry.setDrawRange(0, visiblePoints)
    }

    // Update glow at draw head
    if (glowRef.current && trailGlow && visiblePoints > 1) {
      const glowPosAttr = glowRef.current.geometry.attributes.position as THREE.BufferAttribute
      const glowColAttr = glowRef.current.geometry.attributes.color as THREE.BufferAttribute
      const samplesPerLayer = 200
      const trailLen = Math.max(1, Math.floor(glowLength * visiblePoints))

      for (let l = 0; l < layerData.layers.length; l++) {
        const line = linesRef.current[l]
        if (!line) continue
        const linePosAttr = line.geometry.attributes.position as THREE.BufferAttribute
        const lineColAttr = line.geometry.attributes.color as THREE.BufferAttribute

        for (let i = 0; i < samplesPerLayer; i++) {
          const dstIdx = l * samplesPerLayer + i
          if (dstIdx >= layerData.glowPointCount) break

          // Sample from the trail region near the draw head
          const trailFrac = i / samplesPerLayer
          const srcIdx = Math.max(0, visiblePoints - 1 - Math.floor(trailFrac * trailLen))

          glowPosAttr.setXYZ(dstIdx,
            linePosAttr.getX(srcIdx),
            linePosAttr.getY(srcIdx),
            linePosAttr.getZ(srcIdx),
          )

          // Fade glow along trail
          const fade = (1 - trailFrac) * (0.6 + Math.sin(elapsed * 3 + i * 0.05) * 0.2)
          glowColAttr.setXYZ(dstIdx,
            lineColAttr.getX(srcIdx) * fade,
            lineColAttr.getY(srcIdx) * fade,
            lineColAttr.getZ(srcIdx) * fade,
          )
        }
      }
      glowPosAttr.needsUpdate = true
      glowColAttr.needsUpdate = true
    }
  })

  return (
    <group ref={groupRef}>
      {layerData.layers.map((layer, idx) => (
        <line
          key={idx}
          ref={(el: THREE.Line | null) => {
            linesRef.current[idx] = el
          }}
        >
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              array={new Float32Array(layer.positions)}
              count={pointCount}
              itemSize={3}
            />
            <bufferAttribute
              attach="attributes-color"
              array={new Float32Array(layer.colors)}
              count={pointCount}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial
            vertexColors
            transparent
            opacity={lineOpacity}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            linewidth={thickness}
          />
        </line>
      ))}

      {trailGlow && layerData.glowPointCount > 0 && (
        <points ref={glowRef}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              array={layerData.glowPositions}
              count={layerData.glowPointCount}
              itemSize={3}
            />
            <bufferAttribute
              attach="attributes-color"
              array={layerData.glowColors}
              count={layerData.glowPointCount}
              itemSize={3}
            />
          </bufferGeometry>
          <pointsMaterial
            size={0.12}
            vertexColors
            transparent
            opacity={0.6}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            sizeAttenuation
          />
        </points>
      )}
    </group>
  )
}

export default function Spirograph({ params }: Props) {
  const curveType = (params.curveType as string) ?? 'hypotrochoid'
  const outerRadius = (params.outerRadius as number) ?? 5
  const innerRadius = (params.innerRadius as number) ?? 3
  const penDistance = (params.penDistance as number) ?? 2.5
  const pointCount = (params.pointCount as number) ?? 8000
  const scale = (params.scale as number) ?? 5
  const drawSpeed = (params.drawSpeed as number) ?? 3
  const animated = (params.animated as boolean) ?? true
  const colorMode = (params.colorMode as string) ?? 'rainbow'
  const lineOpacity = (params.lineOpacity as number) ?? 0.85
  const layerCount = (params.layerCount as number) ?? 1
  const layerOffset = (params.layerOffset as number) ?? 0.5
  const rotationSpeed = (params.rotationSpeed as number) ?? 0.1
  const evolveSpeed = (params.evolveSpeed as number) ?? 0
  const trailGlow = (params.trailGlow as boolean) ?? true
  const glowLength = (params.glowLength as number) ?? 0.05
  const petals = (params.petals as number) ?? 0
  const mirrorX = (params.mirrorX as boolean) ?? false
  const mirrorY = (params.mirrorY as boolean) ?? false
  const thickness = (params.thickness as number) ?? 1
  const colorCycleSpeed = (params.colorCycleSpeed as number) ?? 0

  return (
    <SpirographInner
      key={`${curveType}-${pointCount}-${layerCount}`}
      curveType={curveType}
      outerRadius={outerRadius}
      innerRadius={innerRadius}
      penDistance={penDistance}
      pointCount={pointCount}
      scale={scale}
      drawSpeed={drawSpeed}
      animated={animated}
      colorMode={colorMode}
      lineOpacity={lineOpacity}
      layerCount={layerCount}
      layerOffset={layerOffset}
      rotationSpeed={rotationSpeed}
      evolveSpeed={evolveSpeed}
      trailGlow={trailGlow}
      glowLength={glowLength}
      petals={petals}
      mirrorX={mirrorX}
      mirrorY={mirrorY}
      thickness={thickness}
      colorCycleSpeed={colorCycleSpeed}
    />
  )
}
