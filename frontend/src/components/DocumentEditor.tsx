import { useState, useEffect, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ArrowLeft, Bold, Italic, Heading, List, Code, Link } from 'lucide-react'
import type { Document } from '../types'

interface DocumentEditorProps {
  document: Document
  onSave: (id: string, data: { title?: string; content?: string }) => Promise<void>
  onBack: () => void
}

export default function DocumentEditor({ document, onSave, onBack }: DocumentEditorProps) {
  const [title, setTitle] = useState(document.title)
  const [content, setContent] = useState(document.content)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'unsaved' | 'saving'>('saved')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const doSave = useCallback(async (newTitle: string, newContent: string) => {
    setSaveStatus('saving')
    try {
      await onSave(document.id, { title: newTitle, content: newContent })
      setSaveStatus('saved')
    } catch {
      setSaveStatus('unsaved')
    }
  }, [document.id, onSave])

  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaveStatus('unsaved')
    saveTimer.current = setTimeout(() => {
      doSave(title, content)
    }, 1500)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [title, content, doSave])

  const insertMarkdown = (before: string, after = '') => {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const selected = content.substring(start, end)
    const newContent = content.substring(0, start) + before + selected + after + content.substring(end)
    setContent(newContent)
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(start + before.length, start + before.length + selected.length)
    })
  }

  const toolbarButtons = [
    { icon: Bold, label: 'Bold', action: () => insertMarkdown('**', '**') },
    { icon: Italic, label: 'Italic', action: () => insertMarkdown('*', '*') },
    { icon: Heading, label: 'Heading', action: () => insertMarkdown('## ') },
    { icon: List, label: 'List', action: () => insertMarkdown('- ') },
    { icon: Code, label: 'Code', action: () => insertMarkdown('```\n', '\n```') },
    { icon: Link, label: 'Link', action: () => insertMarkdown('[', '](url)') },
  ]

  const statusText = saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? 'Saving...' : 'Unsaved changes'
  const statusColor = saveStatus === 'saved' ? 'text-green' : saveStatus === 'saving' ? 'text-warm-muted' : 'text-warm-danger'

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-warm-border bg-warm-surface shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-warm-muted hover:text-warm-text transition-colors"
        >
          <ArrowLeft size={16} />
          Back
        </button>
        <div className="flex-1" />
        <span className={`text-xs ${statusColor} transition-colors`}>{statusText}</span>
      </div>

      {/* Title */}
      <div className="px-4 pt-4 pb-2 shrink-0">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="text-2xl font-bold bg-transparent border-none focus:outline-none text-warm-text w-full placeholder-warm-muted"
          placeholder="Untitled"
        />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-1 px-4 pb-2 shrink-0">
        {toolbarButtons.map((btn) => (
          <button
            key={btn.label}
            onClick={btn.action}
            className="p-1.5 rounded text-warm-muted hover:bg-warm-elevated hover:text-warm-text transition-colors"
            title={btn.label}
          >
            <btn.icon size={16} />
          </button>
        ))}
      </div>

      {/* Split view */}
      <div className="flex flex-1 min-h-0 border-t border-warm-border">
        {/* Left: Editor */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-warm-border">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="flex-1 w-full bg-warm-bg text-warm-text font-mono text-sm p-4 resize-none focus:outline-none"
            placeholder="Start writing..."
          />
        </div>

        {/* Right: Preview */}
        <div className="flex-1 min-w-0 overflow-y-auto p-4 bg-warm-surface">
          <div className="prose prose-sm max-w-none text-warm-text
            prose-headings:text-warm-text prose-a:text-blue prose-strong:text-warm-text
            prose-code:text-warm-text prose-code:bg-warm-elevated prose-code:px-1 prose-code:rounded
            prose-pre:bg-warm-elevated prose-pre:border prose-pre:border-warm-border
            prose-blockquote:text-warm-muted prose-blockquote:border-warm-border
            prose-li:text-warm-text">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content || '*No content*'}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  )
}
