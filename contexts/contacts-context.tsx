"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export interface Contact {
  id: number
  name: string
  address?: string
  email?: string
  phone?: string
  workplace?: string
  category?: string
  notes?: string
  website?: string
  created_at?: string
  updated_at?: string
}

interface ContactsContextType {
  contacts: Contact[]
  isLoading: boolean
  addContact: (contact: Omit<Contact, 'id'>) => Promise<void>
  updateContact: (id: number, updates: Partial<Contact>) => Promise<void>
  deleteContact: (id: number) => Promise<void>
  refreshContacts: () => Promise<void>
}

const ContactsContext = createContext<ContactsContextType | undefined>(undefined)

export function ContactsProvider({ children }: { children: ReactNode }) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchContacts = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/contacts')
      if (response.ok) {
        const data = await response.json()
        setContacts(data)
      }
    } catch (error) {
      console.error('Failed to fetch contacts:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchContacts()
  }, [])

  const addContact = async (contactData: Omit<Contact, 'id'>) => {
    try {
      const response = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', ...contactData })
      })
      if (response.ok) {
        await fetchContacts()
      }
    } catch (error) {
      console.error('Failed to add contact:', error)
    }
  }

  const updateContact = async (id: number, updates: Partial<Contact>) => {
    try {
      const response = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', id, ...updates })
      })
      if (response.ok) {
        await fetchContacts()
      }
    } catch (error) {
      console.error('Failed to update contact:', error)
    }
  }

  const deleteContact = async (id: number) => {
    try {
      const response = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id })
      })
      if (response.ok) {
        await fetchContacts()
      }
    } catch (error) {
      console.error('Failed to delete contact:', error)
    }
  }

  return (
    <ContactsContext.Provider value={{ 
      contacts, 
      isLoading, 
      addContact, 
      updateContact, 
      deleteContact, 
      refreshContacts: fetchContacts 
    }}>
      {children}
    </ContactsContext.Provider>
  )
}

export function useContacts() {
  const context = useContext(ContactsContext)
  if (context === undefined) {
    throw new Error('useContacts must be used within a ContactsProvider')
  }
  return context
}
