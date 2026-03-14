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

// Simulation shader: reads current state, counts neighbors, applies rules
const SIM_FRAG = `
precision highp float;
uniform sampler2D stateTex;
uniform vec2 resolution;
uniform int ruleSet; // 0=life, 1=briansBrain, 2=wireworld, 3=highLife, 4=dayNight, 5=seeds
uniform bool wrap;
uniform bool invertRules;
uniform vec2 mousePos;
uniform float mouseActive;
uniform float drawSize;
uniform float ageColorSpeed;
varying vec2 vUv;

// State encoding:
// R channel: cell state (0=dead, 1=alive, for multi-state: 0=dead, 1=alive/head, 0.5=dying/tail, 0.75=conductor)
// G channel: age (how many frames alive)
// B channel: reserved

vec4 getCell(vec2 uv) {
  if (wrap) {
    return texture2D(stateTex, fract(uv));
  } else {
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
      return vec4(0.0);
    }
    return texture2D(stateTex, uv);
  }
}

bool isAlive(float state) {
  return state > 0.9;
}

bool isDying(float state) {
  return state > 0.4 && state < 0.6;
}

bool isConductor(float state) {
  return state > 0.7 && state < 0.8;
}

bool isHead(float state) {
  return state > 0.9;
}

bool isTail(float state) {
  return state > 0.4 && state < 0.6;
}

void main() {
  vec2 texel = 1.0 / resolution;
  vec4 current = texture2D(stateTex, vUv);
  float state = current.r;
  float age = current.g;

  // Count live neighbors
  int liveNeighbors = 0;
  int headNeighbors = 0;

  for (int dy = -1; dy <= 1; dy++) {
    for (int dx = -1; dx <= 1; dx++) {
      if (dx == 0 && dy == 0) continue;
      vec2 neighborUV = vUv + vec2(float(dx), float(dy)) * texel;
      vec4 neighbor = getCell(neighborUV);
      if (isAlive(neighbor.r)) {
        liveNeighbors++;
        headNeighbors++;
      }
    }
  }

  float newState = 0.0;
  float newAge = 0.0;

  // === Conway's Game of Life ===
  if (ruleSet == 0) {
    bool alive = isAlive(state);
    bool born = (!alive && liveNeighbors == 3);
    bool survive = (alive && (liveNeighbors == 2 || liveNeighbors == 3));
    if (invertRules) {
      born = (!alive && liveNeighbors != 3);
      survive = (alive && !(liveNeighbors == 2 || liveNeighbors == 3));
    }
    if (born || survive) {
      newState = 1.0;
      newAge = alive ? age + ageColorSpeed : 0.0;
    }
  }

  // === Brian's Brain ===
  else if (ruleSet == 1) {
    if (isAlive(state)) {
      // alive -> dying
      newState = 0.5;
      newAge = 0.0;
    } else if (isDying(state)) {
      // dying -> dead
      newState = 0.0;
      newAge = 0.0;
    } else {
      // dead -> alive if exactly 2 live neighbors
      bool born = (liveNeighbors == 2);
      if (invertRules) born = (liveNeighbors != 2);
      if (born) {
        newState = 1.0;
        newAge = 0.0;
      }
    }
  }

  // === Wireworld ===
  else if (ruleSet == 2) {
    if (isHead(state)) {
      // electron head -> tail
      newState = 0.5;
      newAge = 0.0;
    } else if (isTail(state)) {
      // electron tail -> conductor
      newState = 0.75;
      newAge = 0.0;
    } else if (isConductor(state)) {
      // conductor -> head if 1 or 2 head neighbors
      // recount heads specifically for wireworld
      int heads = 0;
      for (int dy = -1; dy <= 1; dy++) {
        for (int dx = -1; dx <= 1; dx++) {
          if (dx == 0 && dy == 0) continue;
          vec2 neighborUV = vUv + vec2(float(dx), float(dy)) * texel;
          vec4 neighbor = getCell(neighborUV);
          if (isHead(neighbor.r)) heads++;
        }
      }
      bool becomeHead = (heads == 1 || heads == 2);
      if (invertRules) becomeHead = !(heads == 1 || heads == 2);
      if (becomeHead) {
        newState = 1.0;
      } else {
        newState = 0.75;
      }
      newAge = 0.0;
    }
    // dead stays dead in wireworld
  }

  // === HighLife ===
  else if (ruleSet == 3) {
    bool alive = isAlive(state);
    bool born = (!alive && (liveNeighbors == 3 || liveNeighbors == 6));
    bool survive = (alive && (liveNeighbors == 2 || liveNeighbors == 3));
    if (invertRules) {
      born = (!alive && !(liveNeighbors == 3 || liveNeighbors == 6));
      survive = (alive && !(liveNeighbors == 2 || liveNeighbors == 3));
    }
    if (born || survive) {
      newState = 1.0;
      newAge = alive ? age + ageColorSpeed : 0.0;
    }
  }

  // === Day & Night ===
  else if (ruleSet == 4) {
    bool alive = isAlive(state);
    // B3678/S34678
    bool born = (!alive && (liveNeighbors == 3 || liveNeighbors == 6 || liveNeighbors == 7 || liveNeighbors == 8));
    bool survive = (alive && (liveNeighbors == 3 || liveNeighbors == 4 || liveNeighbors == 6 || liveNeighbors == 7 || liveNeighbors == 8));
    if (invertRules) {
      born = !born && !alive;
      survive = !survive && alive;
    }
    if (born || survive) {
      newState = 1.0;
      newAge = alive ? age + ageColorSpeed : 0.0;
    }
  }

  // === Seeds ===
  else if (ruleSet == 5) {
    bool alive = isAlive(state);
    if (alive) {
      // all cells die every generation
      newState = 0.0;
    } else {
      bool born = (liveNeighbors == 2);
      if (invertRules) born = (liveNeighbors != 2);
      if (born) {
        newState = 1.0;
        newAge = 0.0;
      }
    }
  }

  // Mouse drawing
  if (mouseActive > 0.5) {
    float dist = distance(vUv, mousePos) * resolution.x;
    if (dist < drawSize) {
      newState = 1.0;
      newAge = 0.0;
    }
  }

  gl_FragColor = vec4(newState, newAge, 0.0, 1.0);
}
`

