"use client"

import { useState, useEffect, useMemo } from "react"
import { Search, MapPin, Mail, Phone, User, MessageSquare, Loader2, ChevronLeft, ChevronRight, Edit2, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ExternalLibrary } from "@/types/external-library"
import { EditLibraryDialog } from "./edit-library-dialog"

interface Props {
  search: string
  onSelect: (lib: ExternalLibrary) => void
}

const PAGE_SIZE = 12

export function ExternalLibrariesContent({ search, onSelect }: Props) {
  const [libraries, setLibraries] = useState<ExternalLibrary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [editingLib, setEditingLib] = useState<ExternalLibrary | null>(null)

  useEffect(() => {
    fetchLibraries()
  }, [])

  async function fetchLibraries() {
    try {
      const res = await fetch('/api/external-libraries')
      const data = await res.json()
      if (data.libraries) {
        setLibraries(data.libraries)
      }
    } catch (error) {
      console.error('Failed to fetch libraries:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const filtered = useMemo(() => {
    if (!search) return libraries
    const s = search.toLowerCase()
    return libraries.filter(l => 
      l.naziv.toLowerCase().includes(s) ||
      l.mjesto.toLowerCase().includes(s) ||
      l.adresa.toLowerCase().includes(s) ||
      l.k_kod.toLowerCase().includes(s)
    )
  }, [libraries, search])

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="mb-4 h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Učitavanje knjižnica…</p>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h2 className="font-serif text-4xl font-bold">Knjižnice i ustanove</h2>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Popis knjižnica i kontakata za suradnju na predavanjima i projektima.
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          {filtered.length} knjižnica
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {paged.map(lib => (
          <div key={lib.id} className="group flex flex-col rounded-xl border border-border bg-card p-5 transition-all hover:border-accent/40 hover:shadow-md">
            <div className="mb-3 flex-1">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{lib.k_kod || 'Bez koda'}</span>
                    {lib.contact_count && lib.contact_count > 0 ? (
                        <Badge variant="outline" className="h-4 gap-1 border-emerald-200 bg-emerald-50 px-1.5 text-[9px] font-bold uppercase tracking-wider text-emerald-700">
                            <CheckCircle2 className="h-2.5 w-2.5" /> Kontaktirano
                        </Badge>
                    ) : null}
                </div>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-accent" onClick={(e) => { e.stopPropagation(); setEditingLib(lib) }}>
                  <Edit2 className="h-3 w-3" />
                </Button>
              </div>
              <h3 className="line-clamp-2 font-serif text-lg font-bold leading-tight group-hover:text-accent transition-colors">{lib.naziv}</h3>
              <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{lib.postanski_broj} {lib.mjesto}, {lib.adresa}</span>
                </div>
                {lib.telefon && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    <span>{lib.telefon}</span>
                  </div>
                )}
                {(lib.email_sluzbeni || lib.email_direktni) && (
                  <div className="flex items-start gap-2">
                    <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{lib.email_sluzbeni || lib.email_direktni}</span>
                  </div>
                )}
                {lib.odgovorna_osoba && (
                  <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 shrink-0" />
                    <span>{lib.odgovorna_osoba}</span>
                  </div>
                )}
                {lib.last_contact_date && (
                  <div className="mt-2 border-t border-border pt-2 text-[10px] italic text-muted-foreground">
                    Zadnji kontakt: {new Date(lib.last_contact_date).toLocaleDateString("hr-HR")}
                  </div>
                )}
              </div>
            </div>
            
            <Button variant="outline" size="sm" className="mt-4 w-full gap-2 group-hover:bg-accent group-hover:text-accent-foreground" onClick={() => onSelect(lib)}>
              <MessageSquare className="h-3.5 w-3.5" /> Evidencija kontakata
            </Button>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
          <p className="text-sm text-muted-foreground">Strana <span className="font-medium">{page}</span> od <span className="font-medium">{totalPages}</span></p>
          <div className="flex items-center gap-1">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="rounded p-2 hover:bg-secondary disabled:opacity-40">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="rounded p-2 hover:bg-secondary disabled:opacity-40">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Search className="mb-4 h-12 w-12 text-muted-foreground/30" />
          <p className="text-lg font-semibold text-muted-foreground">Nema pronađenih knjižnica</p>
          <p className="text-sm text-muted-foreground">Pokušajte s drugim pojmom pretrage.</p>
        </div>
      )}
      {editingLib && (
        <EditLibraryDialog 
          library={editingLib} 
          onClose={() => setEditingLib(null)} 
          onSuccess={fetchLibraries} 
        />
      )}
    </div>
  )
}
