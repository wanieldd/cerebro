import { useRef, useEffect } from 'react'
import { Terminal, Lightbulb, Code, FileText, Globe, Zap } from 'lucide-react'
import type { Message, SSEEvent, Prompt, ChatParams } from '../types'
import MessageBubble from './MessageBubble'
import ChatInput from './ChatInput'

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
}

export default function ChatView({
  messages, isStreaming, streamingContent, streamingToolCalls,
  onSend, onEditResubmit, onStop, hasApiKey, error, prompts,
}: ChatViewProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, streamingContent])

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto px-6 py-6">
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
                <p className="text-mustard text-sm">Set your API key in Settings to start chatting</p>
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
                        <s.icon size={15} className="text-mustard shrink-0" />
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

          {messages.map((msg) => (
            msg.id !== 'streaming-placeholder' ? (
              <MessageBubble
                key={msg.id}
                message={msg}
                onEdit={msg.role === 'user' ? onEditResubmit : undefined}
              />
            ) : null
          ))}

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
                      <Terminal size={12} className="text-mustard" />
                      <span className="text-warm-muted font-medium">{tc.name}</span>
                      {!(tc as any).result ? (
                        <span className="text-mustard ml-auto animate-pulse">running...</span>
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
                  {streamingContent}
                  <span className="inline-block w-[2px] h-[1em] bg-mustard ml-0.5 animate-pulse align-middle" />
                </div>
              )}

              {/* Thinking indicator */}
              {!streamingContent && streamingToolCalls.length === 0 && (
                <div className="flex items-center gap-2 py-2 text-warm-muted text-sm" style={{ fontFamily: 'var(--font-serif)' }}>
                  <span className="w-2 h-2 rounded-full bg-mustard animate-pulse" />
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

      <ChatInput onSend={onSend} onStop={onStop} isLoading={isStreaming} />
    </div>
  )
}