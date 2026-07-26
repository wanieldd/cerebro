import { useRef, useEffect, useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Terminal, Lightbulb, Code, FileText, Globe, Zap, ArrowDown, Download, Search, X } from 'lucide-react'
import type { Message, SSEEvent, Prompt, ChatParams } from '../types'
import type { ModelOption } from '../types'
import * as api from '../api/client'
import MessageBubble from './MessageBubble'
import ChatInput from './ChatInput'
import ChatModelSelector from './ChatModelSelector'

interface ChatViewProps {
  messages: Message[]
  isStreaming: boolean
  streamingContent: string
  streamingToolCalls: SSEEvent[]
  onSend: (content: string, params?: ChatParams) => Promise<void>
  onEditResubmit: (messageId: string, newContent: string) => Promise<void>
  onRegenerate: () => Promise<void>
  onStop: () => void
  hasApiKey: boolean
  error: string | null
  prompts: Prompt[]
  pendingPrompt?: string | null
  conversationId?: string | null
}

export default function ChatView({
  messages, isStreaming, streamingContent, streamingToolCalls,
  onSend, onEditResubmit, onRegenerate, onStop, hasApiKey, error, prompts, pendingPrompt, conversationId,
}: ChatViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const isCompact = localStorage.getItem('cerebro_compact') === 'true'
  const fontSize = localStorage.getItem('cerebro_font_size') || 'md'
  const fontSizeMap: Record<string, number> = { sm: 14, md: 16, lg: 18 }
  const currentFontSize = fontSizeMap[fontSize] || 16
  const msgContainerClass = isCompact ? 'gap-0.5 py-1' : 'gap-1 py-2'
  const msgPaddingClass = isCompact ? 'px-4 py-3' : 'px-6 py-6'
  const [models, setModels] = useState<ModelOption[]>([])
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [tokenInfo, setTokenInfo] = useState<{ total_tokens: number; message_count: number } | null>(null)

  useEffect(() => {
    const key = localStorage.getItem('hermes_ui_api_key')
    if (key) {
      api.getModels(key).then(setModels).catch(() => {})
    }
  }, [])

  // Fetch token count when conversation changes
  useEffect(() => {
    if (conversationId) {
      api.getConversationTokens(conversationId).then(setTokenInfo).catch(() => setTokenInfo(null))
    } else {
      setTokenInfo(null)
    }
  }, [conversationId, messages.length])

  const handleModelSelect = (id: string) => {
    localStorage.setItem('hermes_ui_model', id)
  }

  const currentModel = localStorage.getItem('hermes_ui_model') || ''

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (bottomRef.current && !showScrollBtn) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, streamingContent, showScrollBtn])

  // Track scroll position for scroll-to-bottom button
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 150
    setShowScrollBtn(!isNearBottom)
  }, [])

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Filter messages for search
  const filteredMessages = searchQuery.trim()
    ? messages.filter((m) =>
        m.content.toLowerCase().includes(searchQuery.toLowerCase()) &&
        m.role !== 'tool'
      )
    : messages

  // Find which messages match the search term for highlighting
  const matchedIds = searchQuery.trim()
    ? new Set(filteredMessages.map((m) => m.id))
    : new Set<string>()

  const handleExport = async (fmt: 'json' | 'md') => {
    if (!conversationId) return
    try {
      const url = await api.exportConversation(conversationId, fmt)
      // Create a temporary link to download
      const a = document.createElement('a')
      a.href = url
      a.download = fmt === 'md' ? 'conversation.md' : 'conversation.json'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('Export failed:', e)
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 relative" style={{ fontSize: currentFontSize + 'px' }}>
      {/* Top bar: model selector + token info + export + search */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-warm-border bg-warm-surface shrink-0">
        <div className="flex items-center gap-2">
          <ChatModelSelector models={models} currentModel={currentModel} onModelSelect={handleModelSelect} />
          {tokenInfo && (
            <span className="text-xs text-warm-muted/60 tabular-nums">
              ~{tokenInfo.total_tokens.toLocaleString()} tokens · {tokenInfo.message_count} msgs
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {conversationId && messages.length > 0 && !isStreaming && (
            <>
              <button
                onClick={() => handleExport('json')}
                className="p-1.5 text-warm-muted hover:text-warm-text rounded-lg hover:bg-warm-elevated transition-colors"
                title="Export as JSON"
              >
                <Download size={14} />
              </button>
              <button
                onClick={() => handleExport('md')}
                className="p-1.5 text-warm-muted hover:text-warm-text rounded-lg hover:bg-warm-elevated transition-colors text-xs"
                title="Export as Markdown"
              >
                <FileText size={14} />
              </button>
            </>
          )}
          <button
            onClick={() => setShowSearch(!showSearch)}
            className={`p-1.5 rounded-lg transition-colors ${showSearch ? 'bg-blue/20 text-blue' : 'text-warm-muted hover:text-warm-text hover:bg-warm-elevated'}`}
            title="Search in conversation"
          >
            <Search size={14} />
          </button>
        </div>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="px-4 py-2 border-b border-warm-border bg-warm-surface">
          <div className="relative max-w-md">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-warm-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in conversation..."
              autoFocus
              className="w-full bg-warm-bg border border-warm-border rounded-lg pl-8 pr-8 py-1.5 text-warm-text placeholder-warm-muted focus:outline-none focus:ring-2 focus:ring-blue text-xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-warm-muted hover:text-warm-text"
              >
                <X size={12} />
              </button>
            )}
          </div>
          {searchQuery && (
            <div className="text-xs text-warm-muted mt-1">
              {filteredMessages.length} match{filteredMessages.length !== 1 ? 'es' : ''}
            </div>
          )}
        </div>
      )}

      <div
        ref={scrollRef}
        className={`flex-1 overflow-y-auto ${msgPaddingClass}`}
        onScroll={handleScroll}
      >
        <div className="max-w-3xl mx-auto">
          {messages.length === 0 && !isStreaming && (
            <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
              <h1
                className="text-4xl font-bold mb-2"
                style={{ fontFamily: 'var(--font-serif)', color: 'var(--color-warm-text)' }}
              >
                Cerebro
              </h1>
              <p className="text-warm-muted mb-8 text-sm" style={{ fontFamily: 'var(--font-serif)' }}>
                Your AI assistant with tools and memory
              </p>
              {!hasApiKey ? (
                <p className="text-blue text-sm">Set your API key in Settings to start chatting</p>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-warm-muted">Try one of these to get started:</p>
                  <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                    {[
                      { icon: Code, text: 'Write a Python script to parse JSON files' },
                      { icon: Lightbulb, text: 'Explain how transformers work in simple terms' },
                      { icon: FileText, text: 'Summarize this codebase for a new developer' },
                      { icon: Globe, text: 'What happened in the news this week?' },
                      { icon: Zap, text: 'Debug: why is my React component not re-rendering?' },
                    ].map((s, i) => (
                      <button
                        key={i}
                        onClick={() => onSend(s.text)}
                        style={{ animationDelay: `${i * 0.07}s` }}
                        className="flex items-center gap-2 px-4 py-2.5 bg-warm-surface border border-warm-border rounded-xl text-sm text-warm-muted hover:text-warm-text hover:border-warm-muted hover:bg-warm-elevated transition-all text-left animate-message-in"
                      >
                        <s.icon size={15} className="text-blue shrink-0" />
                        {s.text}
                      </button>
                    ))}
                  </div>
                  {prompts.length > 0 && (
                    <div className="flex flex-wrap gap-2 justify-center">
                      {prompts.slice(0, 3).map((p) => (
                        <button
                          key={p.id}
                          onClick={() => onSend(p.content)}
                          className="px-3 py-1.5 bg-warm-elevated border border-warm-border rounded-full text-xs text-warm-muted hover:text-warm-text hover:border-warm-muted transition-colors"
                        >
                          {p.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Search results indicator */}
          {showSearch && searchQuery && filteredMessages.length === 0 && messages.length > 0 && (
            <div className="text-center py-8 text-warm-muted text-sm">
              No messages match &ldquo;{searchQuery}&rdquo;
            </div>
          )}

          {/* Messages (filtered by search) */}
          <div className={`flex flex-col ${msgContainerClass}`}>
          {filteredMessages.map((msg, idx) => (
            msg.id !== 'streaming-placeholder' ? (
              <div
                key={msg.id}
                className={matchedIds.has(msg.id) && searchQuery ? 'rounded-lg ring-1 ring-blue/20 -mx-2 px-2' : ''}
              >
                <MessageBubble
                  message={msg}
                  onEdit={msg.role === 'user' ? onEditResubmit : undefined}
                  onRegenerate={!isStreaming && idx === filteredMessages.length - 1 && msg.role === 'assistant' ? onRegenerate : undefined}
                  isLastAssistant={!isStreaming && idx === filteredMessages.length - 1 && msg.role === 'assistant'}
                />
              </div>
            ) : null
          ))}
          </div>

          {/* Streaming content -- AI style, no bubble */}
          {isStreaming && (
            <div className="py-1">
              {streamingToolCalls.length > 0 && (
                <div className="space-y-1 mb-3">
                  {streamingToolCalls.map((tc, i) => (
                    <div
                      key={tc.id || i}
                      className="bg-warm-elevated border border-warm-border rounded-lg px-3 py-2 text-xs flex items-center gap-2 max-w-md"
                    >
                      <Terminal size={12} className="text-blue" />
                      <span className="text-warm-muted font-medium">{tc.name}</span>
                      {!(tc as any).result ? (
                        <span className="text-blue ml-auto animate-pulse">running...</span>
                      ) : (
                        <span className="text-green-500 ml-auto">done</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {streamingContent && (
                <div className="markdown-content" style={{ maxWidth: '65ch' }}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingContent}</ReactMarkdown>
                  <span className="inline-block w-[2px] h-[1em] bg-blue ml-0.5 animate-pulse align-middle" />
                </div>
              )}

              {!streamingContent && streamingToolCalls.length === 0 && (
                <div className="flex items-center gap-2 py-2 text-warm-muted text-sm" style={{ fontFamily: 'var(--font-serif)' }}>
                  <span className="w-2 h-2 rounded-full bg-blue animate-pulse-dot" />
                  Thinking...
                </div>
              )}
            </div>
          )}

          {/* Error banner */}
          {error && (
            <div className="bg-warm-danger/10 border border-warm-danger/30 rounded-xl px-4 py-3 text-warm-danger text-sm mt-2">
              {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Scroll-to-bottom button */}
      {showScrollBtn && !showSearch && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-24 right-8 z-10 w-10 h-10 bg-warm-elevated border border-warm-border rounded-full flex items-center justify-center text-warm-muted hover:text-warm-text hover:border-warm-muted shadow-lg transition-all animate-fade-in"
          title="Scroll to bottom"
        >
          <ArrowDown size={18} />
        </button>
      )}

      <ChatInput onSend={onSend} onStop={onStop} isLoading={isStreaming} pendingPrompt={pendingPrompt} />
    </div>
  )
}
