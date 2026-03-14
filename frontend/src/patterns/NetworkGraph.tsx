import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { createSeededRandom } from '../utils/seededRandom'
import { useInteraction } from '../systems/InteractionManager'

interface Props {
  params: Record<string, unknown>
}

function NetworkGraphInner({
  nodeCount, edgeDistance, nodeSize, edgeOpacity, pulseSpeed,
  clusterCount, damping, connectionDensity, maxConnections,
  distanceBias, longRangeChance, travelerCount, travelerSpeed,
}: {
  nodeCount: number; edgeDistance: number; nodeSize: number;
  edgeOpacity: number; pulseSpeed: number; clusterCount: number;
  damping: number; connectionDensity: number; maxConnections: number;
  distanceBias: number; longRangeChance: number; travelerCount: number;
  travelerSpeed: number;
}) {
  const pointsRef = useRef<THREE.Points>(null)
  const linesRef = useRef<THREE.LineSegments>(null)
  const travelersRef = useRef<THREE.Points>(null)
  const nebulaRef = useRef<THREE.Points>(null)

  const { mouse } = useInteraction()

  const nodeSprite = useMemo(() => {
    const size = 64
    const data = new Uint8Array(size * size * 4)
    const center = size / 2
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - center
        const dy = y - center
        const dist = Math.sqrt(dx * dx + dy * dy) / center
        const alpha = Math.max(0, 1 - dist * dist) * 255
        const idx = (y * size + x) * 4
        data[idx] = 255
        data[idx + 1] = 255
        data[idx + 2] = 255
        data[idx + 3] = alpha
      }
    }
    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
    tex.needsUpdate = true
    return tex
  }, [])

  const state = useMemo(() => {
    const rng = createSeededRandom(42)
    const scale = edgeDistance * 2

    // Create cluster centers
    const centers: THREE.Vector3[] = []
    for (let c = 0; c < clusterCount; c++) {
      centers.push(
        new THREE.Vector3(
          (rng() - 0.5) * scale,
          (rng() - 0.5) * scale,
          0,
        ),
      )
    }

    // Create nodes near cluster centers
    const positions = new Float32Array(nodeCount * 3)
    const colors = new Float32Array(nodeCount * 3)
    const velocities = new Float32Array(nodeCount * 3)
    const clusterIds = new Int32Array(nodeCount)

    const palette = [
      [0.13, 0.83, 0.93], // cyan
      [0.85, 0.27, 0.94], // fuchsia
      [0.98, 0.75, 0.15], // amber
      [0.13, 0.93, 0.53], // green
      [0.93, 0.35, 0.35], // red
      [0.35, 0.55, 0.93], // blue
      [0.93, 0.53, 0.13], // orange
      [0.53, 0.93, 0.13], // lime
      [0.93, 0.13, 0.73], // pink
      [0.13, 0.53, 0.93], // sky
    ]

    for (let i = 0; i < nodeCount; i++) {
      const ci = Math.floor(rng() * clusterCount)
      clusterIds[i] = ci
      const center = centers[ci]
      const spread = edgeDistance * 0.6
      positions[i * 3] = center.x + (rng() - 0.5) * spread
      positions[i * 3 + 1] = center.y + (rng() - 0.5) * spread
      positions[i * 3 + 2] = 0

      const col = palette[ci % palette.length]
      colors[i * 3] = col[0]
      colors[i * 3 + 1] = col[1]
      colors[i * 3 + 2] = col[2]

      velocities[i * 3] = 0
      velocities[i * 3 + 1] = 0
      velocities[i * 3 + 2] = 0
    }

    // Build edges with sparseness controls
    // For each node, find candidates sorted by distance, then probabilistically connect
    const connectionCounts = new Int32Array(nodeCount) // track per-node connections
    const edgeSet = new Set<string>()
    const edgeList: [number, number][] = []

    // Precompute all pairwise distances for candidates
    for (let i = 0; i < nodeCount; i++) {
      // Gather candidates sorted by distance
      const candidates: { j: number; dist: number }[] = []
      for (let j = 0; j < nodeCount; j++) {
        if (j === i) continue
        const dx = positions[i * 3] - positions[j * 3]
        const dy = positions[i * 3 + 1] - positions[j * 3 + 1]
        const dist = Math.sqrt(dx * dx + dy * dy)
        candidates.push({ j, dist })
      }
      candidates.sort((a, b) => a.dist - b.dist)

      for (const cand of candidates) {
        // Skip if this node already has max connections
        if (connectionCounts[i] >= maxConnections) break
        if (connectionCounts[cand.j] >= maxConnections) continue

        // Deduplicate
        const key = Math.min(i, cand.j) + ':' + Math.max(i, cand.j)
        if (edgeSet.has(key)) continue

        let connectProb: number
        if (cand.dist <= edgeDistance) {
          // Near range: probability falls off with distance, biased by distanceBias
          // distanceBias > 1 = strongly prefer close nodes, < 1 = more uniform
          const normalizedDist = cand.dist / edgeDistance
          connectProb = connectionDensity * Math.pow(1 - normalizedDist, distanceBias)
        } else {
          // Beyond normal range: only long-range connections
          connectProb = longRangeChance * Math.exp(-cand.dist / (edgeDistance * 3))
        }

        if (rng() < connectProb) {
          edgeList.push([i, cand.j])
          edgeSet.add(key)
          connectionCounts[i]++
          connectionCounts[cand.j]++
        }
      }
    }

    const edgePositions = new Float32Array(edgeList.length * 6)
    const edgeColors = new Float32Array(edgeList.length * 6)

    // Travelers
    const actualTravelerCount = Math.min(edgeList.length, travelerCount)
    const travelerPositions = new Float32Array(actualTravelerCount * 3)
    const travelerProgress = new Float32Array(actualTravelerCount)
    const travelerEdges = new Int32Array(actualTravelerCount)
    for (let i = 0; i < actualTravelerCount; i++) {
      travelerEdges[i] = Math.floor(rng() * edgeList.length)
      travelerProgress[i] = rng()
    }

    // Nebula
    const nebulaCount = 12
    const nebulaPositions = new Float32Array(nebulaCount * 3)
    const nebulaColors = new Float32Array(nebulaCount * 3)
    const nebulaSizes = new Float32Array(nebulaCount)
    for (let i = 0; i < nebulaCount; i++) {
      nebulaPositions[i * 3] = (rng() - 0.5) * scale * 1.5
      nebulaPositions[i * 3 + 1] = (rng() - 0.5) * scale * 1.5
      nebulaPositions[i * 3 + 2] = -10
      const col = palette[Math.floor(rng() * palette.length)]
      nebulaColors[i * 3] = col[0]
      nebulaColors[i * 3 + 1] = col[1]
      nebulaColors[i * 3 + 2] = col[2]
      nebulaSizes[i] = 50 + rng() * 100
    }

    return {
      positions,
      colors,
      velocities,
      edgeList,
      edgePositions,
      edgeColors,
      travelerPositions,
      travelerProgress,
      travelerEdges,
      travelerCount: actualTravelerCount,
      nebulaPositions,
      nebulaColors,
      nebulaSizes,
      nebulaCount,
    }
  }, [nodeCount, edgeDistance, clusterCount, connectionDensity, maxConnections, distanceBias, longRangeChance, travelerCount])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()

    // Update edges
    for (let e = 0; e < state.edgeList.length; e++) {
      const [i, j] = state.edgeList[e]
      state.edgePositions[e * 6] = state.positions[i * 3]
      state.edgePositions[e * 6 + 1] = state.positions[i * 3 + 1]
      state.edgePositions[e * 6 + 2] = state.positions[i * 3 + 2]
      state.edgePositions[e * 6 + 3] = state.positions[j * 3]
      state.edgePositions[e * 6 + 4] = state.positions[j * 3 + 1]
      state.edgePositions[e * 6 + 5] = state.positions[j * 3 + 2]

      const pulse = (Math.sin(t * pulseSpeed + e * 0.5) + 1) * 0.5
      const alpha = edgeOpacity * (0.3 + pulse * 0.7)
      state.edgeColors[e * 6] = alpha
      state.edgeColors[e * 6 + 1] = alpha
      state.edgeColors[e * 6 + 2] = alpha
      state.edgeColors[e * 6 + 3] = alpha
      state.edgeColors[e * 6 + 4] = alpha
      state.edgeColors[e * 6 + 5] = alpha
    }

    // Mouse interaction
    const mouseWorld = new THREE.Vector3(mouse.x * 200, mouse.y * 200, 0)
    for (let i = 0; i < nodeCount; i++) {
      const dx = state.positions[i * 3] - mouseWorld.x
      const dy = state.positions[i * 3 + 1] - mouseWorld.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 80 && dist > 0.1) {
        const force = 0.5 / dist
        state.velocities[i * 3] += dx * force
        state.velocities[i * 3 + 1] += dy * force
      }

      state.positions[i * 3] += state.velocities[i * 3] * 0.016
      state.positions[i * 3 + 1] += state.velocities[i * 3 + 1] * 0.016
      state.velocities[i * 3] *= damping
      state.velocities[i * 3 + 1] *= damping
    }

    // Update travelers
    for (let i = 0; i < state.travelerCount; i++) {
      state.travelerProgress[i] += travelerSpeed * 0.01
      if (state.travelerProgress[i] > 1) {
        state.travelerProgress[i] = 0
        state.travelerEdges[i] =
          Math.floor(Math.random() * state.edgeList.length)
      }
      const edge = state.edgeList[state.travelerEdges[i]]
      if (edge) {
        const [a, b] = edge
        const prog = state.travelerProgress[i]
        state.travelerPositions[i * 3] =
          state.positions[a * 3] * (1 - prog) +
          state.positions[b * 3] * prog
        state.travelerPositions[i * 3 + 1] =
          state.positions[a * 3 + 1] * (1 - prog) +
          state.positions[b * 3 + 1] * prog
        state.travelerPositions[i * 3 + 2] = 0.1
      }
    }

    // Update buffers
    if (pointsRef.current) {
      const geom = pointsRef.current.geometry
      geom.attributes.position.needsUpdate = true
    }
    if (linesRef.current) {
      const geom = linesRef.current.geometry
      ;(geom.attributes.position as THREE.BufferAttribute).set(
        state.edgePositions,
      )
      geom.attributes.position.needsUpdate = true
      ;(geom.attributes.color as THREE.BufferAttribute).set(state.edgeColors)
      geom.attributes.color.needsUpdate = true
    }
    if (travelersRef.current) {
      const geom = travelersRef.current.geometry
      ;(geom.attributes.position as THREE.BufferAttribute).set(
        state.travelerPositions,
      )
      geom.attributes.position.needsUpdate = true
    }

    // Nebula color cycling
    if (nebulaRef.current) {
      for (let i = 0; i < state.nebulaCount; i++) {
        const phase = t * 0.1 + i * 0.5
        const r = state.nebulaColors[i * 3]
        const g = state.nebulaColors[i * 3 + 1]
        const b = state.nebulaColors[i * 3 + 2]
        const cycle = (Math.sin(phase) + 1) * 0.5
        const attr = nebulaRef.current.geometry.attributes
          .color as THREE.BufferAttribute
        attr.setXYZ(i, r * cycle, g * cycle, b * cycle)
        attr.needsUpdate = true
      }
    }
  })

  return (
    <group>
      {/* Nebula background */}
      <points ref={nebulaRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            array={state.nebulaPositions}
            count={state.nebulaCount}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            array={new Float32Array(state.nebulaColors)}
            count={state.nebulaCount}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          map={nodeSprite}
          size={80}
          transparent
          opacity={0.08}
          vertexColors
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Edges */}
      <lineSegments ref={linesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            array={new Float32Array(state.edgePositions.length)}
            count={state.edgeList.length * 2}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            array={new Float32Array(state.edgeColors.length)}
            count={state.edgeList.length * 2}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial
          vertexColors
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>

      {/* Nodes */}
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            array={state.positions}
            count={nodeCount}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            array={state.colors}
            count={nodeCount}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          map={nodeSprite}
          size={nodeSize * 3}
          transparent
          vertexColors
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Travelers */}
      <points ref={travelersRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            array={new Float32Array(state.travelerCount * 3)}
            count={state.travelerCount}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          map={nodeSprite}
          size={nodeSize * 5}
          transparent
          color="#ffffff"
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  )
}

