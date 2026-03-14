import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { hslToRgb, interpolateColors } from '../utils/colorPalette'

interface Props {
  params: Record<string, unknown>
}

function LissajousInner({
  curveCount, freqA, freqB, freqC, phaseShift, damping,
  pointCount, scale, drawSpeed, animated, colorMode,
  lineOpacity, is3D, rotationSpeed, phaseAnimate, phaseSpeed,
  thickness, trailGlow, glowLength, freqRatio, symmetry,
}: {
  curveCount: number; freqA: number; freqB: number; freqC: number;
  phaseShift: number; damping: number; pointCount: number; scale: number;
  drawSpeed: number; animated: boolean; colorMode: string;
  lineOpacity: number; is3D: boolean; rotationSpeed: number;
  phaseAnimate: boolean; phaseSpeed: number; thickness: number;
  trailGlow: boolean; glowLength: number; freqRatio: number;
  symmetry: number;
}) {
  const groupRef = useRef<THREE.Group>(null)
  const linesRef = useRef<(THREE.Line | null)[]>([])
  const glowRef = useRef<THREE.Points>(null)
  const drawProgressRef = useRef(0)

  const palette = ['#22d3ee', '#d946ef', '#fbbf24', '#4ade80', '#f87171', '#818cf8']

  // Total curves = curveCount * symmetry
  const totalCurves = curveCount * symmetry

  const curveData = useMemo(() => {
    const curves: { positions: Float32Array; colors: Float32Array }[] = []
    const deltaRad = (phaseShift * Math.PI) / 180
    const effectiveFreqB = freqB * freqRatio

    for (let c = 0; c < totalCurves; c++) {
      const curveIdx = c % curveCount
      const symIdx = Math.floor(c / curveCount)
      const symAngle = (symIdx / symmetry) * Math.PI * 2

      const positions = new Float32Array(pointCount * 3)
      const colors = new Float32Array(pointCount * 3)

      // Each curve gets slightly different freq offsets
      const freqOffsetA = freqA + curveIdx * 0.1
      const freqOffsetB = effectiveFreqB + curveIdx * 0.15
      const freqOffsetC = freqC + curveIdx * 0.12
      const curvePhase = deltaRad + (curveIdx / curveCount) * Math.PI * 0.5

      let prevX = 0, prevY = 0, prevZ = 0

      for (let i = 0; i < pointCount; i++) {
        const t = (i / pointCount) * Math.PI * 2 * 8 // 8 full cycles
        const decay = damping > 0 ? Math.exp(-damping * t * 0.01) : 1

        const A = scale * 0.5 * decay
        const B = scale * 0.5 * decay
        const C = scale * 0.5 * decay

        let x = A * Math.sin(freqOffsetA * t + curvePhase)
        let y = B * Math.sin(freqOffsetB * t)
        let z = is3D ? C * Math.sin(freqOffsetC * t + curvePhase * 0.7) : 0

        // Apply symmetry rotation
        if (symIdx > 0) {
          const cosA = Math.cos(symAngle)
          const sinA = Math.sin(symAngle)
          const rx = x * cosA - y * sinA
          const ry = x * sinA + y * cosA
          x = rx
          y = ry
        }

        positions[i * 3] = x
        positions[i * 3 + 1] = y
        positions[i * 3 + 2] = z

        // Compute color
        const frac = i / pointCount
        let r = 1, g = 1, b = 1

        if (colorMode === 'rainbow') {
          ;[r, g, b] = hslToRgb(frac, 0.8, 0.55)
        } else if (colorMode === 'palette') {
          ;[r, g, b] = interpolateColors(palette, frac)
        } else if (colorMode === 'solid') {
          const hue = curveIdx / curveCount
          ;[r, g, b] = hslToRgb(hue, 0.8, 0.6)
        } else if (colorMode === 'speed') {
          // Color by velocity
          const dx = x - prevX
          const dy = y - prevY
          const dz = z - prevZ
          const speed = Math.sqrt(dx * dx + dy * dy + dz * dz)
          const normalizedSpeed = Math.min(1, speed / (scale * 0.3))
          ;[r, g, b] = hslToRgb(0.6 - normalizedSpeed * 0.5, 0.85, 0.4 + normalizedSpeed * 0.3)
        }

        colors[i * 3] = r
        colors[i * 3 + 1] = g
        colors[i * 3 + 2] = b

        prevX = x
        prevY = y
        prevZ = z
      }

      curves.push({ positions, colors })
    }

    // Glow trail points
    const glowCount = trailGlow ? Math.max(1, Math.floor(glowLength * pointCount)) : 0
    const glowPositions = new Float32Array(glowCount * 3)
    const glowColors = new Float32Array(glowCount * 3)

    return { curves, glowCount, glowPositions, glowColors }
  }, [totalCurves, curveCount, freqA, freqB, freqC, phaseShift, damping,
      pointCount, scale, colorMode, is3D, trailGlow, glowLength, freqRatio, symmetry])

  useFrame(({ clock }, delta) => {
    if (!groupRef.current) return
    const elapsed = clock.getElapsedTime()

    // Auto-rotation
    if (is3D) {
      groupRef.current.rotation.y = elapsed * rotationSpeed
      groupRef.current.rotation.x = Math.sin(elapsed * 0.12) * 0.2
    }

    // Progressive draw
    if (animated) {
      drawProgressRef.current = Math.min(1, drawProgressRef.current + delta * drawSpeed * 0.05)
    } else {
      drawProgressRef.current = 1
    }

    const drawCount = Math.floor(drawProgressRef.current * pointCount)
    const deltaRad = (phaseShift * Math.PI) / 180
    const effectiveFreqB = freqB * freqRatio

    // Phase animation offset
    const phaseOffset = phaseAnimate ? elapsed * phaseSpeed * 0.5 : 0

    // Update each curve with animated phase
    for (let c = 0; c < curveData.curves.length; c++) {
      const line = linesRef.current[c]
      if (!line) continue

      const posAttr = line.geometry.attributes.position as THREE.BufferAttribute
      const colAttr = line.geometry.attributes.color as THREE.BufferAttribute

      const curveIdx = c % curveCount
      const symIdx = Math.floor(c / curveCount)
      const symAngle = (symIdx / symmetry) * Math.PI * 2

      const freqOffsetA = freqA + curveIdx * 0.1
      const freqOffsetB = effectiveFreqB + curveIdx * 0.15
      const freqOffsetC = freqC + curveIdx * 0.12
      const curvePhase = deltaRad + (curveIdx / curveCount) * Math.PI * 0.5 + phaseOffset

      let prevX = 0, prevY = 0, prevZ = 0

      for (let i = 0; i < pointCount; i++) {
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

        posAttr.setXYZ(i, x, y, z)

        // Update speed-based color in animation
        if (colorMode === 'speed') {
          const dx = x - prevX
          const dy = y - prevY
          const dz = z - prevZ
          const speed = Math.sqrt(dx * dx + dy * dy + dz * dz)
          const normalizedSpeed = Math.min(1, speed / (scale * 0.3))
          const [r, g, b] = hslToRgb(0.6 - normalizedSpeed * 0.5, 0.85, 0.4 + normalizedSpeed * 0.3)
          colAttr.setXYZ(i, r, g, b)
        }

        prevX = x
        prevY = y
        prevZ = z
      }

      posAttr.needsUpdate = true
      if (colorMode === 'speed') colAttr.needsUpdate = true

      // Set draw range for progressive drawing
      line.geometry.setDrawRange(0, drawCount)
    }

    // Update glow trail behind the draw head
    if (glowRef.current && trailGlow && drawCount > 1) {
      const glowPosAttr = glowRef.current.geometry.attributes.position as THREE.BufferAttribute
      const glowColAttr = glowRef.current.geometry.attributes.color as THREE.BufferAttribute
      const glowCount = curveData.glowCount

      // Sample glow points from the first curve near the draw head
      const firstLine = linesRef.current[0]
      if (firstLine) {
        const linePosAttr = firstLine.geometry.attributes.position as THREE.BufferAttribute
        const lineColAttr = firstLine.geometry.attributes.color as THREE.BufferAttribute

        for (let i = 0; i < glowCount; i++) {
          const srcIdx = Math.max(0, drawCount - 1 - (glowCount - i))
          if (srcIdx >= 0 && srcIdx < pointCount) {
            const fade = (i / glowCount) // fade from dim to bright at head
            glowPosAttr.setXYZ(i,
              linePosAttr.getX(srcIdx),
              linePosAttr.getY(srcIdx),
              linePosAttr.getZ(srcIdx),
            )
            glowColAttr.setXYZ(i,
              lineColAttr.getX(srcIdx) * fade,
              lineColAttr.getY(srcIdx) * fade,
              lineColAttr.getZ(srcIdx) * fade,
            )
          } else {
            glowPosAttr.setXYZ(i, 0, 0, 0)
            glowColAttr.setXYZ(i, 0, 0, 0)
          }
        }

        glowPosAttr.needsUpdate = true
        glowColAttr.needsUpdate = true
      }
    }
  })

  return (
    <group ref={groupRef}>
      {curveData.curves.map((curve, idx) => (
        <line
          key={idx}
          ref={(el: THREE.Line | null) => {
            linesRef.current[idx] = el
          }}
        >
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              array={new Float32Array(curve.positions)}
              count={pointCount}
              itemSize={3}
            />
            <bufferAttribute
              attach="attributes-color"
              array={new Float32Array(curve.colors)}
              count={pointCount}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial
            vertexColors
            transparent
            opacity={lineOpacity}
            linewidth={thickness}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </line>
      ))}

      {trailGlow && curveData.glowCount > 0 && (
        <points ref={glowRef}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              array={curveData.glowPositions}
              count={curveData.glowCount}
              itemSize={3}
            />
            <bufferAttribute
              attach="attributes-color"
              array={curveData.glowColors}
              count={curveData.glowCount}
              itemSize={3}
            />
          </bufferGeometry>
          <pointsMaterial
            size={0.2}
            vertexColors
            transparent
            opacity={0.7}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            sizeAttenuation
          />
        </points>
      )}
    </group>
  )
}

