import { useState } from 'react'
import { Plus, Folder, Edit2, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import type { Project } from '../types'

interface ProjectSidebarProps {
  projects: Project[]
  activeProjectId: string | null
  onSelectProject: (id: string | null) => void
  onNewProject: () => void
  onEditProject: (id: string) => void
  onDeleteProject: (id: string) => void
}

export default function ProjectSidebar({
  projects,
  activeProjectId,
  onSelectProject,
  onNewProject,
  onEditProject,
  onDeleteProject,
}: ProjectSidebarProps) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div>
      <div className="p-2 border-b border-warm-border">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-warm-muted hover:text-warm-text hover:bg-warm-elevated transition-colors"
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <Folder size={14} />
          <span className="flex-1 text-left font-medium">Projects</span>
          <span className="text-xs text-warm-muted/60">{projects.length}</span>
        </button>
        {expanded && (
          <button
            onClick={onNewProject}
            className="w-full flex items-center gap-2 px-3 py-1.5 mt-1 rounded-lg text-xs text-warm-muted hover:text-warm-text hover:bg-warm-elevated transition-colors"
          >
            <Plus size={12} />
            New Project
          </button>
        )}
      </div>
      {expanded && projects.length > 0 && (
        <div className="py-1">
          {projects.map((project) => (
            <div
              key={project.id}
              className={`group flex items-center gap-2 px-3 py-2 mx-1 rounded-lg cursor-pointer text-sm transition-colors ${
                activeProjectId === project.id
                  ? 'bg-blue/15 text-blue'
                  : 'text-warm-muted hover:bg-warm-elevated hover:text-warm-text'
              }`}
              onClick={() => onSelectProject(project.id)}
            >
              <Folder size={14} className="shrink-0" />
              <span className="flex-1 truncate">{project.name}</span>
              <span className="text-xs text-warm-muted/60">{project.conv_count}</span>
              <button
                onClick={(e) => { e.stopPropagation(); onEditProject(project.id) }}
                className="opacity-0 group-hover:opacity-40 hover:opacity-100 hover:text-blue transition-opacity"
                title="Edit project"
              >
                <Edit2 size={12} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteProject(project.id) }}
                className="opacity-0 group-hover:opacity-40 hover:opacity-100 hover:text-warm-danger transition-opacity"
                title="Delete project"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
