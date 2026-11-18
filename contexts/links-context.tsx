"use client"

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react'
import { usePathname } from 'next/navigation'

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
}

const LinksContext = createContext<LinksContextType | undefined>(undefined)

export function LinksProvider({ children }: { children: ReactNode }) {
  const [links, setLinks] = useState<UsefulLink[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const pathname = usePathname()
  const hasTriggeredInitialLoadRef = useRef(false)

  const fetchLinks = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/links')
      if (response.ok) {
        const data = await response.json()
        setLinks(data)
      }
    } catch (error) {
      console.error('Failed to fetch links:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (pathname?.startsWith('/dopuna-podataka')) return
    if (hasTriggeredInitialLoadRef.current) return
    const isPriorityRoute = pathname?.startsWith('/links') || pathname?.startsWith('/trash')
    if (isPriorityRoute) {
      hasTriggeredInitialLoadRef.current = true
      fetchLinks()
      return
    }
    const timer = window.setTimeout(() => {
      if (hasTriggeredInitialLoadRef.current) return
      hasTriggeredInitialLoadRef.current = true
      fetchLinks()
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [pathname, fetchLinks])

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
    <LinksContext.Provider value={{ links, isLoading, addLink, updateLink, deleteLink, refreshLinks: fetchLinks }}>
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
