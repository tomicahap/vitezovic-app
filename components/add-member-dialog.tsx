"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useMembers, Member } from "@/contexts/members-context"
import { useAuth } from "@/contexts/auth-context"
import { findPotentialDuplicateMembers, DuplicateMatch } from "@/lib/member-duplicates"
import { inspectMemberDate, normalizeMemberDateToIso } from "@/lib/date-validation"
import { DateOrYearInput } from "@/components/ui/date-or-year-input"
import { formatDateDMY } from "@/lib/utils"
import { UserPlus, AlertTriangle, Loader2 } from "lucide-react"
import { CloseActionButton, ModalActionFooter, SaveActionButton } from "@/components/ui/action-bar"

const memberSchema = z.object({
  name: z.string().min(2, "Ime mora imati najmanje 2 znaka"),
  maidenName: z.string().optional(),
  oib: z.string().optional(),
  birthDate: z
    .string()
    .optional()
    .refine(
      (val) => !val || !val.trim() || inspectMemberDate(val).status === 'empty' || Boolean(inspectMemberDate(val).isoDate),
      "Unesite ispravan datum rođenja u formatu DD/MM/YYYY"
    ),
  birthPlace: z.string().optional(),
  birthCountry: z.string().optional(),
  email: z
    .string()
    .trim()
    .refine((val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), "Neispravna email adresa"),
  phone: z.string().optional(),
  landlinePhone: z.string().optional(),
  address: z.string().optional(),
  occupation: z.string().optional(),
  workExperience: z.string().optional(),
  foreignLanguages: z.string().optional(),
  hobbiesSkills: z.string().optional(),
  researchAreas: z.string().min(1, "Najmanje jedno područje istraživanja je obavezno"),
  membershipNumber: z.string().optional(),
  registryNumber: z.string().optional(),
  role: z.enum(["moderator", "member"]),
  joinDate: z
    .string()
    .min(1, "Datum upisa u društvo je obavezan")
    .refine(
      (val) => Boolean(inspectMemberDate(val).isoDate),
      "Unesite ispravan datum upisa u formatu DD/MM/YYYY"
    ),
})

type MemberFormData = z.infer<typeof memberSchema>

interface AddMemberDialogProps {
  children?: React.ReactNode
}

