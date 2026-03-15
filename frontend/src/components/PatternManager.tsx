import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loadUserPatterns, deleteUserPattern, generatePatternId, saveUserPattern, type UserPatternGraph } from '../nodes/storage'

interface Props {
  onClose: () => void
}

function PatternRow({
  pattern,
  onEdit,
  onFork,
  onDelete,
}: {
  pattern: UserPatternGraph
  onEdit: (id: string) => void
  onFork: (p: UserPatternGraph) => void
  onDelete: (id: string) => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const isReadOnly = pattern.readOnly ?? false
  const paramCount = pattern.parameterSchema?.length ?? Object.keys(pattern.defaultParams).length

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-200 truncate">{pattern.name}</span>
          {isReadOnly && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 uppercase tracking-wider font-medium flex-shrink-0">
              Read Only
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-[10px] text-gray-600">{pattern.nodes.length} nodes</span>
          <span className="text-[10px] text-gray-600">{paramCount} params</span>
          {pattern.description && (
            <span className="text-[10px] text-gray-600 truncate">{pattern.description}</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onEdit(pattern.id)}
          className="text-[10px] px-2 py-1 rounded bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors"
        >
          {isReadOnly ? 'View' : 'Edit'}
        </button>
        <button
          onClick={() => onFork(pattern)}
          className="text-[10px] px-2 py-1 rounded bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors"
        >
          Fork
        </button>
        {!isReadOnly && (
          confirmDelete ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onDelete(pattern.id)}
                className="text-[10px] px-2 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
              >
                Confirm
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-[10px] px-1.5 py-1 text-gray-500 hover:text-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-[10px] px-2 py-1 rounded text-gray-600 hover:bg-red-500/10 hover:text-red-400 transition-colors"
            >
              Delete
            </button>
          )
        )}
      </div>
    </div>
  )
}

export default function PatternManager({ onClose }: Props) {
  const navigate = useNavigate()
  const [patterns, setPatterns] = useState<UserPatternGraph[]>(() => loadUserPatterns())

  const refresh = () => setPatterns(loadUserPatterns())

  const builtinPatterns = patterns.filter((p) => p.readOnly)
  const userPatterns = patterns.filter((p) => !p.readOnly)

  const handleEdit = (id: string) => {
    onClose()
    navigate(`/designer/${id}`)
  }

  const handleNew = () => {
    onClose()
    navigate('/designer')
  }

  const handleFork = (source: UserPatternGraph) => {
    const forked: UserPatternGraph = {
      ...source,
      id: generatePatternId(),
      name: `${source.name} (Fork)`,
      readOnly: false,
      nodes: JSON.parse(JSON.stringify(source.nodes)),
      edges: JSON.parse(JSON.stringify(source.edges)),
      defaultParams: { ...source.defaultParams },
      parameterSchema: source.parameterSchema ? [...source.parameterSchema] : undefined,
      customNodeDefs: source.customNodeDefs ? [...source.customNodeDefs] : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    saveUserPattern(forked)
    window.dispatchEvent(new CustomEvent('user-patterns-changed'))
    refresh()
    onClose()
    navigate(`/designer/${forked.id}`)
  }

  const handleDelete = (id: string) => {
    deleteUserPattern(id)
    window.dispatchEvent(new CustomEvent('user-patterns-changed'))
    refresh()
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]"
      onClick={onClose}
    >
      <div
        className="glass-panel-solid rounded-lg p-5 w-[520px] max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-200">Pattern Designer</h3>
          <button
            onClick={handleNew}
            className="text-xs px-3 py-1.5 rounded bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors"
          >
            + New Pattern
          </button>
        </div>

        {/* Built-in patterns */}
        {builtinPatterns.length > 0 && (
          <div className="mb-4">
            <div className="text-[10px] uppercase tracking-wider text-amber-400/60 font-medium mb-2">
              Built-in Patterns
            </div>
            <div className="space-y-1.5">
              {builtinPatterns.map((p) => (
                <PatternRow
                  key={p.id}
                  pattern={p}
                  onEdit={handleEdit}
                  onFork={handleFork}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </div>
        )}

        {/* User patterns */}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-cyan-400/60 font-medium mb-2">
            Your Patterns
          </div>
          {userPatterns.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-gray-500 mb-1">No custom patterns yet</p>
              <p className="text-[10px] text-gray-600">
                Create a new pattern or fork a built-in to get started
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {userPatterns.map((p) => (
                <PatternRow
                  key={p.id}
                  pattern={p}
                  onEdit={handleEdit}
                  onFork={handleFork}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
