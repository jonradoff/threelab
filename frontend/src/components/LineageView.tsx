import { useEffect, useState } from 'react'
import * as api from '../api/client'
import useStore from '../store/useStore'
import type { LineageNode } from '../types/genome'

interface Props {
  sceneId: string
  onClose: () => void
}

function TreeNode({
  node,
  onSelect,
  depth,
}: {
  node: LineageNode
  onSelect: (id: string) => void
  depth: number
}) {
  return (
    <div style={{ marginLeft: depth * 20 }} className="mb-1">
      <button
        onClick={() => onSelect(node.id)}
        className="text-xs px-2 py-1 rounded hover:bg-white/10 transition-colors flex items-center gap-2"
      >
        <span className="w-2 h-2 rounded-full bg-cyan-400/60 inline-block" />
        <span className="text-gray-300">{node.name}</span>
        <span className="text-[10px] text-gray-600">
          Gen {node.generation}
          {node.mutationType ? ` (${node.mutationType})` : ''}
        </span>
      </button>
      {node.parents?.map((parent) => (
        <TreeNode
          key={parent.id}
          node={parent}
          onSelect={onSelect}
          depth={depth + 1}
        />
      ))}
    </div>
  )
}

export default function LineageView({ sceneId, onClose }: Props) {
  const [lineage, setLineage] = useState<LineageNode | null>(null)
  const [loading, setLoading] = useState(true)
  const setScene = useStore((s) => s.setScene)

  useEffect(() => {
    api
      .getLineage(sceneId)
      .then(setLineage)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [sceneId])

  const handleSelect = async (id: string) => {
    try {
      const scene = await api.getScene(id)
      setScene(scene)
      onClose()
    } catch (err) {
      console.error('Failed to load scene:', err)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]"
      onClick={onClose}
    >
      <div
        className="glass-panel-solid rounded-lg p-6 w-96 max-h-[70vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-200">
            Evolutionary Lineage
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300"
          >
            {'\u2715'}
          </button>
        </div>

        {loading ? (
          <p className="text-xs text-gray-500">Loading lineage...</p>
        ) : lineage ? (
          <TreeNode node={lineage} onSelect={handleSelect} depth={0} />
        ) : (
          <p className="text-xs text-gray-500">No lineage data available</p>
        )}
      </div>
    </div>
  )
}
