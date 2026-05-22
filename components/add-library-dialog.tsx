"use client"

import { useState } from "react"
import { X, Plus, Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface Props {
  onClose: () => void
}

export function AddLibraryDialog({ onClose }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    k_kod: "",
    naziv: "",
    postanski_broj: "",
    mjesto: "",
    adresa: "",
    email_sluzbeni: "",
    email_direktni: "",
    telefon: "",
    odgovorna_osoba: ""
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const res = await fetch('/api/external-libraries', {
        method: 'POST',
        body: JSON.stringify({ action: 'add', ...formData })
      })
      if (res.ok) {
        onClose()
        window.location.reload() // Simple reload to refresh the list
      }
    } catch (error) {
      console.error('Failed to add library:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="w-[95%] sm:max-w-xl border-border bg-card max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl font-bold">Nova knjižnica / ustanova</DialogTitle>
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
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Dodaj knjižnicu
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
