"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { DateOrYearInput } from "@/components/ui/date-or-year-input"
import { User, Mail, Loader2, AlertCircle, Save, Ban } from "lucide-react"
import { CloseActionButton, FinishActionButton } from "@/components/ui/action-bar"

interface ArchiveMemberProfileForm {
  memberId: number
  firstName: string
  lastName: string
  maidenName: string
  oib: string
  birthDate: string
  birthPlace: string
  birthCountry: string
  email: string
  phone: string
  landlinePhone: string
  address: string
  deceased?: boolean
  deathDate?: string
  doNotContact?: boolean
  doNotContactDate?: string
  doNotContactNote?: string
}

export interface ArchiveUpdatedMemberSummary {
  memberId: number
  name: string
  email: string
  phone: string
  landlinePhone: string
  address: string
}

interface ArchiveMemberDataDialogProps {
  memberId: number | null
  memberName?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (updated: ArchiveUpdatedMemberSummary) => void
}

export function ArchiveMemberDataDialog({
  memberId,
  memberName,
  open,
  onOpenChange,
  onSaved,
}: ArchiveMemberDataDialogProps) {
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [form, setForm] = React.useState<ArchiveMemberProfileForm | null>(null)

  React.useEffect(() => {
    if (!open || !memberId) {
      if (!open) {
        setError(null)
        setForm(null)
      }
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    fetch(`/api/archive?memberId=${encodeURIComponent(String(memberId))}`, { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok || !data.success || !data.member) {
          throw new Error(data.error || "Nije moguće učitati podatke člana.")
        }
        if (!cancelled) {
          setForm(data.member)
        }
      })
      .catch((err: any) => {
        if (!cancelled) {
          setError(err?.message || "Greška pri učitavanju podataka člana.")
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [open, memberId])

  const updateField = <K extends keyof ArchiveMemberProfileForm>(
    key: K,
    value: ArchiveMemberProfileForm[K]
  ) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
    setError(null)
  }

  const handleSaveAndClose = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form) return
    if (!form.firstName.trim() && !form.lastName.trim()) {
      setError("Unesite ime i prezime člana.")
      return
    }

    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/archive", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok || !data.success || !data.member) {
        setError(data.error || "Greška pri spremanju podataka člana.")
        return
      }
      onSaved(data.member)
      onOpenChange(false)
    } catch (err: any) {
      setError(err?.message || "Greška pri povezivanju s poslužiteljem.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[92vh] overflow-y-auto p-0 rounded-2xl border border-border shadow-2xl">
        <div className="bg-[#1B2B36] border-b-2 border-[#CEA369] text-white p-5 rounded-t-2xl">
          <DialogHeader className="text-left space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <DialogTitle className="font-serif text-lg font-bold text-white flex items-center gap-2">
                <User className="h-5 w-5 text-[#CEA369]" />
                Dopuna podataka člana — {memberName || form?.firstName || "Član"}
              </DialogTitle>
              {form?.deceased && (
                <Badge className="bg-white/15 text-[#F2EFE9] border border-[#CEA369]/50 text-[11px]">
                  † Preminuo/la{form.deathDate ? ` (${form.deathDate})` : ""}
                </Badge>
              )}
            </div>
            <DialogDescription className="text-xs text-[#F2EFE9]/80">
              Dopuna osobnih podataka i rođenja te kontakta i prebivališta izravno u registar članova.
            </DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={handleSaveAndClose} className="p-5 sm:p-6 space-y-5">
          {loading && (
            <div className="py-12 flex flex-col items-center justify-center gap-2.5 text-xs text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-[#CEA369]" />
              <span>Učitavanje podataka člana...</span>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!loading && form && (
            <>
              {form.doNotContact && (
                <div className="rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3 text-xs text-red-950 flex items-start gap-2.5">
                  <Ban className="h-4 w-4 text-red-700 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-bold text-red-900">
                      Na izričitu napomenu član je zatražio da ga se ne kontaktira.
                    </p>
                    <p className="text-[11px] text-red-800">
                      Zabranjeno je slanje e-mailova i bilo kakvo kontaktiranje ovog člana kroz aplikaciju.
                      {form.doNotContactDate ? ` Datum zahtjeva: ${form.doNotContactDate}.` : ""}
                      {form.doNotContactNote ? ` Napomena: ${form.doNotContactNote}` : ""}
                    </p>
                  </div>
                </div>
              )}
              {/* 1. Osobni podaci i rođenje */}
              <div className="rounded-2xl border border-border bg-[#FBF9F6] p-4 sm:p-5 space-y-4">
                <div className="flex items-center gap-2 border-b border-border pb-2">
                  <User className="h-4 w-4 text-[#1B2B36]" />
                  <h3 className="text-xs font-bold uppercase tracking-widest text-[#1B2B36]">
                    Osobni podaci i rođenje
                  </h3>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Ime</Label>
                    <Input
                      value={form.firstName}
                      onChange={(e) => updateField("firstName", e.target.value)}
                      disabled={saving}
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Prezime</Label>
                    <Input
                      value={form.lastName}
                      onChange={(e) => updateField("lastName", e.target.value)}
                      disabled={saving}
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Djevojačko prezime</Label>
                    <Input
                      value={form.maidenName}
                      onChange={(e) => updateField("maidenName", e.target.value)}
                      disabled={saving}
                      placeholder="Opcionalno"
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">OIB</Label>
                    <Input
                      value={form.oib}
                      onChange={(e) => updateField("oib", e.target.value)}
                      disabled={saving}
                      placeholder="11 znamenki"
                      maxLength={11}
                      className="bg-background font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <DateOrYearInput
                      label="Datum rođenja"
                      value={form.birthDate}
                      onChange={(val) => updateField("birthDate", val)}
                      disabled={saving}
                      allowYearOnly
                      placeholder="DD/MM/YYYY ili godina"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Mjesto rođenja</Label>
                    <Input
                      value={form.birthPlace}
                      onChange={(e) => updateField("birthPlace", e.target.value)}
                      disabled={saving}
                      placeholder="Grad / naselje"
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
                    <Label className="text-xs">Zemlja rođenja</Label>
                    <Input
                      value={form.birthCountry}
                      onChange={(e) => updateField("birthCountry", e.target.value)}
                      disabled={saving}
                      placeholder="Npr. Hrvatska"
                      className="bg-background"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Kontakt i prebivalište */}
              <div className="rounded-2xl border border-border bg-[#FBF9F6] p-4 sm:p-5 space-y-4">
                <div className="flex items-center gap-2 border-b border-border pb-2">
                  <Mail className="h-4 w-4 text-[#1B2B36]" />
                  <h3 className="text-xs font-bold uppercase tracking-widest text-[#1B2B36]">
                    Kontakt i prebivalište
                  </h3>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Email adresa</Label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) => updateField("email", e.target.value)}
                      disabled={saving}
                      placeholder="ime@domena.hr"
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Mobitel</Label>
                    <Input
                      value={form.phone}
                      onChange={(e) => updateField("phone", e.target.value)}
                      disabled={saving}
                      placeholder="Npr. 091 123 4567"
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Telefon (fiksni)</Label>
                    <Input
                      value={form.landlinePhone}
                      onChange={(e) => updateField("landlinePhone", e.target.value)}
                      disabled={saving}
                      placeholder="Npr. 01 123 4567"
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
                    <Label className="text-xs">Adresa prebivališta</Label>
                    <Input
                      value={form.address}
                      onChange={(e) => updateField("address", e.target.value)}
                      disabled={saving}
                      placeholder="Ulica, kućni broj, poštanski broj i grad"
                      className="bg-background"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          <DialogFooter className="mx-0 mb-0 px-5 py-3.5 rounded-b-2xl gap-2.5">
            <CloseActionButton
              label="Odustani"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            />
            <FinishActionButton
              type="submit"
              label="Spremi i zatvori"
              loading={saving}
              loadingLabel="Spremanje..."
              disabled={loading || saving || !form}
            />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
