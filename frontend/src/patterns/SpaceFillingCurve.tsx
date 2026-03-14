import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { hilbertCurve, mooreCurve } from '../utils/hilbert'
import { hslToRgb, interpolateColors, hexToRgb } from '../utils/colorPalette'

interface Props {
  params: Record<string, unknown>
}

function SpaceFillingCurveInner({
  curveType, depth, drawSpeed, colorProgression, animated,
  rotation, lineWidthParam, scale, waveAmplitude, waveFrequency,
  waveSpeed, spiralTwist, pointMode, pointSize, glowTrail,
  glowLength, mirrorX, mirrorY, breathe, breatheSpeed,
}: {
  curveType: string; depth: number; drawSpeed: number;
  colorProgression: string; animated: boolean; rotation: number;
  lineWidthParam: number; scale: number; waveAmplitude: number;
  waveFrequency: number; waveSpeed: number; spiralTwist: number;
  pointMode: boolean; pointSize: number; glowTrail: boolean;
  glowLength: number; mirrorX: boolean; mirrorY: boolean;
  breathe: number; breatheSpeed: number;
}) {
  const lineRef = useRef<THREE.Line>(null)
  const pointsRef = useRef<THREE.Points>(null)
  const glowRef = useRef<THREE.Points>(null)
  const groupRef = useRef<THREE.Group>(null)

  const palette = ['#22d3ee', '#d946ef', '#fbbf24', '#4ade80']

  const curveData = useMemo(() => {
    let rawPoints = curveType === 'moore' ? mooreCurve(depth) : hilbertCurve(depth)
    const totalPoints = rawPoints.length

    // Apply spiral twist: remap (x,y) through polar coords with twist
    if (spiralTwist > 0) {
      rawPoints = rawPoints.map((p) => {
        const cx = p.x - 0.5
        const cy = p.y - 0.5
        const r = Math.sqrt(cx * cx + cy * cy)
        const theta = Math.atan2(cy, cx) + r * spiralTwist * Math.PI * 2
        return {
          x: 0.5 + r * Math.cos(theta),
          y: 0.5 + r * Math.sin(theta),
        }
      })
    }

    const positions = new Float32Array(totalPoints * 3)
    const colors = new Float32Array(totalPoints * 3)
    const basePositions = new Float32Array(totalPoints * 3)

    for (let i = 0; i < totalPoints; i++) {
      const x = (rawPoints[i].x - 0.5) * scale
      const y = (rawPoints[i].y - 0.5) * scale

      positions[i * 3] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = 0
      basePositions[i * 3] = x
      basePositions[i * 3 + 1] = y
      basePositions[i * 3 + 2] = 0

      const t = i / totalPoints

      let r = 1, g = 1, b = 1
      if (colorProgression === 'rainbow') {
        ;[r, g, b] = hslToRgb(t, 0.8, 0.6)
      } else if (colorProgression === 'palette') {
        ;[r, g, b] = interpolateColors(palette, t)
      } else if (colorProgression === 'solid') {
        ;[r, g, b] = hexToRgb('#22d3ee')
      } else if (colorProgression === 'depth') {
        const cx = rawPoints[i].x - 0.5
        const cy = rawPoints[i].y - 0.5
        const dist = Math.sqrt(cx * cx + cy * cy) * 2
        ;[r, g, b] = hslToRgb(dist * 0.8, 0.8, 0.5)
      } else if (colorProgression === 'direction') {
        if (i > 0) {
          const dx = rawPoints[i].x - rawPoints[i - 1].x
          const dy = rawPoints[i].y - rawPoints[i - 1].y
          const angle = (Math.atan2(dy, dx) / (Math.PI * 2) + 1) % 1
          ;[r, g, b] = hslToRgb(angle, 0.9, 0.55)
        }
      }

      colors[i * 3] = r
      colors[i * 3 + 1] = g
      colors[i * 3 + 2] = b
    }

    // Build mirror copies
    let mirrorCount = 1
    if (mirrorX) mirrorCount *= 2
    if (mirrorY) mirrorCount *= 2

    const allPositions = new Float32Array(totalPoints * 3 * mirrorCount)
    const allBasePositions = new Float32Array(totalPoints * 3 * mirrorCount)
    const allColors = new Float32Array(totalPoints * 3 * mirrorCount)

    allPositions.set(positions)
    allBasePositions.set(basePositions)
    allColors.set(colors)

    let copyIdx = 1
    if (mirrorX) {
      for (let i = 0; i < totalPoints; i++) {
        const off = copyIdx * totalPoints * 3
        allPositions[off + i * 3] = -positions[i * 3]
        allPositions[off + i * 3 + 1] = positions[i * 3 + 1]
        allPositions[off + i * 3 + 2] = 0
        allBasePositions[off + i * 3] = -basePositions[i * 3]
        allBasePositions[off + i * 3 + 1] = basePositions[i * 3 + 1]
        allBasePositions[off + i * 3 + 2] = 0
        allColors[off + i * 3] = colors[i * 3]
        allColors[off + i * 3 + 1] = colors[i * 3 + 1]
        allColors[off + i * 3 + 2] = colors[i * 3 + 2]
      }
      copyIdx++
    }
    if (mirrorY) {
      for (let i = 0; i < totalPoints; i++) {
        const off = copyIdx * totalPoints * 3
        allPositions[off + i * 3] = positions[i * 3]
        allPositions[off + i * 3 + 1] = -positions[i * 3 + 1]
        allPositions[off + i * 3 + 2] = 0
        allBasePositions[off + i * 3] = basePositions[i * 3]
        allBasePositions[off + i * 3 + 1] = -basePositions[i * 3 + 1]
        allBasePositions[off + i * 3 + 2] = 0
        allColors[off + i * 3] = colors[i * 3]
        allColors[off + i * 3 + 1] = colors[i * 3 + 1]
        allColors[off + i * 3 + 2] = colors[i * 3 + 2]
      }
      copyIdx++
    }
    if (mirrorX && mirrorY) {
      for (let i = 0; i < totalPoints; i++) {
        const off = copyIdx * totalPoints * 3
        allPositions[off + i * 3] = -positions[i * 3]
        allPositions[off + i * 3 + 1] = -positions[i * 3 + 1]
        allPositions[off + i * 3 + 2] = 0
        allBasePositions[off + i * 3] = -basePositions[i * 3]
        allBasePositions[off + i * 3 + 1] = -basePositions[i * 3 + 1]
        allBasePositions[off + i * 3 + 2] = 0
        allColors[off + i * 3] = colors[i * 3]
        allColors[off + i * 3 + 1] = colors[i * 3 + 1]
        allColors[off + i * 3 + 2] = colors[i * 3 + 2]
      }
    }

    const totalAll = totalPoints * mirrorCount

    // Glow trail points
    const glowCount = Math.max(1, Math.min(Math.floor(glowLength * totalPoints), totalAll))
    const glowPositions = new Float32Array(glowCount * 3)
    const glowColors = new Float32Array(glowCount * 3)

    return {
      positions: allPositions,
      basePositions: allBasePositions,
      colors: allColors,
      totalPoints: totalAll,
      rawTotalPoints: totalPoints,
      glowPositions,
      glowColors,
      glowCount,
    }
  }, [curveType, depth, colorProgression, spiralTwist, scale, mirrorX, mirrorY, glowLength])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    const mainGeom = pointMode ? pointsRef.current?.geometry : lineRef.current?.geometry
    if (!mainGeom) return

    // Apply wave distortion + breathe to positions
    if (waveAmplitude > 0 || breathe > 0) {
      const posAttr = mainGeom.attributes.position as THREE.BufferAttribute

      for (let i = 0; i < curveData.totalPoints; i++) {
        const bx = curveData.basePositions[i * 3]
        const by = curveData.basePositions[i * 3 + 1]

        // Wave displacement perpendicular to curve
        const wavePhase = (i / curveData.rawTotalPoints) * waveFrequency * Math.PI * 2
        const waveVal = Math.sin(wavePhase + t * waveSpeed) * waveAmplitude

        // Breathe: expand/contract from center
        const breatheVal = 1 + Math.sin(t * breatheSpeed) * breathe * 0.3

        // Perpendicular direction
        let nx = 0, ny = 1
        if (i > 0 && i < curveData.totalPoints - 1) {
          const dx = curveData.basePositions[(i + 1) * 3] - curveData.basePositions[(i - 1) * 3]
          const dy = curveData.basePositions[(i + 1) * 3 + 1] - curveData.basePositions[(i - 1) * 3 + 1]
          const len = Math.sqrt(dx * dx + dy * dy)
          if (len > 0.001) {
            nx = -dy / len
            ny = dx / len
          }
        }

        posAttr.setXYZ(i, bx * breatheVal + nx * waveVal, by * breatheVal + ny * waveVal, 0)
      }
      posAttr.needsUpdate = true
    }

    // Progressive draw
    if (animated) {
      const progress =
        ((t * drawSpeed * 50) % curveData.totalPoints) / curveData.totalPoints
      const drawCount = Math.floor(progress * curveData.totalPoints)
      mainGeom.setDrawRange(0, Math.max(2, drawCount))
    } else {
      mainGeom.setDrawRange(0, curveData.totalPoints)
    }

    // Glow trail behind draw head
    if (glowRef.current && glowTrail && animated) {
      const progress =
        ((t * drawSpeed * 50) % curveData.totalPoints) / curveData.totalPoints
      const headIdx = Math.floor(progress * curveData.totalPoints)
      const glowPosAttr = glowRef.current.geometry.attributes.position as THREE.BufferAttribute
      const glowColAttr = glowRef.current.geometry.attributes.color as THREE.BufferAttribute
      const srcPos = mainGeom.attributes.position as THREE.BufferAttribute

      for (let i = 0; i < curveData.glowCount; i++) {
        const srcIdx = Math.max(0, headIdx - i)
        const fade = 1 - i / curveData.glowCount

        glowPosAttr.setXYZ(i, srcPos.getX(srcIdx), srcPos.getY(srcIdx), 0.01)

        const ci = srcIdx * 3
        glowColAttr.setXYZ(i,
          (curveData.colors[ci] ?? 1) * fade,
          (curveData.colors[ci + 1] ?? 1) * fade,
          (curveData.colors[ci + 2] ?? 1) * fade,
        )
      }
      glowPosAttr.needsUpdate = true
      glowColAttr.needsUpdate = true
      glowRef.current.geometry.setDrawRange(0, Math.min(curveData.glowCount, headIdx))
    }

    // Rotation
    if (groupRef.current) {
      groupRef.current.rotation.z =
        (rotation * Math.PI) / 180 +
        (animated ? t * 0.02 : 0)
    }
  })

  return (
    <group ref={groupRef}>
      {!pointMode && (
        <line ref={lineRef as React.RefObject<THREE.Line>}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              array={new Float32Array(curveData.positions)}
              count={curveData.totalPoints}
              itemSize={3}
            />
            <bufferAttribute
              attach="attributes-color"
              array={curveData.colors}
              count={curveData.totalPoints}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial
            vertexColors
            transparent
            opacity={0.9}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            linewidth={lineWidthParam}
          />
        </line>
      )}

      {pointMode && (
        <points ref={pointsRef}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              array={new Float32Array(curveData.positions)}
              count={curveData.totalPoints}
              itemSize={3}
            />
            <bufferAttribute
              attach="attributes-color"
              array={curveData.colors}
              count={curveData.totalPoints}
              itemSize={3}
            />
          </bufferGeometry>
          <pointsMaterial
            size={pointSize}
            vertexColors
            transparent
            opacity={0.9}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            sizeAttenuation={false}
          />
        </points>
      )}

      {glowTrail && (
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
            size={pointSize * 3}
            vertexColors
            transparent
            opacity={0.6}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            sizeAttenuation={false}
          />
        </points>
      )}
    </group>
  )
}

