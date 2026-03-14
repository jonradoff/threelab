import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useInteraction } from '../systems/InteractionManager'

interface Props {
  params: Record<string, unknown>
}

const QUAD_VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const SIM_FRAG = `
precision highp float;
uniform sampler2D stateTex;
uniform float feed;
uniform float kill;
uniform float dA;
uniform float dB;
uniform float dt;
uniform vec2 resolution;
uniform vec2 mousePos;
uniform float mouseActive;
varying vec2 vUv;

void main() {
  vec2 texel = 1.0 / resolution;
  vec4 state = texture2D(stateTex, vUv);
  float a = state.r;
  float b = state.g;

  // Laplacian (9-point stencil)
  float lapA = 0.0;
  float lapB = 0.0;

  lapA += texture2D(stateTex, vUv + vec2(-texel.x, 0.0)).r * 0.2;
  lapA += texture2D(stateTex, vUv + vec2(texel.x, 0.0)).r * 0.2;
  lapA += texture2D(stateTex, vUv + vec2(0.0, -texel.y)).r * 0.2;
  lapA += texture2D(stateTex, vUv + vec2(0.0, texel.y)).r * 0.2;
  lapA += texture2D(stateTex, vUv + vec2(-texel.x, -texel.y)).r * 0.05;
  lapA += texture2D(stateTex, vUv + vec2(texel.x, -texel.y)).r * 0.05;
  lapA += texture2D(stateTex, vUv + vec2(-texel.x, texel.y)).r * 0.05;
  lapA += texture2D(stateTex, vUv + vec2(texel.x, texel.y)).r * 0.05;
  lapA -= a;

  lapB += texture2D(stateTex, vUv + vec2(-texel.x, 0.0)).g * 0.2;
  lapB += texture2D(stateTex, vUv + vec2(texel.x, 0.0)).g * 0.2;
  lapB += texture2D(stateTex, vUv + vec2(0.0, -texel.y)).g * 0.2;
  lapB += texture2D(stateTex, vUv + vec2(0.0, texel.y)).g * 0.2;
  lapB += texture2D(stateTex, vUv + vec2(-texel.x, -texel.y)).g * 0.05;
  lapB += texture2D(stateTex, vUv + vec2(texel.x, -texel.y)).g * 0.05;
  lapB += texture2D(stateTex, vUv + vec2(-texel.x, texel.y)).g * 0.05;
  lapB += texture2D(stateTex, vUv + vec2(texel.x, texel.y)).g * 0.05;
  lapB -= b;

  float abb = a * b * b;
  float newA = a + (dA * lapA - abb + feed * (1.0 - a)) * dt;
  float newB = b + (dB * lapB + abb - (kill + feed) * b) * dt;

  // Mouse deposits chemical B
  float mouseDist = distance(vUv, mousePos);
  if (mouseActive > 0.5 && mouseDist < 0.03) {
    newB += 0.1 * (1.0 - mouseDist / 0.03);
  }

  gl_FragColor = vec4(clamp(newA, 0.0, 1.0), clamp(newB, 0.0, 1.0), 0.0, 1.0);
}
`

const DISPLAY_FRAG = `
precision highp float;
uniform sampler2D stateTex;
uniform vec3 colorA;
uniform vec3 colorB;
varying vec2 vUv;

void main() {
  vec4 state = texture2D(stateTex, vUv);
  float a = state.r;
  float b = state.g;
  vec3 col = mix(colorA, colorB, b * 2.0);
  col += vec3(b * 0.3, b * 0.1, b * 0.5);
  gl_FragColor = vec4(col, 1.0);
}
`

