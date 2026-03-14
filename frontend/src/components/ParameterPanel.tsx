import { useState, useCallback } from 'react'
import { HexColorPicker } from 'react-colorful'
import useStore from '../store/useStore'
import type { ParameterSchema } from '../types/genome'
import { buildShareUrl } from '../utils/shareLink'
import * as api from '../api/client'

function randomHexColor(): string {
  return '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')
}

export default function ParameterPanel() {
  const currentScene = useStore((s) => s.currentScene)
  const selectedLayerIndex = useStore((s) => s.selectedLayerIndex)
  const patternSchemas = useStore((s) => s.patternSchemas)
  const updateLayerParams = useStore((s) => s.updateLayerParams)
  const updateGlobalParams = useStore((s) => s.updateGlobalParams)
  const favorites = useStore((s) => s.favorites)
  const addFavorite = useStore((s) => s.addFavorite)
  const removeFavorite = useStore((s) => s.removeFavorite)

  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
    pattern: true,
    global: false,
    bloom: false,
    mouse: false,
    palette: false,
    animation: false,
  })
  const [activeColorPicker, setActiveColorPicker] = useState<string | null>(
    null,
  )
  const [lockedParams, setLockedParams] = useState<Record<string, boolean>>({})
  const [shareTooltip, setShareTooltip] = useState<string | null>(null)

  const toggleSection = useCallback(
    (key: string) =>
      setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] })),
    [],
  )

  const toggleLock = useCallback(
    (paramName: string) =>
      setLockedParams((prev) => ({ ...prev, [paramName]: !prev[paramName] })),
    [],
  )

  if (!currentScene) return null

  const layer = currentScene.genome.layers[selectedLayerIndex]
  const schema = layer ? patternSchemas[layer.patternType] : null
  const globalParams = currentScene.genome.globalParams

  const handleParamChange = (name: string, value: unknown) => {
    updateLayerParams(selectedLayerIndex, { [name]: value })
  }

  const randomizeParamsForSchema = (
    schemaToUse: { parameters: ParameterSchema[] },
    layerParams: Record<string, unknown>,
  ): Record<string, unknown> => {
    const randomized: Record<string, unknown> = {}
    for (const param of schemaToUse.parameters) {
      if (lockedParams[param.name]) continue
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
          const current = layerParams[param.name]
          const arr = Array.isArray(current)
            ? (current as string[])
            : Array.isArray(param.default)
              ? (param.default as string[])
              : ['#ffffff']
          randomized[param.name] = arr.map(() => randomHexColor())
          break
        }
      }
    }
    return randomized
  }

  const randomizeParams = () => {
    if (!schema || !layer) return
    const randomized = randomizeParamsForSchema(schema, layer.params)
    updateLayerParams(selectedLayerIndex, randomized)
  }

  // Check if current layer params match an existing favorite
  const currentFavoriteId = layer
    ? favorites.find(
        (f) =>
          f.patternType === layer.patternType &&
          JSON.stringify(f.params) === JSON.stringify(layer.params),
      )?.id ?? null
    : null

  const toggleFavorite = () => {
    if (!layer || !currentScene) return
    if (currentFavoriteId) {
      removeFavorite(currentFavoriteId)
    } else {
      addFavorite({
        patternType: layer.patternType,
        params: { ...layer.params },
        cameraDistance: currentScene.genome.globalParams.cameraDistance,
      })
    }
  }

  const handleShare = async () => {
    if (!layer || !currentScene) return
    setShareTooltip('Creating...')
    try {
      const share = await api.createShare({
        patternType: layer.patternType,
        params: { ...layer.params },
        cameraDistance: currentScene.genome.globalParams.cameraDistance,
      })
      const url = buildShareUrl(share.code)
      await navigator.clipboard.writeText(url)
      setShareTooltip('Copied!')
      setTimeout(() => setShareTooltip(null), 2000)
    } catch {
      setShareTooltip('Share failed')
      setTimeout(() => setShareTooltip(null), 3000)
    }
  }

  const renderParam = (param: ParameterSchema) => {
    const value = layer?.params[param.name] ?? param.default
    const isLocked = !!lockedParams[param.name]

    const lockButton = (
      <button
        onClick={(e) => {
          e.stopPropagation()
          toggleLock(param.name)
        }}
        className={`w-4 h-4 flex-shrink-0 text-[10px] leading-none flex items-center justify-center rounded transition-all ${
          isLocked
            ? 'text-cyan-400 opacity-100'
            : 'text-gray-500 opacity-40 hover:opacity-80'
        }`}
        title={isLocked ? 'Unlock (shuffle will change this)' : 'Lock (shuffle will skip this)'}
      >
        {isLocked ? '\uD83D\uDD12' : '\uD83D\uDD13'}
      </button>
    )

    if (param.type === 'float' || param.type === 'int') {
      const numValue = typeof value === 'number' ? value : Number(param.default)
      const step = param.type === 'int' ? 1 : (param.max !== undefined && param.min !== undefined)
        ? (param.max - param.min) / 200
        : 0.01

      return (
        <div key={param.name} className={`mb-3 ${isLocked ? 'opacity-40' : ''}`}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1">
              {lockButton}
              <label
                className="text-[11px] text-gray-400"
                title={param.description}
              >
                {param.name}
              </label>
            </div>
            <span className="text-[10px] text-gray-500 font-mono">
              {param.type === 'int' ? Math.round(numValue) : numValue.toFixed(3)}
            </span>
          </div>
          <input
            type="range"
            min={param.min ?? 0}
            max={param.max ?? 1}
            step={step}
            value={numValue}
            onChange={(e) => {
              const v = parseFloat(e.target.value)
              handleParamChange(
                param.name,
                param.type === 'int' ? Math.round(v) : v,
              )
            }}
            className="w-full"
          />
        </div>
      )
    }

    if (param.type === 'bool') {
      const boolValue = typeof value === 'boolean' ? value : Boolean(param.default)
      return (
        <div
          key={param.name}
          className={`mb-3 flex items-center justify-between ${isLocked ? 'opacity-40' : ''}`}
        >
          <div className="flex items-center gap-1">
            {lockButton}
            <label
              className="text-[11px] text-gray-400"
              title={param.description}
            >
              {param.name}
            </label>
          </div>
          <button
            onClick={() => handleParamChange(param.name, !boolValue)}
            className={`w-8 h-4 rounded-full transition-colors relative ${
              boolValue ? 'bg-cyan-500/40' : 'bg-white/10'
            }`}
          >
            <div
              className={`absolute top-0.5 w-3 h-3 rounded-full transition-all ${
                boolValue
                  ? 'left-4 bg-cyan-400'
                  : 'left-0.5 bg-gray-500'
              }`}
            />
          </button>
        </div>
      )
    }

    if (param.type === 'enum') {
      const strValue = typeof value === 'string' ? value : String(param.default)
      return (
        <div key={param.name} className={`mb-3 ${isLocked ? 'opacity-40' : ''}`}>
          <div className="flex items-center gap-1 mb-1">
            {lockButton}
            <label
              className="text-[11px] text-gray-400"
              title={param.description}
            >
              {param.name}
            </label>
          </div>
          <select
            value={strValue}
            onChange={(e) => handleParamChange(param.name, e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-gray-300 outline-none focus:border-cyan-400/30"
          >
            {param.enumValues?.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
      )
    }

    if (param.type === 'color') {
      const colorValue = typeof value === 'string' ? value : String(param.default)
      const isActive = activeColorPicker === param.name
      return (
        <div key={param.name} className={`mb-3 relative ${isLocked ? 'opacity-40' : ''}`}>
          <div className="flex items-center gap-1 mb-1">
            {lockButton}
            <label
              className="text-[11px] text-gray-400"
              title={param.description}
            >
              {param.name}
            </label>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                setActiveColorPicker(isActive ? null : param.name)
              }
              className="w-6 h-6 rounded border border-white/10"
              style={{ backgroundColor: colorValue }}
            />
            <span className="text-[10px] text-gray-500 font-mono">
              {colorValue}
            </span>
          </div>
          {isActive && (
            <div className="absolute z-50 mt-1 left-0">
              <div
                className="fixed inset-0"
                onClick={() => setActiveColorPicker(null)}
              />
              <div className="relative z-10">
                <HexColorPicker
                  color={colorValue}
                  onChange={(c) => handleParamChange(param.name, c)}
                />
              </div>
            </div>
          )}
        </div>
      )
    }

    if (param.type === 'colors') {
      const colorsValue = Array.isArray(value)
        ? (value as string[])
        : Array.isArray(param.default)
          ? (param.default as string[])
          : ['#ffffff']

      return (
        <div key={param.name} className={`mb-3 ${isLocked ? 'opacity-40' : ''}`}>
          <div className="flex items-center gap-1 mb-1">
            {lockButton}
            <label
              className="text-[11px] text-gray-400"
              title={param.description}
            >
              {param.name}
            </label>
          </div>
          <div className="flex flex-wrap gap-1">
            {colorsValue.map((c, ci) => (
              <div key={ci} className="relative">
                <button
                  onClick={() =>
                    setActiveColorPicker(
                      activeColorPicker === `${param.name}-${ci}`
                        ? null
                        : `${param.name}-${ci}`,
                    )
                  }
                  className="w-5 h-5 rounded border border-white/10"
                  style={{ backgroundColor: c }}
                />
                <button
                  onClick={() => {
                    const newColors = colorsValue.filter(
                      (_, j) => j !== ci,
                    )
                    handleParamChange(param.name, newColors)
                  }}
                  className="absolute -top-1 -right-1 w-3 h-3 bg-red-500/50 rounded-full text-[7px] text-white leading-none flex items-center justify-center hover:bg-red-500"
                >
                  {'\u2715'}
                </button>
                {activeColorPicker === `${param.name}-${ci}` && (
                  <div className="absolute z-50 mt-1 left-0">
                    <div
                      className="fixed inset-0"
                      onClick={() => setActiveColorPicker(null)}
                    />
                    <div className="relative z-10">
                      <HexColorPicker
                        color={c}
                        onChange={(newC) => {
                          const newColors = [...colorsValue]
                          newColors[ci] = newC
                          handleParamChange(param.name, newColors)
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
            <button
              onClick={() =>
                handleParamChange(param.name, [...colorsValue, '#ffffff'])
              }
              className="w-5 h-5 rounded border border-dashed border-white/20 text-[10px] text-gray-500 flex items-center justify-center hover:border-white/40"
            >
              +
            </button>
          </div>
        </div>
      )
    }

    return null
  }

  return (
    <div className="glass-panel absolute top-14 right-3 w-64 rounded-lg overflow-hidden z-40 max-h-[calc(100vh-120px)] overflow-y-auto">
      {/* Pattern parameters */}
      {layer && schema && (
        <div>
          <div className="flex items-center border-b border-white/5">
            <button
              onClick={() => toggleSection('pattern')}
              className="flex-1 px-3 py-2 flex items-center justify-between hover:bg-white/5 transition-colors"
            >
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                {schema.label || layer.patternType}
              </span>
              <span className="text-[10px] text-gray-600">
                {expandedSections.pattern ? '\u25BC' : '\u25B6'}
              </span>
            </button>
            <button
              onClick={toggleFavorite}
              className={`px-1.5 py-1 text-sm leading-none transition-colors ${
                currentFavoriteId
                  ? 'text-amber-400'
                  : 'text-gray-600 hover:text-amber-400'
              }`}
              title={currentFavoriteId ? 'Remove from favorites' : 'Add to favorites'}
            >
              {currentFavoriteId ? '\u2605' : '\u2606'}
            </button>
            <div className="relative">
              <button
                onClick={handleShare}
                className="px-1.5 py-1 text-[10px] font-medium text-fuchsia-400 bg-fuchsia-400/10 rounded hover:bg-fuchsia-400/20 transition-colors"
                title="Copy share link"
              >
                Share
              </button>
              {shareTooltip && (
                <div className="absolute top-full right-0 mt-1 px-2 py-1 bg-black/90 border border-white/10 rounded text-[10px] text-green-400 whitespace-nowrap z-50">
                  {shareTooltip}
                </div>
              )}
            </div>
            <button
              onClick={randomizeParams}
              className="px-2 py-1 mr-2 text-[10px] font-medium text-cyan-400 bg-cyan-400/10 rounded hover:bg-cyan-400/20 transition-colors"
              title="Shuffle unlocked parameters for this pattern"
            >
              Shuffle
            </button>
          </div>
          {expandedSections.pattern && (
            <div className="px-3 py-2">
              {schema.parameters.map((p) => renderParam(p))}
            </div>
          )}
        </div>
      )}

      {!layer && (
        <div className="px-3 py-6 text-center">
          <p className="text-xs text-gray-600">
            Select a layer to edit parameters
          </p>
        </div>
      )}

      {/* Global Parameters */}
      <div>
        <button
          onClick={() => toggleSection('bloom')}
          className="w-full px-3 py-2 flex items-center justify-between border-b border-white/5 hover:bg-white/5 transition-colors"
        >
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
            Bloom
          </span>
          <span className="text-[10px] text-gray-600">
            {expandedSections.bloom ? '\u25BC' : '\u25B6'}
          </span>
        </button>
        {expandedSections.bloom && (
          <div className="px-3 py-2">
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] text-gray-400">Strength</label>
                <span className="text-[10px] text-gray-500 font-mono">
                  {globalParams.bloomStrength.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={3}
                step={0.01}
                value={globalParams.bloomStrength}
                onChange={(e) =>
                  updateGlobalParams({
                    bloomStrength: parseFloat(e.target.value),
                  })
                }
                className="w-full"
              />
            </div>
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] text-gray-400">Radius</label>
                <span className="text-[10px] text-gray-500 font-mono">
                  {globalParams.bloomRadius.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={globalParams.bloomRadius}
                onChange={(e) =>
                  updateGlobalParams({
                    bloomRadius: parseFloat(e.target.value),
                  })
                }
                className="w-full"
              />
            </div>
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] text-gray-400">Threshold</label>
                <span className="text-[10px] text-gray-500 font-mono">
                  {globalParams.bloomThreshold.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={globalParams.bloomThreshold}
                onChange={(e) =>
                  updateGlobalParams({
                    bloomThreshold: parseFloat(e.target.value),
                  })
                }
                className="w-full"
              />
            </div>
          </div>
        )}
      </div>

      {/* Camera */}
      <div>
        <button
          onClick={() => toggleSection('camera')}
          className="w-full px-3 py-2 flex items-center justify-between border-b border-white/5 hover:bg-white/5 transition-colors"
        >
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
            Camera
          </span>
          <span className="text-[10px] text-gray-600">
            {expandedSections.camera ? '\u25BC' : '\u25B6'}
          </span>
        </button>
        {expandedSections.camera && (
          <div className="px-3 py-2">
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] text-gray-400">Distance / Zoom</label>
                <span className="text-[10px] text-gray-500 font-mono">
                  {(globalParams.cameraDistance ?? 500).toFixed(0)}
                </span>
              </div>
              <input
                type="range"
                min={5}
                max={2000}
                step={1}
                value={globalParams.cameraDistance ?? 500}
                onChange={(e) =>
                  updateGlobalParams({
                    cameraDistance: parseFloat(e.target.value),
                  })
                }
                className="w-full"
              />
            </div>
          </div>
        )}
      </div>

      {/* Background color */}
      <div>
        <button
          onClick={() => toggleSection('global')}
          className="w-full px-3 py-2 flex items-center justify-between border-b border-white/5 hover:bg-white/5 transition-colors"
        >
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
            Background
          </span>
          <span className="text-[10px] text-gray-600">
            {expandedSections.global ? '\u25BC' : '\u25B6'}
          </span>
        </button>
        {expandedSections.global && (
          <div className="px-3 py-2 relative">
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={() =>
                  setActiveColorPicker(
                    activeColorPicker === 'bg' ? null : 'bg',
                  )
                }
                className="w-6 h-6 rounded border border-white/10"
                style={{ backgroundColor: globalParams.backgroundColor }}
              />
              <span className="text-[10px] text-gray-500 font-mono">
                {globalParams.backgroundColor}
              </span>
            </div>
            {activeColorPicker === 'bg' && (
              <div className="absolute z-50 mt-1 right-3">
                <div
                  className="fixed inset-0"
                  onClick={() => setActiveColorPicker(null)}
                />
                <div className="relative z-10">
                  <HexColorPicker
                    color={globalParams.backgroundColor}
                    onChange={(c) =>
                      updateGlobalParams({ backgroundColor: c })
                    }
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Animation */}
      <div>
        <button
          onClick={() => toggleSection('animation')}
          className="w-full px-3 py-2 flex items-center justify-between border-b border-white/5 hover:bg-white/5 transition-colors"
        >
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
            Animation
          </span>
          <span className="text-[10px] text-gray-600">
            {expandedSections.animation ? '\u25BC' : '\u25B6'}
          </span>
        </button>
        {expandedSections.animation && (
          <div className="px-3 py-2">
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] text-gray-400">Speed</label>
                <span className="text-[10px] text-gray-500 font-mono">
                  {globalParams.animation.speed.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={5}
                step={0.01}
                value={globalParams.animation.speed}
                onChange={(e) =>
                  updateGlobalParams({
                    animation: {
                      ...globalParams.animation,
                      speed: parseFloat(e.target.value),
                    },
                  })
                }
                className="w-full"
              />
            </div>
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] text-gray-400">Time Scale</label>
                <span className="text-[10px] text-gray-500 font-mono">
                  {globalParams.animation.timeScale.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={3}
                step={0.01}
                value={globalParams.animation.timeScale}
                onChange={(e) =>
                  updateGlobalParams({
                    animation: {
                      ...globalParams.animation,
                      timeScale: parseFloat(e.target.value),
                    },
                  })
                }
                className="w-full"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
