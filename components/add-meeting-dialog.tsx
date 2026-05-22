"use client"

import { useState } from "react"
import { X, Calendar, Clock, MapPin, Plus, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useMeetings } from "@/contexts/meetings-context"
import { useMembers } from "@/contexts/members-context"
import { useAuth } from "@/contexts/auth-context"
import { useSettings } from "@/contexts/settings-context"
import { TimeInput24h } from "@/components/ui/time-input-24h"

interface AddMeetingDialogProps {
  onClose: () => void
  onCreated?: (id: number) => void
}

export function AddMeetingDialog({ onClose, onCreated }: AddMeetingDialogProps) {
  const { addMeeting } = useMeetings()
  const { user } = useAuth()
  const { settings } = useSettings()

  const [form, setForm] = useState({
    title: "",
    type: settings.meetingTypes[0] ?? "Opća sjednica",
    date: new Date().toISOString().split("T")[0],
    start_time: "",
    end_time: "",
    location: "",
    status: "scheduled" as const,
    chairperson: "",
    minute_taker: "",
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [showLocationDropdown, setShowLocationDropdown] = useState(false)

  function patch(updates: Partial<typeof form>) {
    setForm(prev => ({ ...prev, ...updates }))
  }

  function selectLocation(loc: string) {
    patch({ location: loc })
    setShowLocationDropdown(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) { setError("Naslov sjednice je obavezan."); return }
    if (!form.date) { setError("Datum je obavezan."); return }
    setError("")
    setSubmitting(true)
    const id = await addMeeting({
      title: form.title.trim(),
      type: form.type,
      date: form.date,
      start_time: form.start_time || undefined,
      end_time: form.end_time || undefined,
      location: form.location || undefined,
      status: form.status,
      chairperson: form.chairperson || undefined,
      minute_taker: form.minute_taker || undefined,
      minutes: "",
      attendee_ids: [],
      agenda: [],
      attachments: [],
      next_meeting_agenda: [],
      created_by: user?.name ?? "Nepoznat",
    })
    setSubmitting(false)
    if (id) {
      onCreated?.(id)
      onClose()
    } else {
      setError("Neuspjelo kreiranje sjednice. Provjerite podatke i pokušajte ponovno.")
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 w-[95%] sm:w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-background shadow-2xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-5">
          <div>
            <h2 className="font-serif text-xl font-bold">Nova sjednica</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Zakaži novu sjednicu društva</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>
          )}

          {/* Title */}
          <div>
            <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Naslov sjednice *
            </label>
            <input
              autoFocus
              value={form.title}
              onChange={e => patch({ title: e.target.value })}
              placeholder="npr. Redovna godišnja skupština..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          {/* Type + Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Vrsta sjednice
              </label>
              <select
                value={form.type}
                onChange={e => patch({ type: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              >
                {settings.meetingTypes.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Status
              </label>
              <select
                value={form.status}
                onChange={e => patch({ status: e.target.value as typeof form.status })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="scheduled">Zakazana</option>
                <option value="completed">Završena</option>
                <option value="cancelled">Otkazana</option>
              </select>
            </div>
          </div>

          {/* Date + times */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="mb-1.5 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                <Calendar className="h-3 w-3" /> Datum *
              </label>
              <input
                type="date"
                value={form.date}
                onChange={e => patch({ date: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
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

          {/* Location with dropdown */}
          <div>
            <label className="mb-1.5 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              <MapPin className="h-3 w-3" /> Lokacija
            </label>
            <div className="relative">
              <input
                value={form.location}
                onChange={e => patch({ location: e.target.value })}
                onFocus={() => settings.meetingLocations.length > 0 && setShowLocationDropdown(true)}
                onBlur={() => setTimeout(() => setShowLocationDropdown(false), 150)}
                placeholder="Upišite ili odaberite lokaciju..."
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
              {settings.meetingLocations.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowLocationDropdown(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              )}
              {showLocationDropdown && settings.meetingLocations.length > 0 && (
                <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-background shadow-lg">
                  {settings.meetingLocations.map(loc => (
                    <button
                      key={loc}
                      type="button"
                      onMouseDown={() => selectLocation(loc)}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-secondary"
                    >
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                      {loc}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Voditelj sastanka
              </label>
              <input
                list="members-list"
                value={form.chairperson}
                onChange={e => patch({ chairperson: e.target.value })}
                placeholder="Odaberi ili upiši..."
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Zapisničar
              </label>
              <input
                list="members-list"
                value={form.minute_taker}
                onChange={e => patch({ minute_taker: e.target.value })}
                placeholder="Odaberi ili upiši..."
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>

          <datalist id="members-list">
            {useMembers().members.map(m => (
              <option key={m.id} value={m.name} />
            ))}
          </datalist>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Odustani</Button>
            <Button
              type="submit"
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={submitting}
            >
              <Plus className="h-4 w-4" />
              {submitting ? "Spremanje…" : "Kreiraj sjednicu"}
            </Button>
          </div>
        </form>
      </div>
    </>
  )
}
