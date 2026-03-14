import { useRef, useMemo, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { hslToRgb } from '../utils/colorPalette'

interface Props {
  params: Record<string, unknown>
}

interface LSystemPreset {
  axiom: string
  rules: Record<string, string>
  defaultAngle: number
}

const PRESETS: Record<string, LSystemPreset> = {
  tree: {
    axiom: 'F',
    rules: { F: 'FF+[+F-F-F]-[-F+F+F]' },
    defaultAngle: 25,
  },
  koch: {
    axiom: 'F',
    rules: { F: 'F+F-F-F+F' },
    defaultAngle: 90,
  },
  sierpinski: {
    axiom: 'F-G-G',
    rules: { F: 'F-G+F+G-F', G: 'GG' },
    defaultAngle: 120,
  },
  dragon: {
    axiom: 'FX',
    rules: { X: 'X+YF+', Y: '-FX-Y' },
    defaultAngle: 90,
  },
  fern: {
    axiom: 'X',
    rules: { X: 'F+[[X]-X]-F[-FX]+X', F: 'FF' },
    defaultAngle: 25,
  },
  bush: {
    axiom: 'F',
    rules: { F: 'FF+[+F-F-F]-[-F+F+F]' },
    defaultAngle: 22.5,
  },
  fractalPlant: {
    axiom: 'X',
    rules: { X: 'F-[[X]+X]+F[+FX]-X', F: 'FF' },
    defaultAngle: 25,
  },
}

interface TurtleState {
  x: number
  y: number
  z: number
  hx: number
  hy: number
  hz: number
  depth: number
}

interface BranchSegment {
  x1: number; y1: number; z1: number
  x2: number; y2: number; z2: number
  depth: number
}

function expandLSystem(axiom: string, rules: Record<string, string>, iterations: number): string {
  let current = axiom
  const capped = Math.min(iterations, 8)
  for (let i = 0; i < capped; i++) {
    let next = ''
    for (const ch of current) {
      next += rules[ch] ?? ch
    }
    current = next
    // Safety: cap string length to avoid memory explosion
    if (current.length > 500000) break
  }
  return current
}

function interpretLSystem(
  lstring: string,
  angleDeg: number,
  baseLength: number,
  lengthFactor: number,
  is3D: boolean,
  randomVariation: number,
): BranchSegment[] {
  const segments: BranchSegment[] = []
  const angleRad = (angleDeg * Math.PI) / 180
  const stack: TurtleState[] = []

  // Heading as a direction vector
  let x = 0, y = 0, z = 0
  let hx = 0, hy = 1, hz = 0 // heading: up
  let depth = 0

  // For 2D we rotate heading in XY plane
  // For 3D we also rotate around Y axis on certain commands
  const rng = () => 1 + (Math.random() - 0.5) * 2 * randomVariation

  for (const ch of lstring) {
    switch (ch) {
      case 'F':
      case 'G': {
        const len = baseLength * Math.pow(lengthFactor, depth) * rng()
        const nx = x + hx * len
        const ny = y + hy * len
        const nz = z + hz * len
        segments.push({ x1: x, y1: y, z1: z, x2: nx, y2: ny, z2: nz, depth })
        x = nx; y = ny; z = nz
        break
      }
      case '+': {
        const a = angleRad * rng()
        if (is3D) {
          // Rotate heading around Z axis
          const cosA = Math.cos(a), sinA = Math.sin(a)
          const nhx = hx * cosA - hy * sinA
          const nhy = hx * sinA + hy * cosA
          hx = nhx; hy = nhy
        } else {
          const cosA = Math.cos(a), sinA = Math.sin(a)
          const nhx = hx * cosA - hy * sinA
          const nhy = hx * sinA + hy * cosA
          hx = nhx; hy = nhy
        }
        break
      }
      case '-': {
        const a = -angleRad * rng()
        const cosA = Math.cos(a), sinA = Math.sin(a)
        const nhx = hx * cosA - hy * sinA
        const nhy = hx * sinA + hy * cosA
        hx = nhx; hy = nhy
        break
      }
      case '&': {
        // 3D: pitch down (rotate around right vector)
        if (is3D) {
          const a = angleRad * rng()
          const cosA = Math.cos(a), sinA = Math.sin(a)
          const nhy = hy * cosA - hz * sinA
          const nhz = hy * sinA + hz * cosA
          hy = nhy; hz = nhz
        }
        break
      }
      case '/': {
        // 3D: roll (rotate heading around Y axis for branching variety)
        if (is3D) {
          const a = angleRad * rng()
          const cosA = Math.cos(a), sinA = Math.sin(a)
          const nhx = hx * cosA - hz * sinA
          const nhz = hx * sinA + hz * cosA
          hx = nhx; hz = nhz
        }
        break
      }
      case '[':
        stack.push({ x, y, z, hx, hy, hz, depth })
        depth++
        if (is3D) {
          // Add Y-axis rotation on branch push for 3D variety
          const branchAngle = (Math.PI * 2 / 5) * rng()
          const cosB = Math.cos(branchAngle), sinB = Math.sin(branchAngle)
          const nhx = hx * cosB - hz * sinB
          const nhz = hx * sinB + hz * cosB
          hx = nhx; hz = nhz
        }
        break
      case ']':
        if (stack.length > 0) {
          const state = stack.pop()!
          x = state.x; y = state.y; z = state.z
          hx = state.hx; hy = state.hy; hz = state.hz
          depth = state.depth
        }
        break
      // X, Y and other symbols are ignored (they're just for rule expansion)
    }
  }

  return segments
}

function getSegmentColor(
  seg: BranchSegment,
  idx: number,
  total: number,
  maxDepth: number,
  colorMode: string,
): [number, number, number] {
  switch (colorMode) {
    case 'depth': {
      const t = maxDepth > 0 ? seg.depth / maxDepth : 0
      const h = 0.08 + t * 0.25 // brown to green
      return hslToRgb(h, 0.6, 0.35 + t * 0.2)
    }
    case 'spring': {
      const t = maxDepth > 0 ? seg.depth / maxDepth : 0
      return hslToRgb(0.28 + t * 0.1, 0.7, 0.3 + t * 0.3)
    }
    case 'autumn': {
      const t = maxDepth > 0 ? seg.depth / maxDepth : 0
      const h = 0.0 + t * 0.12 // red to orange/yellow
      return hslToRgb(h, 0.8, 0.4 + t * 0.15)
    }
    case 'winter': {
      const t = maxDepth > 0 ? seg.depth / maxDepth : 0
      return hslToRgb(0.6, 0.1, 0.5 + t * 0.3) // desaturated blue-white
    }
    case 'rainbow': {
      const h = (idx / total) % 1
      return hslToRgb(h, 0.8, 0.5)
    }
    case 'height': {
      // Normalize by max y extent
      const h = 0.65 - Math.max(0, Math.min(1, (seg.y2 + 5) / 15)) * 0.55
      return hslToRgb(h, 0.7, 0.5)
    }
    default: {
      return hslToRgb(0.3, 0.6, 0.4)
    }
  }
}

function LSystemsInner({
  preset, iterations, angle, length, lengthFactor, widthFactor,
  scale, drawSpeed, animated, colorMode, windStrength, windSpeed,
  randomVariation, is3D, rotationSpeed, branchTaper, leafSize,
  leafColor, symmetry, lineOpacity,
}: {
  preset: string; iterations: number; angle: number; length: number;
  lengthFactor: number; widthFactor: number; scale: number;
  drawSpeed: number; animated: boolean; colorMode: string;
  windStrength: number; windSpeed: number; randomVariation: number;
  is3D: boolean; rotationSpeed: number; branchTaper: boolean;
  leafSize: number; leafColor: string; symmetry: number;
  lineOpacity: number;
}) {
  const groupRef = useRef<THREE.Group>(null)
  const linesRef = useRef<THREE.LineSegments>(null)
  const leavesRef = useRef<THREE.Points>(null)
  const [drawnCount, setDrawnCount] = useState(animated ? 0 : Infinity)

  const { positions, colors, leafPositions, leafColors, segmentCount, maxDepth, segmentDepths } = useMemo(() => {
    const presetData = PRESETS[preset] ?? PRESETS.tree
    const effectiveAngle = angle > 0 ? angle : presetData.defaultAngle
    const lstring = expandLSystem(presetData.axiom, presetData.rules, iterations)
    const segments = interpretLSystem(lstring, effectiveAngle, length, lengthFactor, is3D, randomVariation)

    let maxD = 0
    for (const seg of segments) {
      if (seg.depth > maxD) maxD = seg.depth
    }

    // Build geometry for all symmetry copies
    const totalSegs = segments.length * symmetry
    const pos = new Float32Array(totalSegs * 6) // 2 vertices per segment, 3 floats each
    const col = new Float32Array(totalSegs * 6)
    const depths = new Float32Array(totalSegs)

    // Leaf points: tips of branches (segments where depth is at max or near max)
    const leafPosArr: number[] = []
    const leafColArr: number[] = []

    const parsedLeafColor = new THREE.Color(leafColor)

    for (let sym = 0; sym < symmetry; sym++) {
      const rotAngle = (sym / symmetry) * Math.PI * 2
      const cosR = Math.cos(rotAngle)
      const sinR = Math.sin(rotAngle)

      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i]
        const idx = sym * segments.length + i
        const base = idx * 6

        // Apply symmetry rotation around Y axis
        let x1 = seg.x1, z1 = seg.z1, x2 = seg.x2, z2 = seg.z2
        if (symmetry > 1) {
          const rx1 = x1 * cosR - z1 * sinR
          const rz1 = x1 * sinR + z1 * cosR
          const rx2 = x2 * cosR - z2 * sinR
          const rz2 = x2 * sinR + z2 * cosR
          x1 = rx1; z1 = rz1; x2 = rx2; z2 = rz2
        }

        pos[base] = x1 * scale
        pos[base + 1] = seg.y1 * scale
        pos[base + 2] = z1 * scale
        pos[base + 3] = x2 * scale
        pos[base + 4] = seg.y2 * scale
        pos[base + 5] = z2 * scale

        const [r, g, b] = getSegmentColor(seg, i, segments.length, maxD, colorMode)
        col[base] = r; col[base + 1] = g; col[base + 2] = b
        col[base + 3] = r; col[base + 4] = g; col[base + 5] = b

        depths[idx] = seg.depth

        // Collect leaf positions at branch tips
        if (leafSize > 0 && seg.depth >= maxD - 1) {
          leafPosArr.push(x2 * scale, seg.y2 * scale, z2 * scale)
          leafColArr.push(parsedLeafColor.r, parsedLeafColor.g, parsedLeafColor.b)
        }
      }
    }

    return {
      positions: pos,
      colors: col,
      leafPositions: new Float32Array(leafPosArr),
      leafColors: new Float32Array(leafColArr),
      segmentCount: totalSegs,
      maxDepth: maxD,
      segmentDepths: depths,
    }
  }, [preset, iterations, angle, length, lengthFactor, is3D, randomVariation, scale, colorMode, symmetry, leafSize, leafColor])

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const t = clock.getElapsedTime()

    // Auto-rotation for 3D mode
    if (is3D) {
      groupRef.current.rotation.y = t * rotationSpeed
    }

    // Progressive draw animation
    if (animated && drawnCount < segmentCount) {
      setDrawnCount(prev => Math.min(prev + Math.ceil(drawSpeed * 10), segmentCount))
    }

    // Wind simulation & branch taper
    if (linesRef.current) {
      const geom = linesRef.current.geometry
      const posAttr = geom.attributes.position as THREE.BufferAttribute
      const posArray = posAttr.array as Float32Array

      // Copy original positions and apply wind
      const visibleVerts = Math.min(drawnCount * 2, segmentCount * 2)

      for (let i = 0; i < segmentCount; i++) {
        const base = i * 6
        const depth = segmentDepths[i]

        // Wind: displace x based on depth and time (deeper branches sway more)
        const windFactor = windStrength * (depth / (maxDepth || 1))
        const windOffset = Math.sin(t * windSpeed * 2 + positions[base + 1] * 0.5) * windFactor * scale * 0.1

        // Apply wind to both vertices of the segment
        posArray[base] = positions[base] + windOffset
        posArray[base + 3] = positions[base + 3] + windOffset

        if (is3D) {
          const windOffsetZ = Math.cos(t * windSpeed * 1.7 + positions[base + 1] * 0.3) * windFactor * scale * 0.05
          posArray[base + 2] = positions[base + 2] + windOffsetZ
          posArray[base + 5] = positions[base + 5] + windOffsetZ
        }
      }

      posAttr.needsUpdate = true

      // Update draw range for progressive drawing
      if (animated) {
        geom.setDrawRange(0, visibleVerts)
      }

      // Update leaf positions with wind too
      if (leavesRef.current && leafPositions.length > 0) {
        const leafPosAttr = leavesRef.current.geometry.attributes.position as THREE.BufferAttribute
        const leafArr = leafPosAttr.array as Float32Array
        for (let i = 0; i < leafPositions.length / 3; i++) {
          const windOffset = Math.sin(t * windSpeed * 2 + leafPositions[i * 3 + 1] * 0.5) * windStrength * scale * 0.1
          leafArr[i * 3] = leafPositions[i * 3] + windOffset
          if (is3D) {
            leafArr[i * 3 + 2] = leafPositions[i * 3 + 2] +
              Math.cos(t * windSpeed * 1.7 + leafPositions[i * 3 + 1] * 0.3) * windStrength * scale * 0.05
          }
        }
        leafPosAttr.needsUpdate = true

        // Hide leaves until branches are fully drawn
        if (animated) {
          const leafGeom = leavesRef.current.geometry
          const totalLeaves = leafPositions.length / 3
          const leafProgress = drawnCount >= segmentCount ? totalLeaves : 0
          leafGeom.setDrawRange(0, leafProgress)
        }
      }
    }
  })

  return (
    <group ref={groupRef}>
      <lineSegments ref={linesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            array={new Float32Array(positions)}
            count={segmentCount * 2}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            array={colors}
            count={segmentCount * 2}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={lineOpacity}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>

      {leafSize > 0 && leafPositions.length > 0 && (
        <points ref={leavesRef}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              array={new Float32Array(leafPositions)}
              count={leafPositions.length / 3}
              itemSize={3}
            />
            <bufferAttribute
              attach="attributes-color"
              array={leafColors}
              count={leafColors.length / 3}
              itemSize={3}
            />
          </bufferGeometry>
          <pointsMaterial
            size={leafSize}
            vertexColors
            transparent
            opacity={0.8}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            sizeAttenuation
          />
        </points>
      )}
    </group>
  )
}

