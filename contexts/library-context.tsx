"use client"

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { useActivityLog } from './activity-log-context'
import { useAuth } from './auth-context'

export interface Book {
  id: number
  broj?: number
  autor?: string
  naslov: string
  podnaslov?: string
  izdavac?: string
  mjesto?: string
  godina?: string
  isbn?: string
  uvez?: string
  stranice?: number
  jezik?: string
  signatura?: string
  polica?: string
  napomena?: string
  cover_url?: string
  loan_member_id?: number
  loan_member_name?: string
  loan_date?: string
  loan_return_date?: string
  loan_notes?: string
  rights_contacted?: number
  rights_contact_date?: string
  rights_responded?: number
  rights_response_date?: string
  rights_consent?: number
  rights_attachment?: string
  attachments?: { id: string; name: string; url: string; fileType: string; size?: number }[]
}

export interface Journal {
  id: number
  broj?: number
  naslov: string
  svesci?: string
  podrucje?: string
  izdavac?: string
  issn?: string
  napomena?: string
  attachments?: { id: string; name: string; url: string; fileType: string; size?: number }[]
}

interface LibraryContextType {
  books: Book[]
  journals: Journal[]
  isLoadingBooks: boolean
  isLoadingJournals: boolean
  addBook: (data: Omit<Book, 'id'>) => Promise<Book | null>
  updateBook: (id: number, data: Partial<Book>) => Promise<void>
  deleteBook: (id: number) => Promise<void>
  addJournal: (data: Omit<Journal, 'id'>) => Promise<Journal | null>
  updateJournal: (id: number, data: Partial<Journal>) => Promise<void>
  deleteJournal: (id: number) => Promise<void>
  refreshBooks: () => Promise<void>
  refreshJournals: () => Promise<void>
}

const LibraryContext = createContext<LibraryContextType | undefined>(undefined)

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [books, setBooks] = useState<Book[]>([])
  const [journals, setJournals] = useState<Journal[]>([])
  const [isLoadingBooks, setIsLoadingBooks] = useState(true)
  const [isLoadingJournals, setIsLoadingJournals] = useState(true)
  const { addLog } = useActivityLog()
  const { user } = useAuth()

  const fetchBooks = useCallback(async () => {
    setIsLoadingBooks(true)
    try {
      const res = await fetch('/api/library?type=books')
      if (res.ok) { const d = await res.json(); setBooks(d.books ?? []) }
    } catch (e) { console.error(e) }
    finally { setIsLoadingBooks(false) }
  }, [])

  const fetchJournals = useCallback(async () => {
    setIsLoadingJournals(true)
    try {
      const res = await fetch('/api/library?type=journals')
      if (res.ok) { const d = await res.json(); setJournals(d.journals ?? []) }
    } catch (e) { console.error(e) }
    finally { setIsLoadingJournals(false) }
  }, [])

  useEffect(() => { fetchBooks(); fetchJournals() }, [fetchBooks, fetchJournals])

  const addBook = async (data: Omit<Book, 'id'>): Promise<Book | null> => {
    try {
      const res = await fetch('/api/library', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'add', type: 'books', ...data }) })
      if (res.ok) {
        const { book } = await res.json()
        setBooks(prev => [...prev, book].sort((a, b) => (a.broj ?? 0) - (b.broj ?? 0)))
        if (user) addLog({ userId: user.id.toString(), userName: user.name, userRole: user.role, action: 'Dodavanje knjige', details: `Dodana knjiga: ${book.naslov} (${book.autor || 'Neznatno'})` })
        return book
      }
    } catch (e) { console.error(e) }
    return null
  }

  const updateBook = async (id: number, data: Partial<Book>) => {
    setBooks(prev => prev.map(b => b.id === id ? { ...b, ...data } : b))
    try {
      const res = await fetch('/api/library', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update', type: 'books', id, ...data }) })
      if (res.ok && user) {
        const book = books.find(b => b.id === id)
        addLog({ userId: user.id.toString(), userName: user.name, userRole: user.role, action: 'Ažuriranje knjige', details: `Ažurirana knjiga: ${book?.naslov || id}` })
      }
    } catch (e) { console.error(e); await fetchBooks() }
  }

  const deleteBook = async (id: number) => {
    setBooks(prev => prev.filter(b => b.id !== id))
    try {
      const book = books.find(b => b.id === id)
      const res = await fetch('/api/library', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', type: 'books', id }) })
      if (res.ok && user) {
        addLog({ userId: user.id.toString(), userName: user.name, userRole: user.role, action: 'Brisanje knjige', details: `Obrisana knjiga: ${book?.naslov || id}` })
      }
    } catch (e) { console.error(e); await fetchBooks() }
  }

  const addJournal = async (data: Omit<Journal, 'id'>): Promise<Journal | null> => {
    try {
      const res = await fetch('/api/library', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'add', type: 'journals', ...data }) })
      if (res.ok) {
        const { journal } = await res.json()
        setJournals(prev => [...prev, journal].sort((a, b) => (a.broj ?? 0) - (b.broj ?? 0)))
        if (user) addLog({ userId: user.id.toString(), userName: user.name, userRole: user.role, action: 'Dodavanje časopisa', details: `Dodan časopis: ${journal.naslov}` })
        return journal
      }
    } catch (e) { console.error(e) }
    return null
  }

  const updateJournal = async (id: number, data: Partial<Journal>) => {
    setJournals(prev => prev.map(j => j.id === id ? { ...j, ...data } : j))
    try {
      const res = await fetch('/api/library', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update', type: 'journals', id, ...data }) })
      if (res.ok && user) {
        const journal = journals.find(j => j.id === id)
        addLog({ userId: user.id.toString(), userName: user.name, userRole: user.role, action: 'Ažuriranje časopisa', details: `Ažuriran časopis: ${journal?.naslov || id}` })
      }
    } catch (e) { console.error(e); await fetchJournals() }
  }

  const deleteJournal = async (id: number) => {
    setJournals(prev => prev.filter(j => j.id !== id))
    try {
      const journal = journals.find(j => j.id === id)
      const res = await fetch('/api/library', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', type: 'journals', id }) })
      if (res.ok && user) {
        addLog({ userId: user.id.toString(), userName: user.name, userRole: user.role, action: 'Brisanje časopisa', details: `Obrisan časopis: ${journal?.naslov || id}` })
      }
    } catch (e) { console.error(e); await fetchJournals() }
  }

  return (
    <LibraryContext.Provider value={{ books, journals, isLoadingBooks, isLoadingJournals, addBook, updateBook, deleteBook, addJournal, updateJournal, deleteJournal, refreshBooks: fetchBooks, refreshJournals: fetchJournals }}>
      {children}
    </LibraryContext.Provider>
  )
}

export function useLibrary() {
  const ctx = useContext(LibraryContext)
  if (!ctx) throw new Error('useLibrary must be used within LibraryProvider')
  return ctx
}
