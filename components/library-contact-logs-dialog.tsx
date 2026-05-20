"use client"

import { useState, useEffect } from "react"
import { X, Plus, Calendar, User, MessageCircle, Trash2, Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ExternalLibrary, LibraryContactLog } from "@/types/external-library"
import { useAuth } from "@/contexts/auth-context"

interface Props {
  library: ExternalLibrary
  onClose: () => void
}

export function LibraryContactLogsDialog({ library, onClose }: Props) {
  const { user } = useAuth()
  const [logs, setLogs] = useState<LibraryContactLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showAdd, setShowAdd] = useState(false)

  // New log form
  const [newLog, setNewLog] = useState({
    contact_date: new Date().toISOString().split('T')[0],
    library_contact_person: "",
    notes: ""
  })

  useEffect(() => {
    fetchLogs()
  }, [library.id])

  async function fetchLogs() {
    try {
      const res = await fetch(`/api/external-libraries?id=${library.id}`)
      const data = await res.json()
      if (data.logs) {
        setLogs(data.logs.sort((a: any, b: any) => new Date(b.contact_date).getTime() - new Date(a.contact_date).getTime()))
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleAddLog(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/external-libraries', {
        method: 'POST',
        body: JSON.stringify({
          action: 'addLog',
          id: library.id,
          contact_date: newLog.contact_date,
          contact_person_id: user.id,
          contact_person_name: user.name,
          library_contact_person: newLog.library_contact_person,
          notes: newLog.notes
        })
      })

      if (res.ok) {
        setNewLog({
          contact_date: new Date().toISOString().split('T')[0],
          library_contact_person: "",
          notes: ""
        })
        setShowAdd(false)
        fetchLogs()
      }
    } catch (error) {
      console.error('Failed to add log:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDeleteLog(logId: number) {
    if (!confirm('Jeste li sigurni da želite obrisati ovaj zapis?')) return

    try {
      const res = await fetch('/api/external-libraries', {
        method: 'POST',
        body: JSON.stringify({ action: 'deleteLog', id: library.id, logId })
      })
      if (res.ok) fetchLogs()
    } catch (error) {
      console.error('Failed to delete log:', error)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl border-border bg-card">
        <DialogHeader>
          <div className="flex items-start justify-between pr-6">
            <div>
              <DialogTitle className="font-serif text-2xl font-bold">{library.naziv}</DialogTitle>
              <p className="mt-1 text-sm text-muted-foreground">{library.mjesto}, {library.adresa}</p>
            </div>
            {!showAdd && (
              <Button size="sm" className="gap-2" onClick={() => setShowAdd(true)}>
                <Plus className="h-4 w-4" /> Novi kontakt
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="mt-6">
          {showAdd && (
            <form onSubmit={handleAddLog} className="mb-8 rounded-xl border border-accent/20 bg-accent/5 p-4">
              <div className="mb-4 flex items-center justify-between">
                <h4 className="font-bold">Novi zapis kontakta</h4>
                <Button variant="ghost" size="sm" onClick={() => setShowAdd(false)}><X className="h-4 w-4" /></Button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Datum</label>
                  <Input type="date" value={newLog.contact_date} onChange={e => setNewLog({...newLog, contact_date: e.target.value})} className="bg-background" required />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Osoba iz knjižnice</label>
                  <Input placeholder="S kime ste razgovarali?" value={newLog.library_contact_person} onChange={e => setNewLog({...newLog, library_contact_person: e.target.value})} className="bg-background" />
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Bilješke i dogovor</label>
                  <Textarea placeholder="Što ste dogovarali? Status suradnje..." value={newLog.notes} onChange={e => setNewLog({...newLog, notes: e.target.value})} className="h-24 bg-background" required />
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <Button type="submit" disabled={isSubmitting} className="gap-2">
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Spremi zapis
                </Button>
              </div>
            </form>
          )}

          <div className="space-y-4">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Povijest kontakata</h4>
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : logs.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border py-12 text-center text-muted-foreground">
                <MessageCircle className="mx-auto mb-2 h-8 w-8 opacity-20" />
                <p>Nema evidentiranih kontakata za ovu knjižnicu.</p>
              </div>
            ) : (
              <div className="relative space-y-4 before:absolute before:left-3 before:top-2 before:h-[calc(100%-16px)] before:w-px before:bg-border">
                {logs.map(log => (
                  <div key={log.id} className="relative pl-10 group">
                    <div className="absolute left-1 top-2 h-4 w-4 rounded-full border-2 border-background bg-accent" />
                    <div className="rounded-xl border border-border bg-card p-4 transition-all group-hover:border-accent/30 group-hover:shadow-sm">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1 font-medium text-foreground"><Calendar className="h-3 w-3" /> {new Date(log.contact_date).toLocaleDateString("hr-HR")}</span>
                          <span className="flex items-center gap-1"><User className="h-3 w-3" /> {log.contact_person_name}</span>
                          {log.library_contact_person && <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" /> Kontakt: {log.library_contact_person}</span>}
                        </div>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDeleteLog(log.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{log.notes}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
