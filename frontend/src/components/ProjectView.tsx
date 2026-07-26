import { useState, useEffect, useRef } from 'react'
import { ArrowLeft, Edit2, Trash2, Plus, MessageSquare, FileText } from 'lucide-react'
import type { Project, ProjectDetail, Conversation, Document } from '../types'
import * as api from '../api/client'
import ConfirmDialog from './ConfirmDialog'
import DocumentEditor from './DocumentEditor'

interface ProjectViewProps {
  projectId: string
  onBack: () => void
  onOpenConversation: (id: string) => void
  onNewChat: (projectId: string) => void
  onRefresh: () => void
}

export default function ProjectView({ projectId, onBack, onOpenConversation, onNewChat, onRefresh }: ProjectViewProps) {
  const [project, setProject] = useState<Project | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [context, setContext] = useState('')
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const contextTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Documents state
  const [documents, setDocuments] = useState<Document[]>([])
  const [editingDocument, setEditingDocument] = useState<Document | null>(null)

  useEffect(() => {
    api.getProject(projectId).then((d: ProjectDetail) => {
      setProject(d.project)
      setConversations(d.conversations)
      setName(d.project.name)
      setDescription(d.project.description)
      setContext(d.project.context)
      setLoading(false)
    }).catch(() => {
      setLoading(false)
    })
    api.getDocuments(projectId).then(setDocuments).catch(() => {})
  }, [projectId])

  const handleSaveName = async () => {
    if (!name.trim()) return
    setEditingName(false)
    setSaving(true)
    await api.updateProject(projectId, { name: name.trim() })
    setProject((prev) => prev ? { ...prev, name: name.trim() } : prev)
    setSaving(false)
    onRefresh()
  }

  const handleSaveDescription = async () => {
    await api.updateProject(projectId, { description })
    setProject((prev) => prev ? { ...prev, description } : prev)
    onRefresh()
  }

  useEffect(() => {
    if (contextTimer.current) clearTimeout(contextTimer.current)
    contextTimer.current = setTimeout(async () => {
      await api.updateProject(projectId, { context })
      onRefresh()
    }, 1000)
    return () => { if (contextTimer.current) clearTimeout(contextTimer.current) }
  }, [context])

  const handleDelete = async () => {
    await api.deleteProject(projectId)
    setShowDeleteConfirm(false)
    onBack()
    onRefresh()
  }

  const handleDocumentSave = async (id: string, data: { title?: string; content?: string }) => {
    const updated = await api.saveDocument(id, data)
    setDocuments((prev) => prev.map((d) => d.id === id ? { ...d, ...updated } : d))
    setEditingDocument((prev) => prev?.id === id ? { ...prev, ...updated } : prev)
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center text-warm-muted">
        Project not found
      </div>
    )
  }

  if (editingDocument) {
    return (
      <DocumentEditor
        document={editingDocument}
        onSave={handleDocumentSave}
        onBack={() => {
          setEditingDocument(null)
          api.getDocuments(projectId).then(setDocuments).catch(() => {})
        }}
      />
    )
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
      <div className="max-w-2xl w-full mx-auto p-6 space-y-6">
        {/* Back button */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-warm-muted hover:text-warm-text transition-colors"
        >
          <ArrowLeft size={16} />
          Back to chat
        </button>

        {/* Project name */}
        <div className="flex items-center gap-2">
          {editingName ? (
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleSaveName}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false) }}
              className="text-2xl font-bold bg-transparent border-b border-blue focus:outline-none text-warm-text w-full"
              autoFocus
            />
          ) : (
            <h1
              className="text-2xl font-bold text-warm-text cursor-pointer hover:text-blue transition-colors"
              onClick={() => setEditingName(true)}
            >
              {project.name}
            </h1>
          )}
          <button
            onClick={() => setEditingName(true)}
            className="text-warm-muted hover:text-warm-text transition-colors"
          >
            <Edit2 size={14} />
          </button>
          {saving && <span className="text-xs text-warm-muted">Saving...</span>}
        </div>

        {/* Description */}
        <div>
          <label className="text-xs text-warm-muted uppercase tracking-wider font-medium mb-1 block">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleSaveDescription}
            placeholder="Add a description..."
            className="w-full bg-warm-bg border border-warm-border rounded-lg px-3 py-2 text-sm text-warm-text placeholder-warm-muted focus:outline-none focus:ring-2 focus:ring-blue"
          />
        </div>

        {/* Context */}
        <div>
          <label className="text-xs text-warm-muted uppercase tracking-wider font-medium mb-1 block">
            Context document
            <span className="text-warm-muted/60 normal-case ml-1">(auto-saves)</span>
          </label>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Add context that will be included with every chat in this project..."
            rows={8}
            className="w-full bg-warm-bg border border-warm-border rounded-lg px-3 py-2 text-sm text-warm-text placeholder-warm-muted focus:outline-none focus:ring-2 focus:ring-blue resize-y font-mono"
          />
        </div>

        {/* Documents */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-warm-text">Documents</h2>
            <button
              onClick={async () => {
                const doc = await api.createDocument(projectId)
                setDocuments((prev) => [doc, ...prev])
                setEditingDocument(doc)
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue text-black rounded-lg text-xs font-medium hover:opacity-90 transition-opacity"
            >
              <Plus size={14} />
              New Document
            </button>
          </div>
          {documents.length === 0 ? (
            <p className="text-sm text-warm-muted">No documents yet.</p>
          ) : (
            <div className="space-y-1">
              {documents.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => setEditingDocument(doc)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-warm-muted hover:bg-warm-elevated hover:text-warm-text transition-colors text-left"
                >
                  <FileText size={14} className="shrink-0" />
                  <span className="truncate">{doc.title}</span>
                  <span className="text-xs text-warm-muted/60 ml-auto shrink-0">
                    {new Date(doc.updated_at).toLocaleDateString()}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Conversations */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-warm-text">Conversations</h2>
            <button
              onClick={() => onNewChat(projectId)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue text-black rounded-lg text-xs font-medium hover:opacity-90 transition-opacity"
            >
              <Plus size={14} />
              New Chat in Project
            </button>
          </div>
          {conversations.length === 0 ? (
            <p className="text-sm text-warm-muted">No conversations yet.</p>
          ) : (
            <div className="space-y-1">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => onOpenConversation(conv.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-warm-muted hover:bg-warm-elevated hover:text-warm-text transition-colors text-left"
                >
                  <MessageSquare size={14} className="shrink-0" />
                  <span className="truncate">{conv.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Delete */}
        <div className="pt-4 border-t border-warm-border">
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-warm-danger hover:bg-warm-danger/10 transition-colors"
          >
            <Trash2 size={14} />
            Delete Project
          </button>
        </div>
      </div>

      {showDeleteConfirm && (
        <ConfirmDialog
          title="Delete Project"
          message={`Are you sure you want to delete "${project.name}"? Conversations in this project will be unlinked but not deleted.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  )
}
