"use client"

import { useState } from "react"
import { X, Calendar, Clock, MapPin, Plus, ChevronDown, User, Youtube } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLectures } from "@/contexts/lectures-context"
import { useAuth } from "@/contexts/auth-context"
import { useSettings } from "@/contexts/settings-context"
import { TimeInput24h } from "@/components/ui/time-input-24h"
import { useMembers } from "@/contexts/members-context"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Search } from "lucide-react"

const LECTURE_TYPES = [
  { value: "lecture",   label: "Predavanje" },
  { value: "visit",     label: "Gostovanje" },
  { value: "guest",     label: "Gost predavač" },
  { value: "workshop",  label: "Radionica" },
  { value: "excursion", label: "Izlet / ekskurzija" },
]

export function AddLectureDialog({ onClose }: { onClose: () => void }) {
  const { addLecture } = useLectures()
  const { user } = useAuth()
  const { settings } = useSettings()
  const { members } = useMembers()

  const [form, setForm] = useState({
    title: "", type: "lecture", date: new Date().toISOString().split("T")[0],
    start_time: "", end_time: "", location: "", host: "", hosts: [] as { name: string; memberId?: number }[], status: "scheduled" as const,
    youtube_url: "",
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [showLocDrop, setShowLocDrop] = useState(false)
  const [hostSearch, setHostSearch] = useState("")
  const [showHostDrop, setShowHostDrop] = useState(false)

  function patch(u: Partial<typeof form>) { setForm(prev => ({ ...prev, ...u })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) { setError("Naslov je obavezan."); return }
    if (!form.date) { setError("Datum je obavezan."); return }
    setError("")
    setSubmitting(true)
    await addLecture({
      title: form.title.trim(), type: form.type, date: form.date,
      start_time: form.start_time || undefined, end_time: form.end_time || undefined,
      location: form.location || undefined, host: form.host || undefined,
      hosts: form.hosts,
      status: form.status, youtube_url: form.youtube_url || undefined, description: "", attendee_ids: [], attachments: [],
      created_by: user?.name ?? "Nepoznat",
    })
    setSubmitting(false)
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 w-[95%] sm:w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-background shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border px-6 py-5">
          <div>
            <h2 className="font-serif text-xl font-bold">Novo predavanje / gostovanje</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Dodaj novi događaj u evidenciju</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          {error && <div className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>}

          <div>
            <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Naslov *</label>
            <input autoFocus value={form.title} onChange={e => patch({ title: e.target.value })}
              placeholder="npr. Predavanje o genealogiji Dalmacije..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">YouTube link predavanja</label>
              <input value={form.youtube_url} onChange={e => patch({ youtube_url: e.target.value })}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Vrsta</label>
                <select value={form.type} onChange={e => patch({ type: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent">
                  {LECTURE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Status</label>
                <select value={form.status} onChange={e => patch({ status: e.target.value as typeof form.status })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent">
                  <option value="scheduled">Zakazano</option>
                  <option value="completed">Završeno</option>
                  <option value="cancelled">Otkazano</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              <User className="h-3 w-3" /> Predavači / gosti predavači
            </label>
            
            <div className="flex flex-wrap gap-2 mb-2">
              {form.hosts.map((h, i) => (
                <Badge key={i} variant="secondary" className="gap-1 py-1 px-2">
                  {h.name}
                  <button type="button" onClick={() => patch({ hosts: form.hosts.filter((_, idx) => idx !== i) })} className="hover:text-red-500">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {form.hosts.length === 0 && (
                <span className="text-[10px] text-muted-foreground italic">Dodajte barem jednog predavača.</span>
              )}
            </div>

            <div className="relative">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input 
                    value={hostSearch} 
                    onChange={e => { setHostSearch(e.target.value); setShowHostDrop(true) }}
                    onFocus={() => setShowHostDrop(true)}
                    placeholder="Pretraži članove ili upiši ime..."
                    className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && hostSearch.trim()) {
                        e.preventDefault();
                        patch({ hosts: [...form.hosts, { name: hostSearch.trim() }] });
                        setHostSearch("");
                        setShowHostDrop(false);
                      }
                    }}
                  />
                </div>
                <Button 
                  type="button" 
                  variant="secondary" 
                  size="sm"
                  disabled={!hostSearch.trim()}
                  onClick={() => {
                    patch({ hosts: [...form.hosts, { name: hostSearch.trim() }] });
                    setHostSearch("");
                    setShowHostDrop(false);
                  }}
                >
                  Dodaj
                </Button>
              </div>
              
              {showHostDrop && hostSearch.trim() && (
                <div className="absolute z-[60] mt-1 w-full max-h-40 overflow-y-auto rounded-lg border border-border bg-background shadow-xl">
                  {members
                    .filter(m => m.name.toLowerCase().includes(hostSearch.toLowerCase()))
                    .slice(0, 5)
                    .map(m => (
                      <button
                         key={m.id}
                         type="button"
                         className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-secondary"
                         onClick={() => {
                           patch({ hosts: [...form.hosts, { name: m.name, memberId: m.id }] });
                           setHostSearch("");
                           setShowHostDrop(false);
                         }}
                       >
                         <Avatar className="h-6 w-6">
                           <AvatarFallback className="text-[8px]">{m.initials}</AvatarFallback>
                         </Avatar>
                         <span>{m.name}</span>
                       </button>
                     ))}
                 </div>
               )}
             </div>
           </div>
 
           <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
             <div>
               <label className="mb-1.5 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                 <Calendar className="h-3 w-3" /> Datum *
               </label>
               <input type="date" value={form.date} onChange={e => patch({ date: e.target.value })}
                 className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
             </div>
             <div>
               <label className="mb-1.5 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                 <Clock className="h-3 w-3" /> Početak
               </label>
               <TimeInput24h 
                 value={form.start_time} 
                 onChange={v => patch({ start_time: v })} 
               />
             </div>
             <div>
               <label className="mb-1.5 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                 <Clock className="h-3 w-3" /> Završetak
               </label>
               <TimeInput24h 
                 value={form.end_time} 
                 onChange={v => patch({ end_time: v })} 
               />
             </div>
           </div>
 
           <div>
             <label className="mb-1.5 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
               <MapPin className="h-3 w-3" /> Lokacija
             </label>
             <div className="relative">
               <input value={form.location} onChange={e => patch({ location: e.target.value })}
                 onFocus={() => settings.meetingLocations.length > 0 && setShowLocDrop(true)}
                 onBlur={() => setTimeout(() => setShowLocDrop(false), 150)}
                 placeholder="Upišite ili odaberite lokaciju..."
                 className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
               {settings.meetingLocations.length > 0 && (
                 <button type="button" onClick={() => setShowLocDrop(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                   <ChevronDown className="h-4 w-4 text-muted-foreground" />
                 </button>
               )}
               {showLocDrop && settings.meetingLocations.length > 0 && (
                 <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-background shadow-lg">
                   {settings.meetingLocations.map(loc => (
                     <button key={loc} type="button" onMouseDown={() => { patch({ location: loc }); setShowLocDrop(false) }}
                       className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-secondary">
                       <MapPin className="h-3.5 w-3.5 text-muted-foreground" />{loc}
                     </button>
                   ))}
                 </div>
               )}
             </div>
           </div>
 
           <div className="flex justify-end gap-3 pt-2">
             <Button type="button" variant="outline" onClick={onClose}>Odustani</Button>
             <Button type="submit" className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90" disabled={submitting}>
               <Plus className="h-4 w-4" />
               {submitting ? "Spremanje…" : "Dodaj u evidenciju"}
             </Button>
           </div>
         </form>
       </div>
    </>
  )
}
