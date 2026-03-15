import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useInteraction } from '../systems/InteractionManager'
import { hslToRgb } from '../utils/colorPalette'

interface Props {
  params: Record<string, unknown>
}

interface Particle {
  x: number
  y: number
  z: number
  px: number
  py: number
  pz: number
  pinned: boolean
}

interface Constraint {
  a: number
  b: number
  restLen: number
}

function ClothInner({
  gridWidth, gridHeight, spacing, gravity, windStrength, windDirection,
  windTurbulence, damping, stiffness, constraintIterations, pinMode,
  colorMode, colorA, colorB, wireframe, meshOpacity, lightIntensity,
  mouseForce, wave, waveSpeed, rotationSpeed,
}: {
  gridWidth: number; gridHeight: number; spacing: number; gravity: number;
  windStrength: number; windDirection: number; windTurbulence: number;
  damping: number; stiffness: number; constraintIterations: number;
  pinMode: string; colorMode: string; colorA: string; colorB: string;
  wireframe: boolean; meshOpacity: number; lightIntensity: number;
  mouseForce: number; wave: number; waveSpeed: number; rotationSpeed: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const groupRef = useRef<THREE.Group>(null)
  const lightRef = useRef<THREE.PointLight>(null)
  const { mouse } = useInteraction()

  const sim = useMemo(() => {
    const particles: Particle[] = []
    const constraints: Constraint[] = []
    const totalW = gridWidth * spacing
    const totalH = gridHeight * spacing

    // Create particle grid
    for (let j = 0; j < gridHeight; j++) {
      for (let i = 0; i < gridWidth; i++) {
        const x = (i - (gridWidth - 1) / 2) * spacing
        const y = ((gridHeight - 1) / 2 - j) * spacing
        const z = 0

        let pinned = false
        if (pinMode === 'topEdge') {
          pinned = j === 0
        } else if (pinMode === 'corners') {
          pinned = (j === 0 && i === 0) ||
                   (j === 0 && i === gridWidth - 1) ||
                   (j === gridHeight - 1 && i === 0) ||
                   (j === gridHeight - 1 && i === gridWidth - 1)
        } else if (pinMode === 'topCorners') {
          pinned = (j === 0 && i === 0) ||
                   (j === 0 && i === gridWidth - 1)
        }
        // 'none' => no pins

        particles.push({ x, y, z, px: x, py: y, pz: z, pinned })
      }
    }

    // Structural constraints (horizontal + vertical)
    for (let j = 0; j < gridHeight; j++) {
      for (let i = 0; i < gridWidth; i++) {
        const idx = j * gridWidth + i
        // Right neighbor
        if (i < gridWidth - 1) {
          constraints.push({ a: idx, b: idx + 1, restLen: spacing })
        }
        // Bottom neighbor
        if (j < gridHeight - 1) {
          constraints.push({ a: idx, b: idx + gridWidth, restLen: spacing })
        }
        // Diagonal (shear) constraints for stability
        if (i < gridWidth - 1 && j < gridHeight - 1) {
          const diagLen = spacing * Math.SQRT2
          constraints.push({ a: idx, b: idx + gridWidth + 1, restLen: diagLen })
          constraints.push({ a: idx + 1, b: idx + gridWidth, restLen: diagLen })
        }
      }
    }

    // Create geometry
    const segW = gridWidth - 1
    const segH = gridHeight - 1
    const geometry = new THREE.PlaneGeometry(totalW, totalH, segW, segH)
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(
      new Float32Array(gridWidth * gridHeight * 3), 3,
    ))

    return { particles, constraints, geometry }
  }, [gridWidth, gridHeight, spacing, pinMode])

  const colA = useMemo(() => new THREE.Color(colorA), [colorA])
  const colB = useMemo(() => new THREE.Color(colorB), [colorB])

  useFrame((state) => {
    const { particles, constraints, geometry } = sim
    const t = state.clock.elapsedTime
    const dt = 1 / 60

    const windRad = (windDirection * Math.PI) / 180
    const windX = Math.cos(windRad) * windStrength
    const windZ = Math.sin(windRad) * windStrength

    // Mouse world position (approximate — project from NDC onto cloth plane)
    const mouseWorldX = mouse.x * (gridWidth * spacing) * 0.7
    const mouseWorldY = mouse.y * (gridHeight * spacing) * 0.7

    // Verlet integration
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i]
      if (p.pinned) {
        // Apply wave to pinned particles
        if (wave > 0) {
          const col = i % gridWidth
          p.z = Math.sin(t * waveSpeed + col * 0.3) * wave * spacing
        }
        continue
      }

      const vx = (p.x - p.px) * damping
      const vy = (p.y - p.py) * damping
      const vz = (p.z - p.pz) * damping

      p.px = p.x
      p.py = p.y
      p.pz = p.z

      // Gravity
      p.y += vy - gravity * dt * dt * 60

      // Wind with turbulence
      const turbX = (Math.sin(t * 2.3 + p.x * 0.1 + p.y * 0.07) * windTurbulence)
      const turbZ = (Math.cos(t * 1.7 + p.y * 0.1 + p.x * 0.05) * windTurbulence)
      p.x += vx + (windX + turbX) * dt * dt * 60
      p.z += vz + (windZ + turbZ) * dt * dt * 60

      // Mouse interaction — push/pull
      const dx = p.x - mouseWorldX
      const dy = p.y - mouseWorldY
      const dist = Math.sqrt(dx * dx + dy * dy)
      const mouseRadius = spacing * 6
      if (dist < mouseRadius && dist > 0.001) {
        const force = (1 - dist / mouseRadius) * mouseForce * dt * 60
        p.x += (dx / dist) * force * 0.5
        p.y += (dy / dist) * force * 0.5
        p.z += force * 0.3
      }
    }

    // Constraint satisfaction
    for (let iter = 0; iter < constraintIterations; iter++) {
      for (let c = 0; c < constraints.length; c++) {
        const con = constraints[c]
        const pa = particles[con.a]
        const pb = particles[con.b]

        const dx = pb.x - pa.x
        const dy = pb.y - pa.y
        const dz = pb.z - pa.z
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
        if (dist < 0.0001) continue

        const diff = (con.restLen - dist) / dist * stiffness * 0.5
        const ox = dx * diff
        const oy = dy * diff
        const oz = dz * diff

        if (!pa.pinned) {
          pa.x -= ox
          pa.y -= oy
          pa.z -= oz
        }
        if (!pb.pinned) {
          pb.x += ox
          pb.y += oy
          pb.z += oz
        }
      }
    }

    // Update geometry positions and colors
    const posAttr = geometry.attributes.position as THREE.BufferAttribute
    const colAttr = geometry.attributes.color as THREE.BufferAttribute
    const posArr = posAttr.array as Float32Array
    const colArr = colAttr.array as Float32Array

    let maxStress = 0

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i]
      posArr[i * 3] = p.x
      posArr[i * 3 + 1] = p.y
      posArr[i * 3 + 2] = p.z

      // Calculate stress (distance from rest position)
      const vx = p.x - p.px
      const vy = p.y - p.py
      const vz = p.z - p.pz
      const stress = Math.sqrt(vx * vx + vy * vy + vz * vz)
      if (stress > maxStress) maxStress = stress
    }

    if (maxStress < 0.001) maxStress = 0.001

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i]
      const row = Math.floor(i / gridWidth)
      const col = i % gridWidth
      let r = 0, g = 0, b = 0

      if (colorMode === 'stress') {
        const vx = p.x - p.px
        const vy = p.y - p.py
        const vz = p.z - p.pz
        const stress = Math.sqrt(vx * vx + vy * vy + vz * vz) / maxStress
        const mixed = new THREE.Color().copy(colA).lerp(colB, Math.min(stress * 3, 1))
        r = mixed.r; g = mixed.g; b = mixed.b
      } else if (colorMode === 'height') {
        const normY = (p.y - (-gridHeight * spacing / 2)) / (gridHeight * spacing)
        const clamped = Math.max(0, Math.min(1, normY))
        const mixed = new THREE.Color().copy(colA).lerp(colB, 1 - clamped)
        r = mixed.r; g = mixed.g; b = mixed.b
      } else if (colorMode === 'uv') {
        const u = col / (gridWidth - 1)
        const v = row / (gridHeight - 1)
        const rgb = hslToRgb(u * 0.8, 0.7, 0.5 + v * 0.2)
        r = rgb[0]; g = rgb[1]; b = rgb[2]
      } else if (colorMode === 'palette') {
        const phase = (Math.sin(t * 0.5 + col * 0.1 + row * 0.1) + 1) * 0.5
        const mixed = new THREE.Color().copy(colA).lerp(colB, phase)
        r = mixed.r; g = mixed.g; b = mixed.b
      } else {
        // solid
        r = colA.r; g = colA.g; b = colA.b
      }

      colArr[i * 3] = r
      colArr[i * 3 + 1] = g
      colArr[i * 3 + 2] = b
    }

    posAttr.needsUpdate = true
    colAttr.needsUpdate = true
    geometry.computeVertexNormals()

    // Re-center the cloth by computing centroid and offsetting group
    if (groupRef.current) {
      let sumY = 0
      for (let i = 0; i < particles.length; i++) sumY += particles[i].y
      const avgY = sumY / particles.length
      groupRef.current.position.y = -avgY

      // Slow rotation
      if (rotationSpeed > 0) {
        groupRef.current.rotation.y = t * rotationSpeed
      }
    }

    // Animate light
    if (lightRef.current) {
      lightRef.current.position.set(
        Math.sin(t * 0.5) * gridWidth * spacing * 0.6,
        gridHeight * spacing * 0.5,
        Math.cos(t * 0.5) * gridWidth * spacing * 0.6 + gridWidth * spacing * 0.5,
      )
    }
  })

  return (
    <group ref={groupRef}>
      <mesh ref={meshRef} geometry={sim.geometry}>
        <meshPhongMaterial
          vertexColors
          side={THREE.DoubleSide}
          wireframe={wireframe}
          transparent={meshOpacity < 1}
          opacity={meshOpacity}
          shininess={60}
          specular={new THREE.Color(0x444444)}
        />
      </mesh>
      <ambientLight intensity={lightIntensity * 0.4} />
      <pointLight
        ref={lightRef}
        intensity={lightIntensity * 80}
        distance={gridWidth * spacing * 3}
        color="#ffffff"
      />
      <directionalLight
        intensity={lightIntensity * 0.6}
        position={[5, 10, 5]}
      />
    </group>
  )
}

