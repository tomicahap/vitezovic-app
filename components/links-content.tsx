"use client"

import React, { useState, useMemo } from "react"
import { 
  Search, Plus, ExternalLink, Trash2, Edit3, 
  Link as LinkIcon, Filter, Download as DownloadIcon,
  Tag, Info, MoreVertical, X, Save, Globe
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
import { useLinks, UsefulLink } from "@/contexts/links-context"
import { useAuth } from "@/contexts/auth-context"

const CATEGORIES = [
  { id: 'rodoslovno', label: 'Rodoslovno', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { id: 'opce', label: 'Opće', color: 'bg-slate-50 text-slate-700 border-slate-200' },
  { id: 'drustvo', label: 'Za Društvo', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
]

export function LinksContent() {
  const { links, isLoading, addLink, updateLink, deleteLink } = useLinks()
  const { user } = useAuth()
  const canEdit = user?.role === "admin" || user?.accessRights?.links?.edit === true

  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<UsefulLink | null>(null)

  const filteredLinks = useMemo(() => {
    return links.filter(l => {
      const matchesSearch = l.title.toLowerCase().includes(search.toLowerCase()) || 
                           l.description?.toLowerCase().includes(search.toLowerCase()) ||
                           l.url.toLowerCase().includes(search.toLowerCase())
      const matchesCategory = categoryFilter === "all" || l.category === categoryFilter
      return matchesSearch && matchesCategory
    })
  }, [links, search, categoryFilter])

  const handleExport = () => {
    const headers = ["Naslov", "URL", "Opis", "Kategorija", "Datum dodavanja"]
    const rows = filteredLinks.map(l => [
      l.title,
      l.url,
      l.description || "",
      CATEGORIES.find(c => c.id === l.category)?.label || l.category,
      l.created_at ? new Date(l.created_at).toLocaleDateString("hr-HR") : ""
    ])
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n"
      + rows.map(e => e.map(cell => `"${cell.toString().replace(/"/g, '""')}"`).join(",")).join("\n")
    
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `arhiva_linkova_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <main className="flex-1 overflow-auto bg-background/50">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex items-center justify-between px-8 py-4">
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Pretraži arhivu linkova..."
              className="border-border bg-card pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
             <Button variant="outline" size="sm" className="gap-2" onClick={handleExport}>
                <DownloadIcon className="h-4 w-4" /> Izvezi CSV
             </Button>
             {canEdit && (
               <Button size="sm" className="gap-2" onClick={() => setShowAdd(true)}>
                 <Plus className="h-4 w-4" /> Dodaj link
               </Button>
             )}
          </div>
        </div>
      </header>

      <div className="p-8">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <div className="flex items-center gap-4 mb-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <LinkIcon className="h-6 w-6" />
                </div>
                <div>
                    <h2 className="font-serif text-3xl font-bold">Arhiva korisnih linkova</h2>
                    <p className="text-sm text-muted-foreground mt-1">Spremljene poveznice, izvori i digitalne arhive za rodoslovni rad.</p>
                </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant={categoryFilter === "all" ? "default" : "outline"} size="sm" onClick={() => setCategoryFilter("all")}>Svi</Button>
            {CATEGORIES.map(c => (
              <Button key={c.id} 
                variant={categoryFilter === c.id ? "default" : "outline"} 
                size="sm" 
                onClick={() => setCategoryFilter(c.id)}>
                {c.label}
              </Button>
            ))}
          </div>
        </div>

        {isLoading ? (
            <div className="py-24 text-center text-muted-foreground">Učitavanje linkova...</div>
        ) : filteredLinks.length === 0 ? (
            <div className="py-24 text-center rounded-2xl border-2 border-dashed border-border bg-card/30">
                <LinkIcon className="mx-auto h-12 w-12 text-muted-foreground/20 mb-4" />
                <p className="text-muted-foreground">Nema pronađenih linkova u ovoj kategoriji.</p>
                {canEdit && <Button variant="link" onClick={() => setShowAdd(true)}>Spremite prvi link</Button>}
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredLinks.map(link => (
                    <div key={link.id} className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:border-primary/30 hover:shadow-xl">
                        <div className="p-6 flex-1">
                            <div className="flex items-center justify-between mb-4">
                                <Badge variant="outline" className={`text-[10px] font-bold uppercase tracking-widest ${CATEGORIES.find(c => c.id === link.category)?.color}`}>
                                    {CATEGORIES.find(c => c.id === link.category)?.label}
                                </Badge>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {canEdit && (
                                        <>
                                            <button onClick={() => setEditing(link)} className="p-1.5 hover:bg-secondary rounded-lg text-muted-foreground transition-colors"><Edit3 className="h-3.5 w-3.5" /></button>
                                            <button onClick={() => { if(confirm("Obrisati ovaj link?")) deleteLink(link.id) }} className="p-1.5 hover:bg-red-50 rounded-lg text-red-500 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                                        </>
                                    )}
                                </div>
                            </div>

                            <a href={link.url} target="_blank" rel="noopener noreferrer" className="block mb-2 group-hover:text-primary transition-colors">
                                <h3 className="font-serif text-lg font-bold leading-tight">{link.title}</h3>
                            </a>
                            
                            <p className="text-sm text-muted-foreground line-clamp-3 mb-4">{link.description || "Nema opisa."}</p>
                            
                            <div className="mt-auto pt-4 border-t border-border/50">
                                <a href={link.url} target="_blank" rel="noopener noreferrer" 
                                   className="inline-flex items-center gap-2 text-xs font-semibold text-primary hover:underline">
                                    <Globe className="h-3 w-3" /> {new URL(link.url).hostname} <ExternalLink className="h-2 w-2" />
                                </a>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>

      {/* Add Dialog */}
      {showAdd && (
        <Dialog onClose={() => setShowAdd(false)} title="Dodaj novi link" 
                onSubmit={async (data) => { await addLink(data); setShowAdd(false); }} />
      )}

      {/* Edit Dialog */}
      {editing && (
        <Dialog onClose={() => setEditing(null)} title="Uredi link" initialData={editing}
                onSubmit={async (data) => { await updateLink(editing.id, data); setEditing(null); }} />
      )}
    </main>
  )
}

function Dialog({ onClose, title, onSubmit, initialData }: { onClose: () => void; title: string, onSubmit: (val: any) => Promise<void>, initialData?: UsefulLink }) {
  const [data, setData] = useState({
    title: initialData?.title || "",
    url: initialData?.url || "",
    description: initialData?.description || "",
    category: initialData?.category || "rodoslovno"
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!data.title || !data.url) return
    setLoading(true)
    await onSubmit(data)
    setLoading(false)
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-background p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-serif text-xl font-bold">{title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-secondary rounded-full"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Naslov poveznice</label>
            <Input value={data.title} onChange={e => setData({...data, title: e.target.value})} placeholder="n.pr. Državni arhiv - digitalni zapisi" required />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">URL Adresa</label>
            <Input value={data.url} onChange={e => setData({...data, url: e.target.value})} placeholder="https://..." required />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Kategorija</label>
            <Select value={data.category} onValueChange={v => setData({...data, category: v as any})}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rodoslovno">Rodoslovno</SelectItem>
                <SelectItem value="opce">Opće</SelectItem>
                <SelectItem value="drustvo">Za Društvo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Opis / Svrha spremanja</label>
            <textarea 
               value={data.description} 
               onChange={e => setData({...data, description: e.target.value})}
               className="w-full min-h-[100px] rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
               placeholder="Zašto je ovaj link spremljen?"
            />
          </div>
          <div className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Odustani</Button>
            <Button type="submit" disabled={loading}>{loading ? "Spremanje..." : "Spremi"}</Button>
          </div>
        </form>
      </div>
    </>
  )
}
