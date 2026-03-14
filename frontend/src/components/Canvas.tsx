import { Suspense, useState, useCallback, useRef, useEffect } from 'react'
import { Canvas as R3FCanvas, useThree } from '@react-three/fiber'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import useStore from '../store/useStore'
import { getPatternComponent } from '../patterns/PatternRegistry'
import {
  InteractionContext,
  type InteractionState,
} from '../systems/InteractionManager'

function LayerRenderer() {
  const currentScene = useStore((s) => s.currentScene)

  if (!currentScene) return null

  const { layers } = currentScene.genome

  return (
    <>
      {layers.map((layer, idx) => {
        if (!layer.enabled) return null
        const PatternComponent = getPatternComponent(layer.patternType)
        if (!PatternComponent) return null

        return (
          <group key={`${layer.patternType}-${idx}`} renderOrder={idx}>
            <Suspense fallback={null}>
              <PatternComponent params={layer.params} />
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

function CameraController() {
  const cameraDistance = useStore(
    (s) => s.currentScene?.genome.globalParams.cameraDistance ?? 500,
  )
  const { camera } = useThree()

  useEffect(() => {
    camera.position.z = cameraDistance
    camera.updateProjectionMatrix()
  }, [cameraDistance, camera])

  return null
}

export default function AppCanvas() {
  const bgColor = useStore(
    (s) => s.currentScene?.genome.globalParams.backgroundColor ?? '#0a0a0f',
  )
  const cameraDistance = useStore(
    (s) => s.currentScene?.genome.globalParams.cameraDistance ?? 500,
  )
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

  return (
    <div
      className="absolute inset-0"
      onPointerMove={handlePointerMove}
    >
      <InteractionContext.Provider value={interaction}>
        <R3FCanvas
          camera={{ position: [0, 0, cameraDistance], fov: 60, near: 0.1, far: 10000 }}
          gl={{
            antialias: true,
            toneMapping: THREE.NoToneMapping,
            outputColorSpace: THREE.SRGBColorSpace,
          }}
          style={{ background: bgColor }}
        >
          <CameraController />
          <LayerRenderer />
          <PostProcessing />
        </R3FCanvas>
      </InteractionContext.Provider>

      {/* FPS toggle */}
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
    </div>
  )
}
