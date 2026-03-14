import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useInteraction } from '../systems/InteractionManager'

interface Props {
  params: Record<string, unknown>
}

// Vertex shader for fullscreen quads
const QUAD_VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

// Agent update: read agent state, sense pheromone, update position/angle
const AGENT_FRAG = `
precision highp float;
uniform sampler2D agentTex;
uniform sampler2D pheromoneTex;
uniform float sensorAngle;
uniform float sensorDist;
uniform float turnSpeed;
uniform float moveSpeed;
uniform vec2 resolution;
uniform float time;
uniform float randomStrength;
varying vec2 vUv;

float rand(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec4 agent = texture2D(agentTex, vUv);
  vec2 pos = agent.xy;
  float angle = agent.z;
  float speed = agent.w;

  float sa = sensorAngle * 3.14159 / 180.0;
  float sd = sensorDist / resolution.x;

  // Sense pheromone at three positions
  vec2 frontSensor = pos + vec2(cos(angle), sin(angle)) * sd;
  vec2 leftSensor  = pos + vec2(cos(angle + sa), sin(angle + sa)) * sd;
  vec2 rightSensor = pos + vec2(cos(angle - sa), sin(angle - sa)) * sd;

  float frontVal = texture2D(pheromoneTex, fract(frontSensor)).r;
  float leftVal  = texture2D(pheromoneTex, fract(leftSensor)).r;
  float rightVal = texture2D(pheromoneTex, fract(rightSensor)).r;

  float ts = turnSpeed * 3.14159 / 180.0;
  float rnd = rand(pos + vec2(time * 0.137, time * 0.071));
  float rnd2 = rand(pos.yx + vec2(time * 0.093, time * 0.119));

  // Steer toward highest pheromone concentration
  if (frontVal > leftVal && frontVal > rightVal) {
    // Keep going straight — slight random wobble for organic feel
    angle += (rnd - 0.5) * ts * randomStrength * 0.1;
  } else if (frontVal < leftVal && frontVal < rightVal) {
    // Both sides stronger — turn randomly
    angle += (rnd > 0.5 ? 1.0 : -1.0) * ts;
  } else if (rightVal > leftVal) {
    angle -= ts;
  } else if (leftVal > rightVal) {
    angle += ts;
  } else {
    angle += (rnd - 0.5) * ts * 0.5;
  }

  // Add some random jitter to prevent perfect crystalline patterns
  angle += (rnd2 - 0.5) * randomStrength * 0.05;

  float ms = moveSpeed / resolution.x;
  pos += vec2(cos(angle), sin(angle)) * ms * speed;
  pos = fract(pos); // wrap around

  gl_FragColor = vec4(pos, angle, speed);
}
`

// Deposit pheromone: render agents as points into pheromone texture
const DEPOSIT_VERT = `
attribute vec2 agentUV;
uniform sampler2D agentTex;
uniform float depositAmount;
varying float vDeposit;

void main() {
  vec4 agent = texture2D(agentTex, agentUV);
  vec2 pos = agent.xy;
  // Map agent position [0,1] to clip space [-1,1]
  gl_Position = vec4(pos * 2.0 - 1.0, 0.0, 1.0);
  gl_PointSize = 1.0;
  vDeposit = depositAmount;
}
`

const DEPOSIT_FRAG = `
precision highp float;
varying float vDeposit;
void main() {
  gl_FragColor = vec4(vDeposit * 0.05, 0.0, 0.0, 1.0);
}
`

