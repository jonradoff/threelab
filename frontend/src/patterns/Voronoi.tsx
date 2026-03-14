import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useInteraction } from '../systems/InteractionManager'
import { hslToRgb } from '../utils/colorPalette'

interface Props {
  params: Record<string, unknown>
}

const MAX_SEEDS = 64

const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const fragmentShader = `
precision highp float;

varying vec2 vUv;

uniform vec2 seeds[${MAX_SEEDS}];
uniform vec3 seedColors[${MAX_SEEDS}];
uniform int seedCount;
uniform float borderWidth;
uniform vec3 borderColor;
uniform float cellOpacity;
uniform float distortAmount;
uniform float distortFreq;
uniform int metric; // 0=euclidean, 1=manhattan, 2=chebyshev
uniform bool showSeeds;
uniform float seedSize;
uniform float pulseSpeed;
uniform float time;
uniform bool invertColors;
uniform float blendEdges;
uniform float rotation;
uniform vec2 mousePos;
uniform float mouseActive;
uniform vec2 resolution;

float rand(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

vec2 distort(vec2 p) {
  if (distortAmount < 0.001) return p;
  float dx = sin(p.y * distortFreq * 6.2831 + time * 0.5) * distortAmount * 0.05;
  float dy = cos(p.x * distortFreq * 6.2831 + time * 0.7) * distortAmount * 0.05;
  return p + vec2(dx, dy);
}

float dist(vec2 a, vec2 b) {
  vec2 d = abs(a - b);
  if (metric == 1) {
    return d.x + d.y; // manhattan
  } else if (metric == 2) {
    return max(d.x, d.y); // chebyshev
  }
  return length(a - b); // euclidean
}

void main() {
  // Apply rotation around center
  vec2 center = vec2(0.5);
  vec2 p = vUv - center;
  float c = cos(rotation);
  float s = sin(rotation);
  p = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
  p += center;

  vec2 dp = distort(p);

  // Find nearest and second-nearest seed
  float d1 = 1e10;
  float d2 = 1e10;
  int nearest = 0;
  int secondNearest = 0;

  for (int i = 0; i < ${MAX_SEEDS}; i++) {
    if (i >= seedCount) break;
    float d = dist(dp, seeds[i]);
    if (d < d1) {
      d2 = d1;
      secondNearest = nearest;
      d1 = d;
      nearest = i;
    } else if (d < d2) {
      d2 = d;
      secondNearest = i;
    }
  }

  // Pulse effect: modulate distance by time
  float pulse = 1.0;
  if (pulseSpeed > 0.001) {
    pulse = 0.85 + 0.15 * sin(time * pulseSpeed + float(nearest) * 1.7);
  }

  // Cell color from precomputed seed colors
  vec3 cellColor = seedColors[nearest];

  // Blend edges: smooth transition between cells
  if (blendEdges > 0.001) {
    vec3 neighborColor = seedColors[secondNearest];
    float edgeFactor = smoothstep(0.0, blendEdges * 0.1, d2 - d1);
    cellColor = mix(neighborColor, cellColor, edgeFactor);
  }

  cellColor *= pulse;

  if (invertColors) {
    cellColor = vec3(1.0) - cellColor;
  }

  // Border rendering: use difference between nearest and second-nearest
  float borderDist = d2 - d1;
  float borderThreshold = borderWidth * 0.002;
  float borderFactor = 1.0 - smoothstep(0.0, borderThreshold, borderDist);

  vec3 color = mix(cellColor, borderColor, borderFactor);
  float alpha = mix(cellOpacity, 1.0, borderFactor);

  // Seed dot rendering
  if (showSeeds) {
    float seedDist = d1;
    float seedThreshold = seedSize * 0.002;
    float seedFactor = 1.0 - smoothstep(0.0, seedThreshold, seedDist);
    color = mix(color, vec3(1.0), seedFactor * 0.9);
    alpha = mix(alpha, 1.0, seedFactor);
  }

  // Mouse attraction highlight
  if (mouseActive > 0.5) {
    float mDist = length(p - mousePos);
    float glow = exp(-mDist * mDist * 80.0) * 0.3;
    color += vec3(glow);
  }

  gl_FragColor = vec4(color, alpha);
}
`

interface SeedState {
  x: number
  y: number
  vx: number
  vy: number
  angle: number
  orbitRadius: number
  orbitSpeed: number
  orbitCenterX: number
  orbitCenterY: number
  hue: number
}

