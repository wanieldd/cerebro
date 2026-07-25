import { useState } from 'react'
import { Terminal } from 'lucide-react'
import type { ToolCall } from '../types'

interface ToolCallDisplayProps {
  toolCalls: ToolCall[]
}

export default function ToolCallDisplay({ toolCalls }: ToolCallDisplayProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)

  if (!toolCalls || toolCalls.length === 0) return null

  const toggle = (idx: number) => {
    setExpandedIndex(expandedIndex === idx ? null : idx)
  }

  return (
    <div className="space-y-2 mb-2">
      {toolCalls.map((tc, idx) => {
        const isOpen = expandedIndex === idx
        let argsObj: unknown
        try {
          argsObj = JSON.parse(tc.function.arguments)
        } catch {
          argsObj = tc.function.arguments
        }

        return (
          <div
            key={tc.id}
            className="bg-warm-surface border border-warm-border rounded-lg text-xs overflow-hidden"
          >
            <button
              onClick={() => toggle(idx)}
              className="w-full flex items-center gap-2 px-3 py-2 text-warm-text hover:bg-warm-elevated transition-colors text-left"
            >
              <Terminal size={14} />
              <span className="font-medium">{tc.function.name}</span>
              <span className="text-warm-muted ml-auto">(click to expand)</span>
            </button>
            {isOpen && (
              <div className="px-3 pb-2">
                <pre className="bg-warm-elevated p-2 rounded text-warm-muted overflow-x-auto">
                  {JSON.stringify(argsObj, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