export default function ReactionDiffusion({ params }: Props) {
  const feed = (params.feed as number) ?? 0.055
  const kill = (params.kill as number) ?? 0.062
  const diffusionA = (params.diffusionA as number) ?? 1.0
  const diffusionB = (params.diffusionB as number) ?? 0.5
  const timeStep = (params.timeStep as number) ?? 1.0
  const stepsPerFrame = (params.stepsPerFrame as number) ?? 8
  const resolution = Math.min((params.resolution as number) ?? 256, 512)
  const seedPattern = (params.seedPattern as string) ?? 'center'
  const colorMapA = (params.colorMapA as string) ?? '#000000'
  const colorMapB = (params.colorMapB as string) ?? '#ffffff'

  const meshRef = useRef<THREE.Mesh>(null)
  const { gl } = useThree()
  const { mouse } = useInteraction()

  const sim = useMemo(() => {
    // Initialize state texture
    const data = new Float32Array(resolution * resolution * 4)
    for (let i = 0; i < resolution * resolution; i++) {
      data[i * 4] = 1.0     // A = 1 everywhere
      data[i * 4 + 1] = 0.0 // B = 0 everywhere
      data[i * 4 + 2] = 0.0
      data[i * 4 + 3] = 1.0
    }

    // Seed B based on pattern
    const seedB = (x: number, y: number) => {
      const idx = (y * resolution + x) * 4
      data[idx + 1] = 1.0
    }

    const cx = Math.floor(resolution / 2)
    const cy = Math.floor(resolution / 2)
    const seedRadius = Math.floor(resolution * 0.05)

    if (seedPattern === 'center') {
      for (let y = cy - seedRadius; y <= cy + seedRadius; y++) {
        for (let x = cx - seedRadius; x <= cx + seedRadius; x++) {
          if (x >= 0 && x < resolution && y >= 0 && y < resolution) {
            seedB(x, y)
          }
        }
      }
    } else if (seedPattern === 'random') {
      for (let i = 0; i < 20; i++) {
        const rx = Math.floor(Math.random() * resolution)
        const ry = Math.floor(Math.random() * resolution)
        for (let dy = -3; dy <= 3; dy++) {
          for (let dx = -3; dx <= 3; dx++) {
            const xx = rx + dx
            const yy = ry + dy
            if (xx >= 0 && xx < resolution && yy >= 0 && yy < resolution) {
              seedB(xx, yy)
            }
          }
        }
      }
    } else if (seedPattern === 'ring') {
      for (let a = 0; a < Math.PI * 2; a += 0.1) {
        const r = resolution * 0.25
        const x = Math.floor(cx + Math.cos(a) * r)
        const y = Math.floor(cy + Math.sin(a) * r)
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const xx = x + dx
            const yy = y + dy
            if (xx >= 0 && xx < resolution && yy >= 0 && yy < resolution) {
              seedB(xx, yy)
            }
          }
        }
      }
    } else if (seedPattern === 'corners') {
      const corners = [
        [seedRadius + 5, seedRadius + 5],
        [resolution - seedRadius - 5, seedRadius + 5],
        [seedRadius + 5, resolution - seedRadius - 5],
        [resolution - seedRadius - 5, resolution - seedRadius - 5],
      ]
      for (const [ccx, ccy] of corners) {
        for (let y = ccy - seedRadius; y <= ccy + seedRadius; y++) {
          for (let x = ccx - seedRadius; x <= ccx + seedRadius; x++) {
            if (x >= 0 && x < resolution && y >= 0 && y < resolution) {
              seedB(x, y)
            }
          }
        }
      }
    }

    const initTex = new THREE.DataTexture(
      data, resolution, resolution,
      THREE.RGBAFormat, THREE.FloatType,
    )
    initTex.needsUpdate = true
    initTex.minFilter = THREE.LinearFilter
    initTex.magFilter = THREE.LinearFilter
    initTex.wrapS = THREE.RepeatWrapping
    initTex.wrapT = THREE.RepeatWrapping

    const createRT = () =>
      new THREE.WebGLRenderTarget(resolution, resolution, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        type: THREE.FloatType,
        wrapS: THREE.RepeatWrapping,
        wrapT: THREE.RepeatWrapping,
      })

    const rt = [createRT(), createRT()]

    // Copy init data to RT[0]
    const initScene = new THREE.Scene()
    const initCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const initMat = new THREE.MeshBasicMaterial({ map: initTex })
    const initMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), initMat)
    initScene.add(initMesh)
    gl.setRenderTarget(rt[0])
    gl.render(initScene, initCamera)
    gl.setRenderTarget(null)
    initMesh.geometry.dispose()
    initMat.dispose()
    initTex.dispose()

    const simMaterial = new THREE.ShaderMaterial({
      vertexShader: QUAD_VERT,
      fragmentShader: SIM_FRAG,
      uniforms: {
        stateTex: { value: null },
        feed: { value: feed },
        kill: { value: kill },
        dA: { value: diffusionA },
        dB: { value: diffusionB },
        dt: { value: timeStep },
        resolution: { value: new THREE.Vector2(resolution, resolution) },
        mousePos: { value: new THREE.Vector2(0.5, 0.5) },
        mouseActive: { value: 0 },
      },
    })

    const displayMaterial = new THREE.ShaderMaterial({
      vertexShader: QUAD_VERT,
      fragmentShader: DISPLAY_FRAG,
      uniforms: {
        stateTex: { value: null },
        colorA: { value: new THREE.Color(colorMapA) },
        colorB: { value: new THREE.Color(colorMapB) },
      },
    })

    return { rt, simMaterial, displayMaterial, frame: 0 }
  }, [gl, resolution, seedPattern, feed, kill, diffusionA, diffusionB, timeStep, colorMapA, colorMapB])

  useEffect(() => {
    sim.simMaterial.uniforms.feed.value = feed
    sim.simMaterial.uniforms.kill.value = kill
    sim.simMaterial.uniforms.dA.value = diffusionA
    sim.simMaterial.uniforms.dB.value = diffusionB
    sim.simMaterial.uniforms.dt.value = timeStep
    sim.displayMaterial.uniforms.colorA.value.set(colorMapA)
    sim.displayMaterial.uniforms.colorB.value.set(colorMapB)
  }, [sim, feed, kill, diffusionA, diffusionB, timeStep, colorMapA, colorMapB])

  const simScene = useMemo(() => new THREE.Scene(), [])
  const simCamera = useMemo(
    () => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1),
    [],
  )
  const simQuad = useMemo(() => new THREE.Mesh(new THREE.PlaneGeometry(2, 2)), [])

  useEffect(() => {
    simScene.add(simQuad)
    return () => {
      simScene.remove(simQuad)
    }
  }, [simScene, simQuad])

  useFrame(() => {
    const mouseUV = new THREE.Vector2(
      (mouse.x + 1) * 0.5,
      (mouse.y + 1) * 0.5,
    )

    for (let step = 0; step < stepsPerFrame; step++) {
      const src = sim.frame % 2
      const dst = 1 - src

      sim.simMaterial.uniforms.stateTex.value = sim.rt[src].texture
      sim.simMaterial.uniforms.mousePos.value.copy(mouseUV)
      sim.simMaterial.uniforms.mouseActive.value = 1.0

      simQuad.material = sim.simMaterial
      gl.setRenderTarget(sim.rt[dst])
      gl.render(simScene, simCamera)

      sim.frame++
    }

    gl.setRenderTarget(null)

    const latest = sim.frame % 2 === 0 ? 0 : 1
    sim.displayMaterial.uniforms.stateTex.value = sim.rt[latest].texture
    if (meshRef.current) {
      meshRef.current.material = sim.displayMaterial
    }
  })

  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      <planeGeometry args={[2000, 2000]} />
      <meshBasicMaterial />
    </mesh>
  )
}