function initSeeds(count: number): SeedState[] {
  const seeds: SeedState[] = []
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2
    seeds.push({
      x: 0.1 + Math.random() * 0.8,
      y: 0.1 + Math.random() * 0.8,
      vx: (Math.random() - 0.5) * 0.001,
      vy: (Math.random() - 0.5) * 0.001,
      angle,
      orbitRadius: 0.05 + Math.random() * 0.15,
      orbitSpeed: 0.3 + Math.random() * 0.7,
      orbitCenterX: 0.2 + Math.random() * 0.6,
      orbitCenterY: 0.2 + Math.random() * 0.6,
      hue: i / count,
    })
  }
  return seeds
}

function computeSeedColor(
  index: number,
  total: number,
  seed: SeedState,
  colorMode: string,
): [number, number, number] {
  switch (colorMode) {
    case 'distance':
      // Will blend with distance in shader; base it on index
      return hslToRgb(index / total, 0.7, 0.55)
    case 'palette': {
      const palette: [number, number, number][] = [
        [0.91, 0.30, 0.24], // red
        [0.95, 0.61, 0.07], // orange
        [0.94, 0.76, 0.06], // yellow
        [0.18, 0.80, 0.44], // green
        [0.20, 0.60, 0.86], // blue
        [0.56, 0.27, 0.68], // purple
      ]
      return palette[index % palette.length]
    }
    case 'height':
      return hslToRgb(0.55 + seed.y * 0.3, 0.75, 0.4 + seed.y * 0.3)
    case 'random':
    default:
      return hslToRgb(seed.hue, 0.75, 0.55)
  }
}