export default function Lissajous({ params }: Props) {
  const curveCount = (params.curveCount as number) ?? 3
  const freqA = (params.freqA as number) ?? 3
  const freqB = (params.freqB as number) ?? 2
  const freqC = (params.freqC as number) ?? 5
  const phaseShift = (params.phaseShift as number) ?? 0
  const damping = (params.damping as number) ?? 0
  const pointCount = (params.pointCount as number) ?? 5000
  const scale = (params.scale as number) ?? 8
  const drawSpeed = (params.drawSpeed as number) ?? 2
  const animated = (params.animated as boolean) ?? true
  const colorMode = (params.colorMode as string) ?? 'rainbow'
  const lineOpacity = (params.lineOpacity as number) ?? 0.85
  const is3D = (params.is3D as boolean) ?? false
  const rotationSpeed = (params.rotationSpeed as number) ?? 0.2
  const phaseAnimate = (params.phaseAnimate as boolean) ?? true
  const phaseSpeed = (params.phaseSpeed as number) ?? 0.3
  const thickness = (params.thickness as number) ?? 1
  const trailGlow = (params.trailGlow as boolean) ?? true
  const glowLength = (params.glowLength as number) ?? 0.05
  const freqRatio = (params.freqRatio as number) ?? 1
  const symmetry = (params.symmetry as number) ?? 1

  return (
    <LissajousInner
      key={`${curveCount}-${pointCount}-${is3D}`}
      curveCount={curveCount}
      freqA={freqA}
      freqB={freqB}
      freqC={freqC}
      phaseShift={phaseShift}
      damping={damping}
      pointCount={pointCount}
      scale={scale}
      drawSpeed={drawSpeed}
      animated={animated}
      colorMode={colorMode}
      lineOpacity={lineOpacity}
      is3D={is3D}
      rotationSpeed={rotationSpeed}
      phaseAnimate={phaseAnimate}
      phaseSpeed={phaseSpeed}
      thickness={thickness}
      trailGlow={trailGlow}
      glowLength={glowLength}
      freqRatio={freqRatio}
      symmetry={symmetry}
    />
  )
}
