import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { hslToRgb, interpolateColors } from '../utils/colorPalette'

interface Props {
  params: Record<string, unknown>
}

function SphereSpiralsInner({
  spiralCount, pointsPerSpiral, radius, turns,
  rotationSpeed, wobble, wobbleSpeed, colorMode, wireframe,
  noiseDistort, noiseFreq, pulseAmplitude, pulseSpeed,
  flatten, spread, trailGlow, autoMorph, morphSpeed,
}: {
  spiralCount: number; pointsPerSpiral: number; radius: number;
  turns: number; rotationSpeed: number; wobble: number;
  wobbleSpeed: number; colorMode: string; wireframe: boolean;
  noiseDistort: number; noiseFreq: number; pulseAmplitude: number;
  pulseSpeed: number; flatten: number; spread: number;
  trailGlow: boolean; autoMorph: boolean; morphSpeed: number;
}) {
  const groupRef = useRef<THREE.Group>(null)
  const linesRef = useRef<(THREE.Line | null)[]>([])
  const glowRef = useRef<THREE.Points>(null)

  const palette = ['#22d3ee', '#d946ef', '#fbbf24', '#4ade80', '#f87171', '#818cf8']

  // Simple 3D noise-like function for distortion
  const noise3 = (x: number, y: number, z: number): number => {
    const n = Math.sin(x * 1.3 + y * 0.7) * Math.cos(y * 1.1 + z * 0.9) +
              Math.sin(z * 1.7 + x * 0.5) * Math.cos(x * 0.8 + y * 1.4) +
              Math.sin(y * 2.1 + z * 0.3) * 0.5
    return n / 2.5
  }

  const spiralData = useMemo(() => {
    const spirals: { positions: Float32Array; colors: Float32Array }[] = []

    for (let s = 0; s < spiralCount; s++) {
      const positions = new Float32Array(pointsPerSpiral * 3)
      const colors = new Float32Array(pointsPerSpiral * 3)
      const spiralOffset = (s / spiralCount) * Math.PI * 2

      for (let i = 0; i < pointsPerSpiral; i++) {
        const t = i / pointsPerSpiral
        const phi = t * Math.PI * turns + spiralOffset
        const theta = t * Math.PI

        const x = radius * Math.sin(theta) * Math.cos(phi)
        const y = radius * Math.sin(theta) * Math.sin(phi)
        const z = radius * Math.cos(theta)

        positions[i * 3] = x
        positions[i * 3 + 1] = y
        positions[i * 3 + 2] = z

        let r = 1, g = 1, b = 1
        if (colorMode === 'spiral') {
          const h = s / spiralCount
          ;[r, g, b] = hslToRgb(h, 0.8, 0.6)
        } else if (colorMode === 'height') {
          const h = 0.55 + (z / radius) * 0.3
          ;[r, g, b] = hslToRgb(h, 0.7, 0.5)
        } else if (colorMode === 'angle') {
          const h = (phi / (Math.PI * 2)) % 1
          ;[r, g, b] = hslToRgb(h, 0.8, 0.5)
        } else if (colorMode === 'palette') {
          ;[r, g, b] = interpolateColors(palette, t)
        } else if (colorMode === 'speed') {
          // Color by "speed" = rate of parameter change
          const speed = Math.abs(Math.sin(theta * 3 + phi * 2))
          ;[r, g, b] = hslToRgb(0.55 - speed * 0.4, 0.85, 0.4 + speed * 0.3)
        }

        colors[i * 3] = r
        colors[i * 3 + 1] = g
        colors[i * 3 + 2] = b
      }

      spirals.push({ positions, colors })
    }

    // Glow points: sample along all spirals
    const glowCount = trailGlow ? spiralCount * Math.min(pointsPerSpiral, 200) : 0
    const glowPositions = new Float32Array(glowCount * 3)
    const glowColors = new Float32Array(glowCount * 3)

    return { spirals, glowCount, glowPositions, glowColors }
  }, [spiralCount, pointsPerSpiral, radius, turns, colorMode, trailGlow])

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const t = clock.getElapsedTime()

    // Auto-rotation
    groupRef.current.rotation.y = t * rotationSpeed
    groupRef.current.rotation.x = Math.sin(t * 0.15) * 0.3

    // Auto-morph: slowly change turns over time
    const dynamicTurns = autoMorph
      ? turns + Math.sin(t * morphSpeed * 0.3) * 2
      : turns

    // Update spiral positions with all effects
    for (let s = 0; s < spiralData.spirals.length; s++) {
      const line = linesRef.current[s]
      if (!line) continue

      const posAttr = line.geometry.attributes.position as THREE.BufferAttribute
      const spiralOffset = (s / spiralCount) * Math.PI * 2

      for (let i = 0; i < pointsPerSpiral; i++) {
        const frac = i / pointsPerSpiral
        const phi = frac * Math.PI * dynamicTurns + spiralOffset
        const theta = frac * Math.PI

        // Base sphere position
        let bx = Math.sin(theta) * Math.cos(phi)
        let by = Math.sin(theta) * Math.sin(phi)
        let bz = Math.cos(theta)

        // Flatten: squash the sphere along Y axis
        by *= (1 - flatten)

        // Spread: push spirals apart from center
        const spreadFactor = 1 + spread * (s / spiralCount - 0.5) * 2
        bx *= spreadFactor
        by *= spreadFactor

        // Wobble
        const wobbleAmount = wobble * Math.sin(t * wobbleSpeed + phi * 2 + theta * 3) * 0.2

        // Noise distortion: displace radially by noise
        const noiseVal = noiseDistort > 0
          ? noise3(bx * noiseFreq + t * 0.3, by * noiseFreq, bz * noiseFreq + t * 0.2) * noiseDistort
          : 0

        // Pulse: rhythmic expansion
        const pulseVal = pulseAmplitude > 0
          ? Math.sin(t * pulseSpeed + frac * Math.PI * 4) * pulseAmplitude * 0.15
          : 0

        const r = radius + wobbleAmount + noiseVal + pulseVal

        const x = r * bx
        const y = r * by
        const z = r * bz

        posAttr.setXYZ(i, x, y, z)
      }

      posAttr.needsUpdate = true
    }

    // Update glow points
    if (glowRef.current && trailGlow) {
      const glowPosAttr = glowRef.current.geometry.attributes.position as THREE.BufferAttribute
      const glowColAttr = glowRef.current.geometry.attributes.color as THREE.BufferAttribute
      const samplesPerSpiral = Math.min(pointsPerSpiral, 200)

      for (let s = 0; s < spiralData.spirals.length; s++) {
        const line = linesRef.current[s]
        if (!line) continue
        const linePosAttr = line.geometry.attributes.position as THREE.BufferAttribute

        for (let i = 0; i < samplesPerSpiral; i++) {
          const srcIdx = Math.floor((i / samplesPerSpiral) * pointsPerSpiral)
          const dstIdx = s * samplesPerSpiral + i

          if (dstIdx < spiralData.glowCount) {
            glowPosAttr.setXYZ(dstIdx,
              linePosAttr.getX(srcIdx),
              linePosAttr.getY(srcIdx),
              linePosAttr.getZ(srcIdx),
            )

            const ci = srcIdx * 3
            const fade = 0.4 + Math.sin(t * 2 + srcIdx * 0.1) * 0.2
            glowColAttr.setXYZ(dstIdx,
              spiralData.spirals[s].colors[ci] * fade,
              spiralData.spirals[s].colors[ci + 1] * fade,
              spiralData.spirals[s].colors[ci + 2] * fade,
            )
          }
        }
      }
      glowPosAttr.needsUpdate = true
      glowColAttr.needsUpdate = true
    }
  })

  return (
    <group ref={groupRef}>
      {spiralData.spirals.map((spiral, idx) => (
        <line
          key={idx}
          ref={(el: THREE.Line | null) => {
            linesRef.current[idx] = el
          }}
        >
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              array={new Float32Array(spiral.positions)}
              count={pointsPerSpiral}
              itemSize={3}
            />
            <bufferAttribute
              attach="attributes-color"
              array={spiral.colors}
              count={pointsPerSpiral}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial
            vertexColors
            transparent
            opacity={0.85}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </line>
      ))}

      {trailGlow && spiralData.glowCount > 0 && (
        <points ref={glowRef}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              array={spiralData.glowPositions}
              count={spiralData.glowCount}
              itemSize={3}
            />
            <bufferAttribute
              attach="attributes-color"
              array={spiralData.glowColors}
              count={spiralData.glowCount}
              itemSize={3}
            />
          </bufferGeometry>
          <pointsMaterial
            size={0.15}
            vertexColors
            transparent
            opacity={0.5}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            sizeAttenuation
          />
        </points>
      )}

      {wireframe && (
        <mesh>
          <sphereGeometry args={[radius * 0.98, 24, 24]} />
          <meshBasicMaterial
            color="#ffffff"
            wireframe
            transparent
            opacity={0.05}
          />
        </mesh>
      )}
    </group>
  )
}

