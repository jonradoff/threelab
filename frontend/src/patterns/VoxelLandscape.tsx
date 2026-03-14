import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { noise3D } from '../utils/noise'

interface Props {
  params: Record<string, unknown>
}

// Block type colors
const COLORS = {
  grass: new THREE.Color('#4a8c2a'),
  dirt: new THREE.Color('#8b6914'),
  stone: new THREE.Color('#7a7a7a'),
  sand: new THREE.Color('#d4b96a'),
  water: new THREE.Color('#2a6cb0'),
  snow: new THREE.Color('#e8e8f0'),
  wood: new THREE.Color('#6b4226'),
  leaves: new THREE.Color('#2d6e1e'),
  deepStone: new THREE.Color('#505050'),
}

function getBlockColor(
  y: number, surfaceY: number, waterLevel: number,
  snowLevel: number, biomeNoise: number,
): THREE.Color {
  if (y > surfaceY) {
    return COLORS.water
  }
  if (y === surfaceY) {
    if (surfaceY >= snowLevel) return COLORS.snow
    if (surfaceY <= waterLevel + 1 && biomeNoise > 0.3) return COLORS.sand
    return COLORS.grass
  }
  if (y >= surfaceY - 2) return COLORS.dirt
  if (y >= surfaceY - 6) return COLORS.stone
  return COLORS.deepStone
}

function CameraSetup({ worldSize }: { worldSize: number }) {
  const { camera } = useThree()
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    // Position camera above and to the side, looking down onto terrain
    const dist = worldSize * 0.8
    camera.position.set(dist * 0.5, dist * 0.7, dist * 0.5)
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()
  }, [camera, worldSize])

  return null
}