export default function Voronoi({ params }: Props) {
  const seedCount = Math.min(MAX_SEEDS, Math.max(1, (params.seedCount as number) ?? 30))
  const motionType = (params.motionType as string) ?? 'brownian'
  const motionSpeed = (params.motionSpeed as number) ?? 0.5
  const colorMode = (params.colorMode as string) ?? 'random'
  const borderWidth = (params.borderWidth as number) ?? 2
  const borderColorHex = (params.borderColor as string) ?? '#ffffff'
  const cellOpacity = (params.cellOpacity as number) ?? 0.8
  const distortAmount = (params.distortAmount as number) ?? 0
  const distortFreq = (params.distortFreq as number) ?? 2
  const metricName = (params.metric as string) ?? 'euclidean'
  const showSeeds = (params.showSeeds as boolean) ?? false
  const seedSize = (params.seedSize as number) ?? 3
  const pulseSpeed = (params.pulseSpeed as number) ?? 0
  const invertColors = (params.invertColors as boolean) ?? false
  const blendEdges = (params.blendEdges as number) ?? 0
  const rotationSpeed = (params.rotationSpeed as number) ?? 0

  const meshRef = useRef<THREE.Mesh>(null)
  const seedsRef = useRef<SeedState[]>(initSeeds(seedCount))
  const prevSeedCountRef = useRef(seedCount)
  const { mouse } = useInteraction()

  const metricInt = metricName === 'manhattan' ? 1 : metricName === 'chebyshev' ? 2 : 0

  // Handle animated seed count changes
  useEffect(() => {
    const current = seedsRef.current
    if (seedCount > current.length) {
      // Add new seeds
      for (let i = current.length; i < seedCount; i++) {
        const angle = Math.random() * Math.PI * 2
        current.push({
          x: 0.1 + Math.random() * 0.8,
          y: 0.1 + Math.random() * 0.8,
          vx: (Math.random() - 0.5) * 0.001,
          vy: (Math.random() - 0.5) * 0.001,
          angle,
          orbitRadius: 0.05 + Math.random() * 0.15,
          orbitSpeed: 0.3 + Math.random() * 0.7,
          orbitCenterX: 0.2 + Math.random() * 0.6,
          orbitCenterY: 0.2 + Math.random() * 0.6,
          hue: i / seedCount,
        })
      }
    } else if (seedCount < current.length) {
      current.length = seedCount
    }
    prevSeedCountRef.current = seedCount
  }, [seedCount])

  const borderColorVec = useMemo(() => {
    const c = new THREE.Color(borderColorHex)
    return new THREE.Vector3(c.r, c.g, c.b)
  }, [borderColorHex])

  const material = useMemo(() => {
    // Initialize uniform arrays
    const seedsArr: number[] = []
    const colorsArr: number[] = []
    for (let i = 0; i < MAX_SEEDS; i++) {
      seedsArr.push(0, 0)
      colorsArr.push(0, 0, 0)
    }

    return new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      uniforms: {
        seeds: { value: seedsArr.reduce<THREE.Vector2[]>((acc, _, idx) => {
          if (idx % 2 === 0) acc.push(new THREE.Vector2(seedsArr[idx], seedsArr[idx + 1]))
          return acc
        }, []) },
        seedColors: { value: colorsArr.reduce<THREE.Vector3[]>((acc, _, idx) => {
          if (idx % 3 === 0) acc.push(new THREE.Vector3(colorsArr[idx], colorsArr[idx + 1], colorsArr[idx + 2]))
          return acc
        }, []) },
        seedCount: { value: seedCount },
        borderWidth: { value: borderWidth },
        borderColor: { value: borderColorVec },
        cellOpacity: { value: cellOpacity },
        distortAmount: { value: distortAmount },
        distortFreq: { value: distortFreq },
        metric: { value: metricInt },
        showSeeds: { value: showSeeds },
        seedSize: { value: seedSize },
        pulseSpeed: { value: pulseSpeed },
        time: { value: 0 },
        invertColors: { value: invertColors },
        blendEdges: { value: blendEdges },
        rotation: { value: 0 },
        mousePos: { value: new THREE.Vector2(0.5, 0.5) },
        mouseActive: { value: 0 },
        resolution: { value: new THREE.Vector2(2000, 2000) },
      },
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Live-update uniforms
  useEffect(() => {
    material.uniforms.seedCount.value = seedCount
    material.uniforms.borderWidth.value = borderWidth
    material.uniforms.borderColor.value = borderColorVec
    material.uniforms.cellOpacity.value = cellOpacity
    material.uniforms.distortAmount.value = distortAmount
    material.uniforms.distortFreq.value = distortFreq
    material.uniforms.metric.value = metricInt
    material.uniforms.showSeeds.value = showSeeds
    material.uniforms.seedSize.value = seedSize
    material.uniforms.pulseSpeed.value = pulseSpeed
    material.uniforms.invertColors.value = invertColors
    material.uniforms.blendEdges.value = blendEdges
  }, [
    material, seedCount, borderWidth, borderColorVec, cellOpacity,
    distortAmount, distortFreq, metricInt, showSeeds, seedSize,
    pulseSpeed, invertColors, blendEdges,
  ])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    const dt = Math.min(1 / 30, 0.016) // cap delta to avoid jumps
    const seeds = seedsRef.current
    const speed = motionSpeed * 0.01

    // Mouse position in UV space (0-1)
    const mouseUV = new THREE.Vector2(
      (mouse.x + 1) * 0.5,
      (mouse.y + 1) * 0.5,
    )

    // Update seed positions based on motion type
    for (let i = 0; i < seeds.length; i++) {
      const s = seeds[i]

      switch (motionType) {
        case 'brownian':
          s.vx += (Math.random() - 0.5) * speed * 0.5
          s.vy += (Math.random() - 0.5) * speed * 0.5
          s.vx *= 0.95 // damping
          s.vy *= 0.95
          s.x += s.vx
          s.y += s.vy
          break

        case 'orbital':
          s.angle += s.orbitSpeed * speed * dt * 60
          s.x = s.orbitCenterX + Math.cos(s.angle) * s.orbitRadius
          s.y = s.orbitCenterY + Math.sin(s.angle) * s.orbitRadius
          break

        case 'linear':
          s.x += s.vx * speed * dt * 600
          s.y += s.vy * speed * dt * 600
          // Bounce off edges
          if (s.x < 0 || s.x > 1) { s.vx *= -1; s.x = Math.max(0, Math.min(1, s.x)) }
          if (s.y < 0 || s.y > 1) { s.vy *= -1; s.y = Math.max(0, Math.min(1, s.y)) }
          break

        case 'static':
        default:
          break
      }

      // Mouse interaction: attract seeds toward mouse
      const dx = mouseUV.x - s.x
      const dy = mouseUV.y - s.y
      const mDist = Math.sqrt(dx * dx + dy * dy)
      if (mDist < 0.3 && mDist > 0.001) {
        const force = 0.002 * speed / mDist
        s.x += dx * force
        s.y += dy * force
      }

      // Wrap to [0,1]
      s.x = ((s.x % 1) + 1) % 1
      s.y = ((s.y % 1) + 1) % 1
    }

    // Update uniforms
    const seedUniforms = material.uniforms.seeds.value as THREE.Vector2[]
    const colorUniforms = material.uniforms.seedColors.value as THREE.Vector3[]

    for (let i = 0; i < MAX_SEEDS; i++) {
      if (i < seeds.length) {
        seedUniforms[i].set(seeds[i].x, seeds[i].y)
        const [r, g, b] = computeSeedColor(i, seeds.length, seeds[i], colorMode)
        colorUniforms[i].set(r, g, b)
      } else {
        seedUniforms[i].set(-10, -10) // offscreen
      }
    }

    material.uniforms.time.value = t
    material.uniforms.rotation.value = t * rotationSpeed * 0.5
    material.uniforms.mousePos.value = mouseUV
    material.uniforms.mouseActive.value = 1

    if (meshRef.current) {
      meshRef.current.material = material
    }
  })

  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      <planeGeometry args={[2000, 2000]} />
      <meshBasicMaterial />
    </mesh>
  )
}
