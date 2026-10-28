"use client"

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { generateId } from '@/lib/utils'

export interface ActivityLog {
  id: string
  userId: string
  userName: string
  userRole: 'admin' | 'moderator' | 'member'
  action: string
  details: string
  timestamp: Date
  ipAddress?: string
  userAgent?: string
}

interface ActivityLogContextType {
  logs: ActivityLog[]
  addLog: (log: Omit<ActivityLog, 'id' | 'timestamp'>) => void
  refreshLogs: () => Promise<void>
  getUserLogs: (userId: string) => ActivityLog[]
  getRecentLogs: (limit?: number) => ActivityLog[]
  clearLogs: () => void
}

const ActivityLogContext = createContext<ActivityLogContextType | undefined>(undefined)

const initialLogs: ActivityLog[] = []

export function ActivityLogProvider({ children }: { children: ReactNode }) {
  const [logs, setLogs] = useState<ActivityLog[]>(initialLogs)
  const [isLoaded, setIsLoaded] = useState(false)

  const refreshLogs = useCallback(async () => {
    try {
      const response = await fetch('/api/activity-logs')
      const loadedLogs = await response.json()
      
      if (response.ok && Array.isArray(loadedLogs)) {
        setLogs(loadedLogs.map((log: any) => ({
          ...log,
          timestamp: new Date(log.timestamp)
        })))
      }
    } catch (error) {
      console.error('Failed to load logs from API:', error)
    } finally {
      setIsLoaded(true)
    }
  }, [])

  useEffect(() => {
    refreshLogs()
  }, [refreshLogs])

  const addLog = async (logData: Omit<ActivityLog, 'id' | 'timestamp'>) => {
    const generatedId = generateId();

    const newLog: ActivityLog = {
      ...logData,
      id: generatedId,
      timestamp: new Date(),
    }

    try {
      const response = await fetch('/api/activity-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation: 'add', ...newLog })
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status} - ${response.statusText}`)
      }

      setLogs(prev => [newLog, ...prev])
    } catch (error) {
      console.error('Failed to add log via API. Stvarna greška:', error)
    }
  }

  const getUserLogs = (userId: string) => {
    return logs.filter(log => log.userId === userId)
  }

  const getRecentLogs = (limit: number = 50) => {
    return logs.slice(0, limit)
  }

  const clearLogs = () => {
    console.warn('Logovi se ne mogu izbrisati!')
  }

  return (
    <ActivityLogContext.Provider value={{
      logs,
      addLog,
      refreshLogs,
      getUserLogs,
      getRecentLogs,
      clearLogs
    }}>
      {children}
    </ActivityLogContext.Provider>
  )
}

export function useActivityLog() {
  const context = useContext(ActivityLogContext)
  if (context === undefined) {
    throw new Error('useActivityLog must be used within an ActivityLogProvider')
  }
  return context
}
