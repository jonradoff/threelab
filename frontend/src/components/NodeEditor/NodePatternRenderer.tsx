import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Node, Edge } from '@xyflow/react'
import { topologicalSort, executeGraph, type GraphOutputData } from '../../nodes/executor'
import type { ExecutionContext } from '../../nodes/types'
import { useInteraction } from '../../systems/InteractionManager'
import ShaderRenderer from './ShaderRenderer'
import useStore from '../../store/useStore'

// Soft circle sprite for points (cached globally)
let _pointSprite: THREE.Texture | null = null
function getPointSprite(): THREE.Texture {
  if (_pointSprite) return _pointSprite
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
  _pointSprite = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  _pointSprite.needsUpdate = true
  return _pointSprite
}

interface Props {
  nodes: Node[]
  edges: Edge[]
  params: Record<string, unknown>
  renderOrder?: number
}

function updateGeometry(
  geo: THREE.BufferGeometry,
  out: GraphOutputData,
) {
  const pos = out.positions
  if (pos.length === 0) return

  const posAttr = geo.getAttribute('position')
  if (!posAttr || posAttr.count * 3 !== pos.length) {
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    if (out.colors.length === pos.length) {
      geo.setAttribute('color', new THREE.BufferAttribute(out.colors, 3))
    }
  } else {
    (posAttr.array as Float32Array).set(pos)
    posAttr.needsUpdate = true
    const colAttr = geo.getAttribute('color')
    if (colAttr && out.colors.length === pos.length) {
      (colAttr.array as Float32Array).set(out.colors)
      colAttr.needsUpdate = true
    }
  }

  const count = pos.length / 3
  const draw = out.drawCount > 0 ? Math.min(out.drawCount, count) : count
  geo.setDrawRange(0, draw)
}

export default function NodePatternRenderer({ nodes, edges, params, renderOrder }: Props) {
  const groupRef = useRef<THREE.Group>(null)
  const frameStateRef = useRef(new Map<string, unknown>())
  const interaction = useInteraction()
  const animationResetCounter = useStore((s) => s.animationResetCounter)
  const lastResetRef = useRef(0)
  const timeOffsetRef = useRef(0)

  // Refs for geometry buffers (reuse across frames to avoid GC)
  const lineGeoRef = useRef<THREE.BufferGeometry>(null)
  const lineSegGeoRef = useRef<THREE.BufferGeometry>(null)
  const pointsGeoRef = useRef<THREE.BufferGeometry>(null)
  const meshGeoRef = useRef<THREE.BufferGeometry>(null)
  const lineOutputRef = useRef<GraphOutputData | null>(null)
  const lineSegOutputRef = useRef<GraphOutputData | null>(null)
  const pointsOutputRef = useRef<GraphOutputData | null>(null)
  const meshOutputRef = useRef<GraphOutputData | null>(null)
  const shaderOutputRef = useRef<GraphOutputData | null>(null)

  const sortedIds = useMemo(() => topologicalSort(nodes, edges), [nodes, edges])

  useFrame(({ clock, gl }) => {
    // Handle animation reset
    if (animationResetCounter !== lastResetRef.current) {
      lastResetRef.current = animationResetCounter
      timeOffsetRef.current = clock.getElapsedTime()
      frameStateRef.current.clear()
    }

    const size = gl.getSize(new THREE.Vector2())
    const ctx: ExecutionContext = {
      elapsed: clock.getElapsedTime() - timeOffsetRef.current,
      delta: clock.getDelta() || 0.016,
      params,
      frameState: frameStateRef.current,
      resolution: [size.x, size.y],
      mouse: interaction.mouse,
      mouseVelocity: interaction.mouseVelocity,
    }

    const outputs = executeGraph(nodes, edges, sortedIds, ctx)

    // Find outputs by mode
    lineOutputRef.current = outputs.find((o) => o.__mode === 'line') ?? null
    lineSegOutputRef.current = outputs.find((o) => o.__mode === 'lineSegments') ?? null
    pointsOutputRef.current = outputs.find((o) => o.__mode === 'points') ?? null
    meshOutputRef.current = outputs.find((o) => o.__mode === 'mesh') ?? null
    shaderOutputRef.current = outputs.find((o) => o.__mode === 'shader') ?? null

    // Update line geometry
    if (lineOutputRef.current && lineGeoRef.current) {
      updateGeometry(lineGeoRef.current, lineOutputRef.current)
    }

    // Update lineSegments geometry
    if (lineSegOutputRef.current && lineSegGeoRef.current) {
      updateGeometry(lineSegGeoRef.current, lineSegOutputRef.current)
    }

    // Update points geometry
    if (pointsOutputRef.current && pointsGeoRef.current) {
      updateGeometry(pointsGeoRef.current, pointsOutputRef.current)
    }

    // Update mesh geometry
    if (meshOutputRef.current && meshGeoRef.current) {
      const out = meshOutputRef.current
      const pos = out.positions
      if (pos.length > 0) {
        updateGeometry(meshGeoRef.current, out)

        // Set or clear index buffer
        if (out.indices && out.indices.length > 0) {
          const currentIndex = meshGeoRef.current.getIndex()
          if (!currentIndex || currentIndex.count !== out.indices.length) {
            meshGeoRef.current.setIndex(new THREE.BufferAttribute(out.indices, 1))
          } else {
            (currentIndex.array as Uint32Array).set(out.indices)
            currentIndex.needsUpdate = true
          }
        } else {
          // Clear stale index buffer from previous mesh pattern
          meshGeoRef.current.setIndex(null)
        }

        // Set normals if provided
        if (out.normals && out.normals.length > 0) {
          const normAttr = meshGeoRef.current.getAttribute('normal')
          if (!normAttr || normAttr.count * 3 !== out.normals.length) {
            meshGeoRef.current.setAttribute('normal', new THREE.BufferAttribute(out.normals, 3))
          } else {
            (normAttr.array as Float32Array).set(out.normals)
            normAttr.needsUpdate = true
          }
        } else {
          meshGeoRef.current.computeVertexNormals()
        }
      }
    }

    // Shader output is handled by ShaderRenderer via ref
  })

  return (
    <group ref={groupRef}>
      {/* Lighting for mesh mode patterns */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 10, 7]} intensity={0.8} />
      <directionalLight position={[-3, -5, -5]} intensity={0.3} />
      <line frustumCulled={false}>
        <bufferGeometry ref={lineGeoRef} />
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={lineOutputRef.current?.opacity ?? 0.85}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </line>
      <lineSegments frustumCulled={false}>
        <bufferGeometry ref={lineSegGeoRef} />
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={lineSegOutputRef.current?.opacity ?? 0.8}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>
      <points frustumCulled={false}>
        <bufferGeometry ref={pointsGeoRef} />
        <pointsMaterial
          map={getPointSprite()}
          vertexColors
          transparent
          opacity={pointsOutputRef.current?.opacity ?? 0.6}
          size={pointsOutputRef.current?.pointSize ?? 2}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          sizeAttenuation
        />
      </points>
      <mesh frustumCulled={false}>
        <bufferGeometry ref={meshGeoRef} />
        <meshPhongMaterial
          vertexColors
          transparent
          opacity={meshOutputRef.current?.opacity ?? 0.9}
          wireframe={meshOutputRef.current?.wireframe ?? false}
          side={THREE.DoubleSide}
          depthWrite={!(meshOutputRef.current?.wireframe)}
        />
      </mesh>
      <ShaderRenderer configRef={shaderOutputRef} renderOrder={renderOrder} />
    </group>
  )
}
