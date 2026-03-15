import { useState, useRef } from 'react'
import useStore from '../store/useStore'
import { generateStandaloneHTML } from '../export/generateStandaloneHTML'

interface Props {
  sceneName: string
  onClose: () => void
}

export default function ExportModal({ sceneName, onClose }: Props) {
  const currentScene = useStore((s) => s.currentScene)
  const [html, setHtml] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [copied, setCopied] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const handleGenerate = () => {
    if (!currentScene) return
    setError(null)
    try {
      const result = generateStandaloneHTML(currentScene)
      if (!result) {
        setError('Could not extract shader from this pattern. Only shader-based patterns can be exported.')
        return
      }
      setHtml(result)
    } catch (err) {
      setError(`Export failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleTest = () => {
    if (!html) return
    setTesting(true)
  }

  const handleDownload = () => {
    if (!html) return
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${sceneName || 'threelab-export'}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleCopy = async () => {
    if (!html) return
    try {
      await navigator.clipboard.writeText(html)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = html
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]"
      onClick={onClose}
    >
      <div
        className={`glass-panel-solid rounded-lg p-6 flex flex-col ${testing ? 'w-[800px] max-h-[90vh]' : 'w-[500px] max-h-[80vh]'}`}
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

        {!html && !error && (
          <>
            <p className="text-xs text-gray-400 mb-4">
              Export this pattern as a standalone HTML file. It includes everything needed to render the effect — just open it in a browser.
            </p>
            <button
              onClick={handleGenerate}
              className="w-full py-2 rounded bg-cyan-500/20 text-cyan-400 text-sm hover:bg-cyan-500/30 transition-colors"
            >
              Generate Export
            </button>
          </>
        )}

        {error && (
          <div className="text-xs text-red-400 bg-red-500/10 rounded p-3 mb-4">
            {error}
            <button
              onClick={() => { setError(null); setHtml(null) }}
              className="block mt-2 text-gray-400 hover:text-gray-200 underline"
            >
              Try again
            </button>
          </div>
        )}

        {html && (
          <>
            {/* Test preview */}
            {testing && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400">Live Preview</span>
                  <button
                    onClick={() => setTesting(false)}
                    className="text-[10px] text-gray-500 hover:text-gray-300"
                  >
                    Hide Preview
                  </button>
                </div>
                <div className="rounded overflow-hidden border border-white/10" style={{ height: 400 }}>
                  <iframe
                    ref={iframeRef}
                    srcDoc={html}
                    sandbox="allow-scripts allow-same-origin"
                    className="w-full h-full border-0"
                    title="Export Preview"
                  />
                </div>
              </div>
            )}

            {/* Code preview */}
            {!testing && (
              <div className="flex-1 min-h-0 mb-4">
                <pre className="bg-black/40 rounded p-3 text-[10px] text-gray-400 font-mono overflow-auto max-h-60 whitespace-pre-wrap break-all">
                  {html.length > 3000
                    ? html.slice(0, 3000) + '\n...(truncated)'
                    : html}
                </pre>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={handleTest}
                className={`flex-1 py-1.5 rounded text-xs transition-colors ${
                  testing
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                }`}
              >
                {testing ? 'Preview Active' : 'Test'}
              </button>
              <button
                onClick={handleDownload}
                className="flex-1 py-1.5 rounded bg-cyan-500/20 text-cyan-400 text-xs hover:bg-cyan-500/30 transition-colors"
              >
                Download HTML
              </button>
              <button
                onClick={handleCopy}
                className={`flex-1 py-1.5 rounded text-xs transition-colors ${
                  copied
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-fuchsia-500/20 text-fuchsia-400 hover:bg-fuchsia-500/30'
                }`}
              >
                {copied ? 'Copied!' : 'Copy HTML'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
