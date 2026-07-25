import { useRef, useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Terminal, Lightbulb, Code, FileText, Globe, Zap } from 'lucide-react'
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
  onStop: () => void
  hasApiKey: boolean
  error: string | null
  prompts: Prompt[]
  pendingPrompt?: string | null
}

export default function ChatView({
  messages, isStreaming, streamingContent, streamingToolCalls,
  onSend, onEditResubmit, onStop, hasApiKey, error, prompts, pendingPrompt,
}: ChatViewProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const isCompact = localStorage.getItem('cerebro_compact') === 'true'
  const fontSize = localStorage.getItem('cerebro_font_size') || 'md'
  const fontSizeMap: Record<string, number> = { sm: 14, md: 16, lg: 18 }
  const currentFontSize = fontSizeMap[fontSize] || 16
  const msgContainerClass = isCompact ? 'gap-0.5 py-1' : 'gap-1 py-2'
  const msgPaddingClass = isCompact ? 'px-4 py-3' : 'px-6 py-6'
  const [models, setModels] = useState<ModelOption[]>([])

  useEffect(() => {
    const key = localStorage.getItem('hermes_ui_api_key')
    if (key) {
      api.getModels(key).then(setModels).catch(() => {})
    }
  }, [])

  const handleModelSelect = (id: string) => {
    localStorage.setItem('hermes_ui_model', id)
  }

  const currentModel = localStorage.getItem('hermes_ui_model') || ''

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, streamingContent])

  return (
    <div className="flex-1 flex flex-col min-h-0" style={{ fontSize: currentFontSize + 'px' }}>
      <div className={`flex-1 overflow-y-auto ${msgPaddingClass}`}>
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
                        className="flex items-center gap-2 px-4 py-2.5 bg-warm-surface border border-warm-border rounded-xl text-sm text-warm-muted hover:text-warm-text hover:border-warm-muted hover:bg-warm-elevated transition-all text-left"
                      >
                        <s.icon size={15} className="text-blue shrink-0" />
                        {s.text}
                      </button>
                    ))}
                  </div>
                  {/* Also show user's custom prompts if any */}
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

          <div className="flex items-center mb-2">
            <ChatModelSelector models={models} currentModel={currentModel} onModelSelect={handleModelSelect} />
          </div>

          <div className={`flex flex-col ${msgContainerClass}`}>
          {messages.map((msg) => (
            msg.id !== 'streaming-placeholder' ? (
              <MessageBubble
                key={msg.id}
                message={msg}
                onEdit={msg.role === 'user' ? onEditResubmit : undefined}
              />
            ) : null
          ))}
          </div>

          {/* Streaming content — AI style, no bubble */}
          {isStreaming && (
            <div className="py-1">
              {/* Tool calls being executed */}
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

              {/* Streaming text — serif, no bubble, with blinking cursor */}
              {streamingContent && (
                <div className="markdown-content" style={{ maxWidth: '65ch' }}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingContent}</ReactMarkdown>
                  <span className="inline-block w-[2px] h-[1em] bg-blue ml-0.5 animate-pulse align-middle" />
                </div>
              )}

              {/* Thinking indicator */}
              {!streamingContent && streamingToolCalls.length === 0 && (
                <div className="flex items-center gap-2 py-2 text-warm-muted text-sm" style={{ fontFamily: 'var(--font-serif)' }}>
                  <span className="w-2 h-2 rounded-full bg-blue animate-pulse" />
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

      <ChatInput onSend={onSend} onStop={onStop} isLoading={isStreaming} pendingPrompt={pendingPrompt} />
    </div>
  )
}