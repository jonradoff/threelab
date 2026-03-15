import { getAllPatternTypes, getDefaultParams, getDefaultCameraDistance } from '../patterns/PatternRegistry'
import useStore from '../store/useStore'
import type { Layer } from '../types/genome'

interface Props {
  onClose: () => void
}

export default function PatternPicker({ onClose }: Props) {
  const addLayer = useStore((s) => s.addLayer)
  const updateGlobalParams = useStore((s) => s.updateGlobalParams)
  const allTypes = getAllPatternTypes()

  const customPatterns = allTypes.filter((t) => t.isUserPattern).sort((a, b) => a.label.localeCompare(b.label))
  const builtinPatterns = allTypes.filter((t) => !t.isUserPattern).sort((a, b) => a.label.localeCompare(b.label))

  const handleSelect = (type: string) => {
    const newLayer: Layer = {
      patternType: type,
      enabled: true,
      blendMode: 'additive',
      opacity: 1,
      params: getDefaultParams(type),
    }
    addLayer(newLayer)
    updateGlobalParams({ cameraDistance: getDefaultCameraDistance(type) })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]"
      onClick={onClose}
    >
      <div
        className="glass-panel-solid rounded-lg p-4 w-[480px] max-h-[70vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-medium text-gray-200 mb-4">
          Add Pattern Layer
        </h3>

        {/* Custom patterns section */}
        {customPatterns.length > 0 && (
          <>
            <div className="text-[10px] uppercase tracking-wider text-purple-400 font-medium mb-2">
              Custom Patterns
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {customPatterns.map(({ type, label, description }) => (
                <button
                  key={type}
                  onClick={() => handleSelect(type)}
                  className="text-left p-3 rounded-lg bg-purple-500/5 border border-purple-500/10 hover:border-purple-400/30 hover:bg-purple-500/10 transition-all group"
                >
                  <div className="text-sm text-gray-200 group-hover:text-purple-300 transition-colors mb-1">
                    {label}
                  </div>
                  <p className="text-[10px] text-gray-500 leading-relaxed">
                    {description}
                  </p>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Built-in patterns */}
        {customPatterns.length > 0 && (
          <div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-2">
            Built-in Patterns
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          {builtinPatterns.map(({ type, label, description }) => (
            <button
              key={type}
              onClick={() => handleSelect(type)}
              className="text-left p-3 rounded-lg bg-white/5 border border-white/5 hover:border-cyan-400/30 hover:bg-cyan-500/5 transition-all group"
            >
              <div className="text-sm text-gray-200 group-hover:text-cyan-300 transition-colors mb-1">
                {label}
              </div>
              <p className="text-[10px] text-gray-500 leading-relaxed">
                {description}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
