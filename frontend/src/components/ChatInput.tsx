import { useState, useRef, useEffect, type KeyboardEvent, type ChangeEvent } from 'react'
import { Send, Paperclip, Globe, Brain, Bolt, Zap, Sparkles, FileText, X, Square } from 'lucide-react'
import type { ChatParams, UploadResult } from '../types'
import { uploadFile } from '../api/client'

interface ChatInputProps {
  onSend: (content: string, params?: ChatParams) => Promise<void>
  onStop: () => void
  isLoading: boolean
}

const REASONING_OPTIONS = [
  { value: '', label: 'Auto', icon: Brain, desc: 'Let the model decide' },
  { value: 'low', label: 'Low', icon: Bolt, desc: 'Quick, creative' },
  { value: 'medium', label: 'Medium', icon: Sparkles, desc: 'Balanced' },
  { value: 'high', label: 'High', icon: Zap, desc: 'Thorough' },
] as const

interface PastedItem {
  id: string
  filename: string
  url: string
  blob?: Blob
  type: 'image' | 'file'
}

export default function ChatInput({ onSend, onStop, isLoading }: ChatInputProps) {
  const [value, setValue] = useState('')
  const [showParams, setShowParams] = useState(false)
  const [reasoningEffort, setReasoningEffort] = useState(() => localStorage.getItem('chat_reasoning') || '')
  const [webSearch, setWebSearch] = useState(false)
  const [files, setFiles] = useState<UploadResult[]>([])
  const [pasted, setPasted] = useState<PastedItem[]>([])
  const [uploading, setUploading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 8 * 1.5 * 16) + 'px'
    }
  }, [value])

  const handleSend = async () => {
    if (isLoading) return

    // Upload any pasted blobs first
    const uploaded: UploadResult[] = []
    for (const p of pasted) {
      if (p.blob) {
        const file = new File([p.blob], p.filename, { type: p.blob.type })
        try {
          const result = await uploadFile(file)
          uploaded.push(result)
        } catch { /* skip failed uploads */ }
      }
    }

    const allFiles = [...files, ...uploaded]
    let fullContent = value.trim()

    for (const f of allFiles) {
      if (f.is_text) {
        try {
          const resp = await fetch(f.url)
          const text = await resp.text()
          fullContent += `\n\n--- File: ${f.filename} ---\n${text}`
        } catch { /* ignore */ }
      } else if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(f.ext)) {
        fullContent += `\n\n![${f.filename}](${f.url})`
      } else {
        fullContent += `\n\n[Attached: ${f.filename}](${f.url})`
      }
    }

    if (!fullContent && allFiles.length === 0) return

    localStorage.setItem('chat_reasoning', reasoningEffort)

    setValue('')
    setFiles([])
    setPasted([])
    setShowParams(false)

    const params: ChatParams = {}
    if (reasoningEffort) params.reasoning_effort = reasoningEffort
    if (webSearch) params.scope = 'web'

    await onSend(fullContent, params)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFilePick = async (e: ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files
    if (!fileList || fileList.length === 0) return
    setUploading(true)
    try {
      const results: UploadResult[] = []
      for (let i = 0; i < fileList.length; i++) {
        try {
          results.push(await uploadFile(fileList[i]))
        } catch { /* skip failed */ }
      }
      setFiles((prev) => [...prev, ...results])
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return

    const newItems: PastedItem[] = []
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.kind === 'file') {
        const blob = item.getAsFile()
        if (!blob) continue
        const id = 'paste-' + Date.now() + '-' + i
        const isImage = blob.type.startsWith('image/')
        const url = URL.createObjectURL(blob)
        const ext = isImage ? '.png' : blob.name ? '.' + blob.name.split('.').pop() || '.bin' : '.bin'
        newItems.push({
          id,
          filename: blob.name || (isImage ? 'pasted-image' + ext : 'pasted-file' + ext),
          url,
          blob,
          type: isImage ? 'image' : 'file',
        })
      }
    }

    if (newItems.length > 0) {
      e.preventDefault()
      setPasted((prev) => [...prev, ...newItems])
    }
  }

  const removePasted = (id: string) => {
    setPasted((prev) => {
      const item = prev.find((p) => p.id === id)
      if (item) URL.revokeObjectURL(item.url)
      return prev.filter((p) => p.id !== id)
    })
  }

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx))
  }

  const hasAttachments = files.length > 0 || pasted.length > 0

  return (
    <div className="border-t border-warm-border bg-warm-bg" onPaste={handlePaste}>
      {/* Params panel */}
      {showParams && (
        <div className="px-4 py-3 border-b border-warm-border bg-warm-surface">
          <div className="max-w-3xl mx-auto">
            <div className="text-xs text-warm-muted mb-2 font-medium">Reasoning Effort</div>
            <div className="flex flex-wrap gap-2">
              {REASONING_OPTIONS.map((opt) => {
                const Icon = opt.icon
                const active = reasoningEffort === opt.value
                return (
                  <button
                    key={opt.value}
                    onClick={() => setReasoningEffort(opt.value)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs transition-colors ${
                      active
                        ? 'bg-mustard/20 text-mustard-light border border-mustard/30'
                        : 'text-warm-muted hover:bg-warm-elevated border border-transparent'
                    }`}
                  >
                    <Icon size={14} />
                    <span>{opt.label}</span>
                    <span className="text-warm-muted ml-1">{opt.desc}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Pasted image/file previews */}
      {hasAttachments && (
        <div className="px-4 py-2.5">
          <div className="max-w-3xl mx-auto flex flex-wrap gap-2">
            {/* Pasted images — show thumbnail */}
            {pasted.map((p) => (
              <div key={p.id} className="relative group w-16 h-16 rounded-lg overflow-hidden border border-warm-border bg-warm-elevated shrink-0">
                {p.type === 'image' ? (
                  <img src={p.url} alt={p.filename} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-warm-muted">
                    <FileText size={20} />
                  </div>
                )}
                <button
                  onClick={() => removePasted(p.id)}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-warm-danger rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={10} className="text-white" />
                </button>
              </div>
            ))}
            {/* Uploaded files */}
            {files.map((f, i) => (
              <div key={i} className="flex items-center gap-1 bg-warm-elevated rounded-lg px-2 py-1 text-xs text-warm-text">
                {f.is_text ? <FileText size={12} /> : <span className="text-xs">🖼</span>}
                <span className="max-w-[120px] truncate">{f.filename}</span>
                <button onClick={() => removeFile(i)} className="text-warm-muted hover:text-warm-danger ml-1">&times;</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input bar */}
      <div className="p-4">
        <div className="flex items-end gap-2 max-w-3xl mx-auto">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFilePick}
            className="hidden"
            accept=".txt,.md,.py,.js,.ts,.jsx,.tsx,.json,.csv,.html,.css,.yaml,.yml,.xml,.sh,.jpg,.jpeg,.png,.gif,.webp,.svg,.pdf"
          />
          <div className="flex items-center gap-1">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || uploading}
              className="p-2 text-warm-muted hover:text-warm-text transition-colors disabled:opacity-50"
              title="Attach file"
            >
              <Paperclip size={18} />
            </button>
            <button
              onClick={() => setWebSearch(!webSearch)}
              className={`p-2 transition-colors ${webSearch ? 'text-mustard' : 'text-warm-muted hover:text-warm-text'}`}
              title="Web search"
            >
              <Globe size={18} />
            </button>
            <button
              onClick={() => setShowParams(!showParams)}
              className={`p-2 transition-colors ${showParams ? 'text-mustard' : 'text-warm-muted hover:text-warm-text'}`}
              title="Reasoning effort"
            >
              <Brain size={18} />
            </button>
          </div>

          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (Shift+Enter for newline)"
            disabled={isLoading}
            rows={1}
            className="flex-1 bg-warm-surface border border-warm-border rounded-xl px-4 py-3 text-warm-text placeholder-warm-muted resize-none focus:outline-none focus:ring-2 focus:ring-mustard disabled:opacity-50 text-sm"
          />

          <button
            onClick={isLoading ? onStop : handleSend}
            disabled={!isLoading && (!value.trim() && !hasAttachments)}
            className={`p-3 rounded-xl transition-colors font-medium ${
              isLoading
                ? 'bg-warm-danger text-white hover:bg-red-600'
                : 'bg-mustard text-black hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed'
            }`}
            title={isLoading ? 'Stop generating' : 'Send message'}
          >
            {isLoading ? <Square size={16} fill="currentColor" /> : <Send size={18} />}
          </button>
        </div>
      </div>
    </div>
  )
}
