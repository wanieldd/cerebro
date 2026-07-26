import type { Conversation, ConversationDetail, Memory, SSEEvent, Prompt, ModelOption, UploadResult, ChatParams, Project, ProjectDetail, Document } from '../types'

const BASE = '/api'

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(err || `HTTP ${res.status}`)
  }
  return res.json()
}

// ── Streaming Chat ──

export async function* streamChat(
  conversationId: string,
  message: string,
  apiKey: string,
  params?: { model?: string; signal?: AbortSignal } & ChatParams,
): AsyncGenerator<SSEEvent> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Api-Key': apiKey,
  }
  if (params?.model) headers['X-Model'] = params.model

  // Pass image model if configured
  const imageM = localStorage.getItem('cerebro_image_model')
  if (imageM) headers['X-Image-Model'] = imageM

  const res = await fetch(`${BASE}/chat/${conversationId}`, {
    method: 'POST',
    headers,
    signal: params?.signal,
    body: JSON.stringify({
      message,
      reasoning_effort: params?.reasoning_effort,
      scope: params?.scope,
      auto_title: params?.auto_title,
      auto_memory: params?.auto_memory,
      system_prompt: params?.system_prompt,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(err || `HTTP ${res.status}`)
  }

  const reader = res.body?.getReader()
  if (!reader) throw new Error('Response body not readable')

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || '' // Keep incomplete line in buffer

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        const event: SSEEvent = JSON.parse(trimmed)
        yield event
      } catch {
        // Skip malformed lines
      }
    }
  }
}

export async function* streamResubmit(
  conversationId: string,
  message: string,
  apiKey: string,
  model?: string,
  signal?: AbortSignal,
): AsyncGenerator<SSEEvent> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Api-Key': apiKey,
  }
  if (model) headers['X-Model'] = model
  const imageM = localStorage.getItem('cerebro_image_model')
  if (imageM) headers['X-Image-Model'] = imageM

  const res = await fetch(`${BASE}/chat/${conversationId}/resubmit`, {
    method: 'POST',
    headers,
    signal,
    body: JSON.stringify({ content: message }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(err || `HTTP ${res.status}`)
  }

  const reader = res.body?.getReader()
  if (!reader) throw new Error('Response body not readable')

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        const event: SSEEvent = JSON.parse(trimmed)
        yield event
      } catch {
        // skip
      }
    }
  }
}

// ── Conversations ──

export function getConversations(): Promise<Conversation[]> {
  return fetchApi('/conversations')
}

export function createConversation(title?: string, folder?: string): Promise<Conversation> {
  return fetchApi('/conversations', {
    method: 'POST',
    body: JSON.stringify({ title: title || null, folder: folder || null }),
  })
}

export function getConversation(id: string): Promise<ConversationDetail> {
  return fetchApi(`/conversations/${id}`)
}

export function deleteConversation(id: string): Promise<{ deleted: boolean }> {
  return fetchApi(`/conversations/${id}`, { method: 'DELETE' })
}

export function updateConversation(id: string, data: { title?: string; folder?: string }): Promise<Conversation> {
  return fetchApi(`/conversations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

// ── Search ──

export function searchConversations(q: string): Promise<Conversation[]> {
  return fetchApi(`/search?q=${encodeURIComponent(q)}`)
}

// ── Folders ──

export function getFolders(): Promise<string[]> {
  return fetchApi('/folders')
}

export function getFolderConversations(folder: string): Promise<Conversation[]> {
  return fetchApi(`/folders/${encodeURIComponent(folder)}`)
}

// ── Messages ──

export function editMessage(messageId: string, content: string): Promise<{ updated: boolean }> {
  return fetchApi(`/messages/${messageId}`, {
    method: 'PATCH',
    body: JSON.stringify({ content }),
  })
}

// ── Regenerate ──

export async function* streamRegenerate(
  conversationId: string,
  apiKey: string,
  model?: string,
  signal?: AbortSignal,
): AsyncGenerator<SSEEvent> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Api-Key': apiKey,
  }
  if (model) headers['X-Model'] = model
  const imageM = localStorage.getItem('cerebro_image_model')
  if (imageM) headers['X-Image-Model'] = imageM

  const res = await fetch(`${BASE}/chat/${conversationId}/regenerate`, {
    method: 'POST',
    headers,
    signal,
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(err || `HTTP ${res.status}`)
  }

  const reader = res.body?.getReader()
  if (!reader) throw new Error('Response body not readable')

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        const event: SSEEvent = JSON.parse(trimmed)
        yield event
      } catch { /* skip */ }
    }
  }
}

// ── Conversation Export ──

export async function exportConversation(conversationId: string, fmt: 'json' | 'md'): Promise<string> {
  const token = getSessionToken()
  const headers: Record<string, string> = {}
  if (token) headers['X-Session-Token'] = token
  const res = await fetch(`${BASE}/conversations/${conversationId}/export?fmt=${fmt}`, { headers })
  if (!res.ok) throw new Error(`Export failed: HTTP ${res.status}`)
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}

// ── Token Count ──

export function getConversationTokens(conversationId: string): Promise<{ total_tokens: number; message_count: number; by_role: Record<string, number> }> {
  return fetchApi(`/conversations/${conversationId}/tokens`)
}

// ── Prompt Presets ──

export type PromptPreset = {
  id: string
  name: string
  content: string
  created_at: string
  updated_at: string
}

export function getPromptPresets(): Promise<PromptPreset[]> {
  return fetchApi('/prompt-presets')
}

export function createPromptPreset(name: string, content: string): Promise<PromptPreset> {
  return fetchApi('/prompt-presets', {
    method: 'POST',
    body: JSON.stringify({ name, content }),
  })
}

export function updatePromptPreset(id: string, name: string, content: string): Promise<{ updated: boolean }> {
  return fetchApi(`/prompt-presets/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name, content }),
  })
}