export default function NetworkGraph({ params }: Props) {
  const nodeCount = (params.nodeCount as number) ?? 80
  const edgeDistance = (params.edgeDistance as number) ?? 120
  const nodeSize = (params.nodeSize as number) ?? 2
  const edgeOpacity = (params.edgeOpacity as number) ?? 0.3
  const pulseSpeed = (params.pulseSpeed as number) ?? 1
  const clusterCount = (params.clusterCount as number) ?? 3
  const damping = (params.damping as number) ?? 0.9
  const connectionDensity = (params.connectionDensity as number) ?? 0.3
  const maxConnections = (params.maxConnections as number) ?? 5
  const distanceBias = (params.distanceBias as number) ?? 1.5
  const longRangeChance = (params.longRangeChance as number) ?? 0.05
  const travelerCount = (params.travelerCount as number) ?? 30
  const travelerSpeed = (params.travelerSpeed as number) ?? 1

  // Key on params that affect buffer sizes to force remount when they change
  const key = `${nodeCount}-${clusterCount}-${connectionDensity}-${maxConnections}-${distanceBias}-${longRangeChance}-${travelerCount}-${edgeDistance}`

  return (
    <NetworkGraphInner
      key={key}
      nodeCount={nodeCount}
      edgeDistance={edgeDistance}
      nodeSize={nodeSize}
      edgeOpacity={edgeOpacity}
      pulseSpeed={pulseSpeed}
      clusterCount={clusterCount}
      damping={damping}
      connectionDensity={connectionDensity}
      maxConnections={maxConnections}
      distanceBias={distanceBias}
      longRangeChance={longRangeChance}
      travelerCount={travelerCount}
      travelerSpeed={travelerSpeed}
    />
  )
}
