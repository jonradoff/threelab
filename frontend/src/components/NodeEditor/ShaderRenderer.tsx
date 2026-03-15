import { useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { GraphOutputData } from '../../nodes/executor'

const DEFAULT_VERT = `
uniform float uCameraZoom;
varying vec2 vUv;
void main() {
  vec2 center = vec2(0.5, 0.5);
  vUv = center + (uv - center) / max(uCameraZoom, 0.001);
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

// Simulation passes must NOT scale UVs — they need 1:1 texture mapping
const SIM_VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

function toUniformValue(val: unknown): unknown {
  if (Array.isArray(val)) {
    if (val.length === 0) return val
    // Check if it's an array of arrays (vec2[], vec3[], vec4[])
    if (Array.isArray(val[0])) {
      const inner = val[0] as number[]
      if (inner.length === 2) return val.map((v: number[]) => new THREE.Vector2(v[0], v[1]))
      if (inner.length === 3) return val.map((v: number[]) => new THREE.Vector3(v[0], v[1], v[2]))
      if (inner.length === 4) return val.map((v: number[]) => new THREE.Vector4(v[0], v[1], v[2], v[3]))
      return val
    }
    // Single vector
    if (typeof val[0] === 'number') {
      if (val.length === 2) return new THREE.Vector2(val[0], val[1])
      if (val.length === 3) return new THREE.Vector3(val[0], val[1], val[2])
      if (val.length === 4) return new THREE.Vector4(val[0], val[1], val[2], val[3])
    }
  }
  return val
}

function applyUniforms(mat: THREE.ShaderMaterial, uniforms: Record<string, unknown>) {
  for (const [key, val] of Object.entries(uniforms)) {
    const converted = toUniformValue(val)
    if (!mat.uniforms[key]) {
      mat.uniforms[key] = { value: converted }
    } else {
      const existing = mat.uniforms[key].value
      // Copy-in-place for single vectors
      if (existing instanceof THREE.Vector2 && converted instanceof THREE.Vector2) {
        existing.copy(converted)
      } else if (existing instanceof THREE.Vector3 && converted instanceof THREE.Vector3) {
        existing.copy(converted)
      } else if (existing instanceof THREE.Vector4 && converted instanceof THREE.Vector4) {
        existing.copy(converted)
      } else if (Array.isArray(existing) && Array.isArray(converted) &&
                 existing.length === converted.length && existing.length > 0 &&
                 existing[0] instanceof THREE.Vector2) {
        // Update vector arrays in-place
        for (let i = 0; i < existing.length; i++) {
          existing[i].copy(converted[i])
        }
      } else if (Array.isArray(existing) && Array.isArray(converted) &&
                 existing.length === converted.length && existing.length > 0 &&
                 existing[0] instanceof THREE.Vector3) {
        for (let i = 0; i < existing.length; i++) {
          existing[i].copy(converted[i])
        }
      } else {
        mat.uniforms[key].value = converted
      }
    }
  }
}

function buildInitialUniforms(uniforms: Record<string, unknown>): Record<string, { value: unknown }> {
  const result: Record<string, { value: unknown }> = {}
  for (const [key, val] of Object.entries(uniforms)) {
    result[key] = { value: toUniformValue(val) }
  }
  return result
}

interface Props {
  configRef: React.RefObject<GraphOutputData | null>
  renderOrder?: number
}

export default function ShaderRenderer({ configRef, renderOrder }: Props) {
  const meshRef = useRef<THREE.Mesh>(null)
  const materialRef = useRef<THREE.ShaderMaterial | null>(null)
  const lastCodeRef = useRef({ vert: '', frag: '' })

  // Multi-pass state
  const { gl, camera } = useThree()
  const rtMapRef = useRef<Map<string, THREE.WebGLRenderTarget[]>>(new Map())
  const rtFrameRef = useRef<Map<string, number>>(new Map())
  const simSceneRef = useRef<THREE.Scene | null>(null)
  const simCameraRef = useRef<THREE.OrthographicCamera | null>(null)
  const simQuadRef = useRef<THREE.Mesh | null>(null)
  const passMatsRef = useRef<Map<string, THREE.ShaderMaterial>>(new Map())
  const lastPassCodeRef = useRef<Map<string, string>>(new Map())
  const initDoneRef = useRef(false)
  const lastRTDefsRef = useRef<string>('')
  const lastInitDataRef = useRef<Record<string, Float32Array> | undefined>(undefined)

  // Deposit pass infrastructure
  const depositSceneRef = useRef<THREE.Scene | null>(null)
  const depositCameraRef = useRef<THREE.OrthographicCamera | null>(null)
  const depositGeoRef = useRef<Map<string, THREE.BufferGeometry>>(new Map())

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      rtMapRef.current.forEach((targets) => targets.forEach((t) => t.dispose()))
      materialRef.current?.dispose()
      passMatsRef.current.forEach((m) => m.dispose())
      simQuadRef.current?.geometry.dispose()
      depositGeoRef.current.forEach((g) => g.dispose())
    }
  }, [])

  useFrame(() => {
    const config = configRef.current
    const mesh = meshRef.current
    if (!mesh) return

    if (!config || config.__mode !== 'shader') {
      mesh.visible = false
      return
    }

    mesh.visible = true

    // Multi-pass rendering
    if (config.passes && config.passes.length > 0) {
      renderMultiPass(config, mesh)
      return
    }

    // Single-pass rendering
    renderSinglePass(config, mesh)
  })

  function getCameraZoomFactor(): number {
    // Shader patterns manage their own coordinate space via uniforms.
    // Camera zoom should not distort the UV mapping.
    return 1
  }

  function applyCameraZoom(mat: THREE.ShaderMaterial) {
    const factor = getCameraZoomFactor()
    if (!mat.uniforms['uCameraZoom']) {
      mat.uniforms['uCameraZoom'] = { value: factor }
    } else {
      mat.uniforms['uCameraZoom'].value = factor
    }
  }

  function renderSinglePass(config: GraphOutputData, mesh: THREE.Mesh) {
    const vert = config.vertexShader ?? DEFAULT_VERT
    const frag = config.fragmentShader ?? ''
    if (!frag) {
      mesh.visible = false
      return
    }

    if (!materialRef.current ||
        vert !== lastCodeRef.current.vert ||
        frag !== lastCodeRef.current.frag) {
      materialRef.current?.dispose()
      const baseUniforms = config.uniforms ? buildInitialUniforms(config.uniforms) : {}
      baseUniforms['uCameraZoom'] = { value: getCameraZoomFactor() }
      materialRef.current = new THREE.ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        uniforms: baseUniforms,
        depthWrite: false,
        depthTest: false,
        transparent: true,
      })
      mesh.material = materialRef.current
      lastCodeRef.current = { vert, frag }
    } else if (config.uniforms) {
      applyUniforms(materialRef.current, config.uniforms)
    }

    // Apply camera distance as zoom
    if (materialRef.current) {
      applyCameraZoom(materialRef.current)
    }
  }

  function renderMultiPass(config: GraphOutputData, mesh: THREE.Mesh) {
    // Lazy-init simulation infrastructure
    if (!simSceneRef.current) {
      simSceneRef.current = new THREE.Scene()
      simCameraRef.current = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
      const geo = new THREE.PlaneGeometry(2, 2)
      simQuadRef.current = new THREE.Mesh(geo)
      simSceneRef.current.add(simQuadRef.current)
    }

    // Create/recreate render targets if definitions changed
    const rtDefsKey = JSON.stringify(config.renderTargetDefs ?? {})
    if (rtDefsKey !== lastRTDefsRef.current) {
      // Dispose old targets
      rtMapRef.current.forEach((targets) => targets.forEach((t) => t.dispose()))
      rtMapRef.current.clear()
      rtFrameRef.current.clear()
      initDoneRef.current = false
      lastRTDefsRef.current = rtDefsKey
    }

    if (config.renderTargetDefs) {
      for (const [name, def] of Object.entries(config.renderTargetDefs)) {
        if (rtMapRef.current.has(name)) continue
        const count = def.pingPong ? 2 : 1
        const targets: THREE.WebGLRenderTarget[] = []
        for (let i = 0; i < count; i++) {
          targets.push(new THREE.WebGLRenderTarget(def.width, def.height, {
            minFilter: def.filter === 'nearest' ? THREE.NearestFilter : THREE.LinearFilter,
            magFilter: def.filter === 'nearest' ? THREE.NearestFilter : THREE.LinearFilter,
            format: THREE.RGBAFormat,
            type: def.type === 'float' ? THREE.FloatType :
                  def.type === 'half' ? THREE.HalfFloatType : THREE.UnsignedByteType,
            wrapS: def.wrap === 'repeat' ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping,
            wrapT: def.wrap === 'repeat' ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping,
          }))
        }
        rtMapRef.current.set(name, targets)
        rtFrameRef.current.set(name, 0)
      }
    }

    // Reset init if initData changed (e.g. params shuffled)
    if (config.initData) {
      const prevInit = lastInitDataRef.current
      let changed = !prevInit
      if (!changed && prevInit) {
        for (const k of Object.keys(config.initData)) {
          if (config.initData[k] !== prevInit[k]) { changed = true; break }
        }
      }
      if (changed) {
        initDoneRef.current = false
        lastInitDataRef.current = { ...config.initData }
        // Reset ping-pong frame counters so sim reads from freshly-initialized target[0]
        rtFrameRef.current.clear()
      }
    }

    // Initialize render targets with data
    if (!initDoneRef.current && config.initData) {
      for (const [name, data] of Object.entries(config.initData)) {
        const targets = rtMapRef.current.get(name)
        if (!targets || targets.length === 0) continue
        const def = config.renderTargetDefs?.[name]
        if (!def) continue

        const initTex = new THREE.DataTexture(
          data, def.width, def.height,
          THREE.RGBAFormat, THREE.FloatType,
        )
        initTex.needsUpdate = true

        const initMat = new THREE.MeshBasicMaterial({ map: initTex })
        const initMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), initMat)
        const initScene = new THREE.Scene()
        initScene.add(initMesh)

        gl.setRenderTarget(targets[0])
        gl.render(initScene, simCameraRef.current!)
        gl.setRenderTarget(null)

        initMesh.geometry.dispose()
        initMat.dispose()
        initTex.dispose()
      }
      initDoneRef.current = true
    }

    // Execute passes
    const passes = config.passes!
    const steps = config.stepsPerFrame ?? 1

    for (let step = 0; step < steps; step++) {
      for (const pass of passes) {
        // Skip display pass (target=null) on non-last steps
        if (step < steps - 1 && !pass.target) continue

        // Get or create material for this pass
        let mat = passMatsRef.current.get(pass.name)
        const lastCode = lastPassCodeRef.current.get(pass.name) ?? ''

        if (!mat || pass.fragmentShader !== lastCode) {
          mat?.dispose()
          const passUniforms = pass.uniforms ? buildInitialUniforms(pass.uniforms) : {}
          // Only inject camera zoom for display passes, not simulation passes
          const isDisplayPass = !pass.target
          const vert = pass.vertexShader ?? (isDisplayPass ? DEFAULT_VERT : SIM_VERT)
          if (isDisplayPass) {
            passUniforms['uCameraZoom'] = { value: getCameraZoomFactor() }
          }
          mat = new THREE.ShaderMaterial({
            vertexShader: vert,
            fragmentShader: pass.fragmentShader,
            uniforms: passUniforms,
            depthWrite: false,
            depthTest: false,
          })
          passMatsRef.current.set(pass.name, mat)
          lastPassCodeRef.current.set(pass.name, pass.fragmentShader)
        }

        // Set read-from textures as uniforms
        if (pass.readFrom) {
          for (const [uniformName, targetName] of Object.entries(pass.readFrom)) {
            const targets = rtMapRef.current.get(targetName)
            const frame = rtFrameRef.current.get(targetName) ?? 0
            if (targets) {
              const def = config.renderTargetDefs?.[targetName]
              const srcIdx = def?.pingPong ? (frame % 2) : 0
              if (!mat.uniforms[uniformName]) {
                mat.uniforms[uniformName] = { value: targets[srcIdx].texture }
              } else {
                mat.uniforms[uniformName].value = targets[srcIdx].texture
              }
            }
          }
        }

        // Set other uniforms
        if (pass.uniforms) {
          applyUniforms(mat, pass.uniforms)
        }

        // Apply camera zoom only to display passes (not simulation passes)
        if (!pass.target) {
          applyCameraZoom(mat)
        }

        if (pass.target) {
          // Render to target
          const targets = rtMapRef.current.get(pass.target)
          if (targets) {
            const def = config.renderTargetDefs?.[pass.target]
            const frame = rtFrameRef.current.get(pass.target) ?? 0
            // For noClear passes (e.g. deposit), write to the SAME target the previous pass wrote
            // (frame was already advanced, so current dst is frame % 2)
            const dstIdx = def?.pingPong
              ? (pass.noClear ? (frame % 2) : ((frame + 1) % 2))
              : 0

            if (pass.mode === 'deposit') {
              // Deposit pass: render agents as GL_POINTS with additive blending
              renderDepositPass(pass, mat, targets[dstIdx])
            } else {
              simQuadRef.current!.material = mat
              gl.setRenderTarget(targets[dstIdx])
              if (pass.noClear) {
                gl.autoClear = false
              }
              gl.render(simSceneRef.current!, simCameraRef.current!)
              if (pass.noClear) {
                gl.autoClear = true
              }
              gl.setRenderTarget(null)
            }

            // Only advance ping-pong for non-noClear passes (deposit writes to same dst)
            if (def?.pingPong && !pass.noClear) {
              rtFrameRef.current.set(pass.target, frame + 1)
            }
          }
        } else {
          // Display pass - render via the main mesh
          mesh.material = mat
        }
      }
    }
  }

  function renderDepositPass(
    pass: NonNullable<GraphOutputData['passes']>[number],
    mat: THREE.ShaderMaterial,
    target: THREE.WebGLRenderTarget,
  ) {
    const agentRes = pass.agentRes ?? 32
    const geoKey = `deposit_${agentRes}`

    // Lazy-init deposit scene
    if (!depositSceneRef.current) {
      depositSceneRef.current = new THREE.Scene()
      depositCameraRef.current = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    }

    // Get or create deposit geometry for this agent resolution
    let geo = depositGeoRef.current.get(geoKey)
    if (!geo) {
      const agentCount = agentRes * agentRes
      const agentUVs = new Float32Array(agentCount * 2)
      for (let y = 0; y < agentRes; y++) {
        for (let x = 0; x < agentRes; x++) {
          const i = y * agentRes + x
          agentUVs[i * 2] = (x + 0.5) / agentRes
          agentUVs[i * 2 + 1] = (y + 0.5) / agentRes
        }
      }
      geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(
        new Float32Array(agentCount * 3), 3,
      ))
      geo.setAttribute('agentUV', new THREE.BufferAttribute(agentUVs, 2))
      depositGeoRef.current.set(geoKey, geo)
    }

    // Set agent texture from readFrom
    if (pass.agentTarget) {
      const agentTargets = rtMapRef.current.get(pass.agentTarget)
      const agentFrame = rtFrameRef.current.get(pass.agentTarget) ?? 0
      if (agentTargets) {
        const agentDef = configRef.current?.renderTargetDefs?.[pass.agentTarget]
        const srcIdx = agentDef?.pingPong ? (agentFrame % 2) : 0
        if (!mat.uniforms['agentTex']) {
          mat.uniforms['agentTex'] = { value: agentTargets[srcIdx].texture }
        } else {
          mat.uniforms['agentTex'].value = agentTargets[srcIdx].texture
        }
      }
    }

    // Configure material for additive blending
    mat.blending = THREE.AdditiveBlending
    mat.depthTest = false
    mat.depthWrite = false

    const points = new THREE.Points(geo, mat)
    depositSceneRef.current!.add(points)

    gl.setRenderTarget(target)
    gl.autoClear = false // Don't clear — deposit ON TOP of existing pheromone
    gl.render(depositSceneRef.current!, depositCameraRef.current!)
    gl.autoClear = true
    gl.setRenderTarget(null)

    depositSceneRef.current!.remove(points)
  }

  return (
    <mesh ref={meshRef} frustumCulled={false} renderOrder={renderOrder ?? 1000} visible={false}>
      <planeGeometry args={[2, 2]} />
      <meshBasicMaterial />
    </mesh>
  )
}
