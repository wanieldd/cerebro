import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import type { ModelOption } from '../types'

interface ChatModelSelectorProps {
  models: ModelOption[]
  currentModel: string
  onModelSelect: (id: string) => void
}

function fmtPrice(p: Record<string, number>) {
  const pp = (p?.prompt || 0) * 1e6
  const cp = (p?.completion || 0) * 1e6
  if (!pp && !cp) return ''
  return `$${pp.toFixed(2)}/M · $${cp.toFixed(2)}/M out`
}

export default function ChatModelSelector({ models, currentModel, onModelSelect }: ChatModelSelectorProps) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
        setFilter('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filtered = models.filter((m) =>
    m.id.toLowerCase().includes(filter.toLowerCase())
  )

  const displayModel = currentModel || 'Select model'

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2 py-1 text-xs text-warm-muted hover:text-warm-text rounded-md hover:bg-warm-elevated transition-colors"
      >
        <span className="max-w-[180px] truncate">{displayModel}</span>
        <ChevronDown size={12} className="shrink-0" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-72 bg-warm-surface border border-warm-border rounded-lg shadow-lg z-50">
          <div className="relative p-2 pb-1">
            <Search size={12} className="absolute left-4 top-1/2 -translate-y-1/2 text-warm-muted" />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search models..."
              className="w-full bg-warm-bg border border-warm-border rounded-md pl-6 pr-2 py-1.5 text-xs text-warm-text placeholder-warm-muted focus:outline-none focus:ring-1 focus:ring-blue"
              autoFocus
            />
          </div>
          <div className="max-h-56 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="text-warm-muted text-xs text-center py-4">No models match.</div>
            ) : (
              filtered.slice(0, 80).map((m) => (
                <button
                  key={m.id}
                  onClick={() => { onModelSelect(m.id); setOpen(false); setFilter('') }}
                  className={`w-full text-left px-3 py-2 rounded-md text-xs transition-colors ${
                    currentModel === m.id
                      ? 'bg-blue/15 text-blue'
                      : 'text-warm-text hover:bg-warm-elevated'
                  }`}
                >
                  <div className="font-medium leading-tight truncate">{m.id}</div>
                  <div className="text-[10px] text-warm-muted mt-0.5">
                    {fmtPrice(m.pricing)}
                    {m.context_length ? ` · ${(m.context_length / 1000).toFixed(0)}K` : ''}
                  </div>
                </button>
              ))
            )}
            {filtered.length > 80 && (
              <div className="text-warm-muted text-[10px] text-center py-1">+{filtered.length - 80} more</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