// Diffuse + decay pheromone field, also add mouse deposit
const DIFFUSE_FRAG = `
precision highp float;
uniform sampler2D pheromoneTex;
uniform float decayRate;
uniform float diffuseSpeed;
uniform vec2 resolution;
uniform vec2 mousePos;
uniform float mouseActive;
varying vec2 vUv;

void main() {
  vec2 texel = 1.0 / resolution;

  // Weighted 3x3 blur for diffusion — center-weighted for tighter trails
  float center = texture2D(pheromoneTex, vUv).r;
  float sum = center * 4.0;
  sum += texture2D(pheromoneTex, vUv + vec2(-1.0, 0.0) * texel).r;
  sum += texture2D(pheromoneTex, vUv + vec2(1.0, 0.0) * texel).r;
  sum += texture2D(pheromoneTex, vUv + vec2(0.0, -1.0) * texel).r;
  sum += texture2D(pheromoneTex, vUv + vec2(0.0, 1.0) * texel).r;
  sum += texture2D(pheromoneTex, vUv + vec2(-1.0, -1.0) * texel).r * 0.5;
  sum += texture2D(pheromoneTex, vUv + vec2(1.0, -1.0) * texel).r * 0.5;
  sum += texture2D(pheromoneTex, vUv + vec2(-1.0, 1.0) * texel).r * 0.5;
  sum += texture2D(pheromoneTex, vUv + vec2(1.0, 1.0) * texel).r * 0.5;
  float totalWeight = 4.0 + 4.0 + 2.0; // center + cardinals + diagonals
  float diffused = sum / totalWeight;

  // Blend between original and diffused based on diffuseSpeed
  float blended = mix(center, diffused, diffuseSpeed);
  float decayed = blended * (1.0 - decayRate);

  // Mouse deposit
  float mouseDist = distance(vUv, mousePos);
  if (mouseActive > 0.5 && mouseDist < 0.05) {
    float falloff = 1.0 - mouseDist / 0.05;
    decayed += falloff * falloff * 0.3;
  }

  gl_FragColor = vec4(min(decayed, 1.0), 0.0, 0.0, 1.0);
}
`

// Display: map pheromone concentration to colors with organic look
const DISPLAY_FRAG = `
precision highp float;
uniform sampler2D pheromoneTex;
uniform vec3 trailColor;
uniform vec3 bgColor;
uniform float contrast;
uniform float brightness;
varying vec2 vUv;

void main() {
  float val = texture2D(pheromoneTex, vUv).r;

  // Multi-layer tone mapping for organic vein look
  // Low threshold reveals faint tendrils
  float tendrils = smoothstep(0.005, 0.08, val);
  // Medium threshold for main vein structure
  float veins = smoothstep(0.03, 0.25, val);
  // High threshold for bright concentrated areas
  float hotspots = smoothstep(0.15, 0.6, val);

  // Contrast adjustment
  float v = pow(tendrils, 1.0 / max(contrast, 0.1));

  // Layer colors: dark bg -> colored veins -> bright hotspots
  vec3 col = bgColor;
  col = mix(col, trailColor * 0.4, tendrils * 0.6);  // faint network
  col = mix(col, trailColor * brightness, veins);       // main veins
  col += vec3(0.8, 0.9, 1.0) * hotspots * 0.5;        // white-hot centers

  // Subtle edge glow using gradient magnitude
  vec2 texel = vec2(1.0) / vec2(textureSize(pheromoneTex, 0));
  float dx = texture2D(pheromoneTex, vUv + vec2(texel.x, 0.0)).r -
             texture2D(pheromoneTex, vUv - vec2(texel.x, 0.0)).r;
  float dy = texture2D(pheromoneTex, vUv + vec2(0.0, texel.y)).r -
             texture2D(pheromoneTex, vUv - vec2(0.0, texel.y)).r;
  float edge = length(vec2(dx, dy)) * 3.0;
  col += trailColor * edge * 0.2;

  gl_FragColor = vec4(col, 1.0);
}
`