// Display shader: maps state values to colors
const DISPLAY_FRAG = `
precision highp float;
uniform sampler2D stateTex;
uniform vec3 aliveColor;
uniform vec3 deadColor;
uniform vec3 dyingColor;
uniform vec3 wireColor;
uniform int ruleSet;
uniform bool colorByAge;
uniform bool showGrid;
uniform vec2 resolution;
uniform float zoom;
varying vec2 vUv;

vec3 hueShift(vec3 color, float shift) {
  float angle = shift * 6.28318;
  float s = sin(angle);
  float c = cos(angle);
  vec3 k = vec3(0.57735);
  return color * c + cross(k, color) * s + k * dot(k, color) * (1.0 - c);
}

void main() {
  // Apply zoom
  vec2 uv = (vUv - 0.5) / zoom + 0.5;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    gl_FragColor = vec4(deadColor, 1.0);
    return;
  }

  vec4 cell = texture2D(stateTex, uv);
  float state = cell.r;
  float age = cell.g;

  vec3 col = deadColor;

  if (ruleSet == 2) {
    // Wireworld: head=alive, tail=dying, conductor=wire
    if (state > 0.9) {
      col = aliveColor; // electron head
    } else if (state > 0.4 && state < 0.6) {
      col = dyingColor; // electron tail
    } else if (state > 0.7 && state < 0.8) {
      col = wireColor; // conductor
    }
  } else if (ruleSet == 1) {
    // Brian's Brain
    if (state > 0.9) {
      col = aliveColor;
    } else if (state > 0.4 && state < 0.6) {
      col = dyingColor;
    }
  } else {
    // Binary automata
    if (state > 0.9) {
      col = aliveColor;
      if (colorByAge) {
        col = hueShift(aliveColor, fract(age * 0.02));
      }
    }
  }

  // Grid lines
  if (showGrid) {
    vec2 gridPos = uv * resolution;
    vec2 gridLine = abs(fract(gridPos) - 0.5);
    float line = 1.0 - smoothstep(0.0, 0.05, min(gridLine.x, gridLine.y));
    col = mix(col, vec3(0.15), line * 0.4);
  }

  gl_FragColor = vec4(col, 1.0);
}
`