export default function LSystems({ params }: Props) {
  const preset = (params.preset as string) ?? 'tree'
  const iterations = (params.iterations as number) ?? 5
  const angle = (params.angle as number) ?? 25
  const length = (params.length as number) ?? 1
  const lengthFactor = (params.lengthFactor as number) ?? 0.7
  const widthFactor = (params.widthFactor as number) ?? 0.7
  const scale = (params.scale as number) ?? 5
  const drawSpeed = (params.drawSpeed as number) ?? 3
  const animated = (params.animated as boolean) ?? true
  const colorMode = (params.colorMode as string) ?? 'depth'
  const windStrength = (params.windStrength as number) ?? 0.3
  const windSpeed = (params.windSpeed as number) ?? 1
  const randomVariation = (params.randomVariation as number) ?? 0
  const is3D = (params.is3D as boolean) ?? false
  const rotationSpeed = (params.rotationSpeed as number) ?? 0.2
  const branchTaper = (params.branchTaper as boolean) ?? true
  const leafSize = (params.leafSize as number) ?? 0
  const leafColor = (params.leafColor as string) ?? '#44ff44'
  const symmetry = (params.symmetry as number) ?? 1
  const lineOpacity = (params.lineOpacity as number) ?? 0.9

  return (
    <LSystemsInner
      key={`${preset}-${iterations}-${is3D}-${symmetry}`}
      preset={preset}
      iterations={iterations}
      angle={angle}
      length={length}
      lengthFactor={lengthFactor}
      widthFactor={widthFactor}
      scale={scale}
      drawSpeed={drawSpeed}
      animated={animated}
      colorMode={colorMode}
      windStrength={windStrength}
      windSpeed={windSpeed}
      randomVariation={randomVariation}
      is3D={is3D}
      rotationSpeed={rotationSpeed}
      branchTaper={branchTaper}
      leafSize={leafSize}
      leafColor={leafColor}
      symmetry={symmetry}
      lineOpacity={lineOpacity}
    />
  )
}