function VoxelLandscapeInner({
  worldSize, heightScale, noiseScale, noiseOctaves,
  waterLevel, snowLevel, treeDensity, rotationSpeed,
  caveThreshold, terrainSeed,
}: {
  worldSize: number; heightScale: number; noiseScale: number;
  noiseOctaves: number; waterLevel: number; snowLevel: number;
  treeDensity: number; rotationSpeed: number;
  caveThreshold: number; terrainSeed: number;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const needsUpdate = useRef(true)
  const controlsRef = useRef<any>(null)

  const { count, matrices, colors } = useMemo(() => {
    const half = Math.floor(worldSize / 2)
    const blocks: { x: number; y: number; z: number; color: THREE.Color }[] = []
    const seed = terrainSeed

    // Generate heightmap
    const heightmap: number[][] = []
    for (let x = -half; x <= half; x++) {
      const row: number[] = []
      for (let z = -half; z <= half; z++) {
        let h = 0
        let amp = 1
        let freq = noiseScale
        for (let o = 0; o < noiseOctaves; o++) {
          h += noise3D(x * freq + seed, z * freq + seed, seed * 0.1) * amp
          amp *= 0.5
          freq *= 2
        }
        row.push(Math.floor(h * heightScale))
      }
      heightmap.push(row)
    }

    const biomeAt = (x: number, z: number) =>
      noise3D(x * 0.02 + seed + 100, z * 0.02 + seed + 100, 0) * 0.5 + 0.5

    for (let xi = 0; xi < heightmap.length; xi++) {
      for (let zi = 0; zi < heightmap[xi].length; zi++) {
        const x = xi - half
        const z = zi - half
        const surfaceY = heightmap[xi][zi]
        const biome = biomeAt(x, z)

        const topY = Math.max(surfaceY, waterLevel)
        const bottomY = surfaceY - 8

        for (let y = bottomY; y <= topY; y++) {
          if (y < surfaceY - 1 && caveThreshold > 0) {
            const caveNoise = noise3D(
              x * 0.08 + seed, y * 0.08 + seed, z * 0.08 + seed,
            )
            if (caveNoise > 1 - caveThreshold) continue
          }

          if (y > surfaceY && y > waterLevel) continue

          const color = getBlockColor(y, surfaceY, waterLevel, snowLevel, biome)
          const variation = noise3D(x * 3.7 + seed, y * 3.7, z * 3.7 + seed) * 0.08
          const varied = color.clone()
          varied.r = Math.max(0, Math.min(1, varied.r + variation))
          varied.g = Math.max(0, Math.min(1, varied.g + variation))
          varied.b = Math.max(0, Math.min(1, varied.b + variation))

          blocks.push({ x, y, z, color: varied })
        }

        // Trees
        if (
          treeDensity > 0 &&
          surfaceY > waterLevel + 1 &&
          surfaceY < snowLevel &&
          biome < 0.7
        ) {
          const treeNoise = noise3D(x * 1.5 + seed + 50, z * 1.5 + seed + 50, 0)
          if (treeNoise > 1 - treeDensity * 0.5) {
            const trunkHeight = 3 + Math.floor(Math.abs(noise3D(x + seed, z + seed, 1)) * 3)
            for (let ty = 1; ty <= trunkHeight; ty++) {
              blocks.push({
                x, y: surfaceY + ty, z,
                color: COLORS.wood.clone(),
              })
            }
            const canopyR = 2
            for (let cx = -canopyR; cx <= canopyR; cx++) {
              for (let cy = -1; cy <= canopyR; cy++) {
                for (let cz = -canopyR; cz <= canopyR; cz++) {
                  const dist = Math.sqrt(cx * cx + cy * cy + cz * cz)
                  if (dist <= canopyR + 0.3 && Math.random() > 0.15) {
                    const leafVar = (Math.random() - 0.5) * 0.1
                    const leafColor = COLORS.leaves.clone()
                    leafColor.g += leafVar
                    blocks.push({
                      x: x + cx,
                      y: surfaceY + trunkHeight + cy,
                      z: z + cz,
                      color: leafColor,
                    })
                  }
                }
              }
            }
          }
        }
      }
    }

    const count = blocks.length
    const matrices = new Float32Array(count * 16)
    const colors = new Float32Array(count * 3)
    const mat = new THREE.Matrix4()

    for (let i = 0; i < count; i++) {
      const b = blocks[i]
      mat.makeTranslation(b.x, b.y, b.z)
      mat.toArray(matrices, i * 16)
      colors[i * 3] = b.color.r
      colors[i * 3 + 1] = b.color.g
      colors[i * 3 + 2] = b.color.b
    }

    needsUpdate.current = true
    return { count, matrices, colors }
  }, [worldSize, heightScale, noiseScale, noiseOctaves, waterLevel,
      snowLevel, treeDensity, caveThreshold, terrainSeed])

  // Update auto-rotate speed on controls
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = rotationSpeed > 0
      controlsRef.current.autoRotateSpeed = rotationSpeed * 20
    }
  }, [rotationSpeed])

  useFrame(() => {
    // Apply instance data once the mesh is ready
    if (needsUpdate.current && meshRef.current && count > 0) {
      const mesh = meshRef.current
      const mat = new THREE.Matrix4()
      for (let i = 0; i < count; i++) {
        mat.fromArray(matrices, i * 16)
        mesh.setMatrixAt(i, mat)
        mesh.setColorAt(i, new THREE.Color(
          colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2],
        ))
      }
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      needsUpdate.current = false
    }

    // Keep controls updating for auto-rotate
    if (controlsRef.current) controlsRef.current.update()
  })

  if (count === 0) return null

  return (
    <>
      <CameraSetup worldSize={worldSize} />
      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.1}
        enablePan
        enableZoom
        minDistance={5}
        maxDistance={worldSize * 3}
        autoRotate={rotationSpeed > 0}
        autoRotateSpeed={rotationSpeed * 20}
        target={[0, 0, 0]}
      />
      <ambientLight intensity={0.6} />
      <directionalLight position={[20, 30, 10]} intensity={1.0} />
      <directionalLight position={[-10, 20, -10]} intensity={0.4} color="#aaccff" />
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, count]}
        frustumCulled={false}
      >
        <boxGeometry args={[0.95, 0.95, 0.95]} />
        <meshLambertMaterial />
      </instancedMesh>
    </>
  )
}

export default function VoxelLandscape({ params }: Props) {
  const worldSize = Math.min((params.worldSize as number) ?? 32, 64)
  const heightScale = (params.heightScale as number) ?? 8
  const noiseScale = (params.noiseScale as number) ?? 0.06
  const noiseOctaves = Math.min((params.noiseOctaves as number) ?? 4, 6)
  const waterLevel = (params.waterLevel as number) ?? -2
  const snowLevel = (params.snowLevel as number) ?? 12
  const treeDensity = (params.treeDensity as number) ?? 0.3
  const rotationSpeed = (params.rotationSpeed as number) ?? 0.05
  const caveThreshold = (params.caveThreshold as number) ?? 0.15
  const terrainSeed = (params.terrainSeed as number) ?? 42

  return (
    <VoxelLandscapeInner
      key={`${worldSize}-${terrainSeed}-${noiseOctaves}`}
      worldSize={worldSize}
      heightScale={heightScale}
      noiseScale={noiseScale}
      noiseOctaves={noiseOctaves}
      waterLevel={waterLevel}
      snowLevel={snowLevel}
      treeDensity={treeDensity}
      rotationSpeed={rotationSpeed}
      caveThreshold={caveThreshold}
      terrainSeed={terrainSeed}
    />
  )
}
