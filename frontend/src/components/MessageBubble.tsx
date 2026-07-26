import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Copy, Check, Pencil, X, Send, RefreshCw } from 'lucide-react'
import type { Message } from '../types'
import ToolCallDisplay from './ToolCallDisplay'

interface MessageBubbleProps {
  message: Message
  onEdit?: (messageId: string, newContent: string) => Promise<void>
  onRegenerate?: () => void
  isLastAssistant?: boolean
}

// Custom code block component with syntax highlighting
function CodeBlock({ className, children }: { className?: string; children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false)
  const match = /language-(\w+)/.exec(className || '')
  const language = match ? match[1] : ''
  const code = String(children).replace(/\n$/, '')

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative group">
      <div className="flex items-center justify-between px-4 py-1.5 bg-[#2d323b] border-b border-[#3d434f] rounded-t-lg">
        <span className="text-xs text-warm-muted font-mono">{language || 'code'}</span>
        <button
          onClick={handleCopy}
          className="text-warm-muted hover:text-warm-text p-1 transition-colors"
          title="Copy code"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
        </button>
      </div>
      <SyntaxHighlighter
        style={oneDark}
        language={language || 'text'}
        PreTag="div"
        customStyle={{
          margin: 0,
          borderTopLeftRadius: 0,
          borderTopRightRadius: 0,
          borderBottomLeftRadius: '8px',
          borderBottomRightRadius: '8px',
          fontSize: '0.8rem',
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  )
}

export default function MessageBubble({ message, onEdit, onRegenerate, isLastAssistant }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState(message.content)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSaveEdit = async () => {
    if (!onEdit || !editContent.trim() || editContent === message.content) {
      setEditing(false)
      return
    }
    await onEdit(message.id, editContent)
    setEditing(false)
  }

  const handleCancelEdit = () => {
    setEditContent(message.content)
    setEditing(false)
  }

  const markdownComponents = {
    code({ className, children, ...props }: { className?: string; children?: React.ReactNode }) {
      const match = /language-(\w+)/.exec(className || '')
      if (match) {
        return <CodeBlock className={className}>{children}</CodeBlock>
      }
      // Inline code
      return (
        <code className={className} {...props}>
          {children}
        </code>
      )
    },
  }

  // Tool message rendering (collapsible monospace block)
  if (message.role === 'tool') {
    const content = message.content || ''
    const isLong = content.length > 200
    const displayed = isLong && !expanded ? content.slice(0, 200) + '...' : content

    return (
      <div className="flex justify-start py-1 animate-fade-in">
        <div className="bg-warm-elevated border border-warm-border rounded-lg px-3 py-2 max-w-full text-xs font-mono" style={{ fontFamily: 'var(--font-mono)' }}>
          <div className="text-warm-muted mb-1">
            Tool: {message.tool_calls?.[0]?.function?.name || 'unknown'}
          </div>
          <pre className="text-warm-text whitespace-pre-wrap font-mono text-xs">{displayed}</pre>
          {isLong && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-blue hover:text-blue-light mt-1 text-xs transition-colors"
            >
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
      </div>
    )
  }

  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} py-1 animate-message-in`}>
      <div className={`relative group ${isUser ? 'max-w-[75%]' : 'max-w-full w-full'}`}>
        {/* Tool calls (assistant only) */}
        {message.tool_calls && message.tool_calls.length > 0 && !isUser && (
          <div className="mb-3">
            <ToolCallDisplay toolCalls={message.tool_calls} />
          </div>
        )}

        {/* User message -- bubble style */}
        {isUser && message.content && !editing && (
          <div className="bg-warm-bubble rounded-2xl px-5 py-3 inline-block max-w-full">
            <div className="user-message text-warm-text">{message.content}</div>
          </div>
        )}

        {/* AI message -- no bubble, just flowing text */}
        {!isUser && message.content && (
          <div className="markdown-content pr-4">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        {/* Edit mode (user messages only) */}
        {editing && (
          <div className="bg-warm-surface border border-blue rounded-xl p-2">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full bg-warm-bg text-warm-text rounded-lg p-2 text-sm resize-none focus:outline-none border border-warm-border min-h-[60px]"
              style={{ fontFamily: 'var(--font-sans)' }}
              autoFocus
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleSaveEdit}
                className="p-1.5 bg-blue text-black rounded-lg hover:opacity-90 transition-opacity font-medium text-xs"
              >
                <Send size={14} />
              </button>
              <button
                onClick={handleCancelEdit}
                className="p-1.5 bg-warm-elevated text-warm-muted rounded-lg hover:text-warm-text transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Action buttons (timestamp + copy/edit/regenerate/export) */}
        <div className={`flex items-center gap-1 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity ${isUser ? 'justify-end pr-1' : 'pl-0.5'}`}>
          {isLastAssistant && onRegenerate && (
            <button
              onClick={onRegenerate}
              className="text-warm-muted hover:text-blue p-0.5"
              title="Regenerate"
            >
              <RefreshCw size={11} />
            </button>
          )}
          {message.content && (
            <button
              onClick={handleCopy}
              className="text-warm-muted hover:text-blue p-0.5"
              title="Copy"
            >
              {copied ? <Check size={11} /> : <Copy size={11} />}
            </button>
          )}
          {isUser && onEdit && !editing && (
            <button
              onClick={() => { setEditing(true); setEditContent(message.content) }}
              className="text-warm-muted hover:text-blue p-0.5"
              title="Edit"
            >
              <Pencil size={11} />
            </button>
          )}
          <span className="text-warm-muted/60 text-[11px] leading-none tabular-nums">
            {message.created_at?.slice(11, 16) || ''}
          </span>
        </div>
      </div>
    </div>
  )
}
