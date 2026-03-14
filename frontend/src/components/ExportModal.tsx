import { useState } from 'react'
import * as api from '../api/client'

interface Props {
  sceneId: string
  sceneName: string
  onClose: () => void
}

export default function ExportModal({ sceneId, sceneName, onClose }: Props) {
  const [format, setFormat] = useState<'html' | 'react' | 'json'>('json')
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    if (!sceneId) return
    setLoading(true)
    try {
      const response = await api.exportScene(sceneId, format)
      const text = await response.text()
      setPreview(text)
    } catch (err) {
      console.error('Export failed:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = () => {
    if (!preview) return
    const ext = format === 'html' ? 'html' : format === 'react' ? 'jsx' : 'json'
    const mimeType =
      format === 'html'
        ? 'text/html'
        : format === 'json'
          ? 'application/json'
          : 'text/plain'

    const blob = new Blob([preview], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${sceneName || 'threelab-scene'}.${ext}`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleCopy = async () => {
    if (!preview) return
    try {
      await navigator.clipboard.writeText(preview)
    } catch {
      // fallback
      const ta = document.createElement('textarea')
      ta.value = preview
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]"
      onClick={onClose}
    >
      <div
        className="glass-panel-solid rounded-lg p-6 w-[500px] max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-200">Export Scene</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300"
          >
            {'\u2715'}
          </button>
        </div>

        {/* Format selector */}
        <div className="flex gap-2 mb-4">
          {(['json', 'html', 'react'] as const).map((f) => (
            <button
              key={f}
              onClick={() => {
                setFormat(f)
                setPreview(null)
              }}
              className={`px-3 py-1.5 rounded text-xs transition-colors ${
                format === f
                  ? 'bg-cyan-500/20 text-cyan-400'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Generate button */}
        {!preview && (
          <button
            onClick={handleExport}
            disabled={loading || !sceneId}
            className="w-full py-2 rounded bg-cyan-500/20 text-cyan-400 text-sm hover:bg-cyan-500/30 transition-colors disabled:opacity-40 mb-4"
          >
            {loading ? 'Generating...' : 'Generate Export'}
          </button>
        )}

        {/* Preview */}
        {preview && (
          <>
            <div className="flex-1 min-h-0 mb-4">
              <pre className="bg-black/40 rounded p-3 text-[10px] text-gray-400 font-mono overflow-auto max-h-60 whitespace-pre-wrap break-all">
                {preview.length > 3000
                  ? preview.slice(0, 3000) + '\n...(truncated)'
                  : preview}
              </pre>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleDownload}
                className="flex-1 py-1.5 rounded bg-cyan-500/20 text-cyan-400 text-xs hover:bg-cyan-500/30 transition-colors"
              >
                Download
              </button>
              <button
                onClick={handleCopy}
                className="flex-1 py-1.5 rounded bg-fuchsia-500/20 text-fuchsia-400 text-xs hover:bg-fuchsia-500/30 transition-colors"
              >
                Copy to Clipboard
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
