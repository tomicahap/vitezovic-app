"use client"

import { useMemo, useState } from "react"
import { AlertCircle, Check, Plus, Trash2, UserPlus } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { generateId } from "@/lib/utils"
import { getExternalInitials, type ExternalAttendee } from "@/lib/attendance"

interface ExternalAttendeesPanelProps {
  externalAttendees: ExternalAttendee[]
  members: Array<{ id: number; name?: string | null }>
  canEdit: boolean
  onAdd: (guest: ExternalAttendee) => void
  onRemove: (id: string) => void
}

export function ExternalAttendeesPanel({
  externalAttendees,
  members,
  canEdit,
  onAdd,
  onRemove,
}: ExternalAttendeesPanelProps) {
  const [name, setName] = useState("")
  const [note, setNote] = useState("")
  const [error, setError] = useState("")

  const matchingMember = useMemo(() => {
    const q = name.trim().toLowerCase()
    if (!q) return null
    return (members || []).find((m) => (m?.name || "").trim().toLowerCase() === q) || null
  }, [name, members])

  const handleAdd = () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError("Upišite ime i prezime osobe.")
      return
    }
    const alreadyExists = (externalAttendees || []).some(
      (g) => g.name.trim().toLowerCase() === trimmedName.toLowerCase()
    )
    if (alreadyExists) {
      setError(`Osoba „${trimmedName}” već je dodana na popis vanjskih sudionika.`)
      return
    }

    const trimmedNote = note.trim()
    onAdd(
      trimmedNote
        ? { id: `ext-${generateId()}`, name: trimmedName, note: trimmedNote }
        : { id: `ext-${generateId()}`, name: trimmedName }
    )
    setName("")
    setNote("")
    setError("")
  }

  return (
    <div className="mb-6 rounded-2xl border-2 border-violet-300 bg-violet-50/70 p-4 shadow-2xs">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white shadow-2xs mt-0.5">
            <UserPlus className="h-4 w-4" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm font-bold text-violet-950">
                Vanjske osobe / gosti (nisu članovi u bazi)
              </h4>
              <span className="inline-flex items-center rounded-full bg-violet-200/80 px-2.5 py-0.5 text-[11px] font-bold text-violet-900">
                {externalAttendees.length}
              </span>
            </div>
            <p className="text-xs text-violet-900/80 mt-0.5">
              Osobe koje nisu članovi u bazi označavaju se{" "}
              <strong className="font-semibold text-violet-950">ljubičastom bojom</strong> i oznakom{" "}
              <span className="rounded bg-violet-200/80 px-1.5 py-0.5 text-[10px] font-bold text-violet-900">
                Nije član
              </span>
              .
            </p>
          </div>
        </div>
      </div>

      {canEdit && (
        <div className="mb-3 space-y-2 rounded-xl border border-violet-200 bg-white/85 p-3">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
            <div className="sm:col-span-5">
              <Input
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  if (error) setError("")
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    handleAdd()
                  }
                }}
                placeholder="Ime i prezime (npr. Ivana Horvat) *"
                className="h-9 border-violet-200 bg-white text-sm focus-visible:ring-violet-500"
              />
            </div>
            <div className="sm:col-span-5">
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    handleAdd()
                  }
                }}
                placeholder="Napomena / ustanova (opcionalno, npr. Gost, HDA)"
                className="h-9 border-violet-200 bg-white text-sm focus-visible:ring-violet-500"
              />
            </div>
            <div className="sm:col-span-2">
              <Button
                type="button"
                onClick={handleAdd}
                disabled={!name.trim()}
                className="h-9 w-full rounded-lg bg-violet-700 hover:bg-violet-800 text-white font-semibold gap-1.5 shadow-2xs"
              >
                <Plus className="h-4 w-4" />
                <span>Dodaj osobu</span>
              </Button>
            </div>
          </div>

          {error && (
            <p className="flex items-center gap-1.5 text-xs font-medium text-red-700">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </p>
          )}

          {matchingMember && !error && (
            <p className="flex items-center gap-1.5 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-700" />
              <span>
                Napomena: Osoba <strong>{matchingMember.name}</strong> već postoji u bazi članova — možete je odabrati na popisu članova ispod ili je ipak dodati ovdje kao vanjskog gosta.
              </span>
            </p>
          )}
        </div>
      )}

      {externalAttendees.length === 0 ? (
        <p className="rounded-xl border border-dashed border-violet-200 bg-white/50 px-3 py-3 text-center text-xs text-violet-900/70 italic">
          {canEdit
            ? "Nema dodanih vanjskih osoba. Upišite ime i prezime iznad za evidenciju osobe koja nije član."
            : "Nema evidentiranih vanjskih osoba na ovom događanju."}
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {externalAttendees.map((guest) => (
            <div
              key={guest.id}
              className="flex items-center gap-3 rounded-xl border border-violet-300 bg-white px-3 py-2 text-violet-950 shadow-2xs"
            >
              <Avatar className="h-8 w-8 shrink-0 border border-violet-300">
                <AvatarFallback className="bg-violet-600 text-white text-xs font-bold">
                  {getExternalInitials(guest.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="truncate text-xs font-bold text-violet-950">{guest.name}</p>
                  <span className="rounded bg-violet-200/80 px-1.5 py-0.5 text-[9px] font-bold text-violet-900 leading-none">
                    Nije član
                  </span>
                </div>
                {guest.note && (
                  <p className="truncate text-[10px] text-violet-800/80 mt-0.5">{guest.note}</p>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <div
                  className="flex h-4 w-4 items-center justify-center rounded-full border border-violet-600 bg-violet-600 text-white"
                  title="Evidentirano prisustvo (nije član)"
                >
                  <Check className="h-2.5 w-2.5" />
                </div>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => onRemove(guest.id)}
                    aria-label={`Ukloni ${guest.name}`}
                    title={`Ukloni ${guest.name} s popisa prisutnih`}
                    className="rounded-lg p-1 text-violet-700 hover:bg-red-50 hover:text-red-700 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
