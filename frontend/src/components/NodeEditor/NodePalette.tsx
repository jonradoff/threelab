import { useState } from 'react'
import { getNodeDefsByCategory, CATEGORY_COLORS, type Category, type PatternNodeDef } from '../../nodes/types'

interface Props {
  position: { x: number; y: number }
  onAdd: (type: string, position: { x: number; y: number }) => void
  onClose: () => void
}

const CATEGORY_LABELS: Record<Category, string> = {
  input: 'Input',
  math: 'Math',
  generator: 'Generator',
  transform: 'Transform',
  color: 'Color',
  animation: 'Animation',
  output: 'Output',
}

export default function NodePalette({ position, onAdd, onClose }: Props) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Category | 'all'>('all')
  const byCategory = getNodeDefsByCategory()

  const categories: Category[] = ['input', 'math', 'generator', 'transform', 'color', 'animation', 'output']

  const filtered: PatternNodeDef[] = []
  for (const cat of categories) {
    if (filter !== 'all' && cat !== filter) continue
    for (const def of byCategory[cat]) {
      if (search && !def.label.toLowerCase().includes(search.toLowerCase()) && !def.type.includes(search.toLowerCase())) {
        continue
      }
      filtered.push(def)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50"
      onClick={onClose}
    >
      <div
        className="absolute rounded-lg overflow-hidden shadow-2xl"
        style={{
          left: Math.min(position.x, window.innerWidth - 260),
          top: Math.min(position.y, window.innerHeight - 400),
          background: '#12122a',
          border: '1px solid rgba(255,255,255,0.1)',
          width: 240,
          maxHeight: 380,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search */}
        <div className="p-2 border-b border-white/5">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search nodes..."
            className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-gray-300 outline-none focus:border-cyan-400/30"
            autoFocus
          />
        </div>

        {/* Category filter */}
        <div className="px-2 py-1 flex flex-wrap gap-1 border-b border-white/5">
          <button
            onClick={() => setFilter('all')}
            className={`px-1.5 py-0.5 rounded text-[9px] transition-colors ${
              filter === 'all' ? 'bg-white/20 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className="px-1.5 py-0.5 rounded text-[9px] transition-colors"
              style={{
                background: filter === cat ? CATEGORY_COLORS[cat] + '30' : 'transparent',
                color: filter === cat ? CATEGORY_COLORS[cat] : '#6b7280',
              }}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        {/* Results */}
        <div className="overflow-y-auto max-h-[260px]">
          {filtered.map((def) => (
            <button
              key={def.type}
              onClick={() => {
                onAdd(def.type, position)
                onClose()
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-white/5 transition-colors flex items-center gap-2 border-b border-white/3"
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: CATEGORY_COLORS[def.category] }}
              />
              <span className="text-xs text-gray-300">{def.label}</span>
              <span className="text-[9px] text-gray-600 ml-auto">{def.category}</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="px-3 py-4 text-center text-xs text-gray-600">
              No matching nodes
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
