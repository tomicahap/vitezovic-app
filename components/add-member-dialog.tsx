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
  email: z.string().email("Neispravna email adresa"),
  role: z.enum(["moderator", "member"]),
  researchAreas: z.string().min(1, "Najmanje jedno područje istraživanja je obavezno"),
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

  // Check if user can add members (admin or moderator)
  const canAddMembers = user?.role === 'admin' || user?.role === 'moderator'

  if (!canAddMembers) {
    return null
  }

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
      joinDate: new Date().toLocaleDateString('hr-HR'),
    },
  })

  const onSubmit = (data: MemberFormData) => {
    const researchAreas = data.researchAreas.split(',').map(area => area.trim()).filter(area => area.length > 0)
    const initials = data.name.split(' ').map(n => n[0]).join('').toUpperCase()

    addMember({
      name: data.name,
      email: data.email,
      initials,
      role: data.role,
      joinDate: data.joinDate,
      researchAreas,
      additionalAreas: 0,
      avatar: "/placeholder.svg",
    } as any) // Status will be computed in context

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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Dodaj novog člana</DialogTitle>
          <DialogDescription>
            Registriraj novog istraživača u rodoslovno društvo.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Puno ime</Label>
              <Input
                id="name"
                {...register("name")}
                placeholder="Unesite puno ime"
              />
              {errors.name && (
                <p className="text-sm text-red-600">{errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                {...register("email")}
                placeholder="Unesite email adresu"
              />
              {errors.email && (
                <p className="text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="joinDate">Datum pridruživanja (upisa)</Label>
              <Input
                id="joinDate"
                {...register("joinDate")}
                placeholder="DD.MM.GGGG"
              />
              {errors.joinDate && (
                <p className="text-sm text-red-600">{errors.joinDate.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Uloga u sustavu</Label>
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

          <div className="space-y-2">
            <Label htmlFor="researchAreas">Područja istraživanja</Label>
            <Textarea
              id="researchAreas"
              {...register("researchAreas")}
              placeholder="Unesite područja istraživanja odvojena zarezima"
              rows={3}
            />
            {errors.researchAreas && (
              <p className="text-sm text-red-600">{errors.researchAreas.message}</p>
            )}
          </div>



          <div className="flex justify-end gap-3 pt-4">
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