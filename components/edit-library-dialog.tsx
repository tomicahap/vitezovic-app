"use client"

import { useState, useEffect } from "react"
import { X, Save, Loader2, Trash2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ExternalLibrary } from "@/types/external-library"

interface Props {
  library: ExternalLibrary
  onClose: () => void
  onSuccess: () => void
}

export function EditLibraryDialog({ library, onClose, onSuccess }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [formData, setFormData] = useState({
    k_kod: library.k_kod || "",
    naziv: library.naziv || "",
    postanski_broj: library.postanski_broj || "",
    mjesto: library.mjesto || "",
    adresa: library.adresa || "",
    email_sluzbeni: library.email_sluzbeni || "",
    email_direktni: library.email_direktni || "",
    telefon: library.telefon || "",
    odgovorna_osoba: library.odgovorna_osoba || ""
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const res = await fetch('/api/external-libraries', {
        method: 'POST',
        body: JSON.stringify({ action: 'update', id: library.id, ...formData })
      })
      if (res.ok) {
        onSuccess()
        onClose()
      }
    } catch (error) {
      console.error('Failed to update library:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Jeste li sigurni da želite obrisati knjižnicu "${library.naziv}"?`)) return
    
    setIsDeleting(true)
    try {
      const res = await fetch('/api/external-libraries', {
        method: 'POST',
        body: JSON.stringify({ action: 'delete', id: library.id })
      })
      if (res.ok) {
        onSuccess()
        onClose()
      }
    } catch (error) {
      console.error('Failed to delete library:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="w-[95%] sm:max-w-xl border-border bg-card max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle className="font-serif text-2xl font-bold">Uredi podatke knjižnice</DialogTitle>
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={handleDelete} disabled={isDeleting}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Naziv ustanove</label>
              <Input required placeholder="npr. Gradska knjižnica..." value={formData.naziv} onChange={e => setFormData({...formData, naziv: e.target.value})} className="bg-background" />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">K-Kod</label>
              <Input placeholder="npr. K-123/4" value={formData.k_kod} onChange={e => setFormData({...formData, k_kod: e.target.value})} className="bg-background" />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Odgovorna osoba</label>
              <Input placeholder="Ime i prezime" value={formData.odgovorna_osoba} onChange={e => setFormData({...formData, odgovorna_osoba: e.target.value})} className="bg-background" />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Poštanski broj</label>
              <Input placeholder="10000" value={formData.postanski_broj} onChange={e => setFormData({...formData, postanski_broj: e.target.value})} className="bg-background" />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Mjesto</label>
              <Input placeholder="Grad/Općina" value={formData.mjesto} onChange={e => setFormData({...formData, mjesto: e.target.value})} className="bg-background" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Adresa</label>
              <Input placeholder="Ulica i kućni broj" value={formData.adresa} onChange={e => setFormData({...formData, adresa: e.target.value})} className="bg-background" />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">E-mail (službeni)</label>
              <Input type="email" placeholder="knjiznica@..." value={formData.email_sluzbeni} onChange={e => setFormData({...formData, email_sluzbeni: e.target.value})} className="bg-background" />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Telefon</label>
              <Input placeholder="01 / ..." value={formData.telefon} onChange={e => setFormData({...formData, telefon: e.target.value})} className="bg-background" />
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onClose}>Odustani</Button>
            <Button type="submit" disabled={isSubmitting} className="gap-2">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Spremi promjene
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