export function AddMemberDialog({ children }: AddMemberDialogProps) {
  const [open, setOpen] = useState(false)
  const { members, addMember } = useMembers()
  const { user } = useAuth()
  const [pendingPayload, setPendingPayload] = useState<any | null>(null)
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateMatch<Member>[]>([])
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const canAddMembers = user?.role === 'admin' || user?.role === 'moderator'

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<MemberFormData>({
    resolver: zodResolver(memberSchema),
    defaultValues: {
      role: "member",
      birthDate: "",
      joinDate: formatDateDMY(new Date()),
    },
  })

  if (!canAddMembers) {
    return null
  }

  const buildPayload = (data: MemberFormData) => {
    const researchAreas = data.researchAreas.split(',').map(area => area.trim()).filter(area => area.length > 0)
    const initials = data.name.split(' ').map(n => n[0]).join('').toUpperCase()
    return {
      name: data.name.trim(),
      maidenName: data.maidenName || "",
      oib: data.oib || "",
      birthDate: normalizeMemberDateToIso(data.birthDate),
      birthPlace: data.birthPlace || "",
      birthCountry: data.birthCountry || "",
      email: data.email.trim(),
      phone: data.phone || "",
      landlinePhone: data.landlinePhone || "",
      address: data.address || "",
      occupation: data.occupation || "",
      workExperience: data.workExperience || "",
      foreignLanguages: data.foreignLanguages || "",
      hobbiesSkills: data.hobbiesSkills || "",
      membershipNumber: data.membershipNumber || "",
      registryNumber: data.registryNumber || "",
      initials,
      role: data.role,
      joinDate: normalizeMemberDateToIso(data.joinDate),
      researchAreas,
      additionalAreas: 0,
      avatar: "/placeholder.svg",
    }
  }

  const performAdd = async (payload: any, forceDuplicate = false) => {
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const res = await addMember({ ...payload, forceDuplicate } as any)
      if (res.ok) {
        setPendingPayload(null)
        setDuplicateMatches([])
        reset({ role: "member", birthDate: "", joinDate: formatDateDMY(new Date()) })
        setOpen(false)
        return
      }
      if (res.code === 'DUPLICATE_MEMBER' && Array.isArray(res.duplicates) && res.duplicates.length > 0) {
        setPendingPayload(payload)
        setDuplicateMatches(
          res.duplicates.map((d) => ({
            member: d as unknown as Member,
            reasons: d.reasons || ['Mogući duplikat'],
          }))
        )
        return
      }
      setSubmitError(res.error || 'Greška pri dodavanju člana.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const onSubmit = async (data: MemberFormData) => {
    setSubmitError(null)
    const payload = buildPayload(data)
    const matches = findPotentialDuplicateMembers(payload, members)
    if (matches.length > 0) {
      setPendingPayload(payload)
      setDuplicateMatches(matches)
      return
    }
    await performAdd(payload, false)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) {
      setPendingPayload(null)
      setDuplicateMatches([])
      setSubmitError(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children || (
          <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
            <UserPlus className="h-4 w-4" />
            Dodaj novog člana
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="w-[95vw] sm:max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Dodaj novog člana</DialogTitle>
          <DialogDescription>
            Registriraj novog člana u Hrvatsko rodoslovno društvo „Pavao Ritter Vitezović”.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* 1. Osobni podaci i rođenje */}
          <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              1. Osobni podaci i rođenje
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs">Ime i prezime *</Label>
                <Input id="name" {...register("name")} placeholder="Npr. Ana Kovačić" />
                {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="maidenName" className="text-xs">Djevojačko prezime</Label>
                <Input id="maidenName" {...register("maidenName")} placeholder="Opcionalno" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="oib" className="text-xs">OIB</Label>
                <Input id="oib" {...register("oib")} placeholder="11 znamenki" maxLength={11} />
              </div>
              <div className="space-y-1.5">
                <DateOrYearInput
                  id="birthDate"
                  label="Datum rođenja"
                  value={watch("birthDate") || ""}
                  onChange={(val) => setValue("birthDate", val, { shouldValidate: true })}
                  placeholder="DD/MM/YYYY"
                  error={errors.birthDate?.message}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="birthPlace" className="text-xs">Mjesto rođenja</Label>
                <Input id="birthPlace" {...register("birthPlace")} placeholder="Grad / naselje" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="birthCountry" className="text-xs">Zemlja rođenja</Label>
                <Input id="birthCountry" {...register("birthCountry")} placeholder="Npr. Hrvatska" />
              </div>
            </div>
          </div>

          {/* 2. Kontakt i prebivalište */}
          <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              2. Kontakt i prebivalište
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs">Email adresa *</Label>
                <Input id="email" type="email" {...register("email")} placeholder="ime@primjer.hr" />
                {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-xs">Mobitel</Label>
                <Input id="phone" {...register("phone")} placeholder="Npr. 091 123 4567" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="landlinePhone" className="text-xs">Telefon (fiksni)</Label>
                <Input id="landlinePhone" {...register("landlinePhone")} placeholder="Npr. 01 123 4567" />
              </div>
              <div className="space-y-1.5 sm:col-span-3">
                <Label htmlFor="address" className="text-xs">Adresa prebivališta</Label>
                <Input id="address" {...register("address")} placeholder="Ulica, kućni broj, poštanski broj i grad" />
              </div>
            </div>
          </div>

          {/* 3. Zanimanje, vještine i rodoslovna istraživanja */}
          <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              3. Zanimanje, vještine i rodoslovna istraživanja
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="occupation" className="text-xs">Zvanje i zanimanje</Label>
                <Input id="occupation" {...register("occupation")} placeholder="Npr. prof. povijesti" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="foreignLanguages" className="text-xs">Strani jezici</Label>
                <Input id="foreignLanguages" {...register("foreignLanguages")} placeholder="Npr. njemački, latinski, mađarski" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="workExperience" className="text-xs">Radno iskustvo</Label>
                <Input id="workExperience" {...register("workExperience")} placeholder="Npr. rad u arhivu, nastavi, uredski poslovi..." />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="hobbiesSkills" className="text-xs">Hobi / vještine i znanja</Label>
                <Input id="hobbiesSkills" {...register("hobbiesSkills")} placeholder="Npr. čitanje glagoljice, paleografija..." />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="researchAreas" className="text-xs">Lokacije i prezimena koja istražuje *</Label>
                <Textarea
                  id="researchAreas"
                  {...register("researchAreas")}
                  placeholder="Unesite lokacije i prezimena odvojena zarezima (npr. Horvat, Zagorje, Lika)"
                  rows={2}
                />
                {errors.researchAreas && <p className="text-xs text-red-600">{errors.researchAreas.message}</p>}
              </div>
            </div>
          </div>

          {/* 4. Matični podaci */}
          <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              4. Matični podaci
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="membershipNumber" className="text-xs">Br. prijavnice</Label>
                <Input id="membershipNumber" {...register("membershipNumber")} placeholder="Npr. 123" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="registryNumber" className="text-xs">Br. matice</Label>
                <Input id="registryNumber" {...register("registryNumber")} placeholder="Npr. 45" />
              </div>
              <div className="space-y-1.5">
                <DateOrYearInput
                  id="joinDate"
                  label="Datum upisa u društvo *"
                  value={watch("joinDate") || ""}
                  onChange={(val) => setValue("joinDate", val, { shouldValidate: true })}
                  placeholder="DD/MM/YYYY"
                  error={errors.joinDate?.message}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="role" className="text-xs">Uloga u sustavu</Label>
                <Select defaultValue="member" onValueChange={(value) => setValue("role", value as any)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Odaberite ulogu" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Član</SelectItem>
                    <SelectItem value="moderator">Moderator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {submitError && (
            <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <span>{submitError}</span>
            </div>
          )}

          {duplicateMatches.length > 0 && pendingPayload && (
            <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4 space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-amber-950">
                    Upozorenje: Pokušavate upisati osobu koja već postoji u bazi!
                  </h4>
                  <p className="text-xs text-amber-900 mt-0.5">
                    Pronađen je postojeći zapis sa sličnim ili istim podacima. Provjerite je li riječ o istoj osobi prije nego što potvrdite upis:
                  </p>
                </div>
              </div>

              <div className="max-h-44 overflow-y-auto space-y-2">
                {duplicateMatches.map((m) => (
                  <div key={m.member.id} className="rounded-lg border border-amber-200 bg-white p-2.5 text-xs">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-bold text-foreground">{m.member.name}</span>
                      <span className="font-semibold text-amber-800">{m.reasons.join(' • ')}</span>
                    </div>
                    <p className="text-muted-foreground mt-0.5">
                      Br. matice: {m.member.registryNumber || '—'} • Br. prijavnice: {m.member.membershipNumber || '—'} • Email: {m.member.email || '—'} • Upis: {formatDateDMY(m.member.joinDate, '—')}
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPendingPayload(null)
                    setDuplicateMatches([])
                  }}
                >
                  Odustani / Ispravi podatke
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={isSubmitting}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={() => performAdd(pendingPayload, true)}
                >
                  {isSubmitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  Potvrdi da nije duplikat — svejedno upiši
                </Button>
              </div>
            </div>
          )}

          <ModalActionFooter
            className="-mx-6 -mb-6 mt-4 rounded-b-lg"
            right={
              <>
                <CloseActionButton label="Odustani" onClick={() => handleOpenChange(false)} />
                <SaveActionButton
                  type="submit"
                  label="Spremi člana"
                  loading={isSubmitting}
                />
              </>
            }
          />
        </form>
      </DialogContent>
    </Dialog>
  )
}