export default function SpaceFillingCurve({ params }: Props) {
  const curveType = (params.curveType as string) ?? 'hilbert'
  const depth = Math.min((params.depth as number) ?? 5, 7)
  const drawSpeed = (params.drawSpeed as number) ?? 5
  const colorProgression = (params.colorProgression as string) ?? 'rainbow'
  const animated = (params.animated as boolean) ?? true
  const rotation = (params.rotation as number) ?? 0
  const lineWidthParam = (params.lineWidth as number) ?? 2
  const scale = (params.scale as number) ?? 15
  const waveAmplitude = (params.waveAmplitude as number) ?? 0
  const waveFrequency = (params.waveFrequency as number) ?? 3
  const waveSpeed = (params.waveSpeed as number) ?? 1
  const spiralTwist = (params.spiralTwist as number) ?? 0
  const pointMode = (params.pointMode as boolean) ?? false
  const pointSize = (params.pointSize as number) ?? 3
  const glowTrail = (params.glowTrail as boolean) ?? true
  const glowLength = (params.glowLength as number) ?? 0.05
  const mirrorX = (params.mirrorX as boolean) ?? false
  const mirrorY = (params.mirrorY as boolean) ?? false
  const breathe = (params.breathe as number) ?? 0
  const breatheSpeed = (params.breatheSpeed as number) ?? 0.5

  return (
    <SpaceFillingCurveInner
      key={`${curveType}-${depth}-${mirrorX}-${mirrorY}-${pointMode}-${spiralTwist.toFixed(2)}`}
      curveType={curveType}
      depth={depth}
      drawSpeed={drawSpeed}
      colorProgression={colorProgression}
      animated={animated}
      rotation={rotation}
      lineWidthParam={lineWidthParam}
      scale={scale}
      waveAmplitude={waveAmplitude}
      waveFrequency={waveFrequency}
      waveSpeed={waveSpeed}
      spiralTwist={spiralTwist}
      pointMode={pointMode}
      pointSize={pointSize}
      glowTrail={glowTrail}
      glowLength={glowLength}
      mirrorX={mirrorX}
      mirrorY={mirrorY}
      breathe={breathe}
      breatheSpeed={breatheSpeed}
    />
  )
}
