"use client"

import * as React from "react"
import { Member, MemberPayment, MemberFunctionAssignment } from "@/contexts/members-context"
import { useMembers } from "@/contexts/members-context"
import { useAuth } from "@/contexts/auth-context"
import { useSettings } from "@/contexts/settings-context"
import { getMemberActionPermissions } from "@/lib/inquiry-permissions"
import { generateId, isMandateActive, formatMandatePeriod, formatDateDMY } from "@/lib/utils"
import { DateOrYearInput } from "@/components/ui/date-or-year-input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog"
import { Pencil, Plus, DollarSign, Trash2, Mail, User, FileText, CheckCircle, XCircle, Star, CreditCard, ShieldOff, Check, X, Cake } from "lucide-react"
import { Linkify } from "./linkify"
import { InvitationPreviewDialog, formatInvitationDateTime } from "@/components/invitation-preview-dialog"
import { PaymentReminderDialog } from "@/components/payment-reminder-dialog"
import { BirthdayEmailDialog } from "@/components/birthday-email-dialog"

interface MemberDetailsDialogProps {
  member: Member
  children: React.ReactNode
}

export function MemberDetailsDialog({ member, children }: MemberDetailsDialogProps) {
  const { updateMember, addPayment } = useMembers()
  const { user } = useAuth()
  const { settings } = useSettings()
  const memberActions = React.useMemo(() => getMemberActionPermissions(user), [user])
  const [isEditing, setIsEditing] = React.useState(false)
  const [saveNotice, setSaveNotice] = React.useState('')
  const [formState, setFormState] = React.useState<Member>(member)
  const [paymentDate, setPaymentDate] = React.useState('')
  const [paymentAmount, setPaymentAmount] = React.useState('')
  const [paymentForYear, setPaymentForYear] = React.useState('')
  const [paymentNote, setPaymentNote] = React.useState('')
  const [paymentNotice, setPaymentNotice] = React.useState('')

  const paymentYearOptions = React.useMemo(() => {
    const currentYr = new Date().getFullYear()
    const years: number[] = []
    for (let y = currentYr + 5; y >= 2005; y--) {
      years.push(y)
    }
    return years
  }, [])
  const [confirmSave, setConfirmSave] = React.useState(false)
  const [confirmationText, setConfirmationText] = React.useState('')
  const [newFunctionName, setNewFunctionName] = React.useState('')
  const [newFunctionFrom, setNewFunctionFrom] = React.useState('')
  const [newFunctionTo, setNewFunctionTo] = React.useState('')
  const [showAddFunction, setShowAddFunction] = React.useState(false)
  const [editingFunctionId, setEditingFunctionId] = React.useState<string | null>(null)
  const [editFunctionName, setEditFunctionName] = React.useState('')
  const [editFunctionFrom, setEditFunctionFrom] = React.useState('')
  const [editFunctionTo, setEditFunctionTo] = React.useState('')
  const [firstName, setFirstName] = React.useState('')
  const [lastName, setLastName] = React.useState('')
  const [invitationDialogOpen, setInvitationDialogOpen] = React.useState(false)
  const [paymentReminderDialogOpen, setPaymentReminderDialogOpen] = React.useState(false)
  const [birthdayDialogOpen, setBirthdayDialogOpen] = React.useState(false)
  const [generatedPassword, setGeneratedPassword] = React.useState('')
  const [researchAreasInput, setResearchAreasInput] = React.useState('')
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const loadedMemberIdRef = React.useRef<number | null>(null)
  const isEditingRef = React.useRef(false)
  isEditingRef.current = isEditing

  React.useEffect(() => {
    const isNewMember = loadedMemberIdRef.current !== member.id
    if (isNewMember) {
      loadedMemberIdRef.current = member.id
      setFormState(member)
      setResearchAreasInput((member.researchAreas || []).join(', '))
      setIsEditing(false)
      setSaveNotice('')
      setPaymentDate('')
      setPaymentAmount('')
      setPaymentForYear('')
      setPaymentNote('')
      setPaymentNotice('')
      setConfirmSave(false)
      setConfirmationText('')
      setNewFunctionName('')
      setNewFunctionFrom('')
      setNewFunctionTo('')
      setShowAddFunction(false)
      setEditingFunctionId(null)
      setEditFunctionName('')
      setEditFunctionFrom('')
      setEditFunctionTo('')
      setInvitationDialogOpen(false)
      setPaymentReminderDialogOpen(false)
      setBirthdayDialogOpen(false)
      const [first, ...rest] = member.name.split(' ')
      setFirstName(first || '')
      setLastName(rest.join(' ') || '')
      return
    }

    if (isEditingRef.current) {
      setFormState((prev) => ({
        ...prev,
        payments: member.payments,
        status: member.status,
        paymentStatus: member.paymentStatus,
      }))
      return
    }

    setFormState(member)
    setResearchAreasInput((member.researchAreas || []).join(', '))
    const [first, ...rest] = member.name.split(' ')
    setFirstName(first || '')
    setLastName(rest.join(' ') || '')
  }, [member])

  const handleFullNameChange = (newFirst: string, newLast: string) => {
    setFirstName(newFirst)
    setLastName(newLast)
    setFormState((prev) => ({ ...prev, name: `${newFirst} ${newLast}`.trim() }))
  }

  const handleFieldChange = (field: keyof Member, value: string | boolean) => {
    setFormState((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = () => {
    if (!confirmSave) {
      setConfirmSave(true)
      setSaveNotice('Upišite POTVRDI da biste potvrdili izmjene.')
      return
    }
    if (confirmationText.trim().toUpperCase() !== 'POTVRDI') {
      setSaveNotice('Za potvrdu unesite točno POTVRDI.')
      return
    }
    const parsedResearchAreas = researchAreasInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    updateMember(member.id, {
      name: formState.name,
      maidenName: formState.maidenName,
      oib: formState.oib,
      email: formState.email,
      phone: formState.phone,
      landlinePhone: formState.landlinePhone,
      birthDate: formState.birthDate,
      birthPlace: formState.birthPlace,
      birthCountry: formState.birthCountry,
      address: formState.address,
      occupation: formState.occupation,
      workExperience: formState.workExperience,
      hobbiesSkills: formState.hobbiesSkills,
      foreignLanguages: formState.foreignLanguages,
      researchAreas: parsedResearchAreas,
      membershipNumber: formState.membershipNumber,
      registryNumber: formState.registryNumber,
      joinDate: formState.joinDate,
      functions: formState.functions,
      note: formState.note,
      honorary: formState.honorary,
      exemptFromPayment: formState.exemptFromPayment,
      expelled: formState.expelled,
      expulsionDate: formState.expulsionDate,
      expulsionReason: formState.expulsionReason,
      deceased: formState.deceased,
      deathDate: formState.deathDate,
      lastPayment: formState.lastPayment,
      notes: formState.notes,
      password: formState.password,
    })
    setIsEditing(false)
    setConfirmSave(false)
    setConfirmationText('')
    setSaveNotice('Promjene su uspješno spremljene.')
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setFormState(member)
    setResearchAreasInput((member.researchAreas || []).join(', '))
    setSaveNotice('')
    setConfirmSave(false)
    setConfirmationText('')
    const [first, ...rest] = member.name.split(' ')
    setFirstName(first || '')
    setLastName(rest.join(' ') || '')
  }

  const handlePaymentAdd = () => {
    setPaymentNotice('')
    if (!paymentDate || !paymentAmount) {
      setPaymentNotice('Unesite datum i iznos uplate.')
      return
    }
    const parsedForYear = paymentForYear ? Number(paymentForYear) : undefined
    addPayment(member.id, {
      date: paymentDate,
      amount: Number(paymentAmount),
      forYear: parsedForYear && !Number.isNaN(parsedForYear) ? parsedForYear : undefined,
      note: paymentNote || (parsedForYear ? `Članarina za ${parsedForYear}. godinu` : 'Ručno unesena uplata'),
    })
    setPaymentDate('')
    setPaymentAmount('')
    setPaymentForYear('')
    setPaymentNote('')
    setPaymentNotice('✓ Uplata je evidentirana.')
  }

  const addFunctionAssignment = () => {
    if (!newFunctionName.trim()) return
    const newAssignment: MemberFunctionAssignment = {
      id: generateId(),
      functionName: newFunctionName.trim(),
      fromYear: newFunctionFrom.trim(),
      toYear: newFunctionTo.trim(),
    }
    const updated = [...(formState.functions ?? []), newAssignment]
    setFormState((prev) => ({
      ...prev,
      functions: updated,
    }))
    if (!isEditing) {
      updateMember(member.id, { functions: updated })
      setSaveNotice('✓ Funkcija je dodana.')
    }
    setNewFunctionName('')
    setNewFunctionFrom('')
    setNewFunctionTo('')
    setShowAddFunction(false)
  }

  const startEditingFunction = (fn: MemberFunctionAssignment) => {
    setEditingFunctionId(fn.id)
    setEditFunctionName(fn.functionName)
    setEditFunctionFrom(fn.fromYear || '')
    setEditFunctionTo(fn.toYear || '')
  }

  const cancelEditingFunction = () => {
    setEditingFunctionId(null)
    setEditFunctionName('')
    setEditFunctionFrom('')
    setEditFunctionTo('')
  }

  const saveEditingFunction = (id: string) => {
    if (!editFunctionName.trim()) return
    const updated = (formState.functions ?? []).map((fn) =>
      fn.id === id
        ? {
            ...fn,
            functionName: editFunctionName.trim(),
            fromYear: editFunctionFrom.trim(),
            toYear: editFunctionTo.trim(),
          }
        : fn
    )
    setFormState((prev) => ({
      ...prev,
      functions: updated,
    }))
    if (!isEditing) {
      updateMember(member.id, { functions: updated })
      setSaveNotice('✓ Funkcija je uspješno ažurirana.')
    }
    cancelEditingFunction()
  }

  const removeFunctionAssignment = (id: string) => {
    if (!window.confirm("Sigurno želite ukloniti ovu funkciju?")) return
    const updated = (formState.functions ?? []).filter((fn) => fn.id !== id)
    setFormState((prev) => ({
      ...prev,
      functions: updated,
    }))
    if (!isEditing) {
      updateMember(member.id, { functions: updated })
      setSaveNotice('✓ Funkcija je uklonjena.')
    }
    if (editingFunctionId === id) {
      cancelEditingFunction()
    }
  }

  const handleSendInvitation = () => {
    setInvitationDialogOpen(true)
  }

  function parseDateStr(dateStr: string | undefined | null): Date | null {
    if (!dateStr) return null;
    if (/^\d{2}\.\d{2}\.\d{4}\.?$/.test(dateStr.trim())) {
      const parts = dateStr.trim().split('.');
      return new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00`);
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d;
  }

  function formatDate(dateStr: string | undefined | null): string {
    return formatDateDMY(dateStr, '—');
  }


  const getMembershipStatusColor = () => {
    if (member.deceased) return 'bg-gray-100 text-gray-600'
    if (member.expelled) return 'bg-red-100 text-red-700'
    if (member.honorary) return 'bg-blue-100 text-blue-700'
    if (member.status === 'active') return 'bg-emerald-100 text-emerald-700'
    return 'bg-red-100 text-red-700'
  }

  const getMembershipStatusLabel = () => {
    if (member.deceased) return 'Preminuo/la'
    if (member.expelled) return 'Ispisan/a rješenjem'
    if (member.honorary) return 'Počasni član'
    if (member.status === 'active') return 'Aktivan'
    return 'Ispisan/a'
  }

  const getFinancialStatusColor = () => {
    if (member.deceased || member.expelled) return 'bg-gray-50 text-gray-500'
    if (member.honorary || member.exemptFromPayment) return 'bg-blue-50 text-blue-700'
    if (member.paymentStatus === 'paid') return 'bg-emerald-50 text-emerald-700'
    if (member.paymentStatus === 'overdue') return 'bg-amber-50 text-amber-700'
    return 'bg-gray-50 text-gray-500'
  }

  const getFinancialStatusLabel = () => {
    if (member.deceased || member.expelled) return 'Zatvoreno'
    if (member.honorary || member.exemptFromPayment) return 'Oslobođeno'
    if (member.paymentStatus === 'paid') return 'Plaćeno'
    if (member.paymentStatus === 'overdue') return 'Dug'
    return '-'
  }

  // Sort payments by date descending
  const sortedPayments = [...(member.payments ?? [])].sort((a, b) => {
    const dA = parseDateStr(a.date)?.getTime() || 0;
    const dB = parseDateStr(b.date)?.getTime() || 0;
    return dB - dA;
  })

  return (
    <Dialog
      open={dialogOpen}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && isEditing) {
          const ok = window.confirm(
            'Uređivanje podataka člana je u tijeku i promjene nisu spremljene. Želite li zatvoriti prozor bez spremanja?'
          )
          if (!ok) return
          handleCancelEdit()
        }
        setDialogOpen(nextOpen)
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="w-[96vw] sm:max-w-[1400px] h-[92vh] overflow-hidden p-0">
        <div className="flex h-full flex-col overflow-hidden bg-background">

          {/* ========== HEADER S GUMBIMA ========== */}
          <div className="flex items-center justify-between gap-4 border-b border-border bg-card px-6 py-4">
            <div className="flex items-center gap-4 min-w-0">
              <Avatar className="h-14 w-14 shrink-0">
                <AvatarImage src={member.avatar} alt={member.name} />
                <AvatarFallback className="bg-primary text-primary-foreground text-lg font-bold">
                  {member.initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <DialogTitle className="text-xl font-bold leading-tight truncate">{member.name}</DialogTitle>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-xs text-muted-foreground">#{member.registryNumber || '-'}</span>
                  <Badge className={`text-[10px] font-bold px-2 py-0.5 ${getMembershipStatusColor()}`}>
                    Status: {getMembershipStatusLabel()}
                  </Badge>
                  <Badge className={`text-[10px] font-bold px-2 py-0.5 ${getFinancialStatusColor()}`}>
                    Financije: {getFinancialStatusLabel()}
                  </Badge>
                  {member.invitationSent ? (
                    <Badge className="text-[10px] bg-blue-100 text-blue-700 font-bold px-2 py-0.5">
                      ✉ POZIVNICA POSLANA {member.invitationSentAt ? `· ${formatInvitationDateTime(member.invitationSentAt)}` : ''}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground border-dashed px-2 py-0.5">
                      Pozivnica nije poslana
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* AKCIJSKI GUMBI U ZAGLAVLJU */}
            <div className="flex items-center gap-2 shrink-0">
              {!isEditing ? (
                <>
                  {/* Gumb za pozivnicu - samo ako ima email i ovlast */}
                  {memberActions.posalji_pozivnicu && member.email && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                      onClick={handleSendInvitation}
                    >
                      <Mail className="h-3.5 w-3.5" />
                      {member.invitationSent ? 'Pošalji ponovno' : 'Pozivnica'}
                    </Button>
                  )}
                  {/* Gumb za ispis iz društva */}
                  {!member.expelled && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                      onClick={() => {
                        if (window.confirm(`Ispisati člana ${member.name} iz društva?`)) {
                          updateMember(member.id, {
                            expelled: true,
                            expulsionDate: new Date().toISOString().split('T')[0],
                          })
                        }
                      }}
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Ispiši
                    </Button>
                  )}
                  {/* Gumb za uređivanje */}
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setIsEditing(true)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Uredi podatke
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancelEdit}
                  >
                    Odustani
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                    onClick={handleSave}
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    Spremi izmjene
                  </Button>
                </>
              )}
              <DialogClose asChild>
                <button className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-secondary hover:text-foreground text-lg leading-none">
                  ×
                </button>
              </DialogClose>
            </div>
          </div>

          {/* ========== MODAL ZA PREGLED I SLANJE POZIVNICE ========== */}
          <InvitationPreviewDialog
            member={member}
            open={invitationDialogOpen}
            onOpenChange={setInvitationDialogOpen}
            onSuccess={({ sentAt, email }) => {
              setSaveNotice(`✓ Pozivnica poslana na ${email} (${formatInvitationDateTime(sentAt)})`)
            }}
          />

          {/* ========== MODAL ZA PREGLED I SLANJE OBAVIJESTI O PLAĆANJU ========== */}
          <PaymentReminderDialog
            open={paymentReminderDialogOpen}
            onOpenChange={setPaymentReminderDialogOpen}
            mode="single"
            member={member}
            onSuccess={() => {
              setSaveNotice(`✓ Obavijest o plaćanju uspješno poslana na ${member.email}`)
            }}
          />


          {/* ========== SADRŽAJ DIJALOGA ========== */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="grid gap-5 lg:grid-cols-[1.55fr_1fr]">

              {/* LIJEVA KOLONA */}
              <div className="space-y-5">

                {/* 1. Osobni podaci i rođenje */}
                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <div className="mb-4 flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Osobni podaci i rođenje</h3>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Ime</Label>
                      <Input value={firstName} onChange={(e) => handleFullNameChange(e.target.value, lastName)} disabled={!isEditing} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Prezime</Label>
                      <Input value={lastName} onChange={(e) => handleFullNameChange(firstName, e.target.value)} disabled={!isEditing} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Djevojačko prezime</Label>
                      <Input value={formState.maidenName ?? ''} onChange={(e) => handleFieldChange('maidenName', e.target.value)} disabled={!isEditing} placeholder="Opcionalno" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">OIB</Label>
                      <Input value={formState.oib ?? ''} onChange={(e) => handleFieldChange('oib', e.target.value)} disabled={!isEditing} placeholder="11 znamenki" maxLength={11} />
                    </div>
                    <div className="space-y-1.5">
                      {isEditing ? (
                        <DateOrYearInput
                          label="Datum rođenja"
                          value={formState.birthDate ?? ''}
                          onChange={(val) => handleFieldChange('birthDate', val)}
                          placeholder="DD/MM/YYYY"
                        />
                      ) : (
                        <>
                          <Label className="text-xs">Datum rođenja</Label>
                          <Input value={formatDateDMY(formState.birthDate, '')} disabled placeholder="—" />
                        </>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Mjesto rođenja</Label>
                      <Input value={formState.birthPlace ?? ''} onChange={(e) => handleFieldChange('birthPlace', e.target.value)} disabled={!isEditing} placeholder="Grad / naselje" />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
                      <Label className="text-xs">Zemlja rođenja</Label>
                      <Input value={formState.birthCountry ?? ''} onChange={(e) => handleFieldChange('birthCountry', e.target.value)} disabled={!isEditing} placeholder="Npr. Hrvatska" />
                    </div>
                  </div>
                </div>

                {/* 2. Kontakt i prebivalište */}
                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <div className="mb-4 flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Kontakt i prebivalište</h3>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Email adresa</Label>
                      <Input value={formState.email ?? ''} onChange={(e) => handleFieldChange('email', e.target.value)} disabled={!isEditing} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Mobitel</Label>
                      <Input value={formState.phone ?? ''} onChange={(e) => handleFieldChange('phone', e.target.value)} disabled={!isEditing} placeholder="Npr. 091 123 4567" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Telefon (fiksni)</Label>
                      <Input value={formState.landlinePhone ?? ''} onChange={(e) => handleFieldChange('landlinePhone', e.target.value)} disabled={!isEditing} placeholder="Npr. 01 123 4567" />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
                      <Label className="text-xs">Adresa prebivališta</Label>
                      <Input value={formState.address ?? ''} onChange={(e) => handleFieldChange('address', e.target.value)} disabled={!isEditing} />
                    </div>
                  </div>
                </div>

                {/* 3. Zanimanje, vještine i rodoslovna istraživanja */}
                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <div className="mb-4 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Zanimanje, vještine i rodoslovna istraživanja</h3>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Zvanje i zanimanje</Label>
                      <Input value={formState.occupation ?? ''} onChange={(e) => handleFieldChange('occupation', e.target.value)} disabled={!isEditing} placeholder="Npr. prof. povijesti" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Strani jezici</Label>
                      <Input value={formState.foreignLanguages ?? ''} onChange={(e) => handleFieldChange('foreignLanguages', e.target.value)} disabled={!isEditing} placeholder="Npr. engleski, njemački, latinski..." />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs">Radno iskustvo</Label>
                      <Textarea
                        value={formState.workExperience ?? ''}
                        onChange={(e) => handleFieldChange('workExperience', e.target.value)}
                        disabled={!isEditing}
                        rows={2}
                        placeholder="Npr. rad u arhivu, nastavi, uredski poslovi..."
                        className="resize-none"
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs">Hobi / vještine i znanja</Label>
                      <Textarea
                        value={formState.hobbiesSkills ?? ''}
                        onChange={(e) => handleFieldChange('hobbiesSkills', e.target.value)}
                        disabled={!isEditing}
                        rows={2}
                        placeholder="Npr. glagoljica, gotica, paleografija..."
                        className="resize-none"
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs">Lokacije i prezimena koja istražuje</Label>
                      {isEditing ? (
                        <Textarea
                          value={researchAreasInput}
                          onChange={(e) => setResearchAreasInput(e.target.value)}
                          rows={2}
                          placeholder="Odvojeno zarezom (npr. Horvat, Kovačić, Zagorje, Lika)"
                          className="resize-none"
                        />
                      ) : (
                        <div className="min-h-[42px] rounded-xl border border-border bg-muted/20 p-2.5 flex flex-wrap gap-1.5 items-center">
                          {(formState.researchAreas && formState.researchAreas.length > 0) ? (
                            formState.researchAreas.map((area, idx) => (
                              <Badge key={`${area}-${idx}`} variant="secondary" className="text-xs font-medium">
                                {area}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs italic text-muted-foreground">Nema upisanih lokacija niti prezimena.</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 4. Matični podaci, Članstvo i Posebni statusi */}
                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <div className="mb-4 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Matični podaci, članstvo i posebni statusi</h3>
                  </div>
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Br. prijavnice</Label>
                        <Input value={formState.membershipNumber ?? ''} onChange={(e) => handleFieldChange('membershipNumber', e.target.value)} disabled={!isEditing} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Br. matice</Label>
                        <Input value={formState.registryNumber ?? ''} onChange={(e) => handleFieldChange('registryNumber', e.target.value)} disabled={!isEditing} />
                      </div>
                      <div className="space-y-1.5">
                        {isEditing ? (
                          <DateOrYearInput
                            label="Datum upisa u društvo"
                            value={formState.joinDate ?? ''}
                            onChange={(val) => handleFieldChange('joinDate', val)}
                            placeholder="DD/MM/YYYY"
                          />
                        ) : (
                          <>
                            <Label className="text-xs">Datum upisa u društvo</Label>
                            <Input value={formatDateDMY(formState.joinDate, '')} disabled placeholder="—" />
                          </>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Status članstva</Label>
                        <div className="h-10 flex items-center">
                          <Badge className={`${getMembershipStatusColor()} text-xs font-bold`}>
                            {getMembershipStatusLabel()}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Checkboxovi s bojama kad su označeni */}
                    <div className="grid gap-2 sm:grid-cols-2">
                      {/* Počasni član */}
                      <label className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                        formState.honorary
                          ? 'border-blue-300 bg-blue-50 text-blue-700'
                          : 'border-border bg-background text-foreground hover:bg-muted/50'
                      } ${!isEditing ? 'cursor-default opacity-80' : ''}`}>
                        <input
                          type="checkbox"
                          checked={formState.honorary ?? false}
                          onChange={(e) => handleFieldChange('honorary', e.target.checked)}
                          disabled={!isEditing}
                          className="h-4 w-4 accent-blue-600"
                        />
                        <Star className={`h-4 w-4 ${formState.honorary ? 'text-blue-600' : 'text-muted-foreground'}`} />
                        <span className="text-sm font-medium">Počasni član</span>
                      </label>

                      {/* Oslobođen plaćanja */}
                      <label className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                        formState.exemptFromPayment
                          ? 'border-green-300 bg-green-50 text-green-700'
                          : 'border-border bg-background text-foreground hover:bg-muted/50'
                      } ${!isEditing ? 'cursor-default opacity-80' : ''}`}>
                        <input
                          type="checkbox"
                          checked={formState.exemptFromPayment ?? false}
                          onChange={(e) => handleFieldChange('exemptFromPayment', e.target.checked)}
                          disabled={!isEditing}
                          className="h-4 w-4 accent-green-600"
                        />
                        <ShieldOff className={`h-4 w-4 ${formState.exemptFromPayment ? 'text-green-600' : 'text-muted-foreground'}`} />
                        <span className="text-sm font-medium">Oslobođen plaćanja</span>
                      </label>

                      {/* Preminuo/la */}
                      <label className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                        formState.deceased
                          ? 'border-gray-400 bg-gray-100 text-gray-600'
                          : 'border-border bg-background text-foreground hover:bg-muted/50'
                      } ${!isEditing ? 'cursor-default opacity-80' : ''}`}>
                        <input
                          type="checkbox"
                          checked={formState.deceased ?? false}
                          onChange={(e) => handleFieldChange('deceased', e.target.checked)}
                          disabled={!isEditing}
                          className="h-4 w-4"
                        />
                        <span className="text-sm font-medium">Preminuo/la</span>
                      </label>

                      {/* Ispisan/a */}
                      <label className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                        formState.expelled
                          ? 'border-red-300 bg-red-50 text-red-700'
                          : 'border-border bg-background text-foreground hover:bg-muted/50'
                      } ${!isEditing ? 'cursor-default opacity-80' : ''}`}>
                        <input
                          type="checkbox"
                          checked={formState.expelled ?? false}
                          onChange={(e) => handleFieldChange('expelled', e.target.checked)}
                          disabled={!isEditing}
                          className="h-4 w-4 accent-red-600"
                        />
                        <XCircle className={`h-4 w-4 ${formState.expelled ? 'text-red-600' : 'text-muted-foreground'}`} />
                        <span className="text-sm font-medium">Ispisan/a iz društva</span>
                      </label>
                    </div>

                    {/* Uvjetna polja kad je označen ispis */}
                    {formState.expelled && (
                      <div className="rounded-xl bg-red-50 border border-red-200 p-3 grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-red-700">Datum ispisa</Label>
                          <Input value={formState.expulsionDate ?? ''} onChange={(e) => handleFieldChange('expulsionDate', e.target.value)} disabled={!isEditing} className="h-9 text-sm" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-red-700">Razlog ispisa</Label>
                          <Input value={formState.expulsionReason ?? ''} onChange={(e) => handleFieldChange('expulsionReason', e.target.value)} disabled={!isEditing} className="h-9 text-sm" />
                        </div>
                      </div>
                    )}

                    {/* Uvjetno polje za datum smrti */}
                    {formState.deceased && (
                      <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-gray-600">Datum smrti</Label>
                          <Input value={formState.deathDate ?? ''} onChange={(e) => handleFieldChange('deathDate', e.target.value)} disabled={!isEditing} className="h-9 text-sm" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Funkcije u društvu */}
                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Funkcije u društvu</h3>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1 border-dashed"
                      onClick={() => setShowAddFunction(prev => !prev)}
                    >
                      {showAddFunction ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                      {showAddFunction ? "Zatvori" : "Dodaj funkciju"}
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {(showAddFunction || isEditing) && (
                      <div className="rounded-xl bg-muted/50 border border-border p-3 space-y-3">
                        <div className="flex items-center justify-between pb-1 border-b border-border/50">
                          <span className="text-xs font-semibold">Nova funkcija</span>
                          <span className="text-[10px] text-muted-foreground">Prazno &quot;Do godine&quot; označava aktivnu funkciju</span>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs">Funkcija</Label>
                            <input
                              list="member-details-available-functions"
                              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                              value={newFunctionName}
                              onChange={(e) => setNewFunctionName(e.target.value)}
                              placeholder="Odaberite ili upišite..."
                            />
                            <datalist id="member-details-available-functions">
                              {settings.availableFunctions?.map((fn, idx) => (
                                <option key={`${fn}-${idx}`} value={fn} />
                              ))}
                            </datalist>
                          </div>
                          <DateOrYearInput
                            label="Od godine ili datuma"
                            value={newFunctionFrom}
                            onChange={setNewFunctionFrom}
                            placeholder="npr. 2020 ili 15.05.2020"
                          />
                          <DateOrYearInput
                            label="Do godine ili datuma"
                            value={newFunctionTo}
                            onChange={setNewFunctionTo}
                            placeholder="prazno za aktivnu ili npr. 2024 / 15.05.2024"
                          />
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                          {showAddFunction && !isEditing && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs"
                              onClick={() => setShowAddFunction(false)}
                            >
                              Odustani
                            </Button>
                          )}
                          <Button
                            size="sm"
                            className="h-8 text-xs gap-1.5"
                            onClick={addFunctionAssignment}
                            disabled={!newFunctionName.trim()}
                          >
                            <Plus className="h-3.5 w-3.5" /> Dodaj funkciju
                          </Button>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      {(formState.functions ?? []).length > 0 ? (
                        (formState.functions ?? []).map((fn) => {
                          const isCurrentlyEditing = editingFunctionId === fn.id
                          if (isCurrentlyEditing) {
                            return (
                              <div key={fn.id} className="rounded-xl border-2 border-primary/40 bg-accent/5 p-3 space-y-3">
                                <div className="flex items-center justify-between pb-1 border-b border-primary/20">
                                  <span className="text-xs font-semibold text-primary">Promjena / nadopuna funkcije</span>
                                  <span className="text-[10px] text-muted-foreground">Prazno &quot;Do&quot; = u tijeku</span>
                                </div>
                                <div className="grid gap-2 sm:grid-cols-3">
                                  <div className="space-y-1.5">
                                    <Label className="text-xs">Funkcija</Label>
                                    <input
                                      list={`edit-functions-list-${fn.id}`}
                                      className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                      value={editFunctionName}
                                      onChange={(e) => setEditFunctionName(e.target.value)}
                                      placeholder="Naziv funkcije..."
                                    />
                                    <datalist id={`edit-functions-list-${fn.id}`}>
                                      {settings.availableFunctions?.map((f, idx) => (
                                        <option key={`${f}-${idx}`} value={f} />
                                      ))}
                                    </datalist>
                                  </div>
                                  <DateOrYearInput
                                    label="Od godine ili datuma"
                                    value={editFunctionFrom}
                                    onChange={setEditFunctionFrom}
                                    placeholder="npr. 2020 ili 15.05.2020"
                                  />
                                  <DateOrYearInput
                                    label="Do godine ili datuma"
                                    value={editFunctionTo}
                                    onChange={setEditFunctionTo}
                                    placeholder="prazno za aktivnu ili npr. 2024 / 15.05.2024"
                                  />
                                </div>
                                <div className="flex justify-end gap-2 pt-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 text-xs gap-1"
                                    onClick={cancelEditingFunction}
                                  >
                                    <X className="h-3.5 w-3.5" /> Odustani
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    className="h-8 text-xs gap-1 bg-primary text-primary-foreground hover:bg-primary/90"
                                    onClick={() => saveEditingFunction(fn.id)}
                                    disabled={!editFunctionName.trim()}
                                  >
                                    <Check className="h-3.5 w-3.5" /> Spremi izmjenu
                                  </Button>
                                </div>
                              </div>
                            )
                          }

                          return (
                            <div key={fn.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-2.5 transition-all hover:border-accent/40">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-semibold truncate">{fn.functionName}</p>
                                  {isMandateActive(fn.toYear) && (
                                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                                      Aktivna
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {formatMandatePeriod(fn.fromYear, fn.toYear)}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-secondary"
                                  title="Uredi / nadopuni funkciju"
                                  onClick={() => startEditingFunction(fn)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                  title="Ukloni funkciju"
                                  onClick={() => removeFunctionAssignment(fn.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          )
                        })
                      ) : (
                        <div className="rounded-xl border border-dashed border-border p-4 text-sm text-center text-muted-foreground">
                          Nema dodijeljenih funkcija.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* DESNA KOLONA */}
              <div className="space-y-5">

                {/* Pristup sustavu i evidencija pozivnice */}
                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-primary" />
                      <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Pristup sustavu i evidencija pozivnice</h3>
                    </div>
                    {member.email && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 h-7 text-xs border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                        onClick={handleSendInvitation}
                      >
                        <Mail className="h-3 w-3" />
                        {member.invitationSent ? 'Pošalji ponovno' : 'Pošalji pozivnicu'}
                      </Button>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 text-xs">
                    <div className="rounded-xl bg-muted/40 p-3 space-y-1">
                      <span className="text-muted-foreground text-[11px] font-medium block">Status pozivnice</span>
                      <div>
                        {member.invitationSent ? (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 font-semibold text-xs">
                            ✓ Poslana članu
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-200 text-xs">
                            Nije poslana
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl bg-muted/40 p-3 space-y-1">
                      <span className="text-muted-foreground text-[11px] font-medium block">Datum slanja za evidenciju</span>
                      <p className="font-semibold text-foreground text-xs">
                        {member.invitationSentAt ? (
                          formatInvitationDateTime(member.invitationSentAt)
                        ) : member.invitationSent ? (
                          'Evidentirano (ranije poslano)'
                        ) : (
                          <span className="text-muted-foreground italic">Još nije poslana</span>
                        )}
                      </p>
                    </div>

                    <div className="rounded-xl bg-muted/40 p-3 space-y-1">
                      <span className="text-muted-foreground text-[11px] font-medium block">Korisničko ime (Username)</span>
                      <p className="font-mono text-xs font-semibold text-foreground truncate">
                        {member.email || <span className="text-red-500 italic">Nema emaila</span>}
                      </p>
                    </div>

                    <div className="rounded-xl bg-muted/40 p-3 space-y-1">
                      <span className="text-muted-foreground text-[11px] font-medium block">Privremena lozinka</span>
                      <p className="font-mono text-xs font-bold text-primary">
                        {member.password ? member.password : (
                          <span className="text-muted-foreground text-[11px] font-normal italic">Generira se prilikom slanja</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Financije */}
                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Financije</h3>
                    </div>
                    {memberActions.obavijesti_za_placanje && member.email && (
                      <Button
                        size="sm"
                        className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5 h-8 px-3 w-full sm:w-auto shrink-0 shadow-sm transition-all hover:scale-105"
                        onClick={() => setPaymentReminderDialogOpen(true)}
                      >
                        <Mail className="h-3.5 w-3.5" />
                        Pošalji obavijest o plaćanju
                      </Button>
                    )}
                  </div>
                  <div className="space-y-4">
                    {/* Status plaćanja - samo ovdje, ne duplikat */}
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Financijski status (sustavski)</Label>
                        <div className="h-10 flex items-center">
                          <Badge className={`${getFinancialStatusColor()} text-xs font-bold`}>
                            {getFinancialStatusLabel()}
                          </Badge>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Zadnja evidentirana uplata</Label>
                        <div className="h-10 flex items-center text-sm font-medium">
                          {sortedPayments[0]?.date ? (
                            <span>
                              {formatDate(sortedPayments[0].date)}
                              {sortedPayments[0].forYear ? (
                                <span className="ml-1.5 text-xs text-blue-700 font-medium">
                                  (za {sortedPayments[0].forYear}. god.)
                                </span>
                              ) : null}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Zadnja poslana obavijest</Label>
                        <div className="h-10 flex items-center text-sm font-medium">
                          {(member as any).lastPaymentReminderAt ? (
                            formatInvitationDateTime((member as any).lastPaymentReminderAt)
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1.5 sm:col-span-3 pt-2 border-t border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <Label className="text-xs">Zadnja rođendanska čestitka (evidencija)</Label>
                          <div className="text-sm font-medium mt-0.5 flex items-center gap-1.5">
                            <Cake className="h-3.5 w-3.5 text-pink-600" />
                            {member.lastBirthdayEmailAt ? (
                              formatInvitationDateTime(member.lastBirthdayEmailAt)
                            ) : (
                              <span className="text-muted-foreground">Nije još poslana</span>
                            )}
                          </div>
                        </div>
                        {memberActions.rodjendanske_cestitke && member.email && !member.deceased && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 h-8 px-3 border-pink-300 text-pink-700 hover:bg-pink-50 hover:text-pink-800 shrink-0"
                            onClick={() => setBirthdayDialogOpen(true)}
                          >
                            <Cake className="h-3.5 w-3.5" />
                            Pošalji rođendansku čestitku
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Tablica povijesti uplata */}
                    <div>
                      <Label className="text-xs mb-2 block">Povijest uplata</Label>
                      <div className="rounded-xl border border-border overflow-hidden">
                        <table className="w-full text-xs">
                          <thead className="bg-muted text-muted-foreground">
                            <tr>
                              <th className="px-3 py-2 text-left font-bold uppercase text-[10px]">Datum</th>
                              <th className="px-3 py-2 text-left font-bold uppercase text-[10px]">Za godinu</th>
                              <th className="px-3 py-2 text-right font-bold uppercase text-[10px]">Iznos</th>
                              <th className="px-3 py-2 text-left font-bold uppercase text-[10px]">Bilješka</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {sortedPayments.length > 0 ? (
                              sortedPayments.map((p, i) => (
                                <tr key={p.id} className={i === 0 ? 'bg-emerald-50' : ''}>
                                  <td className="px-3 py-2 font-medium">
                                    {formatDate(p.date)}
                                    {i === 0 && <span className="ml-1 text-[9px] text-emerald-600 font-bold">ZADNJA</span>}
                                  </td>
                                  <td className="px-3 py-2">
                                    {p.forYear ? (
                                      <Badge variant="outline" className="text-[10px] font-mono bg-blue-50 text-blue-700 border-blue-200">
                                        {p.forYear}. god.
                                      </Badge>
                                    ) : (
                                      <span className="text-muted-foreground">—</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-right font-bold">{p.amount} €</td>
                                  <td className="px-3 py-2 text-muted-foreground">{p.note || '—'}</td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={4} className="px-3 py-5 text-center text-muted-foreground">
                                  Nema evidentiranih uplata.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <Separator />

                    {/* Dodavanje uplate - samo za aktivne članove */}
                    {(member.status === 'active' || member.status === 'pending') && !member.deceased && !member.expelled && (
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Evidentiranje uplate</h4>
                        <div className="space-y-3">
                          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
                            <div className="space-y-1.5">
                              <Label className="text-xs">Datum uplate</Label>
                              <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">Iznos (€)</Label>
                              <Input type="number" min="0" step="0.01" placeholder="0,00" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
                            </div>
                            <div className="space-y-1.5 col-span-2 sm:col-span-1">
                              <Label className="text-xs">Za godinu (članarina)</Label>
                              <select
                                value={paymentForYear}
                                onChange={(e) => setPaymentForYear(e.target.value)}
                                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                              >
                                <option value="">Prema datumu uplate</option>
                                {paymentYearOptions.map((yr) => (
                                  <option key={yr} value={String(yr)}>
                                    {yr}. godina
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Bilješka (opcionalno)</Label>
                            <Input placeholder="Npr. Godišnja članarina 2025" value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} />
                          </div>
                          <Button size="sm" className="w-full gap-1.5" onClick={handlePaymentAdd}>
                            <Plus className="h-3.5 w-3.5" /> Evidentiraj uplatu
                          </Button>
                          {paymentNotice && (
                            <p className={`text-sm font-medium ${paymentNotice.startsWith('✓') ? 'text-green-600' : 'text-red-600'}`}>
                              {paymentNotice}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bilješke */}
                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Bilješke</h3>
                  {isEditing ? (
                    <Textarea
                      value={formState.notes ?? formState.note ?? ''}
                      onChange={(e) => handleFieldChange('notes', e.target.value)}
                      rows={5}
                      placeholder="Dodatne bilješke o članu..."
                      className="resize-none"
                    />
                  ) : (
                    <div className="min-h-[100px] rounded-xl border border-border bg-muted/20 p-3 text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">
                      {formState.notes || formState.note ? (
                        <Linkify text={formState.notes ?? formState.note} />
                      ) : (
                        <span className="italic text-muted-foreground">Nema bilješki.</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Obavijesti i potvrda */}
            {saveNotice && (
              <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm font-medium ${
                saveNotice.startsWith('✓') ? 'border-green-200 bg-green-50 text-green-700' : 'border-amber-200 bg-amber-50 text-amber-700'
              }`}>
                {saveNotice}
              </div>
            )}

            {confirmSave && (
              <div className="mt-3 flex gap-3 items-center rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                <div className="flex-1 space-y-1.5">
                  <Label className="text-xs text-amber-700 font-bold">Potvrda spremanja</Label>
                  <Input
                    placeholder="Unesite POTVRDI"
                    value={confirmationText}
                    onChange={(e) => setConfirmationText(e.target.value)}
                    className="h-9"
                    onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                  />
                </div>
                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white shrink-0" onClick={handleSave}>
                  Potvrdi
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
      <BirthdayEmailDialog
        member={member}
        open={birthdayDialogOpen}
        onOpenChange={setBirthdayDialogOpen}
      />
    </Dialog>
  )
}
