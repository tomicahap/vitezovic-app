"use client"

import React, { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from './auth-context'
import { useActivityLog } from './activity-log-context'

export interface ProjectGoal { id: string; text: string; done: boolean }
export interface ProjectAttachment { id: string; name: string; url: string; fileType: string; size?: number }
export interface ProjectRecord { id: string; date: string; title: string; content: string }
export interface ProjectContributor { id: string; data: Record<string, any> }

export interface Project {
  id: number
  title: string
  description?: string
  status: 'active' | 'paused' | 'completed' | 'cancelled'
  priority: 'high' | 'medium' | 'low'
  progress: number
  start_date?: string
  end_date?: string
  lead_member_id?: number
  lead_member_name?: string
  member_ids: number[]
  goals: ProjectGoal[]
  attachments: ProjectAttachment[]
  records?: ProjectRecord[]
  contributors?: ProjectContributor[]
  contributor_template_id?: string
  notes?: string
  project_url?: string
  created_by?: string
  created_at?: string
}

interface ProjectsContextType {
  projects: Project[]
  isLoading: boolean
  addProject: (data: Omit<Project, 'id' | 'created_at'>) => Promise<Project | null>
  updateProject: (id: number, data: Partial<Project>) => Promise<void>
  deleteProject: (id: number) => Promise<void>
  refreshProjects: () => Promise<void>
  ensureLoaded: () => Promise<void>
}

const ProjectsContext = createContext<ProjectsContextType | undefined>(undefined)

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const { user } = useAuth()
  const { addLog } = useActivityLog()
  const pathname = usePathname()
  const hasTriggeredInitialLoadRef = useRef(false)
  const inFlightRef = useRef<Promise<void> | null>(null)

  const fetch_ = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/projects')
      if (res.ok) {
        const d = await res.json()
        setProjects(d.projects ?? [])
        hasTriggeredInitialLoadRef.current = true
      }
    } catch (e) { console.error(e) }
    finally { setIsLoading(false) }
  }, [])

  const ensureLoaded = useCallback(async () => {
    if (hasTriggeredInitialLoadRef.current) return
    if (inFlightRef.current) return inFlightRef.current
    const p = fetch_().finally(() => {
      inFlightRef.current = null
    })
    inFlightRef.current = p
    return p
  }, [fetch_])

  useEffect(() => {
    if (pathname?.startsWith('/dopuna-podataka')) return
    if (!user) {
      hasTriggeredInitialLoadRef.current = false
      inFlightRef.current = null
      setProjects([])
      setIsLoading(false)
      return
    }
    const isProjectsRoute = pathname?.startsWith('/projects')
    if (isProjectsRoute) {
      ensureLoaded()
    }
  }, [user, pathname, ensureLoaded])

  const addProject = async (data: Omit<Project, 'id' | 'created_at'>): Promise<Project | null> => {
    try {
      const res = await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'add', ...data }) })
      if (res.ok) {
        const { project } = await res.json()
        setProjects(prev => [project, ...prev])
        if (user) addLog({ userId: user.id.toString(), userName: user.name, userRole: user.role, action: 'Novi projekt', details: `Otvoren novi projekt: ${data.title}` })
        return project
      }
    } catch (e) { console.error(e) }
    return null
  }

  const updateProject = async (id: number, data: Partial<Project>) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, ...data } : p))
    try {
      const res = await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update', id, ...data }) })
      if (res.ok && user) {
        const project = projects.find(p => p.id === id)
        addLog({ userId: user.id.toString(), userName: user.name, userRole: user.role, action: 'Ažuriranje projekta', details: `Ažuriran projekt: ${project?.title || id}` })
      }
    } catch (e) { console.error(e); await fetch_() }
  }

  const deleteProject = async (id: number) => {
    setProjects(prev => prev.filter(p => p.id !== id))
    try {
      const project = projects.find(p => p.id === id)
      const res = await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', id }) })
      if (res.ok && user) {
        addLog({ userId: user.id.toString(), userName: user.name, userRole: user.role, action: 'Brisanje projekta', details: `Obrisan projekt: ${project?.title || id}` })
      }
    } catch (e) { console.error(e); await fetch_() }
  }

  return (
    <ProjectsContext.Provider value={{ projects, isLoading, addProject, updateProject, deleteProject, refreshProjects: fetch_, ensureLoaded }}>
      {children}
    </ProjectsContext.Provider>
  )
}

export function useProjects() {
  const ctx = useContext(ProjectsContext)
  if (!ctx) throw new Error('useProjects must be used within ProjectsProvider')
  return ctx
}
