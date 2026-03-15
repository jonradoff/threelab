import { Suspense, useState, useCallback, useRef, useEffect } from 'react'
import { Canvas as R3FCanvas, useThree, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import useStore from '../store/useStore'
import { getPatternComponent, getDefaultParams } from '../patterns/PatternRegistry'
import { reportRender } from '../api/client'
import {
  InteractionContext,
  type InteractionState,
} from '../systems/InteractionManager'

const DEG2RAD = Math.PI / 180
const RAD2DEG = 180 / Math.PI

function LayerRenderer() {
  const currentScene = useStore((s) => s.currentScene)
  const lastSnapshotRef = useRef('')

  // Report renders whenever the active layer configuration changes
  // This fires on: shuffle, surprise me, layer add/remove/switch, pattern change
  const layers = currentScene?.genome.layers
  useEffect(() => {
    if (!layers) return
    // Build a snapshot of current layer state to detect meaningful changes
    const snapshot = layers
      .filter((l) => l.enabled)
      .map((l) => `${l.patternType}:${JSON.stringify(l.params)}`)
      .join('|')
    if (snapshot !== lastSnapshotRef.current) {
      lastSnapshotRef.current = snapshot
      for (const layer of layers) {
        if (layer.enabled) reportRender(layer.patternType)
      }
    }
  }, [layers])

  if (!currentScene) return null

  return (
    <>
      {layers.map((layer, idx) => {
        if (!layer.enabled) return null
        const PatternComponent = getPatternComponent(layer.patternType)
        if (!PatternComponent) return null

        // Ensure migrated patterns have __graphId from registry defaults
        // (old favorites/saved scenes may lack it)
        const defaults = getDefaultParams(layer.patternType)
        const params = defaults.__graphId && !layer.params.__graphId
          ? { ...defaults, ...layer.params }
          : layer.params

        return (
          <group key={`${layer.patternType}-${idx}`} renderOrder={idx}>
            <Suspense fallback={null}>
              <PatternComponent params={{ ...params, __layerIndex: idx }} />
            </Suspense>
          </group>
        )
      })}
    </>
  )
}

function PostProcessing() {
  const globalParams = useStore((s) => s.currentScene?.genome.globalParams)
  if (!globalParams) return null

  return (
    <EffectComposer>
      <Bloom
        intensity={globalParams.bloomStrength}
        luminanceThreshold={globalParams.bloomThreshold}
        luminanceSmoothing={globalParams.bloomRadius}
        mipmapBlur
      />
    </EffectComposer>
  )
}

/**
 * Converts spherical (azimuth, polar, distance) to camera position.
 * azimuth=0, polar=90 => camera at (0, 0, distance) looking at origin.
 */
function sphericalToPosition(azimuthDeg: number, polarDeg: number, distance: number): [number, number, number] {
  const azimuth = azimuthDeg * DEG2RAD
  const polar = polarDeg * DEG2RAD
  const x = distance * Math.sin(polar) * Math.sin(azimuth)
  const y = distance * Math.cos(polar)
  const z = distance * Math.sin(polar) * Math.cos(azimuth)
  return [x, y, z]
}

function CameraController() {
  const globalParams = useStore(
    (s) => s.currentScene?.genome.globalParams,
  )
  const updateGlobalParams = useStore((s) => s.updateGlobalParams)
  const { camera } = useThree()
  const controlsRef = useRef<ReturnType<typeof OrbitControls> extends React.ReactElement<infer P> ? P : never>(null)
  // Track whether we're programmatically updating (to avoid feedback loop)
  const programmaticRef = useRef(false)
  // Track last store values to detect external slider changes
  const lastStoreRef = useRef({
    distance: 0, azimuth: 0, polar: 0,
    targetX: 0, targetY: 0, targetZ: 0,
  })

  const distance = globalParams?.cameraDistance ?? 500
  const azimuth = globalParams?.cameraAzimuth ?? 0
  const polar = globalParams?.cameraPolar ?? 90
  const targetX = globalParams?.cameraTargetX ?? 0
  const targetY = globalParams?.cameraTargetY ?? 0
  const targetZ = globalParams?.cameraTargetZ ?? 0

  // Apply store values to camera when they change from sliders
  useEffect(() => {
    const last = lastStoreRef.current
    const changed = (
      last.distance !== distance ||
      last.azimuth !== azimuth ||
      last.polar !== polar ||
      last.targetX !== targetX ||
      last.targetY !== targetY ||
      last.targetZ !== targetZ
    )
    if (!changed) return

    lastStoreRef.current = { distance, azimuth, polar, targetX, targetY, targetZ }

    programmaticRef.current = true
    const [x, y, z] = sphericalToPosition(azimuth, polar, distance)
    camera.position.set(x, y, z)
    camera.lookAt(targetX, targetY, targetZ)
    camera.updateProjectionMatrix()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const controls = controlsRef.current as any
    if (controls) {
      controls.target.set(targetX, targetY, targetZ)
      controls.update()
    }

    // Clear flag after a frame to allow OrbitControls change events through
    requestAnimationFrame(() => {
      programmaticRef.current = false
    })
  }, [distance, azimuth, polar, targetX, targetY, targetZ, camera])

  // Sync OrbitControls changes back to store (debounced)
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleControlsChange = useCallback(() => {
    if (programmaticRef.current) return

    // Debounce store updates to avoid overwhelming Zustand during drag
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
    syncTimerRef.current = setTimeout(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const controls = controlsRef.current as any
      if (!controls) return

      const pos = camera.position
      const target = controls.target as THREE.Vector3

      // Derive spherical from camera position relative to target
      const dx = pos.x - target.x
      const dy = pos.y - target.y
      const dz = pos.z - target.z
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)

      if (dist < 0.001) return

      const polarRad = Math.acos(Math.max(-1, Math.min(1, dy / dist)))
      const azimuthRad = Math.atan2(dx, dz)

      const newDistance = Math.round(dist)
      const newAzimuth = Math.round(azimuthRad * RAD2DEG * 10) / 10
      const newPolar = Math.round(polarRad * RAD2DEG * 10) / 10
      const newTargetX = Math.round(target.x * 100) / 100
      const newTargetY = Math.round(target.y * 100) / 100
      const newTargetZ = Math.round(target.z * 100) / 100

      // Update last known values to prevent feedback loop
      lastStoreRef.current = {
        distance: newDistance, azimuth: newAzimuth, polar: newPolar,
        targetX: newTargetX, targetY: newTargetY, targetZ: newTargetZ,
      }

      updateGlobalParams({
        cameraDistance: newDistance,
        cameraAzimuth: newAzimuth,
        cameraPolar: newPolar,
        cameraTargetX: newTargetX,
        cameraTargetY: newTargetY,
        cameraTargetZ: newTargetZ,
      })
    }, 50)
  }, [camera, updateGlobalParams])

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping={false}
      onChange={handleControlsChange}
    />
  )
}

