import { useState } from 'react'
import { ArrowLeft, Plus, Trash2, Pencil } from 'lucide-react'
import type { Prompt } from '../types'
import * as api from '../api/client'

interface PromptLibraryProps {
  prompts: Prompt[]
  onBack: () => void
  onSelect: (prompt: Prompt) => void
  onRefresh: () => void
}

export default function PromptLibrary({ prompts, onBack, onSelect, onRefresh }: PromptLibraryProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [showNew, setShowNew] = useState(false)

  const handleCreate = async () => {
    if (!newTitle.trim() || !newContent.trim()) return
    try {
      await api.createPrompt(newTitle.trim(), newContent.trim())
      setNewTitle('')
      setNewContent('')
      setShowNew(false)
      onRefresh()
    } catch { /* ignore */ }
  }

  const handleUpdate = async (id: string) => {
    if (!editTitle.trim() || !editContent.trim()) return
    try {
      await api.updatePrompt(id, editTitle.trim(), editContent.trim())
      setEditingId(null)
      onRefresh()
    } catch { /* ignore */ }
  }

  const handleDelete = async (id: string) => {
    try {
      await api.deletePrompt(id)
      onRefresh()
    } catch { /* ignore */ }
  }

  const startEdit = (p: Prompt) => {
    setEditingId(p.id)
    setEditTitle(p.title)
    setEditContent(p.content)
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between mb-4">
          <button onClick={onBack} className="flex items-center gap-2 text-warm-muted hover:text-warm-text transition-colors">
            <ArrowLeft size={20} />
            <span className="text-lg font-medium">Prompts</span>
          </button>
          <button
            onClick={() => setShowNew(!showNew)}
            className="flex items-center gap-1 px-3 py-1.5 bg-mustard text-black rounded-lg hover:opacity-90 transition-colors text-sm"
          >
            <Plus size={16} />
            New
          </button>
        </div>

        {/* New prompt form */}
        {showNew && (
          <div className="bg-warm-surface border border-warm-border rounded-xl p-4 space-y-3">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Prompt title"
              className="w-full bg-warm-bg border border-warm-border rounded-lg px-3 py-2 text-warm-text placeholder-warm-muted text-sm focus:outline-none focus:ring-2 focus:ring-mustard"
            />
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Prompt content"
              rows={3}
              className="w-full bg-warm-bg border border-warm-border rounded-lg px-3 py-2 text-warm-text placeholder-warm-muted text-sm resize-none focus:outline-none focus:ring-2 focus:ring-mustard"
            />
            <div className="flex gap-2">
              <button onClick={handleCreate} className="px-3 py-1.5 bg-mustard text-black rounded-lg hover:opacity-90 text-sm transition-colors">
                Save
              </button>
              <button onClick={() => { setShowNew(false); setNewTitle(''); setNewContent('') }} className="px-3 py-1.5 bg-warm-elevated text-warm-text rounded-lg hover:bg-warm-elevated text-sm transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Prompt list */}
        {prompts.length === 0 && !showNew && (
          <div className="text-warm-muted text-center py-8">No prompts yet. Create one to quickly insert common messages.</div>
        )}

        <div className="space-y-2">
          {prompts.map((p) => (
            <div key={p.id} className="bg-warm-surface border border-warm-border rounded-xl overflow-hidden">
              {editingId === p.id ? (
                <div className="p-4 space-y-3">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full bg-warm-bg border border-warm-border rounded-lg px-3 py-2 text-sm text-warm-text focus:outline-none focus:ring-2 focus:ring-mustard"
                  />
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={3}
                    className="w-full bg-warm-bg border border-warm-border rounded-lg px-3 py-2 text-sm text-warm-text resize-none focus:outline-none focus:ring-2 focus:ring-mustard"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => handleUpdate(p.id)} className="px-3 py-1 bg-mustard text-black rounded text-xs hover:opacity-90">Save</button>
                    <button onClick={() => setEditingId(null)} className="px-3 py-1 bg-warm-elevated text-warm-text rounded text-xs hover:bg-warm-elevated">Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => onSelect(p)}
                    className="w-full text-left p-4 hover:bg-warm-elevated/50 transition-colors"
                  >
                    <div className="font-medium text-warm-text text-sm">{p.title}</div>
                    <div className="text-warm-muted text-xs mt-1 line-clamp-2">{p.content}</div>
                  </button>
                  <div className="flex justify-end gap-1 px-4 pb-2">
                    <button onClick={() => startEdit(p)} className="text-warm-muted hover:text-mustard p-1">
                      <Pencil size={12} />
                    </button>
                    <button onClick={() => handleDelete(p.id)} className="text-warm-muted hover:text-warm-danger p-1">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}