// Display shader fallback without textureSize (for WebGL1 compat)
const DISPLAY_FRAG_COMPAT = `
precision highp float;
uniform sampler2D pheromoneTex;
uniform vec3 trailColor;
uniform vec3 bgColor;
uniform float contrast;
uniform float brightness;
uniform vec2 resolution;
varying vec2 vUv;

void main() {
  float val = texture2D(pheromoneTex, vUv).r;

  float tendrils = smoothstep(0.005, 0.08, val);
  float veins = smoothstep(0.03, 0.25, val);
  float hotspots = smoothstep(0.15, 0.6, val);

  float v = pow(tendrils, 1.0 / max(contrast, 0.1));

  vec3 col = bgColor;
  col = mix(col, trailColor * 0.4, tendrils * 0.6);
  col = mix(col, trailColor * brightness, veins);
  col += vec3(0.8, 0.9, 1.0) * hotspots * 0.5;

  vec2 texel = 1.0 / resolution;
  float dx = texture2D(pheromoneTex, vUv + vec2(texel.x, 0.0)).r -
             texture2D(pheromoneTex, vUv - vec2(texel.x, 0.0)).r;
  float dy = texture2D(pheromoneTex, vUv + vec2(0.0, texel.y)).r -
             texture2D(pheromoneTex, vUv - vec2(0.0, texel.y)).r;
  float edge = length(vec2(dx, dy)) * 3.0;
  col += trailColor * edge * 0.2;

  gl_FragColor = vec4(col, 1.0);
}
`

