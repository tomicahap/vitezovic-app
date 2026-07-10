"use client"

import * as React from "react"
import { 
  Search, Plus, Mail, Phone, MapPin, Building2, 
  MoreVertical, Pencil, Trash2, Filter, Download,
  ExternalLink, Globe, Contact, UserPlus, X, Save
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useContacts, Contact as ContactType } from "@/contexts/contacts-context"
import { useAuth } from "@/contexts/auth-context"
import { Linkify } from "./linkify"

// ─── Contact Detail Dialog ──────────────────────────────────────────────────

function ContactDetailDialog({ contact: initial, onClose }: { contact: ContactType; onClose: () => void }) {
  const { updateContact, deleteContact } = useContacts()
  const { user } = useAuth()
  const canEdit = user?.role === "admin" || user?.accessRights?.contacts?.edit === true

  const [contact, setContact] = React.useState<ContactType>(initial)
  const [isDirty, setIsDirty] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)

  function patch(u: Partial<ContactType>) {
    setContact(prev => ({ ...prev, ...u }))
    setIsDirty(true)
  }

  async function handleSave() {
    setIsSaving(true)
    await updateContact(contact.id, contact)
    setIsSaving(false)
    setIsDirty(false)
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <Contact className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-serif text-xl font-bold">{contact.name}</h2>
              <p className="text-xs text-muted-foreground uppercase tracking-widest">{contact.category || "KONTAKT"}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">IME I PREZIME / NAZIV</label>
                <Input value={contact.name} onChange={e => patch({ name: e.target.value })} disabled={!canEdit} className="bg-muted/30" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">KATEGORIJA</label>
                  <Select value={contact.category || "Ostalo"} onValueChange={(val) => patch({ category: val })} disabled={!canEdit}>
                    <SelectTrigger className="bg-muted/30">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Institucija">Institucija</SelectItem>
                      <SelectItem value="Arhiv">Arhiv</SelectItem>
                      <SelectItem value="Suradnik">Suradnik</SelectItem>
                      <SelectItem value="Stručnjak">Stručnjak</SelectItem>
                      <SelectItem value="Ostalo">Ostalo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">RADNO MJESTO / URED</label>
                    <Input value={contact.workplace || ""} onChange={e => patch({ workplace: e.target.value })} disabled={!canEdit} className="bg-muted/30" />
                </div>
              </div>

              <div className="space-y-4 rounded-xl border border-border bg-muted/20 p-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-primary/80">Kontakt podaci</h3>
                <div className="space-y-3">
                    <div className="flex items-center gap-3">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <Input value={contact.email || ""} onChange={e => patch({ email: e.target.value })} disabled={!canEdit} placeholder="Email adresa" className="flex-1" />
                    </div>
                    <div className="flex items-center gap-3">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <Input value={contact.phone || ""} onChange={e => patch({ phone: e.target.value })} disabled={!canEdit} placeholder="Broj telefona" className="flex-1" />
                    </div>
                    <div className="flex items-center gap-3">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <Input value={contact.address || ""} onChange={e => patch({ address: e.target.value })} disabled={!canEdit} placeholder="Adresa" className="flex-1" />
                    </div>
                    <div className="flex items-center gap-3">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <Input value={contact.website || ""} onChange={e => patch({ website: e.target.value })} disabled={!canEdit} placeholder="Web stranica" className="flex-1" />
                    </div>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">NAPOMENE</label>
                {canEdit ? (
                  <textarea 
                    value={contact.notes || ""} 
                    onChange={e => patch({ notes: e.target.value })} 
                    className="min-h-[120px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                    placeholder="Dodatne informacije o kontaktu..."
                  />
                ) : (
                  <div className="min-h-[120px] w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed text-slate-700">
                    {contact.notes ? <Linkify text={contact.notes} /> : <span className="italic text-muted-foreground">Nema napomena.</span>}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          {canEdit ? (
            <Button variant="outline" size="sm" className="gap-2 text-red-600 hover:bg-red-50" onClick={async () => { if(confirm("Obriši kontakt?")) { await deleteContact(contact.id); onClose(); } }}>
              <Trash2 className="h-4 w-4" /> Obriši
            </Button>
          ) : <div />}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Zatvori</Button>
            {isDirty && canEdit && (
              <Button size="sm" className="gap-2" onClick={handleSave} disabled={isSaving}>
                <Save className="h-4 w-4" />{isSaving ? "Spremanje..." : "Spremi"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Add Contact Dialog ─────────────────────────────────────────────────────

function AddContactDialog({ onClose }: { onClose: () => void }) {
  const { addContact } = useContacts()
  const [form, setForm] = React.useState({ 
    name: "", category: "Ostalo", workplace: "", email: "", phone: "", address: "", website: "", notes: "" 
  })
  const [submitting, setSubmitting] = React.useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name) return
    setSubmitting(true)
    await addContact(form)
    setSubmitting(false)
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-background shadow-2xl">
        <form onSubmit={handleSubmit}>
          <div className="flex items-center justify-between border-b border-border px-6 py-5">
            <div>
              <h2 className="font-serif text-xl font-bold">Novi kontakt u adresaru</h2>
              <p className="text-sm text-muted-foreground">Dodajte osobu ili instituciju van društva</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary"><X className="h-4 w-4" /></button>
          </div>
          
          <div className="p-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold">Ime i prezime / Naziv *</label>
              <Input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold">Kategorija</label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Institucija">Institucija</SelectItem>
                    <SelectItem value="Arhiv">Arhiv</SelectItem>
                    <SelectItem value="Suradnik">Suradnik</SelectItem>
                    <SelectItem value="Stručnjak">Stručnjak</SelectItem>
                    <SelectItem value="Ostalo">Ostalo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold">Radno mjesto / Ured</label>
                <Input value={form.workplace} onChange={e => setForm(f => ({ ...f, workplace: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold">Email</label>
                <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold">Telefon</label>
                <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold">Adresa</label>
              <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-border bg-muted/30 px-6 py-4">
            <Button type="button" variant="outline" onClick={onClose}>Odustani</Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Spremanje..." : "Spremi kontakt"}
            </Button>
          </div>
        </form>
      </div>
    </>
  )
}

// ─── Main Content ───────────────────────────────────────────────────────────

export function ContactsContent() {
  const { contacts, isLoading, deleteContact } = useContacts()
  const { user } = useAuth()
  const [search, setSearch] = React.useState("")
  const [categoryFilter, setCategoryFilter] = React.useState("all")
  const [selectedContact, setSelectedContact] = React.useState<ContactType | null>(null)
  const [showAdd, setShowAdd] = React.useState(false)

  const canEdit = user?.role === "admin" || user?.accessRights?.contacts?.edit === true

  const filteredContacts = React.useMemo(() => {
    return contacts.filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) || 
                           (c.email?.toLowerCase().includes(search.toLowerCase())) ||
                           (c.workplace?.toLowerCase().includes(search.toLowerCase()))
      const matchesCategory = categoryFilter === "all" || c.category === categoryFilter
      return matchesSearch && matchesCategory
    })
  }, [contacts, search, categoryFilter])

  return (
    <main className="flex-1 overflow-auto bg-background/50">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex items-center justify-between px-8 py-4">
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Pretraži adresar po imenu, uredu ili mailu..."
              className="border-border bg-card pl-10 h-9 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
             <Button variant="outline" size="sm" className="gap-2"><Download className="h-4 w-4" /> Izvoz</Button>
             {canEdit && (
               <Button size="sm" className="gap-2" onClick={() => setShowAdd(true)}>
                 <UserPlus className="h-4 w-4" /> Novi kontakt
               </Button>
             )}
          </div>
        </div>
      </header>

      <div className="p-8">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
                <div className="h-8 w-1 bg-primary rounded-full" />
                <h2 className="font-serif text-3xl font-bold">Adresar kontakata</h2>
            </div>
            <p className="max-w-xl text-sm text-muted-foreground">
              Evidencija suradnika, institucija, arhiva i stručnjaka potrebnih za rad društva. 
              Ovaj popis sadrži osobe koje nisu redovni članovi društva.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Prikaži:</label>
            <div className="flex rounded-lg border border-border bg-card p-1">
              {[
                { id: 'all', label: 'Sve' },
                { id: 'Institucija', label: 'Institucije' },
                { id: 'Arhiv', label: 'Arhivi' },
                { id: 'Suradnik', label: 'Suradnici' },
              ].map(f => (
                <button key={f.id} onClick={() => setCategoryFilter(f.id)}
                  className={`px-3 py-1 text-xs font-semibold transition-all rounded ${categoryFilter === f.id ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredContacts.length === 0 ? (
            <div className="col-span-full py-24 text-center">
                <Contact className="mx-auto h-12 w-12 text-muted-foreground/20 mb-4" />
                <p className="text-muted-foreground">Nema pronađenih kontakata u adresaru.</p>
            </div>
          ) : filteredContacts.map(contact => (
            <div 
              key={contact.id} 
              onClick={() => setSelectedContact(contact)}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:shadow-md hover:border-primary/20 cursor-pointer"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                  <Building2 className="h-5 w-5" />
                </div>
                <Badge variant="secondary" className="text-[9px] font-bold uppercase tracking-wider bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                  {contact.category || "Ostalo"}
                </Badge>
              </div>

              <div className="space-y-1">
                <h3 className="font-serif text-lg font-bold group-hover:text-primary transition-colors line-clamp-1">{contact.name}</h3>
                <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                    <Building2 className="h-3 w-3" />
                    {contact.workplace || "Suradnik / Vanjski"}
                </p>
              </div>

              <div className="mt-6 space-y-2 pt-4 border-t border-border/50">
                {contact.email && (
                  <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" />
                    <span className="truncate">{contact.email}</span>
                  </div>
                )}
                {contact.phone && (
                  <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" />
                    <span>{contact.phone}</span>
                  </div>
                )}
              </div>

              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="rounded-full bg-primary/10 p-1.5 text-primary">
                    <ExternalLink className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showAdd && <AddContactDialog onClose={() => setShowAdd(false)} />}
      {selectedContact && <ContactDetailDialog contact={selectedContact} onClose={() => setSelectedContact(null)} />}
    </main>
  )
}
