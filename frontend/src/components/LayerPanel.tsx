import { useState } from 'react'
import useStore from '../store/useStore'
import PatternPicker from './PatternPicker'
import { getAllPatternTypes, getDefaultParams, getDefaultCameraDistance } from '../patterns/PatternRegistry'
import type { ParameterSchema } from '../types/genome'

function randomHexColor(): string {
  return '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')
}

const BLEND_MODES = ['normal', 'additive', 'multiply', 'screen']

export default function LayerPanel() {
  const currentScene = useStore((s) => s.currentScene)
  const selectedLayerIndex = useStore((s) => s.selectedLayerIndex)
  const selectLayer = useStore((s) => s.selectLayer)
  const updateLayer = useStore((s) => s.updateLayer)
  const removeLayer = useStore((s) => s.removeLayer)
  const reorderLayers = useStore((s) => s.reorderLayers)
  const setScene = useStore((s) => s.setScene)
  const patternSchemas = useStore((s) => s.patternSchemas)
  const [showPicker, setShowPicker] = useState(false)

  if (!currentScene) return null

  const layers = currentScene.genome.layers

  const randomizeEverything = () => {
    const allTypes = getAllPatternTypes()
    if (allTypes.length === 0) return

    const chosen = allTypes[Math.floor(Math.random() * allTypes.length)]
    const defaults = getDefaultParams(chosen.type)
    const chosenSchema = patternSchemas[chosen.type]

    // Randomize all params using schema ranges
    const randomized: Record<string, unknown> = {}
    if (chosenSchema) {
      for (const param of chosenSchema.parameters) {
        switch (param.type) {
          case 'float': {
            const min = param.min ?? 0
            const max = param.max ?? 1
            randomized[param.name] = min + Math.random() * (max - min)
            break
          }
          case 'int': {
            const min = param.min ?? 0
            const max = param.max ?? 100
            randomized[param.name] = Math.round(min + Math.random() * (max - min))
            break
          }
          case 'bool':
            randomized[param.name] = Math.random() < 0.5
            break
          case 'enum':
            if (param.enumValues && param.enumValues.length > 0) {
              randomized[param.name] =
                param.enumValues[Math.floor(Math.random() * param.enumValues.length)]
            }
            break
          case 'color':
            randomized[param.name] = randomHexColor()
            break
          case 'colors': {
            const arr = Array.isArray(param.default)
              ? (param.default as string[])
              : ['#ffffff']
            randomized[param.name] = arr.map(() => randomHexColor())
            break
          }
        }
      }
    }

    const newLayer = {
      patternType: chosen.type,
      enabled: true,
      blendMode: 'normal' as const,
      opacity: 1,
      params: { ...defaults, ...randomized },
    }

    setScene({
      ...currentScene,
      genome: {
        ...currentScene.genome,
        layers: [newLayer],
        globalParams: {
          ...currentScene.genome.globalParams,
          cameraDistance: getDefaultCameraDistance(chosen.type),
        },
      },
    })
  }

  return (
    <>
      <div className="glass-panel absolute top-14 left-3 w-56 rounded-lg overflow-hidden z-40">
        {/* Surprise Me — random pattern + random params */}
        <div className="px-3 py-2 border-b border-white/5">
          <button
            onClick={randomizeEverything}
            className="w-full py-2 text-sm font-bold text-black bg-gradient-to-r from-cyan-400 to-purple-500 rounded hover:from-cyan-300 hover:to-purple-400 transition-all active:scale-95"
            title="Pick a random pattern with random settings"
          >
            Surprise Me
          </button>
        </div>

        <div className="px-3 py-2 border-b border-white/5 flex items-center justify-between">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
            Layers
          </span>
          <button
            onClick={() => setShowPicker(true)}
            className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            + Add
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {layers.map((layer, idx) => (
            <div
              key={idx}
              onClick={() => selectLayer(idx)}
              className={`px-3 py-2 cursor-pointer border-b border-white/5 transition-colors ${
                idx === selectedLayerIndex
                  ? 'bg-cyan-500/10 border-l-2 border-l-cyan-400'
                  : 'hover:bg-white/5 border-l-2 border-l-transparent'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                {/* Visibility toggle */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    updateLayer(idx, { enabled: !layer.enabled })
                  }}
                  className={`text-xs ${
                    layer.enabled
                      ? 'text-gray-300'
                      : 'text-gray-600'
                  }`}
                  title={layer.enabled ? 'Visible' : 'Hidden'}
                >
                  {layer.enabled ? '\u25C9' : '\u25CE'}
                </button>

                <span className="text-xs text-gray-300 flex-1 truncate">
                  {layer.patternType}
                </span>

                {/* Reorder */}
                <div className="flex flex-col gap-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (idx > 0) reorderLayers(idx, idx - 1)
                    }}
                    className="text-[9px] text-gray-500 hover:text-gray-300 leading-none"
                    disabled={idx === 0}
                  >
                    {'\u25B2'}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (idx < layers.length - 1) reorderLayers(idx, idx + 1)
                    }}
                    className="text-[9px] text-gray-500 hover:text-gray-300 leading-none"
                    disabled={idx === layers.length - 1}
                  >
                    {'\u25BC'}
                  </button>
                </div>

                {/* Delete */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    removeLayer(idx)
                  }}
                  className="text-[10px] text-gray-600 hover:text-red-400 transition-colors"
                >
                  {'\u2715'}
                </button>
              </div>

              {/* Opacity + blend row */}
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={layer.opacity}
                  onChange={(e) => {
                    e.stopPropagation()
                    updateLayer(idx, { opacity: parseFloat(e.target.value) })
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 h-1"
                />
                <select
                  value={layer.blendMode}
                  onChange={(e) => {
                    e.stopPropagation()
                    updateLayer(idx, { blendMode: e.target.value })
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-transparent text-[10px] text-gray-500 outline-none cursor-pointer"
                >
                  {BLEND_MODES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}

          {layers.length === 0 && (
            <div className="px-3 py-6 text-center">
              <p className="text-xs text-gray-600">No layers yet</p>
              <button
                onClick={() => setShowPicker(true)}
                className="text-xs text-cyan-400 mt-2 hover:text-cyan-300"
              >
                Add a layer
              </button>
            </div>
          )}
        </div>
      </div>

      {showPicker && <PatternPicker onClose={() => setShowPicker(false)} />}
    </>
  )
}
