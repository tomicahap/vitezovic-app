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
import { useMembers } from "@/contexts/members-context"
import { useAuth } from "@/contexts/auth-context"
import { UserPlus } from "lucide-react"

const memberSchema = z.object({
  name: z.string().min(2, "Ime mora imati najmanje 2 znaka"),
  maidenName: z.string().optional(),
  oib: z.string().optional(),
  birthDate: z.string().optional(),
  birthPlace: z.string().optional(),
  birthCountry: z.string().optional(),
  email: z.string().email("Neispravna email adresa"),
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
  joinDate: z.string().min(1, "Datum pridruživanja je obavezan"),
})

type MemberFormData = z.infer<typeof memberSchema>

interface AddMemberDialogProps {
  children?: React.ReactNode
}

export function AddMemberDialog({ children }: AddMemberDialogProps) {
  const [open, setOpen] = useState(false)
  const { addMember } = useMembers()
  const { user } = useAuth()

  const canAddMembers = user?.role === 'admin' || user?.role === 'moderator'

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<MemberFormData>({
    resolver: zodResolver(memberSchema),
    defaultValues: {
      role: "member",
      joinDate: new Date().toLocaleDateString('en-GB'),
    },
  })

  if (!canAddMembers) {
    return null
  }

  const onSubmit = (data: MemberFormData) => {
    const researchAreas = data.researchAreas.split(',').map(area => area.trim()).filter(area => area.length > 0)
    const initials = data.name.split(' ').map(n => n[0]).join('').toUpperCase()

    addMember({
      name: data.name,
      maidenName: data.maidenName || "",
      oib: data.oib || "",
      birthDate: data.birthDate || "",
      birthPlace: data.birthPlace || "",
      birthCountry: data.birthCountry || "",
      email: data.email,
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
      joinDate: data.joinDate,
      researchAreas,
      additionalAreas: 0,
      avatar: "/placeholder.svg",
    } as any)

    reset()
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
                <Label htmlFor="birthDate" className="text-xs">Datum rođenja</Label>
                <Input id="birthDate" type="date" {...register("birthDate")} />
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
                <Label htmlFor="joinDate" className="text-xs">Datum upisa *</Label>
                <Input id="joinDate" {...register("joinDate")} placeholder="DD/MM/YYYY" />
                {errors.joinDate && <p className="text-xs text-red-600">{errors.joinDate.message}</p>}
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

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Odustani
            </Button>
            <Button type="submit">
              Dodaj člana
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