export default function AppCanvas() {
  const bgColor = useStore(
    (s) => s.currentScene?.genome.globalParams.backgroundColor ?? '#0a0a0f',
  )
  const globalParams = useStore(
    (s) => s.currentScene?.genome.globalParams,
  )
  const cameraDistance = globalParams?.cameraDistance ?? 500
  const cameraAzimuth = globalParams?.cameraAzimuth ?? 0
  const cameraPolar = globalParams?.cameraPolar ?? 90

  const fullscreen = useStore((s) => s.fullscreen)
  const [showFps, setShowFps] = useState(false)
  const fpsRef = useRef<HTMLDivElement>(null)
  const frameTimesRef = useRef<number[]>([])

  const [interaction, setInteraction] = useState<InteractionState>({
    mouse: { x: 0, y: 0 },
    mouseVelocity: { x: 0, y: 0 },
    scrollY: 0,
  })

  const prevMouse = useRef({ x: 0, y: 0 })

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      const vx = x - prevMouse.current.x
      const vy = y - prevMouse.current.y
      prevMouse.current = { x, y }
      setInteraction((prev) => ({
        ...prev,
        mouse: { x, y },
        mouseVelocity: { x: vx, y: vy },
      }))
    },
    [],
  )

  // FPS counter
  useEffect(() => {
    if (!showFps) return
    let frameId: number
    const tick = () => {
      const now = performance.now()
      frameTimesRef.current.push(now)
      // Keep last 60 frames
      while (
        frameTimesRef.current.length > 0 &&
        now - frameTimesRef.current[0] > 1000
      ) {
        frameTimesRef.current.shift()
      }
      if (fpsRef.current) {
        fpsRef.current.textContent = `${frameTimesRef.current.length} fps`
      }
      frameId = requestAnimationFrame(tick)
    }
    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [showFps])

  // Compute initial camera position from spherical coords
  const initialPos = sphericalToPosition(cameraAzimuth, cameraPolar, cameraDistance)

  return (
    <div
      className="absolute inset-0"
      onPointerMove={handlePointerMove}
    >
      <InteractionContext.Provider value={interaction}>
        <R3FCanvas
          camera={{ position: initialPos, fov: 60, near: 0.1, far: 10000 }}
          gl={{
            antialias: true,
            toneMapping: THREE.NoToneMapping,
            outputColorSpace: THREE.SRGBColorSpace,
          }}
          style={{ background: bgColor }}
        >
          <ambientLight intensity={0.6} />
          <directionalLight position={[5, 5, 5]} intensity={0.8} />
          <CameraController />
          <LayerRenderer />
          <PostProcessing />
        </R3FCanvas>
      </InteractionContext.Provider>

      {/* FPS toggle — hidden in fullscreen */}
      {!fullscreen && (
        <>
          <button
            onClick={() => setShowFps((v) => !v)}
            className="absolute bottom-2 right-2 text-xs text-gray-600 hover:text-gray-400 transition-colors"
          >
            FPS
          </button>
          {showFps && (
            <div
              ref={fpsRef}
              className="absolute bottom-2 right-12 text-xs text-cyan-400 font-mono"
            >
              -- fps
            </div>
          )}
        </>
      )}
    </div>
  )
}
