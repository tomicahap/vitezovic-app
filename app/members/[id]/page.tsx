"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { Member, MemberFunctionAssignment, AccessCategory, MemberAccessRight } from "@/contexts/members-context"
import { useMembers } from "@/contexts/members-context"
import { generateId } from "@/lib/utils"
import { useSettings } from "@/contexts/settings-context"
import { useAuth } from "@/contexts/auth-context"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Pencil, Plus, DollarSign, Trash2, Mail, User, FileText,
  ArrowLeft, CheckCircle, CheckCircle2, XCircle, Star, ShieldOff, UserCheck,
} from "lucide-react"

export default function MemberDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const { members, updateMember, deleteMember, addPayment, updatePayment, deletePayment, getMemberById } = useMembers()
  const { settings } = useSettings()
  const { user } = useAuth()

  const memberId = Number(params.id)
  const member = Number.isNaN(memberId) ? undefined : getMemberById(memberId)
  const isAdmin = user?.role === 'admin'
  const canEditMembers = isAdmin || user?.accessRights?.members?.edit === true
  const canViewFinances = isAdmin || user?.accessRights?.finances?.view === true
  const canEditFinances = isAdmin || user?.accessRights?.finances?.edit === true

  const accessCategories: Array<{ key: AccessCategory; label: string }> = [
    { key: 'members', label: 'Članovi' },
    { key: 'meetings', label: 'Sjednice' },
    { key: 'projects', label: 'Projekti' },
    { key: 'finances', label: 'Financije' },
    { key: 'archive', label: 'Arhiv' },
    { key: 'drive', label: 'Google Drive' },
    { key: 'logs', label: 'Logovi' },
    { key: 'contacts', label: 'Adresar' },
    { key: 'library', label: 'Knjižnica' },
    { key: 'lectures', label: 'Predavanja' },
    { key: 'links', label: 'Linkovi' },
    { key: 'gmail', label: 'Inbox (Gmail)' },
    { key: 'chronicle', label: 'Ljetopis' },
    { key: 'polls', label: 'Glasovanja' },
  ]

  const [isEditing, setIsEditing] = React.useState(false)
  const [saveNotice, setSaveNotice] = React.useState('')
  const [formState, setFormState] = React.useState<Member | null>(null)
  const [paymentDate, setPaymentDate] = React.useState('')
  const [paymentAmount, setPaymentAmount] = React.useState('')
  const [paymentNote, setPaymentNote] = React.useState('')
  const [paymentNotice, setPaymentNotice] = React.useState('')
  const [showSaveConfirmDialog, setShowSaveConfirmDialog] = React.useState(false)
  const [showPaymentConfirmDialog, setShowPaymentConfirmDialog] = React.useState(false)
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = React.useState(false)
  const [memberPolls, setMemberPolls] = React.useState<any[]>([])

  React.useEffect(() => {
    if (member?.id) {
      fetch(`/api/polls?memberId=${member.id}&all=true`)
        .then(res => res.json())
        .then(data => setMemberPolls(data))
        .catch(err => console.error("Error fetching member polls:", err))
    }
  }, [member?.id])
  const [showInvitationDialog, setShowInvitationDialog] = React.useState(false)
  const [generatedPassword, setGeneratedPassword] = React.useState('')
  const [newFunctionName, setNewFunctionName] = React.useState('')
  const [newFunctionFrom, setNewFunctionFrom] = React.useState('')
  const [newFunctionTo, setNewFunctionTo] = React.useState('')
  const [firstName, setFirstName] = React.useState('')
  const [lastName, setLastName] = React.useState('')
  const [editingPaymentId, setEditingPaymentId] = React.useState<string | null>(null)
  const [editPaymentDate, setEditPaymentDate] = React.useState('')
  const [editPaymentAmount, setEditPaymentAmount] = React.useState('')
  const [editPaymentNote, setEditPaymentNote] = React.useState('')

  React.useEffect(() => {
    if (member) {
      setFormState(member)
      setIsEditing(false)
      setSaveNotice('')
      setPaymentDate('')
      setPaymentAmount('')
      setPaymentNote('')
      setPaymentNotice('')
      setShowSaveConfirmDialog(false)
      setShowPaymentConfirmDialog(false)
      setShowDeleteConfirmDialog(false)
      setShowInvitationDialog(false)
      setNewFunctionName('')
      setNewFunctionFrom('')
      setNewFunctionTo('')
      const [first, ...rest] = member.name.split(' ')
      setFirstName(first || '')
      setLastName(rest.join(' ') || '')
    }
  }, [member])

  if (!member || !formState) {
    return (
      <div className="flex flex-col md:flex-row min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Član nije pronađen</h2>
          <Button onClick={() => router.push('/members')} className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Natrag na članove
          </Button>
        </div>
      </div>
    )
  }

  const getAccessRight = (category: AccessCategory): MemberAccessRight => {
    return (formState as any)?.accessRights?.[category] ?? { view: false, edit: false }
  }

  const handleAccessChange = (category: AccessCategory, field: keyof MemberAccessRight, value: boolean) => {
    setFormState((prev) => {
      if (!prev) return prev
      const current = (prev as any).accessRights ?? {}
      const existing = current[category] ?? { view: false, edit: false }
      const updated = {
        ...current,
        [category]: {
          ...existing,
          [field]: value,
          ...(field === 'edit' && value ? { view: true } : {}),
        },
      }
      return { ...prev, accessRights: updated } as Member
    })
  }

  const handleFullNameChange = (newFirst: string, newLast: string) => {
    setFirstName(newFirst)
    setLastName(newLast)
    setFormState((prev) => prev ? ({ ...prev, name: `${newFirst} ${newLast}`.trim() }) : null)
    setShowSaveConfirmDialog(false)
  }

  const handleFieldChange = (field: keyof Member, value: string | boolean) => {
    setFormState((prev) => prev ? ({ ...prev, [field]: value }) : null)
    setShowSaveConfirmDialog(false)
  }

  const handleSave = () => {
    if (!isEditing) {
      setIsEditing(true)
      setSaveNotice('')
      return
    }
    setShowSaveConfirmDialog(true)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    if (member) setFormState(member)
    setSaveNotice('')
    setShowSaveConfirmDialog(false)
    const [first, ...rest] = member.name.split(' ')
    setFirstName(first || '')
    setLastName(rest.join(' ') || '')
  }

  const confirmSave = () => {
    if (formState) {
      updateMember(member.id, formState)
      setIsEditing(false)
      setSaveNotice('✓ Podaci su uspješno spremljeni.')
      setShowSaveConfirmDialog(false)
    }
  }

  const handlePaymentAdd = () => {
    if (!paymentDate || !paymentAmount) {
      setPaymentNotice('Unesite datum i iznos uplate.')
      return
    }
    setShowPaymentConfirmDialog(true)
  }

  const confirmPayment = () => {
    addPayment(member.id, {
      date: paymentDate,
      amount: Number(paymentAmount),
      note: paymentNote || 'Ručno unesena uplata',
    })
    setPaymentDate('')
    setPaymentAmount('')
    setPaymentNote('')
    setShowPaymentConfirmDialog(false)
    setPaymentNotice('✓ Uplata je evidentirana.')
  }

  const handleDelete = () => setShowDeleteConfirmDialog(true)

  const confirmDelete = () => {
    deleteMember(member.id)
    router.push('/members')
  }

  const handleSendInvitation = () => {
    const pwd = Math.random().toString(36).slice(-8).toUpperCase()
    setGeneratedPassword(pwd)
    setShowInvitationDialog(true)
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

      const data = await response.json()

      if (response.ok) {
        // Obavezno spremiti generiranu lozinku u bazu kako bi se korisnik mogao prijaviti
        updateMember(member.id, { 
          invitationSent: true,
          password: generatedPassword,
          isTempPassword: true
        })
        setShowInvitationDialog(false)
        setSaveNotice(`✓ Pozivnica poslana na ${member.email}. Privremena lozinka: ${generatedPassword}`)
      } else {
        console.error('API Error:', response.status, data)
        throw new Error(data.error || 'Failed to send')
      }
    } catch (e: any) {
      setSaveNotice(`× Greška: ${e.message}`)
      console.error('Invitation error:', e)
    }
  }

  const addFunctionAssignment = () => {
    if (!newFunctionName) return
    const newAssignment: MemberFunctionAssignment = {
      id: generateId(),
      functionName: newFunctionName,
      fromYear: newFunctionFrom,
      toYear: newFunctionTo,
    }
    setFormState((prev) => prev ? ({
      ...prev,
      functions: [...(prev.functions ?? []), newAssignment],
    }) : null)
    setNewFunctionName('')
    setNewFunctionFrom('')
    setNewFunctionTo('')
  }

  const removeFunctionAssignment = (id: string) => {
    setFormState((prev) => prev ? ({
      ...prev,
      functions: prev.functions?.filter((fn) => fn.id !== id),
    }) : null)
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

  function formatDate(dStr: string | undefined | null) {
    if (!dStr) return '-';
    const parts = dStr.split('-');
    if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}.`;
    return dStr;
  }

  const getMembershipStatusColor = () => {
    if (member.deceased) return 'bg-gray-100 text-gray-600 border-gray-200'
    if (member.expelled) return 'bg-red-100 text-red-700 border-red-200'
    if (member.honorary) return 'bg-blue-100 text-blue-700 border-blue-200'
    if (member.status === 'active') return 'bg-emerald-100 text-emerald-700 border-emerald-200'
    return 'bg-red-100 text-red-700 border-red-200'
  }

  const getMembershipStatusLabel = () => {
    if (member.deceased) return 'Preminuo/la'
    if (member.expelled) return 'Ispisan/a iz društva'
    if (member.honorary) return 'Počasni član'
    if (member.status === 'active') return 'Aktivan'
    return 'Ispisan/a'
  }

  const getFinancialStatusColor = () => {
    if (member.deceased || member.expelled) return 'bg-gray-50 text-gray-500 border-gray-200'
    if (member.honorary || member.exemptFromPayment) return 'bg-blue-50 text-blue-700 border-blue-200'
    if (member.paymentStatus === 'paid') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    if (member.paymentStatus === 'overdue') return 'bg-amber-50 text-amber-700 border-amber-200'
    return 'bg-gray-50 text-gray-500 border-gray-200'
  }

  const getFinancialStatusLabel = () => {
    if (member.deceased || member.expelled) return 'Zatvoreno'
    if (member.honorary || member.exemptFromPayment) return 'Oslobođeno'
    if (member.paymentStatus === 'paid') return 'Plaćeno'
    if (member.paymentStatus === 'overdue') return 'Dug'
    return '-'
  }

  const handlePaymentDelete = (paymentId: string) => {
    if (window.confirm('Jeste li sigurni da želite obrisati ovu uplatu?')) {
      deletePayment(member.id, paymentId)
      setPaymentNotice('✓ Uplata je obrisana.')
    }
  }

  const handlePaymentEditStart = (p: any) => {
    setEditingPaymentId(p.id)
    setEditPaymentDate(p.date)
    setEditPaymentAmount(p.amount.toString())
    setEditPaymentNote(p.note || '')
  }

  const handlePaymentEditSave = () => {
    if (!editPaymentDate || !editPaymentAmount) return
    updatePayment(member.id, editingPaymentId!, {
      date: editPaymentDate,
      amount: Number(editPaymentAmount),
      note: editPaymentNote,
    })
    setEditingPaymentId(null)
    setPaymentNotice('✓ Uplata je izmijenjena.')
  }

  const handleSendPaymentReminder = async () => {
    try {
      setPaymentNotice('Slanje obavijesti...')
      const response = await fetch('/api/admin/notifications/payment-reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: member.id })
      })

      const data = await response.json()
      if (response.ok && data.success) {
        setPaymentNotice('✓ Obavijest o plaćanju je uspješno poslana.')
      } else {
        setPaymentNotice(`× Greška: ${data.error || 'Neuspjelo slanje'}`)
      }
    } catch (err) {
      setPaymentNotice('× Greška pri spajanju na poslužitelj.')
    }
  }


  // Sort payments newest first
  const sortedPayments = [...(member.payments ?? [])].sort((a, b) => {
    const dA = parseDateStr(a.date)?.getTime() || 0;
    const dB = parseDateStr(b.date)?.getTime() || 0;
    return dB - dA;
  })

  return (
    <div className="min-h-screen bg-background">
      {/* ========== STICKY HEADER S GUMBIMA ========== */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur shadow-sm">
        <div className="flex items-center justify-between px-6 py-3 gap-4">
          {/* Lijeva strana: Natrag + Info o članu */}
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="sm" onClick={() => router.push('/members')} className="shrink-0">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Natrag
            </Button>
            <div className="hidden sm:block h-6 w-px bg-border" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold leading-tight truncate">{member.name}</h1>
                <Badge className={`text-[10px] font-bold px-2 py-0.5 border ${getMembershipStatusColor()}`}>
                  Status: {getMembershipStatusLabel()}
                </Badge>
                <Badge className={`text-[10px] font-bold px-2 py-0.5 border ${getFinancialStatusColor()}`}>
                  Financije: {getFinancialStatusLabel()}
                </Badge>
                {member.invitationSent && (
                  <Badge className="text-[10px] bg-blue-100 text-blue-700 border-blue-200 font-bold px-2 py-0.5">
                    ✉ POZIVNICA POSLANA
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Matica: {member.registryNumber || '—'} · Prijavnica: {member.membershipNumber || '—'}
              </p>
            </div>
          </div>

          {/* Desna strana: AKCIJSKI GUMBI */}
          <div className="flex items-center gap-2 shrink-0">
            {!isEditing ? (
              <>
                {/* Gumb za pozivnicu */}
                {member.email && canEditMembers && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hidden sm:flex"
                    onClick={handleSendInvitation}
                  >
                    <Mail className="h-3.5 w-3.5" />
                    Pošalji pozivnicu
                  </Button>
                )}
                {/* Gumb za ispis */}
                {!member.expelled && canEditMembers && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hidden sm:flex"
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
                {canEditMembers && (
                  <Button size="sm" className="gap-1.5" onClick={handleSave}>
                    <Pencil className="h-3.5 w-3.5" />
                    Uredi podatke
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
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
          </div>
        </div>
      </header>

      {/* ========== OBAVIJESTI ========== */}
      {saveNotice && (
        <div className={`mx-6 mt-4 rounded-2xl border px-4 py-3 text-sm font-medium ${
          saveNotice.startsWith('✓')
            ? 'border-green-200 bg-green-50 text-green-700'
            : 'border-amber-200 bg-amber-50 text-amber-700'
        }`}>
          {saveNotice}
        </div>
      )}

      {/* ========== SADRŽAJ ========== */}
      <div className="p-6">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">

            {/* ===== LIJEVA KOLONA ===== */}
            <div className="space-y-5">

              {/* Osnovni podaci */}
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Osobni podaci</h3>
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
                    <Label className="text-xs">Telefon / Mobitel</Label>
                    <Input value={formState.phone ?? ''} onChange={(e) => handleFieldChange('phone', e.target.value)} disabled={!isEditing} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Datum rođenja</Label>
                    <Input value={formState.birthDate ?? ''} onChange={(e) => handleFieldChange('birthDate', e.target.value)} disabled={!isEditing} />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs">Adresa prebivališta</Label>
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

              {/* ČLANSTVO I POSEBNI STATUSI - SPOJENO U JEDNO */}
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Članstvo i posebni statusi</h3>
                </div>
                <div className="space-y-4">
                  {/* Datum upisa i status */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Datum upisa u društvo</Label>
                      <Input value={formState.joinDate} onChange={(e) => handleFieldChange('joinDate', e.target.value)} disabled={!isEditing} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Status</Label>
                      {isEditing ? (
                        <select
                          className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                          value={formState.status}
                          onChange={(e) => handleFieldChange('status', e.target.value as Member['status'])}
                        >
                          <option value="active">Aktivan</option>
                          <option value="pending">Na čekanju</option>
                          <option value="expired">Istekao / Neaktivan</option>
                        </select>
                      ) : (
                        <div className="h-10 flex items-center gap-2">
                          <Badge className={`border text-xs font-bold ${getMembershipStatusColor()}`}>{getMembershipStatusLabel()}</Badge>
                          <Badge className={`border text-xs font-bold ${getFinancialStatusColor()}`}>{getFinancialStatusLabel()}</Badge>
                        </div>
                      )}
                    </div>
                  </div>

                  <Separator />

                  {/* Checkboxovi kao kartice s bojama */}
                  <p className="text-xs text-muted-foreground font-medium">Posebni statusi (označite što se odnosi na ovog člana):</p>
                  <div className="grid gap-2 sm:grid-cols-2">

                    {/* Počasni član - PLAVO */}
                    <label className={`flex items-center gap-3 rounded-xl border-2 p-3 transition-all ${
                      isEditing ? 'cursor-pointer' : 'cursor-default'
                    } ${
                      formState.honorary
                        ? 'border-blue-400 bg-blue-50 text-blue-800 shadow-sm'
                        : 'border-border bg-background text-foreground hover:border-blue-200'
                    }`}>
                      <input
                        type="checkbox"
                        checked={formState.honorary ?? false}
                        onChange={(e) => handleFieldChange('honorary', e.target.checked)}
                        disabled={!isEditing}
                        className="h-4 w-4 accent-blue-600"
                      />
                      <Star className={`h-4 w-4 shrink-0 ${formState.honorary ? 'text-blue-600' : 'text-muted-foreground'}`} />
                      <span className="text-sm font-semibold">Počasni član</span>
                    </label>

                    {/* Oslobođen plaćanja - ZELENO */}
                    <label className={`flex items-center gap-3 rounded-xl border-2 p-3 transition-all ${
                      isEditing ? 'cursor-pointer' : 'cursor-default'
                    } ${
                      formState.exemptFromPayment
                        ? 'border-green-400 bg-green-50 text-green-800 shadow-sm'
                        : 'border-border bg-background text-foreground hover:border-green-200'
                    }`}>
                      <input
                        type="checkbox"
                        checked={formState.exemptFromPayment ?? false}
                        onChange={(e) => handleFieldChange('exemptFromPayment', e.target.checked)}
                        disabled={!isEditing}
                        className="h-4 w-4 accent-green-600"
                      />
                      <ShieldOff className={`h-4 w-4 shrink-0 ${formState.exemptFromPayment ? 'text-green-600' : 'text-muted-foreground'}`} />
                      <span className="text-sm font-semibold">Oslobođen plaćanja</span>
                    </label>

                    {/* Preminuo/la - SIVO */}
                    <label className={`flex items-center gap-3 rounded-xl border-2 p-3 transition-all ${
                      isEditing ? 'cursor-pointer' : 'cursor-default'
                    } ${
                      formState.deceased
                        ? 'border-gray-400 bg-gray-100 text-gray-700 shadow-sm'
                        : 'border-border bg-background text-foreground hover:border-gray-300'
                    }`}>
                      <input
                        type="checkbox"
                        checked={formState.deceased ?? false}
                        onChange={(e) => handleFieldChange('deceased', e.target.checked)}
                        disabled={!isEditing}
                        className="h-4 w-4"
                      />
                      <span className="text-sm font-semibold">Preminuo/la</span>
                    </label>

                    {/* Ispisan/a - CRVENO */}
                    <label className={`flex items-center gap-3 rounded-xl border-2 p-3 transition-all ${
                      isEditing ? 'cursor-pointer' : 'cursor-default'
                    } ${
                      formState.expelled
                        ? 'border-red-400 bg-red-50 text-red-800 shadow-sm'
                        : 'border-border bg-background text-foreground hover:border-red-200'
                    }`}>
                      <input
                        type="checkbox"
                        checked={formState.expelled ?? false}
                        onChange={(e) => handleFieldChange('expelled', e.target.checked)}
                        disabled={!isEditing}
                        className="h-4 w-4 accent-red-600"
                      />
                      <XCircle className={`h-4 w-4 shrink-0 ${formState.expelled ? 'text-red-600' : 'text-muted-foreground'}`} />
                      <span className="text-sm font-semibold">Ispisan/a iz društva</span>
                    </label>
                  </div>

                  {/* Uvjetna polja za datum smrti */}
                  {formState.deceased && (
                    <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 space-y-1.5">
                      <Label className="text-xs text-gray-600 font-bold">Datum smrti</Label>
                      <Input value={formState.deathDate ?? ''} onChange={(e) => handleFieldChange('deathDate', e.target.value)} disabled={!isEditing} className="h-9" />
                    </div>
                  )}

                  {/* Uvjetna polja za ispis */}
                  {formState.expelled && (
                    <div className="rounded-xl bg-red-50 border border-red-200 p-3 grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-red-700 font-bold">Datum ispisa</Label>
                        <Input value={formState.expulsionDate ?? ''} onChange={(e) => handleFieldChange('expulsionDate', e.target.value)} disabled={!isEditing} className="h-9" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-red-700 font-bold">Razlog ispisa</Label>
                        <Input value={formState.expulsionReason ?? ''} onChange={(e) => handleFieldChange('expulsionReason', e.target.value)} disabled={!isEditing} className="h-9" />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Pristup aplikaciji - admin only */}
              {isAdmin && (
                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <div className="mb-4 flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Pristup aplikaciji</h3>
                  </div>
                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Lozinka (ostavite prazno ako ne mijenjate)</Label>
                        <Input 
                          type="text" 
                          placeholder="Unesite novu lozinku..." 
                          value={formState.password ?? ''} 
                          onChange={(e) => handleFieldChange('password', e.target.value)} 
                          disabled={!isEditing} 
                        />
                      </div>
                      <div className="flex items-end pb-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formState.isTempPassword ?? false}
                            onChange={(e) => handleFieldChange('isTempPassword', e.target.checked)}
                            disabled={!isEditing}
                            className="h-4 w-4 accent-primary"
                          />
                          <span className="text-xs font-medium">Privremena lozinka (zahtijeva promjenu)</span>
                        </label>
                      </div>
                    </div>

                    <Separator />
                    
                    <p className="text-sm text-muted-foreground">Dodijelite kojim modulima ovaj član može pristupiti.</p>
                    <div className="rounded-xl border border-border overflow-hidden">
                      <div className="grid grid-cols-[1.8fr_1fr_1fr] bg-muted px-4 py-2 text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                        <span>Modul</span>
                        <span className="text-center">Pogled</span>
                        <span className="text-center">Uređivanje</span>
                      </div>
                      {accessCategories.map(({ key: category, label }) => {
                        const rights = getAccessRight(category)
                        return (
                          <div key={category} className="grid grid-cols-[1.8fr_1fr_1fr] border-t border-border px-4 py-2.5 text-sm bg-background">
                            <span className="flex items-center font-medium">{label}</span>
                            <label className="flex items-center justify-center">
                              <input
                                type="checkbox"
                                checked={rights.view}
                                onChange={(e) => handleAccessChange(category, 'view', e.target.checked)}
                                disabled={!isEditing}
                                className="h-4 w-4 accent-primary"
                              />
                            </label>
                            <label className="flex items-center justify-center">
                              <input
                                type="checkbox"
                                checked={rights.edit}
                                onChange={(e) => handleAccessChange(category, 'edit', e.target.checked)}
                                disabled={!isEditing}
                                className="h-4 w-4 accent-primary"
                              />
                            </label>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Funkcije u društvu */}
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">Funkcije u društvu</h3>
                <div className="space-y-3">
                  {isEditing && (
                    <div className="rounded-xl bg-muted/50 border border-border p-3 space-y-3">
                      <div className="grid gap-2 sm:grid-cols-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Funkcija</Label>
                          <select
                            className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                            value={newFunctionName}
                            onChange={(e) => setNewFunctionName(e.target.value)}
                          >
                            <option value="">Odaberite...</option>
                            {settings.availableFunctions?.map((fn, idx) => (
                              <option key={`${fn}-${idx}`} value={fn}>{fn}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Od godine</Label>
                          <Input type="number" value={newFunctionFrom} onChange={(e) => setNewFunctionFrom(e.target.value)} placeholder="2020" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Do godine</Label>
                          <Input type="number" value={newFunctionTo} onChange={(e) => setNewFunctionTo(e.target.value)} placeholder="2024" />
                        </div>
                      </div>
                      <Button size="sm" className="gap-1.5" onClick={addFunctionAssignment}>
                        <Plus className="h-3.5 w-3.5" /> Dodaj funkciju
                      </Button>
                    </div>
                  )}
                  <div className="space-y-2">
                    {(formState.functions ?? []).length > 0 ? (
                      (formState.functions ?? []).map((fn) => (
                        <div key={fn.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-2.5">
                          <div>
                            <p className="text-sm font-semibold">{fn.functionName}</p>
                            <p className="text-xs text-muted-foreground">{fn.fromYear} – {fn.toYear || 'danas'}</p>
                          </div>
                          {isEditing && (
                            <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => removeFunctionAssignment(fn.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="rounded-xl border border-dashed border-border p-4 text-sm text-center text-muted-foreground">
                        Nema dodijeljenih funkcija.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ===== DESNA KOLONA ===== */}
            <div className="space-y-5">

              {/* Financije */}
              {canViewFinances && (
                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-primary" />
                      <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Financije</h3>
                    </div>
                    
                    {/* Brza akcija: Slanje obavijesti (sada na vrhu radi veće vidljivosti) */}
                    {canEditFinances && member.email && (
                      <Button 
                        size="sm" 
                        variant={member.status_clana === 'DUG' ? "default" : "outline"} 
                        className={`gap-1.5 h-7 text-[10px] px-3 ${member.status_clana === 'DUG' ? 'bg-amber-600 hover:bg-amber-700' : ''}`}
                        onClick={handleSendPaymentReminder}
                      >
                        <Mail className="h-3 w-3" /> 
                        {member.status_clana === 'DUG' ? 'POŠALJI PODSJETNIK ZA DUG' : 'Pošalji obavijest o plaćanju'}
                      </Button>
                    )}
                  </div>
                  <div className="space-y-4">
                    {/* Status plaćanja - SAMO OVDJE, ne više duplikat */}
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Status plaćanja</Label>
                        {isEditing && canEditFinances ? (
                          <select
                            className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                            value={formState.paymentStatus}
                            onChange={(e) => handleFieldChange('paymentStatus', e.target.value)}
                          >
                            <option value="paid">Plaćeno</option>
                            <option value="overdue">Dug</option>
                            <option value="pending">Na čekanju</option>
                          </select>
                        ) : (
                          <div className="h-10 flex items-center">
                            <Badge className={`text-xs font-bold border ${
                              member.paymentStatus === 'paid'
                                ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                : member.paymentStatus === 'overdue'
                                ? 'bg-red-100 text-red-700 border-red-200'
                                : 'bg-yellow-100 text-yellow-700 border-yellow-200'
                            }`}>
                              {member.paymentStatus === 'paid' ? '✓ Plaćeno' : member.paymentStatus === 'overdue' ? '⚠ Dug' : '◌ Na čekanju'}
                            </Badge>
                          </div>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Zadnja uplata</Label>
                        <div className="h-10 flex items-center text-sm font-semibold">
                          {sortedPayments[0]?.date ? formatDate(sortedPayments[0]?.date) : <span className="text-muted-foreground font-normal">—</span>}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Zadnja poslana obavijest</Label>
                        <div className="h-10 flex items-center text-sm font-semibold">
                          {(member as any).lastPaymentReminderAt ? new Date((member as any).lastPaymentReminderAt).toLocaleDateString('hr-HR') + ' ' + new Date((member as any).lastPaymentReminderAt).toLocaleTimeString('hr-HR', {hour: '2-digit', minute:'2-digit'}) : <span className="text-muted-foreground font-normal">—</span>}
                        </div>
                      </div>
                    </div>

                    {/* Tablica povijesti uplata */}
                    <div>
                      <Label className="text-xs mb-2 block">Povijest uplata</Label>
                      <div className="rounded-xl border border-border overflow-hidden">
                        <table className="w-full text-xs">
                          <thead className="bg-muted">
                            <tr>
                              <th className="px-3 py-2 text-left font-bold uppercase text-[10px] text-muted-foreground">Datum</th>
                              <th className="px-3 py-2 text-right font-bold uppercase text-[10px] text-muted-foreground">Iznos</th>
                              <th className="px-3 py-2 text-left font-bold uppercase text-[10px] text-muted-foreground">Bilješka</th>
                              {canEditFinances && <th className="px-3 py-2 text-right font-bold uppercase text-[10px] text-muted-foreground">Akcije</th>}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {sortedPayments.length > 0 ? (
                              sortedPayments.map((p, i) => (
                                <tr key={p.id} className={i === 0 ? 'bg-emerald-50' : 'bg-background'}>
                                  <td className="px-3 py-2 font-medium">
                                    {editingPaymentId === p.id ? (
                                      <Input type="date" value={editPaymentDate} onChange={(e) => setEditPaymentDate(e.target.value)} className="h-7 text-xs px-2" />
                                    ) : (
                                      <>
                                        {formatDate(p.date)}
                                        {i === 0 && <span className="ml-1 text-[9px] text-emerald-600 font-bold">ZADNJA</span>}
                                      </>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-right font-bold text-foreground">
                                    {editingPaymentId === p.id ? (
                                      <Input type="number" value={editPaymentAmount} onChange={(e) => setEditPaymentAmount(e.target.value)} className="h-7 text-xs px-2 text-right" />
                                    ) : (
                                      <>{p.amount} €</>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-muted-foreground">
                                    {editingPaymentId === p.id ? (
                                      <Input value={editPaymentNote} onChange={(e) => setEditPaymentNote(e.target.value)} className="h-7 text-xs px-2" />
                                    ) : (
                                      <>{p.note || '—'}</>
                                    )}
                                  </td>
                                  {canEditFinances && (
                                    <td className="px-3 py-2 text-right">
                                      <div className="flex justify-end gap-1">
                                        {editingPaymentId === p.id ? (
                                          <>
                                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-green-600" onClick={handlePaymentEditSave}><CheckCircle className="h-3.5 w-3.5" /></Button>
                                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-600" onClick={() => setEditingPaymentId(null)}><XCircle className="h-3.5 w-3.5" /></Button>
                                          </>
                                        ) : (
                                          <>
                                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-primary" onClick={() => handlePaymentEditStart(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-red-600" onClick={() => handlePaymentDelete(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                                          </>
                                        )}
                                      </div>
                                    </td>
                                  )}
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
                                  Nema evidentiranih uplata.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <Separator />

                    {/* Evidentiranje nove uplate */}
                    {canEditFinances && (
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
              )}
              {/* Glasovanja */}
              {isAdmin && (
                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Glasovanja</h3>
                  </div>
                  <div className="space-y-3">
                    {memberPolls.length > 0 ? (
                      memberPolls.map(poll => (
                        <div key={poll.id} className="flex items-center justify-between p-3 rounded-xl border bg-muted/20">
                          <div className="flex-1">
                            <p className="text-sm font-semibold">{poll.title}</p>
                            <p className="text-[10px] text-muted-foreground">Datum: {new Date(poll.created_at).toLocaleDateString('hr-HR')}</p>
                          </div>
                          <Badge variant={poll.hasVoted ? "default" : "outline"} className={poll.hasVoted ? "bg-green-100 text-green-700 border-green-200" : "text-amber-600 border-amber-200 bg-amber-50"}>
                            {poll.hasVoted ? "Glasovao/la" : "Nije glasovao/la"}
                          </Badge>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-center text-muted-foreground py-4 border border-dashed rounded-xl">
                        Član nije uključen u niti jedno aktivno glasovanje.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Bilješke */}
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Bilješke</h3>
                <Textarea
                  value={formState.notes ?? formState.note ?? ''}
                  onChange={(e) => handleFieldChange('notes', e.target.value)}
                  disabled={!isEditing}
                  rows={6}
                  placeholder="Dodatne bilješke o članu..."
                  className="resize-none"
                />
              </div>

              {/* Brisanje - samo admin */}
              {isAdmin && (
                <div className="rounded-2xl border border-red-200 bg-red-50/50 p-4">
                  <p className="text-xs text-red-700 font-bold uppercase tracking-wider mb-2">⚠ Opasna zona</p>
                  <p className="text-xs text-muted-foreground mb-3">Brisanje člana je trajna radnja i ne može se poništiti.</p>
                  <Button variant="outline" size="sm" className="border-red-200 text-red-700 hover:bg-red-100 gap-1.5" onClick={handleDelete}>
                    <Trash2 className="h-3.5 w-3.5" /> Trajno obriši člana
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ========== MODALNI PROZORI ========== */}

      {/* Potvrda slanja pozivnice */}
      {showInvitationDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-background rounded-2xl border border-border shadow-2xl p-6 max-w-sm w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <Mail className="h-5 w-5 text-blue-700" />
              </div>
              <div>
                <h3 className="font-bold">Slanje pozivnice</h3>
                <p className="text-xs text-muted-foreground">Podaci za prijavu u sustav</p>
              </div>
            </div>
            <div className="rounded-xl bg-muted p-4 space-y-2 mb-4 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-xs">Primatelj</span>
                <span className="font-semibold">{member.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-xs">Email</span>
                <span className="font-mono text-xs">{member.email}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-xs">Korisničko ime</span>
                <span className="font-mono text-xs">{member.email}</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-xs">Privremena lozinka</span>
                <span className="font-mono text-base font-bold tracking-widest text-primary">{generatedPassword}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-4">U produkcijskom sustavu ovi podaci bi se automatski poslali na email.</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowInvitationDialog(false)}>Odustani</Button>
              <Button size="sm" className="flex-1 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white" onClick={confirmInvitation}>
                <Mail className="h-3.5 w-3.5" /> Potvrdi pozivnicu
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Potvrda spremanja */}
      {showSaveConfirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-background p-6 shadow-xl">
            <h3 className="text-lg font-bold mb-2">Potvrdi spremanje</h3>
            <p className="text-sm text-muted-foreground mb-5">Jeste li sigurni da želite ažurirati podatke ovog člana?</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowSaveConfirmDialog(false)}>Odustani</Button>
              <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={confirmSave}>Spremi</Button>
            </div>
          </div>
        </div>
      )}

      {/* Potvrda uplate */}
      {showPaymentConfirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-background p-6 shadow-xl">
            <h3 className="text-lg font-bold mb-2">Potvrdi uplatu</h3>
            <p className="text-sm text-muted-foreground mb-2">Evidentirate uplatu:</p>
            <div className="rounded-xl bg-muted p-3 mb-5 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Datum:</span><strong>{paymentDate}</strong></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Iznos:</span><strong>{paymentAmount} €</strong></div>
              {paymentNote && <div className="flex justify-between"><span className="text-muted-foreground">Bilješka:</span><span>{paymentNote}</span></div>}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowPaymentConfirmDialog(false)}>Odustani</Button>
              <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={confirmPayment}>Potvrdi uplatu</Button>
            </div>
          </div>
        </div>
      )}

      {/* Potvrda brisanja */}
      {showDeleteConfirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-red-200 bg-background p-6 shadow-xl">
            <h3 className="text-lg font-bold text-red-700 mb-2">⚠ Potvrdi brisanje</h3>
            <p className="text-sm text-muted-foreground mb-5">
              Ova radnja je <strong>trajna</strong> i ne može se poništiti. Jeste li sigurni da želite obrisati člana <strong>{member.name}</strong>?
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirmDialog(false)}>Odustani</Button>
              <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={confirmDelete}>Da, obriši</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}