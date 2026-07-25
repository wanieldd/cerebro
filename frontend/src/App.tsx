import { useState, useEffect, useCallback, useRef } from 'react'
import { MessageSquare, Plus, Trash2, Brain, Settings as SettingsIcon, Search, Key, FileText } from 'lucide-react'
import type { Conversation, Message as MessageType, SSEEvent, Prompt, ChatParams } from './types'
import * as api from './api/client'
import type { AuthStatus } from './api/client'
import ChatView from './components/ChatView'
import Settings from './components/Settings'
import MemoryManager from './components/MemoryManager'
import PromptLibrary from './components/PromptLibrary'
import OnboardingWizard from './components/OnboardingWizard'
import SignIn from './components/SignIn'

import ConfirmDialog from './components/ConfirmDialog'

type Page = 'chat' | 'settings' | 'memories' | 'prompts'
type AuthState = 'loading' | 'onboarding' | 'signin' | 'authenticated'

export default function App() {
  const [authState, setAuthState] = useState<AuthState>('loading')
  const [page, setPage] = useState<Page>('chat')
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<MessageType[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [streamingToolCalls, setStreamingToolCalls] = useState<SSEEvent[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Conversation[] | null>(null)
  const [folders, setFolders] = useState<string[]>([])
  const [activeFolder, setActiveFolder] = useState<string | null>(null)
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [error, setError] = useState<string | null>(null)
  const [deleteConfirming, setDeleteConfirming] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('hermes_ui_api_key') || '')
  const abortRef = useRef<AbortController | null>(null)

  // Auth check
  useEffect(() => {
    api.getAuthStatus().then((status: AuthStatus) => {
      if (!status.has_users) {
        setAuthState('onboarding')
      } else if (!status.authenticated) {
        setAuthState('signin')
      } else {
        setAuthState('authenticated')
      }
    }).catch(() => {
      // If server unreachable, assume local mode — skip auth
      setAuthState('authenticated')
    })
  }, [])

  // Data fetching — must be BEFORE early returns so hook count stays consistent
  useEffect(() => {
    api.getConversations().then(setConversations).catch(() => {})
    api.getFolders().then(setFolders).catch(() => {})
    api.getPrompts().then(setPrompts).catch(() => {})
  }, [])

  useEffect(() => {
    if (activeConvId) {
      api.getConversation(activeConvId).then((d) => {
        setMessages(d.messages)
        setStreamingContent('')
        setStreamingToolCalls([])
      }).catch(() => {
        setActiveConvId(null)
        setMessages([])
      })
    } else {
      setMessages([])
      setStreamingContent('')
      setStreamingToolCalls([])
    }
  }, [activeConvId])

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults(null); return }
    const timer = setTimeout(async () => {
      try { setSearchResults(await api.searchConversations(searchQuery)) }
      catch { setSearchResults(null) }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  // Keep apiKey in sync with localStorage (so sidebar updates when Settings changes it)
  useEffect(() => {
    const handler = () => setApiKey(localStorage.getItem('hermes_ui_api_key') || '')
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  const model = localStorage.getItem('hermes_ui_model') || ''
  const imageModel = localStorage.getItem('cerebro_image_model') || ''
  const systemPrompt = localStorage.getItem('cerebro_system_prompt') || ''
  const autoMemory = localStorage.getItem('cerebro_auto_memory') !== 'false'
  const autoTitle = localStorage.getItem('cerebro_auto_title') !== 'false'

  const handleStopGeneration = useCallback(() => {
    abortRef.current?.abort()
    setIsStreaming(false)
    setStreamingContent('')
    setStreamingToolCalls([])
    setMessages((prev) => prev.filter((m) => m.id !== 'streaming-placeholder'))
  }, [])

  const handleNewChat = useCallback(async () => {
    const conv = await api.createConversation(undefined, activeFolder || undefined)
    setConversations((prev) => [conv, ...prev])
    setActiveConvId(conv.id)
    setMessages([])
    setStreamingContent('')
    setStreamingToolCalls([])
    setError(null)
    setPage('chat')
  }, [activeFolder])

  const handleDeleteConv = useCallback(async (id: string) => {
    setDeleteConfirming(id)
  }, [])

  const confirmDelete = useCallback(async () => {
    if (!deleteConfirming) return
    const id = deleteConfirming
    setDeleteConfirming(null)
    try {
      await api.deleteConversation(id)
    } catch (e) {
      console.error('Delete failed:', e)
    }
    setConversations((prev) => prev.filter((c) => c.id !== id))
    if (activeConvId === id) { setActiveConvId(null); setMessages([]) }
  }, [deleteConfirming, activeConvId])

  const handleSendMessage = useCallback(async (content: string, params?: ChatParams) => {
    if (isStreaming) return
    setError(null)

    const controller = new AbortController()
    abortRef.current = controller

    let convId = activeConvId
    if (!convId) {
      const conv = await api.createConversation(undefined, activeFolder || undefined)
      setConversations((prev) => [conv, ...prev])
      setActiveConvId(conv.id)
      convId = conv.id
    }
    if (!apiKey) { setPage('settings'); return }

    setIsStreaming(true)
    setStreamingContent('')
    setStreamingToolCalls([])

    const userMsg: MessageType = {
      id: 'temp-' + Date.now(), conversation_id: convId, role: 'user', content, created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg, {
      id: 'streaming-placeholder', conversation_id: convId, role: 'assistant', content: '', created_at: new Date().toISOString(),
    }])

    try {
      let accumulated = ''
      for await (const event of api.streamChat(convId, content, apiKey, {
        model: model || undefined, ...params,
        signal: controller.signal,
        auto_title: autoTitle,
        auto_memory: autoMemory,
        system_prompt: systemPrompt || undefined,
      })) {
        if (event.type === 'token') {
          accumulated += event.content || ''
          setStreamingContent(accumulated)
          setMessages((prev) => {
            const msgs = [...prev]; const last = msgs[msgs.length - 1]
            if (last?.id === 'streaming-placeholder') msgs[msgs.length - 1] = { ...last, content: accumulated }
            return msgs
          })
        } else if (event.type === 'tool_call') {
          setStreamingToolCalls((prev) => [...prev, event])
        } else if (event.type === 'tool_result') {
          setStreamingToolCalls((prev) => prev.map((tc) => tc.id === event.id ? { ...tc, result: event.content } : tc))
        } else if (event.type === 'done') {
          const data = await api.getConversation(convId)
          setMessages(data.messages)
          setStreamingContent('')
          setStreamingToolCalls([])
          setConversations((prev) => prev.map((c) =>
            c.id === convId ? { ...c, updated_at: new Date().toISOString() } : c
          ).sort((a, b) => b.updated_at.localeCompare(a.updated_at)))
        } else if (event.type === 'error') {
          setError(event.content || 'An error occurred')
          setMessages((prev) => prev.filter((m) => m.id !== 'streaming-placeholder'))
          setStreamingContent('')
          setStreamingToolCalls([])
        }
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'Request failed')
      setMessages((prev) => prev.filter((m) => m.id !== 'streaming-placeholder'))
    } finally {
      setIsStreaming(false)
      setStreamingContent('')
      setStreamingToolCalls([])
    }
  }, [activeConvId, activeFolder, apiKey, model, isStreaming])

  const handleEditResubmit = useCallback(async (messageId: string, newContent: string) => {
    await api.editMessage(messageId, newContent)
    const convId = activeConvId
    if (!convId) return

    const controller = new AbortController()
    abortRef.current = controller

    setIsStreaming(true); setStreamingContent(''); setStreamingToolCalls([])
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === messageId)
      if (idx === -1) return prev
      const trimmed = [...prev.slice(0, idx + 1)]
      trimmed[idx] = { ...trimmed[idx], content: newContent }
      return [...trimmed, { id: 'streaming-placeholder', conversation_id: convId, role: 'assistant', content: '', created_at: new Date().toISOString() }]
    })

    try {
      let accumulated = ''
      for await (const event of api.streamResubmit(convId, newContent, apiKey, model || undefined, controller.signal)) {
        if (event.type === 'token') {
          accumulated += event.content || ''
          setStreamingContent(accumulated)
          setMessages((prev) => {
            const msgs = [...prev]; const last = msgs[msgs.length - 1]
            if (last?.id === 'streaming-placeholder') msgs[msgs.length - 1] = { ...last, content: accumulated }
            return msgs
          })
        } else if (event.type === 'tool_call') {
          setStreamingToolCalls((prev) => [...prev, event])
        } else if (event.type === 'tool_result') {
          setStreamingToolCalls((prev) => prev.map((tc) => tc.id === event.id ? { ...tc, result: event.content } : tc))
        } else if (event.type === 'done') {
          const data = await api.getConversation(convId)
          setMessages(data.messages); setStreamingContent(''); setStreamingToolCalls([])
        } else if (event.type === 'error') {
          setError(event.content || ''); setMessages((prev) => prev.filter((m) => m.id !== 'streaming-placeholder'))
          setStreamingContent(''); setStreamingToolCalls([])
        }
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'Request failed')
      setMessages((prev) => prev.filter((m) => m.id !== 'streaming-placeholder'))
    } finally {
      setIsStreaming(false); setStreamingContent(''); setStreamingToolCalls([])
    }
  }, [activeConvId, apiKey, model])

  const displayedConversations = searchResults !== null ? searchResults
    : activeFolder ? conversations.filter((c) => c.folder === activeFolder) : conversations

  const handleAuthComplete = () => {
    setAuthState('authenticated')
  }

  // If auth is loading or showing auth screens, render those instead of the app
  if (authState === 'loading') {
    return (
      <div className="min-h-screen bg-warm-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-mustard border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (authState === 'onboarding') {
    return <OnboardingWizard onComplete={handleAuthComplete} onSwitchToSignin={() => setAuthState('signin')} />
  }

  if (authState === 'signin') {
    return <SignIn onSignIn={handleAuthComplete} onSwitchToSignup={() => setAuthState('onboarding')} />
  }

  return (
    <div className="flex h-screen bg-warm-bg text-warm-text">
      {/* Sidebar */}
      {sidebarOpen && (
              <aside className="w-56 bg-warm-surface border-r border-warm-border flex flex-col shrink-0">
                {/* Branding */}
                <div className="px-3 py-3 border-b border-warm-border flex items-center gap-2">
                  <div className="w-7 h-7 bg-mustard rounded-lg flex items-center justify-center shrink-0">
                    <MessageSquare size={14} className="text-black" />
                  </div>
                  <span
                    className="text-sm font-semibold text-warm-text"
                    style={{ fontFamily: 'var(--font-serif)' }}
                  >
                    Cerebro
                  </span>
                </div>

                <div className="p-2 border-b border-warm-border">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-warm-muted" />
              <input
                type="text" value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full bg-warm-bg border border-warm-border rounded-lg pl-8 pr-3 py-1.5 text-warm-text placeholder-warm-muted focus:outline-none focus:ring-2 focus:ring-mustard text-xs"
              />
            </div>
          </div>

          <div className="p-2">
            <button
              onClick={handleNewChat}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-warm-border text-warm-muted hover:text-warm-text hover:bg-warm-elevated transition-colors text-sm"
            >
              <Plus size={16} />
              New Chat
            </button>
          </div>

          {folders.length > 0 && (
            <div className="px-2 pb-1 flex gap-1 overflow-x-auto">
              <button
                onClick={() => setActiveFolder(null)}
                className={`px-2 py-1 rounded text-xs whitespace-nowrap transition-colors ${
                  activeFolder === null ? 'bg-mustard/20 text-mustard' : 'text-warm-muted hover:text-warm-text'
                }`}
              >
                All
              </button>
              {folders.map((f) => (
                <button
                  key={f}
                  onClick={() => setActiveFolder(f)}
                  className={`px-2 py-1 rounded text-xs whitespace-nowrap transition-colors ${
                    activeFolder === f ? 'bg-mustard/20 text-mustard' : 'text-warm-muted hover:text-warm-text'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {displayedConversations.length === 0 && (
              <div className="text-warm-muted text-xs text-center py-4">
                {searchQuery ? 'No results' : 'No conversations'}
              </div>
            )}
            {displayedConversations.map((conv) => (
              <div
                key={conv.id}
                className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors ${
                  activeConvId === conv.id
                    ? 'bg-warm-elevated text-warm-text'
                    : 'text-warm-muted hover:bg-warm-elevated hover:text-warm-text'
                }`}
                onClick={() => { setActiveConvId(conv.id); setPage('chat'); setSearchQuery(''); setSearchResults(null) }}
              >
                <MessageSquare size={14} className="shrink-0 text-warm-muted" />
                <span className="flex-1 truncate">{conv.title}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteConv(conv.id) }}
                  className="opacity-40 hover:opacity-100 hover:text-warm-danger transition-opacity"
                  title="Delete conversation"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>

          <div className="p-2 border-t border-warm-border space-y-0.5">
            <button
              onClick={() => setPage('prompts')}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                page === 'prompts' ? 'bg-warm-elevated text-warm-text' : 'text-warm-muted hover:bg-warm-elevated hover:text-warm-text'
              }`}
            >
              <FileText size={16} />
              Prompts
              <span className="ml-auto text-xs text-warm-muted/60">{prompts.length}</span>
            </button>
            <button
              onClick={() => setPage('memories')}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                page === 'memories' ? 'bg-warm-elevated text-warm-text' : 'text-warm-muted hover:bg-warm-elevated hover:text-warm-text'
              }`}
            >
              <Brain size={16} />
              Memories
            </button>
            <button
              onClick={() => setPage('settings')}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                page === 'settings' ? 'bg-warm-elevated text-warm-text' : 'text-warm-muted hover:bg-warm-elevated hover:text-warm-text'
              }`}
            >
              <SettingsIcon size={16} />
              Settings
            </button>
            {!apiKey && (
              <div className="flex items-center gap-2 px-3 py-2 text-xs text-mustard">
                <Key size={12} />
                No API key set
              </div>
            )}
          </div>
        </aside>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <div className="md:hidden flex items-center gap-2 p-2 border-b border-warm-border bg-warm-surface">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-warm-elevated rounded-lg">
            <MessageSquare size={18} />
          </button>
          <span className="text-sm font-medium truncate">
            {conversations.find((c) => c.id === activeConvId)?.title || 'Cerebro'}
          </span>
        </div>

        {page === 'chat' && (
          <ChatView
            messages={messages} isStreaming={isStreaming} streamingContent={streamingContent}
            streamingToolCalls={streamingToolCalls} onSend={handleSendMessage}
            onEditResubmit={handleEditResubmit} onStop={handleStopGeneration}
            hasApiKey={!!apiKey} error={error} prompts={prompts}
          />
        )}
        {page === 'settings' && (
          <Settings
            onBack={() => {
              setPage('chat')
              setApiKey(localStorage.getItem('hermes_ui_api_key') || '')
            }}
          />
        )}
        {page === 'memories' && <MemoryManager onBack={() => setPage('chat')} />}
        {page === 'prompts' && (
          <PromptLibrary prompts={prompts} onBack={() => setPage('chat')} onSelect={() => {}} onRefresh={() => api.getPrompts().then(setPrompts)} />
        )}
      </div>

      {/* Delete confirmation dialog */}
      {deleteConfirming && (
        <ConfirmDialog
          title="Delete conversation"
          message="This will permanently delete this conversation and all its messages. This action cannot be undone."
          confirmLabel="Delete"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteConfirming(null)}
        />
      )}
    </div>
  )
}