export default function CellularAutomata({ params }: Props) {
  const ruleSet = (params.ruleSet as string) ?? 'life'
  const gridSize = (params.gridSize as number) ?? 512
  const fillDensity = (params.fillDensity as number) ?? 0.3
  const stepsPerFrame = (params.stepsPerFrame as number) ?? 1
  const aliveColor = (params.aliveColor as string) ?? '#00ff88'
  const deadColor = (params.deadColor as string) ?? '#050510'
  const dyingColor = (params.dyingColor as string) ?? '#ff4444'
  const wireColor = (params.wireColor as string) ?? '#ffaa00'
  const zoom = (params.zoom as number) ?? 1
  const wrap = (params.wrap as boolean) ?? true
  const colorByAge = (params.colorByAge as boolean) ?? false
  const ageColorSpeed = (params.ageColorSpeed as number) ?? 0.1
  const seedPattern = (params.seedPattern as string) ?? 'random'
  const drawSize = (params.drawSize as number) ?? 3
  const showGrid = (params.showGrid as boolean) ?? false
  const invertRules = (params.invertRules as boolean) ?? false

  const meshRef = useRef<THREE.Mesh>(null)
  const { gl } = useThree()
  const { mouse } = useInteraction()

  const ruleSetIndex = useMemo(() => {
    const map: Record<string, number> = {
      life: 0, briansBrain: 1, wireworld: 2, highLife: 3, dayNight: 4, seeds: 5,
    }
    return map[ruleSet] ?? 0
  }, [ruleSet])

  const SIM_SIZE = Math.min(2048, Math.max(64, gridSize))

  const sim = useMemo(() => {
    // Build initial state data
    const data = new Float32Array(SIM_SIZE * SIM_SIZE * 4)

    if (seedPattern === 'gliders') {
      // Place several gliders
      const glider = [
        [0, 1], [1, 2], [2, 0], [2, 1], [2, 2],
      ]
      for (let g = 0; g < 12; g++) {
        const ox = Math.floor(Math.random() * (SIM_SIZE - 10)) + 3
        const oy = Math.floor(Math.random() * (SIM_SIZE - 10)) + 3
        for (const [dx, dy] of glider) {
          const idx = ((oy + dy) * SIM_SIZE + (ox + dx)) * 4
          data[idx] = 1.0
        }
      }
    } else if (seedPattern === 'oscillators') {
      // Place blinkers and toads
      const blinker = [[0, 0], [1, 0], [2, 0]]
      const toad = [[1, 0], [2, 0], [3, 0], [0, 1], [1, 1], [2, 1]]
      for (let i = 0; i < 20; i++) {
        const ox = Math.floor(Math.random() * (SIM_SIZE - 10)) + 5
        const oy = Math.floor(Math.random() * (SIM_SIZE - 10)) + 5
        const pattern = i % 2 === 0 ? blinker : toad
        for (const [dx, dy] of pattern) {
          const idx = ((oy + dy) * SIM_SIZE + (ox + dx)) * 4
          data[idx] = 1.0
        }
      }
    } else if (seedPattern === 'centered') {
      // Dense block in center
      const cx = Math.floor(SIM_SIZE / 2)
      const cy = Math.floor(SIM_SIZE / 2)
      const radius = Math.floor(SIM_SIZE * 0.1)
      for (let y = cy - radius; y <= cy + radius; y++) {
        for (let x = cx - radius; x <= cx + radius; x++) {
          if (x >= 0 && x < SIM_SIZE && y >= 0 && y < SIM_SIZE && Math.random() < fillDensity) {
            const idx = (y * SIM_SIZE + x) * 4
            data[idx] = 1.0
          }
        }
      }
    } else {
      // random
      for (let i = 0; i < SIM_SIZE * SIM_SIZE; i++) {
        if (Math.random() < fillDensity) {
          data[i * 4] = 1.0
          // For wireworld, randomly assign conductor vs head
          if (ruleSetIndex === 2) {
            const r = Math.random()
            if (r < 0.7) {
              data[i * 4] = 0.75 // conductor
            } else if (r < 0.9) {
              data[i * 4] = 1.0  // electron head
            } else {
              data[i * 4] = 0.5  // electron tail
            }
          }
        }
      }
    }

    const initTex = new THREE.DataTexture(
      data, SIM_SIZE, SIM_SIZE,
      THREE.RGBAFormat, THREE.FloatType,
    )
    initTex.needsUpdate = true
    initTex.minFilter = THREE.NearestFilter
    initTex.magFilter = THREE.NearestFilter

    const createRT = () =>
      new THREE.WebGLRenderTarget(SIM_SIZE, SIM_SIZE, {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        format: THREE.RGBAFormat,
        type: THREE.FloatType,
      })

    const stateRT = [createRT(), createRT()]

    // Initialize RT[0] from data texture
    const initScene = new THREE.Scene()
    const initCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const initQuad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.MeshBasicMaterial({ map: initTex }),
    )
    initScene.add(initQuad)
    gl.setRenderTarget(stateRT[0])
    gl.render(initScene, initCamera)
    gl.setRenderTarget(null)
    initQuad.geometry.dispose()
    ;(initQuad.material as THREE.MeshBasicMaterial).dispose()
    initTex.dispose()

    // Simulation material
    const simMaterial = new THREE.ShaderMaterial({
      vertexShader: QUAD_VERT,
      fragmentShader: SIM_FRAG,
      uniforms: {
        stateTex: { value: null },
        resolution: { value: new THREE.Vector2(SIM_SIZE, SIM_SIZE) },
        ruleSet: { value: ruleSetIndex },
        wrap: { value: wrap },
        invertRules: { value: invertRules },
        mousePos: { value: new THREE.Vector2(-1, -1) },
        mouseActive: { value: 0 },
        drawSize: { value: drawSize },
        ageColorSpeed: { value: ageColorSpeed },
      },
    })

    // Display material
    const displayMaterial = new THREE.ShaderMaterial({
      vertexShader: QUAD_VERT,
      fragmentShader: DISPLAY_FRAG,
      uniforms: {
        stateTex: { value: null },
        aliveColor: { value: new THREE.Color(aliveColor) },
        deadColor: { value: new THREE.Color(deadColor) },
        dyingColor: { value: new THREE.Color(dyingColor) },
        wireColor: { value: new THREE.Color(wireColor) },
        ruleSet: { value: ruleSetIndex },
        colorByAge: { value: colorByAge },
        showGrid: { value: showGrid },
        resolution: { value: new THREE.Vector2(SIM_SIZE, SIM_SIZE) },
        zoom: { value: zoom },
      },
    })

    return {
      stateRT,
      simMaterial,
      displayMaterial,
      frame: 0,
    }
  }, [gl, SIM_SIZE, fillDensity, seedPattern, ruleSetIndex])

  // Live-update uniforms
  useEffect(() => {
    sim.simMaterial.uniforms.ruleSet.value = ruleSetIndex
    sim.simMaterial.uniforms.wrap.value = wrap
    sim.simMaterial.uniforms.invertRules.value = invertRules
    sim.simMaterial.uniforms.drawSize.value = drawSize
    sim.simMaterial.uniforms.ageColorSpeed.value = ageColorSpeed
    sim.displayMaterial.uniforms.aliveColor.value.set(aliveColor)
    sim.displayMaterial.uniforms.deadColor.value.set(deadColor)
    sim.displayMaterial.uniforms.dyingColor.value.set(dyingColor)
    sim.displayMaterial.uniforms.wireColor.value.set(wireColor)
    sim.displayMaterial.uniforms.ruleSet.value = ruleSetIndex
    sim.displayMaterial.uniforms.colorByAge.value = colorByAge
    sim.displayMaterial.uniforms.showGrid.value = showGrid
    sim.displayMaterial.uniforms.zoom.value = zoom
  }, [sim, ruleSetIndex, wrap, invertRules, drawSize, ageColorSpeed, aliveColor, deadColor, dyingColor, wireColor, colorByAge, showGrid, zoom])

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

  useFrame(() => {
    const mouseUV = new THREE.Vector2(
      (mouse.x + 1) * 0.5,
      (mouse.y + 1) * 0.5,
    )

    const steps = Math.min(stepsPerFrame, 16)
    for (let step = 0; step < steps; step++) {
      const src = sim.frame % 2
      const dst = 1 - src

      sim.simMaterial.uniforms.stateTex.value = sim.stateRT[src].texture
      sim.simMaterial.uniforms.mousePos.value.copy(mouseUV)
      sim.simMaterial.uniforms.mouseActive.value = 1
      simQuad.material = sim.simMaterial
      gl.setRenderTarget(sim.stateRT[dst])
      gl.render(simScene, simCamera)

      sim.frame++
    }

    gl.setRenderTarget(null)

    // Update display mesh
    const lastDst = sim.frame % 2 === 0 ? 0 : 1
    sim.displayMaterial.uniforms.stateTex.value = sim.stateRT[lastDst].texture
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
