"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'
import { useAuth } from './auth-context'
import { useActivityLog } from './activity-log-context'

// ─── Types ─────────────────────────────────────────────────────────────────

export interface AgendaItem {
  id: string
  text: string
  done?: boolean
}

export interface NextAgendaItem {
  id: string
  text: string
  addedBy: string
  addedAt: string
}

export interface MeetingAttachment {
  id: string
  name: string
  url: string
  fileType: 'image' | 'pdf' | 'word'
  size?: number
}

export interface Meeting {
  id: number
  title: string
  type: string
  date: string
  start_time?: string
  end_time?: string
  location?: string
  minutes?: string
  attendee_ids: number[]
  agenda: AgendaItem[]
  attachments: MeetingAttachment[]
  status: 'scheduled' | 'completed' | 'cancelled'
  next_meeting_date?: string
  next_meeting_time?: string
  next_meeting_location?: string
  next_meeting_agenda: NextAgendaItem[]
  chairperson?: string
  minute_taker?: string
  youtube_url?: string
  created_by?: string
  created_at?: string
  updated_at?: string
}

// ─── Context type ──────────────────────────────────────────────────────────

interface MeetingsContextType {
  meetings: Meeting[]
  isLoading: boolean
  addMeeting: (data: Omit<Meeting, 'id' | 'created_at' | 'updated_at'>) => Promise<number | null>
  updateMeeting: (id: number, updates: Partial<Meeting>) => Promise<void>
  deleteMeeting: (id: number) => Promise<void>
  addNextAgendaItem: (meetingId: number, item: NextAgendaItem) => Promise<void>
  removeNextAgendaItem: (meetingId: number, itemId: string) => Promise<void>
  getMeetingById: (id: number) => Meeting | undefined
  reload: () => Promise<void>
}

const MeetingsContext = createContext<MeetingsContextType | undefined>(undefined)

// ─── Provider ──────────────────────────────────────────────────────────────

export function MeetingsProvider({ children }: { children: ReactNode }) {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { user } = useAuth()
  const { addLog } = useActivityLog()

  const reload = useCallback(async () => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/meetings')
      if (res.ok) {
        const data = await res.json()
        setMeetings(data)
      }
    } catch (err) {
      console.error('Failed to load meetings:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const addMeeting = async (data: Omit<Meeting, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const res = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          ...data,
          created_by: user?.name ?? 'Nepoznat',
        }),
      })
      if (res.ok) {
        const { id } = await res.json()
        await reload()
        if (user) addLog({ userId: user.id.toString(), userName: user.name, userRole: user.role, action: 'Nova sjednica', details: `Zakazana nova sjednica: ${data.title} (${data.date})` })
        return id as number
      }
    } catch (err) {
      console.error('Failed to add meeting:', err)
    }
    return null
  }

  const updateMeeting = async (id: number, updates: Partial<Meeting>) => {
    try {
      const res = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', id, ...updates }),
      })
      if (res.ok) {
        const meeting = meetings.find(m => m.id === id)
        if (user) addLog({ userId: user.id.toString(), userName: user.name, userRole: user.role, action: 'Ažuriranje sjednice', details: `Ažurirani podaci za sjednicu: ${meeting?.title || id}` })
        await reload()
      }
    } catch (err) {
      console.error('Failed to update meeting:', err)
    }
  }

  const deleteMeeting = async (id: number) => {
    try {
      const res = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id }),
      })
      if (res.ok) {
        const meeting = meetings.find(m => m.id === id)
        if (user) addLog({ userId: user.id.toString(), userName: user.name, userRole: user.role, action: 'Brisanje sjednice', details: `Obrisana sjednica: ${meeting?.title || id}` })
        setMeetings(prev => prev.filter(m => m.id !== id))
      }
    } catch (err) {
      console.error('Failed to delete meeting:', err)
    }
  }

  const addNextAgendaItem = async (meetingId: number, item: NextAgendaItem) => {
    try {
      const res = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add-next-agenda-item', id: meetingId, item }),
      })
      if (res.ok) {
        if (user) addLog({ userId: user.id.toString(), userName: user.name, userRole: user.role, action: 'Dodavanje stavke dnevnog reda', details: `Dodana stavka: "${item.text}"` })
        setMeetings(prev =>
          prev.map(m =>
            m.id === meetingId
              ? { ...m, next_meeting_agenda: [...m.next_meeting_agenda, item] }
              : m
          )
        )
      }
    } catch (err) {
      console.error('Failed to add agenda item:', err)
    }
  }

  const removeNextAgendaItem = async (meetingId: number, itemId: string) => {
    try {
      const res = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove-next-agenda-item', id: meetingId, itemId }),
      })
      if (res.ok) {
        setMeetings(prev =>
          prev.map(m =>
            m.id === meetingId
              ? { ...m, next_meeting_agenda: m.next_meeting_agenda.filter(i => i.id !== itemId) }
              : m
          )
        )
      }
    } catch (err) {
      console.error('Failed to remove agenda item:', err)
    }
  }

  const getMeetingById = (id: number) => meetings.find(m => m.id === id)

  return (
    <MeetingsContext.Provider
      value={{
        meetings,
        isLoading,
        addMeeting,
        updateMeeting,
        deleteMeeting,
        addNextAgendaItem,
        removeNextAgendaItem,
        getMeetingById,
        reload,
      }}
    >
      {children}
    </MeetingsContext.Provider>
  )
}

export function useMeetings() {
  const ctx = useContext(MeetingsContext)
  if (!ctx) throw new Error('useMeetings must be used within a MeetingsProvider')
  return ctx
}
