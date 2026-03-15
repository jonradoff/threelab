import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { getNodeDef, CATEGORY_COLORS, PORT_TYPE_COLORS, type Category } from '../../nodes/types'

function PatternNodeComponent({ id, type, data, selected }: NodeProps) {
  const def = getNodeDef(type ?? '')
  if (!def) return null

  const catColor = CATEGORY_COLORS[def.category as Category] ?? '#666'
  const nodeData = (data ?? {}) as Record<string, unknown>

  return (
    <div
      className={`rounded-lg overflow-hidden text-xs min-w-[140px] ${
        selected ? 'ring-2 ring-white/40' : ''
      }`}
      style={{ background: '#1a1a2e', border: `1px solid ${catColor}40` }}
    >
      {/* Header */}
      <div
        className="px-2 py-1 text-[10px] font-semibold text-white/90 uppercase tracking-wider"
        style={{ background: catColor + '30', borderBottom: `1px solid ${catColor}40` }}
      >
        {def.label}
      </div>

      {/* Body: inline data fields */}
      {def.dataFields && def.dataFields.length > 0 && (
        <div className="px-2 py-1 space-y-1">
          {def.dataFields.map((field) => (
            <div key={field.name} className="flex items-center gap-1">
              <span className="text-[9px] text-gray-500 w-10 truncate">{field.label ?? field.name}</span>
              {field.type === 'number' && (
                <input
                  type="number"
                  value={(nodeData[field.name] as number) ?? field.default}
                  onChange={(e) => {
                    // Update via xyflow's data — handled by the store
                    const event = new CustomEvent('node-data-change', {
                      detail: { nodeId: id, field: field.name, value: parseFloat(e.target.value) || 0 },
                    })
                    window.dispatchEvent(event)
                  }}
                  className="flex-1 bg-black/40 border border-white/10 rounded px-1 py-0.5 text-[10px] text-gray-300 outline-none w-14"
                  step="any"
                />
              )}
              {field.type === 'string' && field.name === 'paramType' && (
                <select
                  value={(nodeData[field.name] as string) ?? field.default}
                  onChange={(e) => {
                    const event = new CustomEvent('node-data-change', {
                      detail: { nodeId: id, field: field.name, value: e.target.value },
                    })
                    window.dispatchEvent(event)
                  }}
                  className="flex-1 bg-black/40 border border-white/10 rounded px-1 py-0.5 text-[10px] text-gray-300 outline-none w-14"
                >
                  <option value="float">float</option>
                  <option value="int">int</option>
                  <option value="bool">bool</option>
                  <option value="enum">enum</option>
                </select>
              )}
              {field.type === 'string' && field.name !== 'paramType' && (
                <input
                  type="text"
                  value={(nodeData[field.name] as string) ?? field.default}
                  onChange={(e) => {
                    const event = new CustomEvent('node-data-change', {
                      detail: { nodeId: id, field: field.name, value: e.target.value },
                    })
                    window.dispatchEvent(event)
                  }}
                  className="flex-1 bg-black/40 border border-white/10 rounded px-1 py-0.5 text-[10px] text-gray-300 outline-none w-14"
                />
              )}
              {field.type === 'color' && (
                <input
                  type="color"
                  value={(nodeData[field.name] as string) ?? field.default}
                  onChange={(e) => {
                    const event = new CustomEvent('node-data-change', {
                      detail: { nodeId: id, field: field.name, value: e.target.value },
                    })
                    window.dispatchEvent(event)
                  }}
                  className="w-6 h-4 rounded border border-white/10 cursor-pointer"
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Ports */}
      <div className="relative px-2 py-1">
        {def.inputs.map((port, i) => (
          <div key={port.name} className="flex items-center h-5 relative">
            <Handle
              type="target"
              position={Position.Left}
              id={port.name}
              style={{
                background: PORT_TYPE_COLORS[port.type],
                width: 8,
                height: 8,
                border: '1px solid rgba(255,255,255,0.2)',
                top: 'auto',
                transform: 'none',
                position: 'relative',
                left: -8,
              }}
            />
            <span className="text-[9px] text-gray-500 ml-0">{port.name}</span>
          </div>
        ))}
        {def.outputs.map((port, i) => (
          <div key={port.name} className="flex items-center justify-end h-5 relative">
            <span className="text-[9px] text-gray-500 mr-0">{port.name}</span>
            <Handle
              type="source"
              position={Position.Right}
              id={port.name}
              style={{
                background: PORT_TYPE_COLORS[port.type],
                width: 8,
                height: 8,
                border: '1px solid rgba(255,255,255,0.2)',
                top: 'auto',
                transform: 'none',
                position: 'relative',
                right: -8,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export default memo(PatternNodeComponent)
