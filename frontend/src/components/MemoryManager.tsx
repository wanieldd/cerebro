import { useState, useEffect } from 'react'
import { ArrowLeft, Trash2, Plus, Brain, Lightbulb, Copy } from 'lucide-react'
import { getMemories, addMemory, deleteMemory } from '../api/client'
import type { Memory } from '../types'

interface MemoryManagerProps {
  onBack: () => void
}

const EXAMPLES = [
  { key: 'user-name', content: 'My name is Daniel, I go by dan' },
  { key: 'user-occupation', content: 'I am an EE student at UAlberta on co-op at Ledcor' },
  { key: 'user-location', content: 'I live in Edmonton, Alberta, Canada' },
]

export default function MemoryManager({ onBack }: MemoryManagerProps) {
  const [memories, setMemories] = useState<Memory[]>([])
  const [key, setKey] = useState('')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState('')

  const fetchMemories = async () => {
    setLoading(true)
    try {
      const data = await getMemories()
      setMemories(data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMemories()
  }, [])

  const handleAdd = async () => {
    if (!key.trim() || !content.trim()) return
    setSaving(true)
    try {
      await addMemory(key.trim(), content.trim())
      setKey('')
      setContent('')
      await fetchMemories()
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (memKey: string) => {
    try {
      await deleteMemory(memKey)
      await fetchMemories()
    } catch {
      // ignore
    }
  }

  const handleUseExample = (ex: { key: string; content: string }) => {
    setKey(ex.key)
    setContent(ex.content)
  }

  const handleCopyKey = async (k: string) => {
    await navigator.clipboard.writeText(k)
    setCopied(k)
    setTimeout(() => setCopied(''), 1500)
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-warm-muted hover:text-warm-text transition-colors mb-3"
          >
            <ArrowLeft size={20} />
            <span className="text-lg font-medium" style={{ fontFamily: 'var(--font-serif)' }}>Memories</span>
          </button>
          <div className="bg-warm-surface border border-warm-border rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Brain size={20} className="text-blue shrink-0 mt-0.5" />
              <div>
                <div className="text-sm text-warm-text font-medium mb-1">What are memories?</div>
                <div className="text-xs text-warm-muted leading-relaxed">
                  Memories are facts Cerebro remembers about you across conversations. 
                  The AI can save these automatically (when auto-memory is on), or you can add them manually below.
                  They get injected as context into every new conversation.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Add Memory Form */}
        <div className="bg-warm-surface border border-warm-border rounded-xl p-4 space-y-3">
          <div className="text-sm text-warm-text font-medium flex items-center gap-2">
            <Plus size={16} className="text-blue" />
            Add a memory
          </div>
          <div className="space-y-2">
            <div>
              <label className="text-xs text-warm-muted mb-1 block">What to remember (key)</label>
              <input
                type="text"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="e.g. user-name, user-location, project-x-status"
                className="w-full bg-warm-bg border border-warm-border rounded-lg px-3 py-2 text-warm-text placeholder-warm-muted focus:outline-none focus:ring-2 focus:ring-blue text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-warm-muted mb-1 block">What to store (content)</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="e.g. Daniel is an EE student at UAlberta..."
                rows={3}
                className="w-full bg-warm-bg border border-warm-border rounded-lg px-3 py-2 text-warm-text placeholder-warm-muted focus:outline-none focus:ring-2 focus:ring-blue text-sm resize-none"
              />
            </div>
          </div>
          <button
            onClick={handleAdd}
            disabled={!key.trim() || !content.trim() || saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue text-black rounded-lg hover:opacity-90 transition-colors text-sm disabled:opacity-50 font-medium"
          >
            {saving ? 'Saving...' : 'Save Memory'}
          </button>
        </div>

        {/* Example memories -- only show if no memories exist yet */}
        {!loading && memories.length === 0 && (
          <div className="bg-warm-surface border border-warm-border rounded-xl p-4">
            <div className="text-sm text-warm-text font-medium flex items-center gap-2 mb-3">
              <Lightbulb size={16} className="text-blue" />
              Try these examples
            </div>
            <div className="space-y-2">
              {EXAMPLES.map((ex) => (
                <div
                  key={ex.key}
                  className="flex items-center justify-between bg-warm-bg rounded-lg px-3 py-2 group"
                >
                  <div className="min-w-0">
                    <div className="text-xs text-blue font-mono">{ex.key}</div>
                    <div className="text-xs text-warm-text mt-0.5 truncate">{ex.content}</div>
                  </div>
                  <button
                    onClick={() => handleUseExample(ex)}
                    className="px-2 py-1 text-xs text-warm-muted hover:text-blue transition-colors shrink-0 ml-2"
                  >
                    Use this
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Memory List */}
        {loading ? (
          <div className="text-warm-muted text-center py-8 text-sm">Loading memories...</div>
        ) : memories.length > 0 ? (
          <div className="space-y-2">
            <div className="text-xs text-warm-muted uppercase tracking-wider px-1">
              {memories.length} memor{memories.length === 1 ? 'y' : 'ies'}
            </div>
            {memories.map((mem) => (
              <div
                key={mem.key}
                className="bg-warm-surface border border-warm-border rounded-xl p-4 group hover:border-warm-muted transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <code className="text-xs text-blue font-mono bg-warm-elevated px-1.5 py-0.5 rounded">{mem.key}</code>
                      <button
                        onClick={() => handleCopyKey(mem.key)}
                        className="text-warm-muted hover:text-warm-text transition-colors"
                        title="Copy key"
                      >
                        <Copy size={11} />
                      </button>
                      {copied === mem.key && (
                        <span className="text-xs text-green-500">Copied!</span>
                      )}
                    </div>
                    <div className="text-sm text-warm-text leading-relaxed">{mem.content}</div>
                  </div>
                  <button
                    onClick={() => handleDelete(mem.key)}
                    className="text-warm-muted hover:text-warm-danger transition-colors shrink-0 opacity-0 group-hover:opacity-100 p-1"
                    title="Delete memory"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}