export default function SphereSpirals({ params }: Props) {
  const spiralCount = (params.spiralCount as number) ?? 8
  const pointsPerSpiral = (params.pointsPerSpiral as number) ?? 500
  const radius = (params.radius as number) ?? 5
  const turns = (params.turns as number) ?? 5
  const rotationSpeed = (params.rotationSpeed as number) ?? 0.3
  const wobble = (params.wobble as number) ?? 0.5
  const wobbleSpeed = (params.wobbleSpeed as number) ?? 0.5
  const colorMode = (params.colorMode as string) ?? 'spiral'
  const wireframe = (params.wireframe as boolean) ?? false
  const noiseDistort = (params.noiseDistort as number) ?? 0
  const noiseFreq = (params.noiseFreq as number) ?? 2
  const pulseAmplitude = (params.pulseAmplitude as number) ?? 0
  const pulseSpeed = (params.pulseSpeed as number) ?? 1
  const flatten = (params.flatten as number) ?? 0
  const spread = (params.spread as number) ?? 0
  const trailGlow = (params.trailGlow as boolean) ?? false
  const autoMorph = (params.autoMorph as boolean) ?? false
  const morphSpeed = (params.morphSpeed as number) ?? 0.5

  return (
    <SphereSpiralsInner
      key={`${spiralCount}-${pointsPerSpiral}-${trailGlow}`}
      spiralCount={spiralCount}
      pointsPerSpiral={pointsPerSpiral}
      radius={radius}
      turns={turns}
      rotationSpeed={rotationSpeed}
      wobble={wobble}
      wobbleSpeed={wobbleSpeed}
      colorMode={colorMode}
      wireframe={wireframe}
      noiseDistort={noiseDistort}
      noiseFreq={noiseFreq}
      pulseAmplitude={pulseAmplitude}
      pulseSpeed={pulseSpeed}
      flatten={flatten}
      spread={spread}
      trailGlow={trailGlow}
      autoMorph={autoMorph}
      morphSpeed={morphSpeed}
    />
  )
}
