"use client"

import * as React from "react"
import { Member, MemberPayment, MemberFunctionAssignment } from "@/contexts/members-context"
import { useMembers } from "@/contexts/members-context"
import { useSettings } from "@/contexts/settings-context"
import { generateId } from "@/lib/utils"
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
import { Pencil, Plus, DollarSign, Trash2, Mail, User, FileText, CheckCircle, XCircle, Star, CreditCard, ShieldOff, Check, X } from "lucide-react"
import { Linkify } from "./linkify"

interface MemberDetailsDialogProps {
  member: Member
  children: React.ReactNode
}

export function MemberDetailsDialog({ member, children }: MemberDetailsDialogProps) {
  const { updateMember, addPayment } = useMembers()
  const { settings } = useSettings()
  const [isEditing, setIsEditing] = React.useState(false)
  const [saveNotice, setSaveNotice] = React.useState('')
  const [formState, setFormState] = React.useState<Member>(member)
  const [paymentDate, setPaymentDate] = React.useState('')
  const [paymentAmount, setPaymentAmount] = React.useState('')
  const [paymentNote, setPaymentNote] = React.useState('')
  const [paymentNotice, setPaymentNotice] = React.useState('')
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
  const [generatedPassword, setGeneratedPassword] = React.useState('')

  React.useEffect(() => {
    setFormState(member)
    setIsEditing(false)
    setSaveNotice('')
    setPaymentDate('')
    setPaymentAmount('')
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
    updateMember(member.id, {
      name: formState.name,
      email: formState.email,
      phone: formState.phone,
      birthDate: formState.birthDate,
      address: formState.address,
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
    addPayment(member.id, {
      date: paymentDate,
      amount: Number(paymentAmount),
      note: paymentNote || 'Ručno unesena uplata',
    })
    setPaymentDate('')
    setPaymentAmount('')
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
    const pwd = Math.random().toString(36).slice(-8).toUpperCase()
    setGeneratedPassword(pwd)
    setInvitationDialogOpen(true)
  }

  const confirmInvitation = async () => {
    try {
      setSaveNotice('Slanje pozivnice...')
      
      const response = await fetch('/api/send-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: member.email,
          name: member.name,
          tempPassword: generatedPassword
        })
      })

      if (response.ok) {
        updateMember(member.id, { 
          invitationSent: true,
          password: generatedPassword,
          role: member.role || 'member'
        })
        setInvitationDialogOpen(false)
        setSaveNotice(`✓ Pozivnica poslana na ${member.email}. Lozinka: ${generatedPassword}`)
      } else {
        throw new Error('Failed to send')
      }
    } catch (e) {
      setSaveNotice('× Greška pri slanju pozivnice.')
      console.error(e)
    }
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
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="w-[90vw] max-w-5xl h-[90vh] overflow-hidden p-0">
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
                  {member.invitationSent && (
                    <Badge className="text-[10px] bg-blue-100 text-blue-700 font-bold px-2 py-0.5">
                      ✉ POZIVNICA POSLANA
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* AKCIJSKI GUMBI U ZAGLAVLJU */}
            <div className="flex items-center gap-2 shrink-0">
              {!isEditing ? (
                <>
                  {/* Gumb za pozivnicu - samo ako ima email */}
                  {member.email && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                      onClick={handleSendInvitation}
                    >
                      <Mail className="h-3.5 w-3.5" />
                      Pozivnica
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

          {/* ========== MODAL ZA POZIVNICU ========== */}
          {invitationDialogOpen && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="bg-background rounded-2xl border border-border shadow-2xl p-6 max-w-sm w-full mx-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <Mail className="h-5 w-5 text-blue-700" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">Slanje pozivnice</h3>
                    <p className="text-xs text-muted-foreground">Podaci za prijavu u sustav</p>
                  </div>
                </div>
                <div className="space-y-3 mb-5">
                  <div className="rounded-xl bg-muted p-3 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground text-xs uppercase font-medium">Primatelj</span>
                      <span className="font-medium">{member.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground text-xs uppercase font-medium">Email</span>
                      <span className="font-mono text-xs">{member.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground text-xs uppercase font-medium">Kor. ime</span>
                      <span className="font-mono text-xs">{member.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground text-xs uppercase font-medium">Privr. lozinka</span>
                      <span className="font-mono text-sm font-bold tracking-widest text-primary">{generatedPassword}</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Član će dobiti ove podatke na email i moći će se prijaviti u sustav.</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setInvitationDialogOpen(false)}>
                    Odustani
                  </Button>
                  <Button size="sm" className="flex-1 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white" onClick={confirmInvitation}>
                    <Mail className="h-3.5 w-3.5" />
                    Potvrdi slanje
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ========== SADRŽAJ DIJALOGA ========== */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">

              {/* LIJEVA KOLONA */}
              <div className="space-y-5">

                {/* Osnovni podaci */}
                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <div className="mb-4 flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Osnovni podaci</h3>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Ime</Label>
                      <Input value={firstName} onChange={(e) => handleFullNameChange(e.target.value, lastName)} disabled={!isEditing} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Prezime</Label>
                      <Input value={lastName} onChange={(e) => handleFullNameChange(firstName, e.target.value)} disabled={!isEditing} />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs">Email adresa</Label>
                      <Input value={formState.email ?? ''} onChange={(e) => handleFieldChange('email', e.target.value)} disabled={!isEditing} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Telefon</Label>
                      <Input value={formState.phone ?? ''} onChange={(e) => handleFieldChange('phone', e.target.value)} disabled={!isEditing} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Datum rođenja</Label>
                      <Input value={formState.birthDate ?? ''} onChange={(e) => handleFieldChange('birthDate', e.target.value)} disabled={!isEditing} />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs">Adresa</Label>
                      <Input value={formState.address ?? ''} onChange={(e) => handleFieldChange('address', e.target.value)} disabled={!isEditing} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Br. prijavnice</Label>
                      <Input value={formState.membershipNumber ?? ''} onChange={(e) => handleFieldChange('membershipNumber', e.target.value)} disabled={!isEditing} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Br. matice</Label>
                      <Input value={formState.registryNumber ?? ''} onChange={(e) => handleFieldChange('registryNumber', e.target.value)} disabled={!isEditing} />
                    </div>
                  </div>
                </div>

                {/* Članstvo, Status i Posebni statusi - SPOJENO */}
                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <div className="mb-4 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Članstvo i posebni statusi</h3>
                  </div>
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Datum upisa u društvo</Label>
                        <Input value={formState.joinDate} onChange={(e) => handleFieldChange('joinDate', e.target.value)} disabled={!isEditing} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Status članstva (sustavski)</Label>
                        <div className="h-10 flex items-center">
                          <Badge className={`${getMembershipStatusColor()} text-xs font-bold`}>
                            {getMembershipStatusLabel()}
                          </Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground italic">Određuje sustav na temelju uplata ili posebnih statusa.</p>
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
                          <div className="space-y-1.5">
                            <Label className="text-xs">Od godine</Label>
                            <Input
                              type="number"
                              className="h-9 text-sm"
                              value={newFunctionFrom}
                              onChange={(e) => setNewFunctionFrom(e.target.value)}
                              placeholder="npr. 2020"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Do godine</Label>
                            <Input
                              type="number"
                              className="h-9 text-sm"
                              value={newFunctionTo}
                              onChange={(e) => setNewFunctionTo(e.target.value)}
                              placeholder="prazno za aktivnu"
                            />
                          </div>
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
                                  <span className="text-[10px] text-muted-foreground">Prazno &quot;Do godine&quot; = u tijeku</span>
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
                                  <div className="space-y-1.5">
                                    <Label className="text-xs">Od godine</Label>
                                    <Input
                                      type="number"
                                      className="h-9 text-sm"
                                      value={editFunctionFrom}
                                      onChange={(e) => setEditFunctionFrom(e.target.value)}
                                      placeholder="npr. 2020"
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label className="text-xs">Do godine</Label>
                                    <Input
                                      type="number"
                                      className="h-9 text-sm"
                                      value={editFunctionTo}
                                      onChange={(e) => setEditFunctionTo(e.target.value)}
                                      placeholder="prazno za danas"
                                    />
                                  </div>
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
                                  {!fn.toYear && (
                                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                                      Aktivna
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {fn.fromYear || "—"} – {fn.toYear || "danas"}
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

                {/* Financije */}
                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Financije</h3>
                    </div>
                    {member.email && (
                      <Button
                        size="sm"
                        className="bg-red-600 hover:bg-red-700 text-white gap-1.5 h-8 px-3 w-full sm:w-auto shrink-0 shadow-sm transition-all hover:scale-105"
                        onClick={async () => {
                          if (confirm(`Želite li poslati obavijest o plaćanju (i QR uplatnicu) na email ${member.email}?`)) {
                            try {
                              const res = await fetch(`/api/admin/settings/test-email?type=payment_notice&targetEmail=${encodeURIComponent(member.email)}`);
                              const data = await res.json();
                              if (data.success) {
                                setSaveNotice(`✓ Obavijest o plaćanju poslana na ${member.email}`);
                              } else {
                                setSaveNotice(`Greška: ${data.error}`);
                              }
                            } catch (e) {
                              setSaveNotice(`Greška pri slanju obavijesti`);
                            }
                          }
                        }}
                      >
                        <Mail className="h-3.5 w-3.5" />
                        Pošalji obavijest o plaćanju
                      </Button>
                    )}
                  </div>
                  <div className="space-y-4">
                    {/* Status plaćanja - samo ovdje, ne duplikat */}
                    <div className="grid gap-3 sm:grid-cols-2">
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
                          {sortedPayments[0]?.date ? formatDate(sortedPayments[0]?.date) : <span className="text-muted-foreground">—</span>}
                        </div>
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
                              <th className="px-3 py-2 text-right font-bold uppercase text-[10px]">Iznos</th>
                              <th className="px-3 py-2 text-left font-bold uppercase text-[10px]">Bilješka</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {sortedPayments.length > 0 ? (
                              sortedPayments.map((p, i) => (
                                <tr key={p.id} className={i === 0 ? 'bg-emerald-50' : ''}>
                                  <td className="px-3 py-2 font-medium">
                                    {p.date}
                                    {i === 0 && <span className="ml-1 text-[9px] text-emerald-600 font-bold">ZADNJA</span>}
                                  </td>
                                  <td className="px-3 py-2 text-right font-bold">{p.amount} €</td>
                                  <td className="px-3 py-2 text-muted-foreground">{p.note || '—'}</td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={3} className="px-3 py-5 text-center text-muted-foreground">
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
                          <div className="grid gap-3 grid-cols-2">
                            <div className="space-y-1.5">
                              <Label className="text-xs">Datum</Label>
                              <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">Iznos (€)</Label>
                              <Input type="number" min="0" step="0.01" placeholder="0,00" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
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
    </Dialog>
  )
}
