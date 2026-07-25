export interface Conversation {
  id: string
  title: string
  created_at: string
  updated_at: string
  folder?: string
}

export interface ToolCall {
  id: string
  type: string
  function: {
    name: string
    arguments: string
  }
}

export interface Message {
  id: string
  conversation_id: string
  role: 'user' | 'assistant' | 'tool' | 'system'
  content: string
  tool_calls?: ToolCall[] | null
  created_at: string
}

export interface Memory {
  id?: string
  key: string
  content: string
  created_at?: string
  updated_at?: string
}

export interface ConversationDetail {
  conversation: Conversation
  messages: Message[]
}

export interface SSEEvent {
  type: 'token' | 'tool_call' | 'tool_result' | 'done' | 'error'
  content?: string
  id?: string
  name?: string
  arguments?: string
  finish_reason?: string
}

export interface Prompt {
  id: string
  title: string
  content: string
  created_at: string
  updated_at: string
}

export interface ModelOption {
  id: string
  name: string
  pricing: Record<string, number>
  context_length: number
}

export interface UploadResult {
  url: string
  filename: string
  size: number
  is_text: boolean
  ext: string
}

export interface ChatParams {
  reasoning_effort?: string
  scope?: string
  auto_title?: boolean
  auto_memory?: boolean
  system_prompt?: string
}
