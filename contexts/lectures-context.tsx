"use client"

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
import { useAuth } from './auth-context'
import { useActivityLog } from './activity-log-context'

export interface LectureAttachment {
  id: string
  name: string
  url: string
  fileType: string
  size?: number
}

export interface Lecture {
  id: number
  title: string
  type: string       // 'lecture' | 'visit' | 'guest' | 'workshop'
  date: string
  start_time?: string
  end_time?: string
  location?: string
  description?: string
  host?: string
  hosts?: { name: string; memberId?: number }[]
  attendee_ids: number[]
  attachments: LectureAttachment[]
  status: 'scheduled' | 'completed' | 'cancelled'
  youtube_url?: string
  created_by?: string
  created_at?: string
}

interface LecturesContextType {
  lectures: Lecture[]
  isLoading: boolean
  addLecture: (data: Omit<Lecture, 'id' | 'created_at'>) => Promise<number | null>
  updateLecture: (id: number, data: Partial<Lecture>) => Promise<void>
  deleteLecture: (id: number) => Promise<void>
  refreshLectures: () => Promise<void>
}

const LecturesContext = createContext<LecturesContextType | undefined>(undefined)

export function LecturesProvider({ children }: { children: ReactNode }) {
  const [lectures, setLectures] = useState<Lecture[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { user } = useAuth()
  const { addLog } = useActivityLog()

  const fetchLectures = useCallback(async () => {
    try {
      const res = await fetch('/api/lectures')
      if (res.ok) {
        const data = await res.json()
        setLectures(data.lectures ?? [])
      }
    } catch (e) {
      console.error('Failed to load lectures', e)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchLectures() }, [fetchLectures])

  const addLecture = async (data: Omit<Lecture, 'id' | 'created_at'>): Promise<number | null> => {
    try {
      const res = await fetch('/api/lectures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', ...data }),
      })
      if (res.ok) {
        const { lecture } = await res.json()
        setLectures(prev => [lecture, ...prev])
        if (user) addLog({ userId: user.id.toString(), userName: user.name, userRole: user.role, action: 'Novo predavanje', details: `Dodano predavanje: ${data.title}` })
        return lecture.id
      }
    } catch (e) { console.error(e) }
    return null
  }

  const updateLecture = async (id: number, data: Partial<Lecture>) => {
    setLectures(prev => prev.map(l => l.id === id ? { ...l, ...data } : l))
    try {
      const res = await fetch('/api/lectures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', id, ...data }),
      })
      if (res.ok && user) {
        const lecture = lectures.find(l => l.id === id)
        addLog({ userId: user.id.toString(), userName: user.name, userRole: user.role, action: 'Ažuriranje predavanja', details: `Ažurirano predavanje: ${lecture?.title || id}` })
      }
    } catch (e) { console.error(e); await fetchLectures() }
  }

  const deleteLecture = async (id: number) => {
    setLectures(prev => prev.filter(l => l.id !== id))
    try {
      const lecture = lectures.find(l => l.id === id)
      const res = await fetch('/api/lectures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id }),
      })
      if (res.ok && user) {
        addLog({ userId: user.id.toString(), userName: user.name, userRole: user.role, action: 'Brisanje predavanja', details: `Obrisano predavanje: ${lecture?.title || id}` })
      }
    } catch (e) { console.error(e); await fetchLectures() }
  }

  return (
    <LecturesContext.Provider value={{ lectures, isLoading, addLecture, updateLecture, deleteLecture, refreshLectures: fetchLectures }}>
      {children}
    </LecturesContext.Provider>
  )
}

export function useLectures() {
  const ctx = useContext(LecturesContext)
  if (!ctx) throw new Error('useLectures must be used within LecturesProvider')
  return ctx
}