export function deletePromptPreset(id: string): Promise<{ deleted: boolean }> {
  return fetchApi(`/prompt-presets/${id}`, { method: 'DELETE' })
}

// ── Models ──

export function getModels(apiKey: string): Promise<ModelOption[]> {
  return fetchApi('/models', {
    headers: { 'X-Api-Key': apiKey },
  })
}

// ── Validation ──

export function validateApiKey(key: string): Promise<{ valid: boolean }> {
  return fetchApi('/validate-key', {
    method: 'POST',
    body: JSON.stringify({ key }),
  })
}

// ── Memories ──

export function getMemories(): Promise<Memory[]> {
  return fetchApi('/memories')
}

export function addMemory(key: string, content: string): Promise<Memory> {
  return fetchApi('/memories', {
    method: 'POST',
    body: JSON.stringify({ key, content }),
  })
}

export function deleteMemory(key: string): Promise<{ deleted: boolean }> {
  return fetchApi(`/memories/${encodeURIComponent(key)}`, { method: 'DELETE' })
}

// ── Prompts ──

export function getPrompts(): Promise<Prompt[]> {
  return fetchApi('/prompts')
}

export function createPrompt(title: string, content: string): Promise<Prompt> {
  return fetchApi('/prompts', {
    method: 'POST',
    body: JSON.stringify({ title, content }),
  })
}

export function updatePrompt(id: string, title: string, content: string): Promise<{ updated: boolean }> {
  return fetchApi(`/prompts/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ title, content }),
  })
}

export function deletePrompt(id: string): Promise<{ deleted: boolean }> {
  return fetchApi(`/prompts/${id}`, { method: 'DELETE' })
}

// ── File Upload ──

export async function uploadFile(file: File): Promise<UploadResult> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${BASE}/upload`, { method: 'POST', body: form })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(err || `HTTP ${res.status}`)
  }
  return res.json()
}

// ── Auth ──

export type AuthStatus = {
  has_users: boolean
  authenticated: boolean
  user: { id: string; username: string; display_name: string; created_at: string } | null
}

export type AuthResult = {
  user: { id: string; username: string; display_name: string; created_at: string }
  session_token: string
}

const SESSION_KEY = 'cerebro_session_token'

export function getSessionToken(): string | null {
  return localStorage.getItem(SESSION_KEY)
}

export function setSessionToken(token: string): void {
  localStorage.setItem(SESSION_KEY, token)
}

export function clearSessionToken(): void {
  localStorage.removeItem(SESSION_KEY)
}

// ── Projects ──

export function getProjects(): Promise<Project[]> {
  return fetchApi('/projects')
}

export function createProject(name: string, description?: string, context?: string): Promise<Project> {
  return fetchApi('/projects', {
    method: 'POST',
    body: JSON.stringify({ name, description: description || '', context: context || '' }),
  })
}

export function getProject(id: string): Promise<ProjectDetail> {
  return fetchApi(`/projects/${id}`)
}

export function updateProject(id: string, data: { name?: string; description?: string; context?: string }): Promise<Project> {
  return fetchApi(`/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function deleteProject(id: string): Promise<{ deleted: boolean }> {
  return fetchApi(`/projects/${id}`, { method: 'DELETE' })
}

// ── Documents ──

export function getDocuments(projectId?: string): Promise<Document[]> {
  const q = projectId ? `?project_id=${encodeURIComponent(projectId)}` : ''
  return fetchApi(`/documents${q}`)
}

export function createDocument(projectId?: string, title?: string, content?: string): Promise<Document> {
  return fetchApi('/documents', {
    method: 'POST',
    body: JSON.stringify({ project_id: projectId || '', title: title || 'Untitled', content: content || '' }),
  })
}

export function getDocument(id: string): Promise<Document> {
  return fetchApi(`/documents/${id}`)
}

export function saveDocument(id: string, data: { title?: string; content?: string }): Promise<Document> {
  return fetchApi(`/documents/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function deleteDocument(id: string): Promise<{ deleted: boolean }> {
  return fetchApi(`/documents/${id}`, { method: 'DELETE' })
}

async function authFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(err || `HTTP ${res.status}`)
  }
  return res.json()
}

export function getAuthStatus(): Promise<AuthStatus> {
  const token = getSessionToken()
  const headers: Record<string, string> = {}
  if (token) headers['X-Session-Token'] = token
  return authFetch('/auth/status', { headers })
}

export function signup(username: string, displayName: string, password: string): Promise<AuthResult> {
  return authFetch('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ username, display_name: displayName, password }),
  })
}

export function signin(username: string, password: string): Promise<AuthResult> {
  return authFetch('/auth/signin', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export function signout(): Promise<{ ok: boolean }> {
  const token = getSessionToken()
  const headers: Record<string, string> = {}
  if (token) headers['X-Session-Token'] = token
  return authFetch('/auth/signout', { method: 'POST', headers })
}

export function changePassword(currentPassword: string, newPassword: string): Promise<{ ok: boolean }> {
  const token = getSessionToken()
  const headers: Record<string, string> = {}
  if (token) headers['X-Session-Token'] = token
  return authFetch('/auth/change-password', {
    method: 'POST',
    headers,
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  })
}