export default function Cloth({ params }: Props) {
  const gridWidth = (params.gridWidth as number) ?? 40
  const gridHeight = (params.gridHeight as number) ?? 40
  const spacing = (params.spacing as number) ?? 0.3
  const gravity = (params.gravity as number) ?? 0.5
  const windStrength = (params.windStrength as number) ?? 1
  const windDirection = (params.windDirection as number) ?? 0
  const windTurbulence = (params.windTurbulence as number) ?? 0.5
  const damping = (params.damping as number) ?? 0.97
  const stiffness = (params.stiffness as number) ?? 1
  const constraintIterations = (params.constraintIterations as number) ?? 3
  const pinMode = (params.pinMode as string) ?? 'topEdge'
  const colorMode = (params.colorMode as string) ?? 'stress'
  const colorA = (params.colorA as string) ?? '#22d3ee'
  const colorB = (params.colorB as string) ?? '#d946ef'
  const wireframe = (params.wireframe as boolean) ?? false
  const meshOpacity = (params.meshOpacity as number) ?? 0.9
  const lightIntensity = (params.lightIntensity as number) ?? 1
  const mouseForce = (params.mouseForce as number) ?? 2
  const wave = (params.wave as number) ?? 0
  const waveSpeed = (params.waveSpeed as number) ?? 1
  const rotationSpeed = (params.rotationSpeed as number) ?? 0.1

  const key = `${gridWidth}-${gridHeight}-${pinMode}`

  return (
    <ClothInner
      key={key}
      gridWidth={gridWidth}
      gridHeight={gridHeight}
      spacing={spacing}
      gravity={gravity}
      windStrength={windStrength}
      windDirection={windDirection}
      windTurbulence={windTurbulence}
      damping={damping}
      stiffness={stiffness}
      constraintIterations={constraintIterations}
      pinMode={pinMode}
      colorMode={colorMode}
      colorA={colorA}
      colorB={colorB}
      wireframe={wireframe}
      meshOpacity={meshOpacity}
      lightIntensity={lightIntensity}
      mouseForce={mouseForce}
      wave={wave}
      waveSpeed={waveSpeed}
      rotationSpeed={rotationSpeed}
    />
  )
}
