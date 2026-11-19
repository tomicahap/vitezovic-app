"use client"

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from './auth-context'

export interface UsefulLink {
  id: number
  title: string
  url: string
  description?: string
  category: 'rodoslovno' | 'opce' | 'drustvo'
  created_at?: string
  updated_at?: string
}

interface LinksContextType {
  links: UsefulLink[]
  isLoading: boolean
  addLink: (link: Omit<UsefulLink, 'id'>) => Promise<void>
  updateLink: (id: number, updates: Partial<UsefulLink>) => Promise<void>
  deleteLink: (id: number) => Promise<void>
  refreshLinks: () => Promise<void>
  ensureLoaded: () => Promise<void>
}

const LinksContext = createContext<LinksContextType | undefined>(undefined)

export function LinksProvider({ children }: { children: ReactNode }) {
  const [links, setLinks] = useState<UsefulLink[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const { user } = useAuth()
  const pathname = usePathname()
  const hasTriggeredInitialLoadRef = useRef(false)
  const inFlightRef = useRef<Promise<void> | null>(null)

  const fetchLinks = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/links')
      if (response.ok) {
        const data = await response.json()
        setLinks(data)
        hasTriggeredInitialLoadRef.current = true
      }
    } catch (error) {
      console.error('Failed to fetch links:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const ensureLoaded = useCallback(async () => {
    if (hasTriggeredInitialLoadRef.current) return
    if (inFlightRef.current) return inFlightRef.current
    const p = fetchLinks().finally(() => {
      inFlightRef.current = null
    })
    inFlightRef.current = p
    return p
  }, [fetchLinks])

  useEffect(() => {
    if (pathname?.startsWith('/dopuna-podataka')) return
    if (!user) {
      hasTriggeredInitialLoadRef.current = false
      inFlightRef.current = null
      setLinks([])
      setIsLoading(false)
      return
    }
    if (pathname?.startsWith('/links')) {
      ensureLoaded()
    }
  }, [user, pathname, ensureLoaded])

  const addLink = async (linkData: Omit<UsefulLink, 'id'>) => {
    try {
      const response = await fetch('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', ...linkData })
      })
      if (response.ok) await fetchLinks()
    } catch (error) {
      console.error('Failed to add link:', error)
    }
  }

  const updateLink = async (id: number, updates: Partial<UsefulLink>) => {
    try {
      const response = await fetch('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', id, ...updates })
      })
      if (response.ok) await fetchLinks()
    } catch (error) {
      console.error('Failed to update link:', error)
    }
  }

  const deleteLink = async (id: number) => {
    try {
      const response = await fetch('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id })
      })
      if (response.ok) await fetchLinks()
    } catch (error) {
      console.error('Failed to delete link:', error)
    }
  }

  return (
    <LinksContext.Provider value={{ links, isLoading, addLink, updateLink, deleteLink, refreshLinks: fetchLinks, ensureLoaded }}>
      {children}
    </LinksContext.Provider>
  )
}

export function useLinks() {
  const context = useContext(LinksContext)
  if (context === undefined) {
    throw new Error('useLinks must be used within a LinksProvider')
  }
  return context
}
