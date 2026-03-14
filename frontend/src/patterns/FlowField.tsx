import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { noise3D, curlNoise3D } from '../utils/noise'
import { useInteraction } from '../systems/InteractionManager'
import { interpolateColors } from '../utils/colorPalette'

interface Props {
  params: Record<string, unknown>
}

const PALETTE = ['#22d3ee', '#d946ef', '#fbbf24', '#22d3ee']

function FlowFieldInner({
  particleCount, noiseScale, noiseSpeed, particleSpeed,
  particleLife, fieldStrength, fadeRate, lineWidth,
}: {
  particleCount: number; noiseScale: number; noiseSpeed: number;
  particleSpeed: number; particleLife: number; fieldStrength: number;
  fadeRate: number; lineWidth: number;
}) {
  const pointsRef = useRef<THREE.Points>(null)
  const trailRef = useRef<THREE.LineSegments>(null)
  const { mouse } = useInteraction()

  const state = useMemo(() => {
    const positions = new Float32Array(particleCount * 3)
    const colors = new Float32Array(particleCount * 3)
    const ages = new Float32Array(particleCount)
    const maxAges = new Float32Array(particleCount)

    const SPREAD = 400

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * SPREAD
      positions[i * 3 + 1] = (Math.random() - 0.5) * SPREAD
      positions[i * 3 + 2] = 0
      ages[i] = Math.random() * particleLife
      maxAges[i] = particleLife * (0.5 + Math.random() * 0.5)

      const col = interpolateColors(PALETTE, Math.random())
      colors[i * 3] = col[0]
      colors[i * 3 + 1] = col[1]
      colors[i * 3 + 2] = col[2]
    }

    // Trail segments: each particle can have trail segments
    const trailSegCount = particleCount * 2 // one line segment per particle (current to prev)
    const trailPositions = new Float32Array(trailSegCount * 3)
    const trailColors = new Float32Array(trailSegCount * 3)
    const prevPositions = new Float32Array(particleCount * 3)
    prevPositions.set(positions)

    return {
      positions,
      colors,
      ages,
      maxAges,
      trailPositions,
      trailColors,
      prevPositions,
      trailSegCount,
      SPREAD,
    }
  }, [particleCount, particleLife])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    const SPREAD = state.SPREAD

    for (let i = 0; i < particleCount; i++) {
      // Save previous position for trail
      state.prevPositions[i * 3] = state.positions[i * 3]
      state.prevPositions[i * 3 + 1] = state.positions[i * 3 + 1]

      const x = state.positions[i * 3]
      const y = state.positions[i * 3 + 1]

      // Sample curl noise at particle position
      const curl = curlNoise3D(
        x * noiseScale,
        y * noiseScale,
        t * noiseSpeed,
      )

      // Simple noise for non-curl mode
      const nx = noise3D(x * noiseScale, y * noiseScale, t * noiseSpeed)
      const ny = noise3D(
        x * noiseScale + 100,
        y * noiseScale + 100,
        t * noiseSpeed,
      )

      let vx = curl[0] * fieldStrength + nx * 0.2
      let vy = curl[1] * fieldStrength + ny * 0.2

      // Mouse force
      const mouseWorld = new THREE.Vector2(mouse.x * 200, mouse.y * 200)
      const dx = x - mouseWorld.x
      const dy = y - mouseWorld.y
      const mouseDist = Math.sqrt(dx * dx + dy * dy)
      if (mouseDist < 100 && mouseDist > 1) {
        const force = 30 / mouseDist
        vx += dx * force * 0.01
        vy += dy * force * 0.01
      }

      state.positions[i * 3] += vx * particleSpeed
      state.positions[i * 3 + 1] += vy * particleSpeed

      state.ages[i] += 1

      // Respawn when out of bounds or too old
      if (
        state.ages[i] > state.maxAges[i] ||
        Math.abs(state.positions[i * 3]) > SPREAD * 0.5 ||
        Math.abs(state.positions[i * 3 + 1]) > SPREAD * 0.5
      ) {
        state.positions[i * 3] = (Math.random() - 0.5) * SPREAD
        state.positions[i * 3 + 1] = (Math.random() - 0.5) * SPREAD
        state.prevPositions[i * 3] = state.positions[i * 3]
        state.prevPositions[i * 3 + 1] = state.positions[i * 3 + 1]
        state.ages[i] = 0
        state.maxAges[i] = particleLife * (0.5 + Math.random() * 0.5)
      }

      // Update trail segment
      const lifeFrac = 1 - state.ages[i] / state.maxAges[i]
      const alpha = lifeFrac * (1 - fadeRate)

      state.trailPositions[i * 6] = state.prevPositions[i * 3]
      state.trailPositions[i * 6 + 1] = state.prevPositions[i * 3 + 1]
      state.trailPositions[i * 6 + 2] = 0
      state.trailPositions[i * 6 + 3] = state.positions[i * 3]
      state.trailPositions[i * 6 + 4] = state.positions[i * 3 + 1]
      state.trailPositions[i * 6 + 5] = 0

      state.trailColors[i * 6] = state.colors[i * 3] * alpha
      state.trailColors[i * 6 + 1] = state.colors[i * 3 + 1] * alpha
      state.trailColors[i * 6 + 2] = state.colors[i * 3 + 2] * alpha
      state.trailColors[i * 6 + 3] = state.colors[i * 3] * alpha
      state.trailColors[i * 6 + 4] = state.colors[i * 3 + 1] * alpha
      state.trailColors[i * 6 + 5] = state.colors[i * 3 + 2] * alpha
    }

    if (pointsRef.current) {
      pointsRef.current.geometry.attributes.position.needsUpdate = true
    }
    if (trailRef.current) {
      const geom = trailRef.current.geometry
      ;(geom.attributes.position as THREE.BufferAttribute).set(
        state.trailPositions,
      )
      geom.attributes.position.needsUpdate = true
      ;(geom.attributes.color as THREE.BufferAttribute).set(state.trailColors)
      geom.attributes.color.needsUpdate = true
    }
  })

  return (
    <group>
      {/* Trail lines */}
      <lineSegments ref={trailRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            array={new Float32Array(state.trailSegCount * 3)}
            count={state.trailSegCount}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            array={new Float32Array(state.trailSegCount * 3)}
            count={state.trailSegCount}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={0.8}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          linewidth={lineWidth}
        />
      </lineSegments>

      {/* Particle heads */}
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            array={state.positions}
            count={particleCount}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            array={state.colors}
            count={particleCount}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={lineWidth * 1.5}
          vertexColors
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
    </group>
  )
}

export default function FlowField({ params }: Props) {
  const particleCount = Math.min((params.particleCount as number) ?? 5000, 20000)
  const noiseScale = (params.noiseScale as number) ?? 0.005
  const noiseSpeed = (params.noiseSpeed as number) ?? 0.2
  const particleSpeed = (params.particleSpeed as number) ?? 2
  const particleLife = (params.particleLife as number) ?? 100
  const fieldStrength = (params.fieldStrength as number) ?? 1
  const fadeRate = (params.fadeRate as number) ?? 0.05
  const lineWidth = (params.lineWidth as number) ?? 1

  return (
    <FlowFieldInner
      key={particleCount}
      particleCount={particleCount}
      noiseScale={noiseScale}
      noiseSpeed={noiseSpeed}
      particleSpeed={particleSpeed}
      particleLife={particleLife}
      fieldStrength={fieldStrength}
      fadeRate={fadeRate}
      lineWidth={lineWidth}
    />
  )
}