export default function Physarum({ params }: Props) {
  const agentCount = (params.agentCount as number) ?? 100000
  const sensorAngle = (params.sensorAngle as number) ?? 30
  const sensorDistance = (params.sensorDistance as number) ?? 20
  const turnSpeed = (params.turnSpeed as number) ?? 45
  const moveSpeed = (params.moveSpeed as number) ?? 1.5
  const decayRate = (params.decayRate as number) ?? 0.02
  const depositAmount = (params.depositAmount as number) ?? 5
  const diffuseSpeed = (params.diffuseSpeed as number) ?? 0.5
  const stepsPerFrame = (params.stepsPerFrame as number) ?? 4
  const spawnPattern = (params.spawnPattern as string) ?? 'center'
  const trailColor = (params.trailColor as string) ?? '#00ff88'
  const contrast = (params.contrast as number) ?? 1.5
  const brightness = (params.brightness as number) ?? 1.2
  const randomStrength = (params.randomStrength as number) ?? 0.5
  const simResolution = (params.simResolution as number) ?? 512

  const meshRef = useRef<THREE.Mesh>(null)
  const { gl } = useThree()
  const { mouse } = useInteraction()

  const SIM_SIZE = Math.min(1024, Math.max(256, simResolution))
  const agentSide = Math.min(512, Math.ceil(Math.sqrt(Math.min(agentCount, 262144))))
  const actualAgents = agentSide * agentSide

  const sim = useMemo(() => {
    // Initialize agent positions based on spawn pattern
    const agentData = new Float32Array(agentSide * agentSide * 4)
    for (let i = 0; i < actualAgents; i++) {
      let px: number, py: number, angle: number

      if (spawnPattern === 'center') {
        // Cluster agents near center with random angles pointing outward
        const r = Math.random() * 0.15 + 0.01
        const theta = Math.random() * Math.PI * 2
        px = 0.5 + Math.cos(theta) * r
        py = 0.5 + Math.sin(theta) * r
        angle = theta + Math.PI + (Math.random() - 0.5) * 1.0 // mostly pointing inward
      } else if (spawnPattern === 'ring') {
        // Agents on a ring pointing inward
        const theta = Math.random() * Math.PI * 2
        const r = 0.3 + (Math.random() - 0.5) * 0.05
        px = 0.5 + Math.cos(theta) * r
        py = 0.5 + Math.sin(theta) * r
        angle = theta + Math.PI + (Math.random() - 0.5) * 0.8
      } else if (spawnPattern === 'multi') {
        // Multiple spawn points
        const cluster = Math.floor(Math.random() * 5)
        const cx = [0.3, 0.7, 0.5, 0.25, 0.75][cluster]
        const cy = [0.3, 0.3, 0.7, 0.6, 0.6][cluster]
        const r = Math.random() * 0.08
        const theta = Math.random() * Math.PI * 2
        px = cx + Math.cos(theta) * r
        py = cy + Math.sin(theta) * r
        angle = Math.random() * Math.PI * 2
      } else {
        // random
        px = Math.random()
        py = Math.random()
        angle = Math.random() * Math.PI * 2
      }

      agentData[i * 4 + 0] = px
      agentData[i * 4 + 1] = py
      agentData[i * 4 + 2] = angle
      agentData[i * 4 + 3] = 0.8 + Math.random() * 0.4 // slight speed variation
    }

    const agentDataTex = new THREE.DataTexture(
      agentData, agentSide, agentSide,
      THREE.RGBAFormat, THREE.FloatType,
    )
    agentDataTex.needsUpdate = true
    agentDataTex.minFilter = THREE.NearestFilter
    agentDataTex.magFilter = THREE.NearestFilter

    const createRT = (w: number, h: number, filter: THREE.TextureFilter = THREE.LinearFilter) =>
      new THREE.WebGLRenderTarget(w, h, {
        minFilter: filter,
        magFilter: filter,
        format: THREE.RGBAFormat,
        type: THREE.FloatType,
      })

    const agentRT = [
      createRT(agentSide, agentSide, THREE.NearestFilter),
      createRT(agentSide, agentSide, THREE.NearestFilter),
    ]
    const pheromoneRT = [createRT(SIM_SIZE, SIM_SIZE), createRT(SIM_SIZE, SIM_SIZE)]

    // Init agent RT from data texture
    const initScene = new THREE.Scene()
    const initCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const initQuad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.MeshBasicMaterial({ map: agentDataTex }),
    )
    initScene.add(initQuad)
    gl.setRenderTarget(agentRT[0])
    gl.render(initScene, initCamera)
    gl.setRenderTarget(null)
    initQuad.geometry.dispose()
    ;(initQuad.material as THREE.MeshBasicMaterial).dispose()

    // Agent update material
    const agentMaterial = new THREE.ShaderMaterial({
      vertexShader: QUAD_VERT,
      fragmentShader: AGENT_FRAG,
      uniforms: {
        agentTex: { value: null },
        pheromoneTex: { value: null },
        sensorAngle: { value: sensorAngle },
        sensorDist: { value: sensorDistance },
        turnSpeed: { value: turnSpeed },
        moveSpeed: { value: moveSpeed },
        resolution: { value: new THREE.Vector2(SIM_SIZE, SIM_SIZE) },
        time: { value: 0 },
        randomStrength: { value: randomStrength },
      },
    })

    // Deposit material
    const agentUVs = new Float32Array(actualAgents * 2)
    for (let y = 0; y < agentSide; y++) {
      for (let x = 0; x < agentSide; x++) {
        const i = y * agentSide + x
        agentUVs[i * 2] = (x + 0.5) / agentSide
        agentUVs[i * 2 + 1] = (y + 0.5) / agentSide
      }
    }
    const depositGeom = new THREE.BufferGeometry()
    depositGeom.setAttribute('position', new THREE.BufferAttribute(
      new Float32Array(actualAgents * 3), 3,
    ))
    depositGeom.setAttribute('agentUV', new THREE.BufferAttribute(agentUVs, 2))

    const depositMaterial = new THREE.ShaderMaterial({
      vertexShader: DEPOSIT_VERT,
      fragmentShader: DEPOSIT_FRAG,
      uniforms: {
        agentTex: { value: null },
        depositAmount: { value: depositAmount },
      },
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
    })
    const depositPoints = new THREE.Points(depositGeom, depositMaterial)
    const depositScene = new THREE.Scene()
    const depositCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    depositScene.add(depositPoints)

    // Diffuse material
    const diffuseMaterial = new THREE.ShaderMaterial({
      vertexShader: QUAD_VERT,
      fragmentShader: DIFFUSE_FRAG,
      uniforms: {
        pheromoneTex: { value: null },
        decayRate: { value: decayRate },
        diffuseSpeed: { value: diffuseSpeed },
        resolution: { value: new THREE.Vector2(SIM_SIZE, SIM_SIZE) },
        mousePos: { value: new THREE.Vector2(0.5, 0.5) },
        mouseActive: { value: 0 },
      },
    })

    // Display material — use compat version to avoid textureSize issues
    const trailColorVec = new THREE.Color(trailColor)
    const displayMaterial = new THREE.ShaderMaterial({
      vertexShader: QUAD_VERT,
      fragmentShader: DISPLAY_FRAG_COMPAT,
      uniforms: {
        pheromoneTex: { value: null },
        trailColor: { value: trailColorVec },
        bgColor: { value: new THREE.Color(0x020208) },
        contrast: { value: contrast },
        brightness: { value: brightness },
        resolution: { value: new THREE.Vector2(SIM_SIZE, SIM_SIZE) },
      },
    })

    return {
      agentRT,
      pheromoneRT,
      agentMaterial,
      depositPoints,
      depositMaterial,
      depositScene,
      depositCamera,
      diffuseMaterial,
      displayMaterial,
      frame: 0,
    }
  }, [gl, agentSide, actualAgents, spawnPattern, SIM_SIZE])

  // Live-update uniforms when params change (no remount needed)
  useEffect(() => {
    sim.agentMaterial.uniforms.sensorAngle.value = sensorAngle
    sim.agentMaterial.uniforms.sensorDist.value = sensorDistance
    sim.agentMaterial.uniforms.turnSpeed.value = turnSpeed
    sim.agentMaterial.uniforms.moveSpeed.value = moveSpeed
    sim.agentMaterial.uniforms.randomStrength.value = randomStrength
    sim.diffuseMaterial.uniforms.decayRate.value = decayRate
    sim.diffuseMaterial.uniforms.diffuseSpeed.value = diffuseSpeed
    sim.depositMaterial.uniforms.depositAmount.value = depositAmount
    sim.displayMaterial.uniforms.trailColor.value.set(trailColor)
    sim.displayMaterial.uniforms.contrast.value = contrast
    sim.displayMaterial.uniforms.brightness.value = brightness
  }, [sim, sensorAngle, sensorDistance, turnSpeed, moveSpeed, decayRate, depositAmount, diffuseSpeed, trailColor, contrast, brightness, randomStrength])

  // Sim scene + quad for fullscreen passes
  const simScene = useMemo(() => new THREE.Scene(), [])
  const simCamera = useMemo(
    () => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1),
    [],
  )
  const simQuad = useMemo(() => {
    const geom = new THREE.PlaneGeometry(2, 2)
    return new THREE.Mesh(geom)
  }, [])

  useEffect(() => {
    simScene.add(simQuad)
    return () => { simScene.remove(simQuad) }
  }, [simScene, simQuad])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    const mouseUV = new THREE.Vector2(
      (mouse.x + 1) * 0.5,
      (mouse.y + 1) * 0.5,
    )

    // Run multiple simulation steps per frame for faster pattern development
    const steps = Math.min(stepsPerFrame, 16)
    for (let step = 0; step < steps; step++) {
      const src = sim.frame % 2
      const dst = 1 - src

      // Step 1: Update agent positions
      sim.agentMaterial.uniforms.agentTex.value = sim.agentRT[src].texture
      sim.agentMaterial.uniforms.pheromoneTex.value = sim.pheromoneRT[src].texture
      sim.agentMaterial.uniforms.time.value = t + step * 0.001
      simQuad.material = sim.agentMaterial
      gl.setRenderTarget(sim.agentRT[dst])
      gl.render(simScene, simCamera)

      // Step 2: Diffuse + decay existing pheromone
      sim.diffuseMaterial.uniforms.pheromoneTex.value = sim.pheromoneRT[src].texture
      sim.diffuseMaterial.uniforms.mousePos.value.copy(mouseUV)
      sim.diffuseMaterial.uniforms.mouseActive.value = 1
      simQuad.material = sim.diffuseMaterial
      gl.setRenderTarget(sim.pheromoneRT[dst])
      gl.render(simScene, simCamera)

      // Step 3: Deposit agent trails on top (additive blending)
      sim.depositMaterial.uniforms.agentTex.value = sim.agentRT[dst].texture
      gl.setRenderTarget(sim.pheromoneRT[dst])
      gl.render(sim.depositScene, sim.depositCamera)

      sim.frame++
    }

    gl.setRenderTarget(null)

    // Update display mesh
    const lastDst = sim.frame % 2 === 0 ? 0 : 1
    sim.displayMaterial.uniforms.pheromoneTex.value = sim.pheromoneRT[lastDst].texture
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
