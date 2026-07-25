import { useState } from 'react'
import { Search } from 'lucide-react'

export interface ModelOption {
  id: string
  name: string
  pricing: Record<string, number>
  context_length: number
}

function fmtPrice(p: Record<string, number>) {
  const pp = (p?.prompt || 0) * 1e6
  const cp = (p?.completion || 0) * 1e6
  if (!pp && !cp) return ''
  return `$${pp.toFixed(2)}/M · $${cp.toFixed(2)}/M out`
}

interface ModelSelectorProps {
  models: ModelOption[]
  model: string
  onModelSelect: (id: string) => void
  onToggleManual: () => void
  manual: boolean
}

export default function ModelSelector({ models, model, onModelSelect, onToggleManual, manual }: ModelSelectorProps) {
  const [modelFilter, setModelFilter] = useState('')
  const filtered = models.filter((m) =>
    m.id.toLowerCase().includes(modelFilter.toLowerCase())
  )

  if (manual) {
    return (
      <input
        type="text" value={model}
        onChange={(e) => onModelSelect(e.target.value)}
        placeholder="Type model ID..."
        className="w-full bg-warm-bg border border-warm-border rounded-lg px-3 py-2 text-sm text-warm-text placeholder-warm-muted focus:outline-none focus:ring-2 focus:ring-blue"
      />
    )
  }

  return (
    <div className="space-y-2">
      {models.length > 20 && (
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-warm-muted" />
          <input
            type="text" value={modelFilter}
            onChange={(e) => setModelFilter(e.target.value)}
            placeholder="Search models..."
            className="w-full bg-warm-bg border border-warm-border rounded-lg pl-8 pr-3 py-2 text-sm text-warm-text placeholder-warm-muted focus:outline-none focus:ring-2 focus:ring-blue"
          />
        </div>
      )}

      {models.length === 0 ? (
        <div className="text-warm-muted text-sm py-4 text-center">
          {modelFilter ? 'No models match.' : 'Enter an API key to load models.'}
        </div>
      ) : (
        <div className="max-h-48 overflow-y-auto space-y-0.5 rounded-lg border border-warm-border p-1">
          {filtered.slice(0, 80).map((m) => (
            <button
              key={m.id}
              onClick={() => onModelSelect(m.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                model === m.id
                  ? 'bg-blue/15 text-blue border border-blue/25'
                  : 'text-warm-text hover:bg-warm-elevated'
              }`}
            >
              <div className="font-medium text-xs leading-tight">{m.id}</div>
              <div className="text-[10px] text-warm-muted mt-0.5">
                {fmtPrice(m.pricing)}
                {m.context_length ? ` · ${(m.context_length / 1000).toFixed(0)}K` : ''}
              </div>
            </button>
          ))}
          {filtered.length > 80 && (
            <div className="text-warm-muted text-[10px] text-center py-1">+{filtered.length - 80} more</div>
          )}
        </div>
      )}
    </div>
  )
}