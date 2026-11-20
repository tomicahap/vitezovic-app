"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { Member, MemberFunctionAssignment, AccessCategory, MemberAccessRight } from "@/contexts/members-context"
import { useMembers } from "@/contexts/members-context"
import { generateId, isMandateActive, formatMandatePeriod, formatDateDMY, formatDateTimeDMY } from "@/lib/utils"
import { getArchiveResultLabel } from "@/lib/archive-constants"
import { findPotentialDuplicateMembers, DuplicateMatch } from "@/lib/member-duplicates"
import { inspectMemberDate } from "@/lib/date-validation"
import { DateOrYearInput } from "@/components/ui/date-or-year-input"
import { useSettings } from "@/contexts/settings-context"
import { getFunctionsPermissions, getMemberActionPermissions, APP_MODULE_PERMISSIONS_LIST, MEMBER_ACTION_PERMISSIONS_LIST, parseAccessRights, type AppModulePermissionKey, type MemberActionPermissionKey } from "@/lib/inquiry-permissions"
import { ModuleAccessCardsSection, MemberActionsCardsSection } from "@/components/access-rights-editor"
import { AppSidebar } from "@/components/app-sidebar"
import { DesktopHeaderNav } from "@/components/desktop-header-nav"
import { useAuth } from "@/contexts/auth-context"
import { useActivityLog } from "@/contexts/activity-log-context"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Linkify } from "@/components/linkify"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Pencil, Plus, DollarSign, Trash2, Mail, User, FileText, FileDown,
  ArrowLeft, CheckCircle, CheckCircle2, XCircle, Star, ShieldOff, UserCheck, Check, X, Cake, MoreVertical, Ban, Archive,
} from "lucide-react"
import { InvitationPreviewDialog, formatInvitationDateTime } from "@/components/invitation-preview-dialog"
import { PaymentReminderDialog } from "@/components/payment-reminder-dialog"
import { BirthdayEmailDialog } from "@/components/birthday-email-dialog"
import { MissingDataEmailDialog } from "@/components/missing-data-email-dialog"
import { UnsavedChangesGuard } from "@/components/unsaved-changes-guard"

export default function MemberDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const { members, updateMember, deleteMember, addPayment, updatePayment, deletePayment, getMemberById } = useMembers()
  const { settings } = useSettings()
  const { user } = useAuth()
  const { addLog } = useActivityLog()
  const hasLoggedViewRef = React.useRef(false)

  const memberId = Number(params.id)
  const member = Number.isNaN(memberId) ? undefined : getMemberById(memberId)

  React.useEffect(() => {
    if (member && user && !hasLoggedViewRef.current) {
      hasLoggedViewRef.current = true
      addLog({
        userId: user.id.toString(),
        userName: user.name,
        userRole: user.role,
        action: 'Pregled člana',
        details: `Korisnik ${user.name} je pregledao profil člana: ${member.name} (ID: ${member.id})`
      })
    }
  }, [member?.id, user?.id])
  const isAdmin = user?.role === 'admin'
  const canEditMembers = isAdmin || user?.accessRights?.members?.edit === true
  const canViewFinances = isAdmin || user?.accessRights?.finances?.view === true
  const canEditFinances = isAdmin || user?.accessRights?.finances?.edit === true
  const canViewArchive =
    isAdmin ||
    user?.role === 'moderator' ||
    user?.accessRights?.archive?.view === true ||
    user?.accessRights?.archive?.edit === true
  const fnPerms = getFunctionsPermissions(user)
  const canViewFunctions = fnPerms.view
  const canEditFunctions = fnPerms.edit
  const memberActions = React.useMemo(() => getMemberActionPermissions(user), [user])

  const [isEditing, setIsEditing] = React.useState(false)
  const [saveNotice, setSaveNotice] = React.useState('')
  const [formState, setFormState] = React.useState<Member | null>(null)
  const [paymentDate, setPaymentDate] = React.useState('')
  const [paymentAmount, setPaymentAmount] = React.useState('')
  const [paymentForYear, setPaymentForYear] = React.useState('')
  const [paymentNote, setPaymentNote] = React.useState('')
  const [paymentNotice, setPaymentNotice] = React.useState('')
  const [showSaveConfirmDialog, setShowSaveConfirmDialog] = React.useState(false)
  const [saveDuplicateMatches, setSaveDuplicateMatches] = React.useState<DuplicateMatch<Member>[]>([])
  const [showPaymentConfirmDialog, setShowPaymentConfirmDialog] = React.useState(false)
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = React.useState(false)
  const [memberPolls, setMemberPolls] = React.useState<any[]>([])
  const [archiveInfo, setArchiveInfo] = React.useState<{
    contacted: boolean
    contactedAt: string
    contactResult: string
    note: string
    updatedByName: string
    updatedAt: string
  } | null>(null)

  React.useEffect(() => {
    if (!member?.id || !canViewArchive) {
      setArchiveInfo(null)
      return
    }
    let cancelled = false
    fetch(`/api/archive?memberId=${member.id}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.success && data.archive) {
          setArchiveInfo(data.archive)
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [member?.id, canViewArchive])

  React.useEffect(() => {
    if (member?.id) {
      fetch(`/api/polls?memberId=${member.id}&all=true`)
        .then(res => res.json())
        .then(data => setMemberPolls(data))
        .catch(err => console.error("Error fetching member polls:", err))
    }
  }, [member?.id])
  const [showInvitationDialog, setShowInvitationDialog] = React.useState(false)
  const [showPaymentReminderDialog, setShowPaymentReminderDialog] = React.useState(false)
  const [showBirthdayDialog, setShowBirthdayDialog] = React.useState(false)
  const [showMissingDataDialog, setShowMissingDataDialog] = React.useState(false)
  const [generatedPassword, setGeneratedPassword] = React.useState('')
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
  const [editingPaymentId, setEditingPaymentId] = React.useState<string | null>(null)
  const [editPaymentDate, setEditPaymentDate] = React.useState('')
  const [editPaymentAmount, setEditPaymentAmount] = React.useState('')
  const [editPaymentForYear, setEditPaymentForYear] = React.useState('')
  const [editPaymentNote, setEditPaymentNote] = React.useState('')
  const [researchAreasInput, setResearchAreasInput] = React.useState('')
  const [pendingLeaveHref, setPendingLeaveHref] = React.useState<string | null>(null)
  const loadedMemberIdRef = React.useRef<number | null>(null)
  const isEditingRef = React.useRef(false)
  isEditingRef.current = isEditing

  const paymentYearOptions = React.useMemo(() => {
    const currentYr = new Date().getFullYear()
    const years: number[] = []
    for (let y = currentYr + 5; y >= 2005; y--) {
      years.push(y)
    }
    return years
  }, [])

  React.useEffect(() => {
    if (!member) return
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
      setShowSaveConfirmDialog(false)
      setShowPaymentConfirmDialog(false)
      setShowDeleteConfirmDialog(false)
      setShowInvitationDialog(false)
      setNewFunctionName('')
      setNewFunctionFrom('')
      setNewFunctionTo('')
      setShowAddFunction(false)
      setEditingFunctionId(null)
      setEditFunctionName('')
      setEditFunctionFrom('')
      setEditFunctionTo('')
      const [first, ...rest] = member.name.split(' ')
      setFirstName(first || '')
      setLastName(rest.join(' ') || '')
      return
    }

    // Ako je u tijeku uređivanje istog člana, nikako ne prepisuj unesene podatke ni ne gasi uređivanje
    if (isEditingRef.current) {
      setFormState((prev) =>
        prev
          ? {
              ...prev,
              payments: member.payments,
              invitationSent: member.invitationSent,
              invitationSentAt: member.invitationSentAt,
              lastPaymentReminderAt: member.lastPaymentReminderAt,
              lastBirthdayEmailAt: member.lastBirthdayEmailAt,
              lastMissingDataEmailAt: member.lastMissingDataEmailAt,
              dataFormViewedAt: member.dataFormViewedAt,
              dataFormSubmittedAt: member.dataFormSubmittedAt,
              dataFormUpdatedFields: member.dataFormUpdatedFields,
              status: member.status,
              paymentStatus: member.paymentStatus,
            }
          : member
      )
      return
    }

    setFormState(member)
    setResearchAreasInput((member.researchAreas || []).join(', '))
    const [first, ...rest] = member.name.split(' ')
    setFirstName(first || '')
    setLastName(rest.join(' ') || '')
  }, [member])

  const parsedAccessRights = React.useMemo(
    () => parseAccessRights((formState as any)?.accessRights || (formState as any)?.access_rights),
    [formState]
  )

  if (!member || !formState) {
    return (
      <div className="flex flex-col md:flex-row min-h-screen bg-background">
        <AppSidebar activeItem="members" />
        <main className="flex-1 min-w-0 flex items-center justify-center p-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold">Član nije pronađen</h2>
            <Button onClick={() => router.push('/members')} className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Natrag na članove
            </Button>
          </div>
        </main>
      </div>
    )
  }

  const handleAccessChange = (category: AppModulePermissionKey, field: keyof MemberAccessRight, value: boolean) => {
    setFormState((prev) => {
      if (!prev) return prev
      const current = parseAccessRights((prev as any).accessRights || (prev as any).access_rights)
      const defaultRight = category === 'functions' ? { view: true, edit: false } : { view: false, edit: false }
      const existing = current[category] ?? defaultRight
      const updated = {
        ...current,
        [category]: {
          ...existing,
          [field]: value,
          ...(field === 'edit' && value ? { view: true } : {}),
          ...(field === 'view' && !value ? { edit: false } : {}),
        },
      }
      if (!isEditing && member) {
        updateMember(member.id, { accessRights: updated, access_rights: updated } as any)
        setSaveNotice('✓ Prava pristupa su spremljena.')
      }
      return { ...prev, accessRights: updated, access_rights: updated } as unknown as Member
    })
  }

  const handleSetAllModules = (mode: 'none' | 'view' | 'edit') => {
    setFormState((prev) => {
      if (!prev) return prev
      const current = parseAccessRights((prev as any).accessRights || (prev as any).access_rights)
      const updated = { ...current }
      for (const item of APP_MODULE_PERMISSIONS_LIST) {
        updated[item.key] =
          mode === 'edit'
            ? { view: true, edit: true }
            : mode === 'view'
            ? { view: true, edit: false }
            : { view: false, edit: false }
      }
      if (!isEditing && member) {
        updateMember(member.id, { accessRights: updated, access_rights: updated } as any)
        setSaveNotice(
          mode === 'edit'
            ? '✓ Odobren je puni pristup (Pregled i Uređivanje) za sve module.'
            : mode === 'view'
            ? '✓ Odobren je pregled za sve module sustava.'
            : '✓ Uklonjen je pristup svim modulima sustava.'
        )
      }
      return { ...prev, accessRights: updated, access_rights: updated } as unknown as Member
    })
  }

  const handleMemberActionToggle = (key: MemberActionPermissionKey, enabled: boolean) => {
    setFormState((prev) => {
      if (!prev) return prev
      const current = parseAccessRights((prev as any).accessRights || (prev as any).access_rights)
      const updated = {
        ...current,
        [key]: { view: enabled, edit: enabled },
      }
      if (!isEditing && member) {
        updateMember(member.id, { accessRights: updated, access_rights: updated } as any)
        setSaveNotice('✓ Ovlasti nad alatima i akcijama su spremljene.')
      }
      return { ...prev, accessRights: updated, access_rights: updated } as unknown as Member
    })
  }

  const handleSetAllMemberActions = (enabled: boolean) => {
    setFormState((prev) => {
      if (!prev) return prev
      const current = parseAccessRights((prev as any).accessRights || (prev as any).access_rights)
      const updated = { ...current }
      for (const item of MEMBER_ACTION_PERMISSIONS_LIST) {
        updated[item.key] = { view: enabled, edit: enabled }
      }
      if (!isEditing && member) {
        updateMember(member.id, { accessRights: updated, access_rights: updated } as any)
        setSaveNotice(
          enabled
            ? '✓ Odobrene su sve ovlasti za alate i akcije.'
            : '✓ Uklonjene su sve ovlasti za alate i akcije.'
        )
      }
      return { ...prev, accessRights: updated, access_rights: updated } as unknown as Member
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

  const validateMemberDates = (state: Member): string | null => {
    const dateChecks: Array<{ label: string; value?: string | null }> = [
      { label: 'Datum upisa u društvo', value: state.joinDate },
      { label: 'Datum rođenja', value: state.birthDate },
      { label: 'Datum smrti', value: state.deceased ? state.deathDate : '' },
      { label: 'Datum ispisa', value: state.expelled ? state.expulsionDate : '' },
      { label: 'Datum zahtjeva za zabranu kontakta', value: state.doNotContact ? state.doNotContactDate : '' },
    ]
    for (const check of dateChecks) {
      const val = String(check.value || '').trim()
      if (val && !inspectMemberDate(val).isoDate) {
        return `⚠ ${check.label} nije ispravan. Unesite datum u formatu DD/MM/YYYY.`
      }
    }
    return null
  }

  const handleSave = () => {
    if (!isEditing) {
      setIsEditing(true)
      setSaveNotice('')
      return
    }
    if (formState && member) {
      const dateError = validateMemberDates(formState)
      if (dateError) {
        setSaveNotice(dateError)
        return
      }
      const matches = findPotentialDuplicateMembers(
        {
          id: member.id,
          name: formState.name,
          email: formState.email,
          oib: formState.oib,
          registryNumber: formState.registryNumber,
          membershipNumber: formState.membershipNumber,
        },
        members,
        member.id
      )
      setSaveDuplicateMatches(matches)
    } else {
      setSaveDuplicateMatches([])
    }
    setShowSaveConfirmDialog(true)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    if (member) {
      setFormState(member)
      setResearchAreasInput((member.researchAreas || []).join(', '))
    }
    setSaveNotice('')
    setSaveDuplicateMatches([])
    setShowSaveConfirmDialog(false)
    const [first, ...rest] = member.name.split(' ')
    setFirstName(first || '')
    setLastName(rest.join(' ') || '')
  }

  const confirmSave = async () => {
    if (formState) {
      const parsedResearchAreas = researchAreasInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      const result = await updateMember(member.id, { ...formState, researchAreas: parsedResearchAreas })
      setShowSaveConfirmDialog(false)
      if (result && !result.ok) {
        setSaveNotice(`⚠ ${result.error || 'Greška pri spremanju podataka.'}`)
        return
      }
      setIsEditing(false)
      setSaveDuplicateMatches([])
      setSaveNotice('✓ Podaci su uspješno spremljeni.')
    }
  }

  const hasInProgressPayment =
    editingPaymentId !== null ||
    paymentDate.trim() !== '' ||
    paymentAmount.trim() !== '' ||
    paymentNote.trim() !== ''
  const hasInProgressFunction =
    editingFunctionId !== null ||
    (showAddFunction &&
      (newFunctionName.trim() !== '' ||
        newFunctionFrom.trim() !== '' ||
        newFunctionTo.trim() !== ''))
  const hasUnsavedChanges = isEditing || hasInProgressPayment || hasInProgressFunction

  const handleSaveAndLeave = async (): Promise<boolean> => {
    if (!isEditing || !formState || !member) return false
    const dateError = validateMemberDates(formState)
    if (dateError) {
      setSaveNotice(dateError)
      return false
    }
    const matches = findPotentialDuplicateMembers(
      {
        id: member.id,
        name: formState.name,
        email: formState.email,
        oib: formState.oib,
        registryNumber: formState.registryNumber,
        membershipNumber: formState.membershipNumber,
      },
      members,
      member.id
    )
    if (matches.length > 0) {
      setSaveDuplicateMatches(matches)
      setShowSaveConfirmDialog(true)
      return false
    }
    const parsedResearchAreas = researchAreasInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const result = await updateMember(member.id, { ...formState, researchAreas: parsedResearchAreas })
    if (result && !result.ok) {
      setSaveNotice(`⚠ ${result.error || 'Greška pri spremanju podataka.'}`)
      return false
    }
    setIsEditing(false)
    setSaveDuplicateMatches([])
    setSaveNotice('✓ Podaci su uspješno spremljeni.')
    return true
  }

  const handleDiscardAllUnsaved = () => {
    handleCancelEdit()
    setPaymentDate('')
    setPaymentAmount('')
    setPaymentForYear('')
    setPaymentNote('')
    setEditingPaymentId(null)
    cancelEditingFunction()
    setNewFunctionName('')
    setNewFunctionFrom('')
    setNewFunctionTo('')
    setShowAddFunction(false)
  }

  const handlePaymentAdd = () => {
    if (!paymentDate || !paymentAmount) {
      setPaymentNotice('Unesite datum i iznos uplate.')
      return
    }
    setShowPaymentConfirmDialog(true)
  }

  const confirmPayment = () => {
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
    setShowPaymentConfirmDialog(false)
    setPaymentNotice('✓ Uplata je evidentirana.')
  }

  const handleDelete = () => setShowDeleteConfirmDialog(true)

  const confirmDelete = () => {
    deleteMember(member.id)
    router.push('/members')
  }

  const handleSendInvitation = () => {
    if (member?.doNotContact) return
    setShowInvitationDialog(true)
  }

  const addFunctionAssignment = () => {
    if (!newFunctionName.trim()) return
    const newAssignment: MemberFunctionAssignment = {
      id: generateId(),
      functionName: newFunctionName.trim(),
      fromYear: newFunctionFrom.trim(),
      toYear: newFunctionTo.trim(),
    }
    const updated = [...(formState?.functions ?? []), newAssignment]
    setFormState((prev) => prev ? ({
      ...prev,
      functions: updated,
    }) : null)
    if (!isEditing && member) {
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
    const updated = (formState?.functions ?? []).map((fn) =>
      fn.id === id
        ? {
            ...fn,
            functionName: editFunctionName.trim(),
            fromYear: editFunctionFrom.trim(),
            toYear: editFunctionTo.trim(),
          }
        : fn
    )
    setFormState((prev) => prev ? ({
      ...prev,
      functions: updated,
    }) : null)
    if (!isEditing && member) {
      updateMember(member.id, { functions: updated })
      setSaveNotice('✓ Funkcija je uspješno ažurirana.')
    }
    cancelEditingFunction()
  }

  const removeFunctionAssignment = (id: string) => {
    if (!window.confirm("Sigurno želite ukloniti ovu funkciju?")) return
    const updated = (formState?.functions ?? []).filter((fn) => fn.id !== id)
    setFormState((prev) => prev ? ({
      ...prev,
      functions: updated,
    }) : null)
    if (!isEditing && member) {
      updateMember(member.id, { functions: updated })
      setSaveNotice('✓ Funkcija je uklonjena.')
    }
    if (editingFunctionId === id) {
      cancelEditingFunction()
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

  function formatDate(dStr: string | undefined | null) {
    return formatDateDMY(dStr, '-');
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
    setEditPaymentForYear(p.forYear ? String(p.forYear) : '')
    setEditPaymentNote(p.note || '')
  }

  const handlePaymentEditSave = () => {
    if (!editPaymentDate || !editPaymentAmount) return
    const parsedForYear = editPaymentForYear ? Number(editPaymentForYear) : undefined
    updatePayment(member.id, editingPaymentId!, {
      date: editPaymentDate,
      amount: Number(editPaymentAmount),
      forYear: parsedForYear && !Number.isNaN(parsedForYear) ? parsedForYear : undefined,
      note: editPaymentNote,
    })
    setEditingPaymentId(null)
    setPaymentNotice('✓ Uplata je izmijenjena.')
  }

  const handleSendPaymentReminder = () => {
    if (member?.doNotContact) return
    setShowPaymentReminderDialog(true)
  }



  // Sort payments newest first
  const sortedPayments = [...(member.payments ?? [])].sort((a, b) => {
    const dA = parseDateStr(a.date)?.getTime() || 0;
    const dB = parseDateStr(b.date)?.getTime() || 0;
    return dB - dA;
  })

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-background">
      <AppSidebar activeItem="members" />
      <main className="flex-1 min-w-0 flex flex-col md:h-screen md:overflow-hidden">
      <DesktopHeaderNav activeItem="members" showBar />
      {/* ========== FIKSNO ZAGLAVLJE S GUMBIMA ========== */}
      <header className="shrink-0 z-30 border-b border-border bg-background/95 backdrop-blur shadow-sm">
        <div className="flex items-center justify-between px-6 py-3 gap-4">
          {/* Lijeva strana: Natrag + Info o članu */}
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (hasUnsavedChanges) {
                  setPendingLeaveHref('/members')
                } else {
                  router.push('/members')
                }
              }}
              className="shrink-0"
            >
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
                {member.doNotContact && (
                  <Badge className="text-[10px] bg-red-600 text-white border border-red-700 font-bold px-2 py-0.5 gap-1">
                    <Ban className="h-3 w-3" />
                    NE KONTAKTIRATI
                  </Badge>
                )}
                {member.invitationSent ? (
                  <Badge className="text-[10px] bg-blue-100 text-blue-700 border-blue-200 font-bold px-2 py-0.5">
                    ✉ POZIVNICA POSLANA {member.invitationSentAt ? `· ${formatInvitationDateTime(member.invitationSentAt)}` : ''}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground border-dashed px-2 py-0.5">
                    Pozivnica nije poslana
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
                {/* Gumb za PDF izvještaj člana */}
                <a
                  href={`/api/members/${member.id}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 hidden sm:flex"
                    title="Generiraj i preuzmi PDF evidencijski list člana"
                  >
                    <FileDown className="h-3.5 w-3.5" />
                    PDF karton
                  </Button>
                </a>
                {/* Gumb za slanje linka i PDF-a za dopunu podataka */}
                {member.email && memberActions.zatrazi_dopunu && !member.deceased && !member.doNotContact && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 border-[#CEA369] bg-amber-50/70 text-[#1B2B36] hover:bg-amber-100 hidden sm:flex"
                    onClick={() => setShowMissingDataDialog(true)}
                    title="Pošalji članu personalizirani link i PDF za dopunu podataka koji nedostaju"
                  >
                    <FileText className="h-3.5 w-3.5 text-[#b58442]" />
                    Zatraži dopunu
                  </Button>
                )}
                {/* Gumb za pozivnicu */}
                {member.email && memberActions.posalji_pozivnicu && !member.doNotContact && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hidden sm:flex"
                    onClick={handleSendInvitation}
                  >
                    <Mail className="h-3.5 w-3.5" />
                    {member.invitationSent ? 'Pošalji ponovno pozivnicu' : 'Pošalji pozivnicu'}
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
                {/* Mobilni izbornik za skrivene akcije na manjim ekranima */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="sm:hidden gap-1 px-2.5"
                      title="Dodatne akcije za člana"
                    >
                      <MoreVertical className="h-4 w-4" />
                      <span className="text-xs">Akcije</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem asChild>
                      <a
                        href={`/api/members/${member.id}/pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <FileDown className="h-4 w-4" />
                        <span>PDF karton člana</span>
                      </a>
                    </DropdownMenuItem>
                    {member.email && memberActions.zatrazi_dopunu && !member.deceased && !member.doNotContact && (
                      <DropdownMenuItem
                        onClick={() => setShowMissingDataDialog(true)}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <FileText className="h-4 w-4 text-[#b58442]" />
                        <span>Zatraži dopunu podataka</span>
                      </DropdownMenuItem>
                    )}
                    {member.email && memberActions.posalji_pozivnicu && !member.doNotContact && (
                      <DropdownMenuItem
                        onClick={handleSendInvitation}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <Mail className="h-4 w-4 text-blue-600" />
                        <span>{member.invitationSent ? 'Pošalji ponovno pozivnicu' : 'Pošalji pozivnicu'}</span>
                      </DropdownMenuItem>
                    )}
                    {!member.expelled && canEditMembers && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => {
                            if (window.confirm(`Ispisati člana ${member.name} iz društva?`)) {
                              updateMember(member.id, {
                                expelled: true,
                                expulsionDate: new Date().toISOString().split('T')[0],
                              })
                            }
                          }}
                          className="flex items-center gap-2 cursor-pointer text-red-600 focus:text-red-700"
                        >
                          <XCircle className="h-4 w-4" />
                          <span>Ispiši člana iz društva</span>
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Gumb za uređivanje */}
                {canEditMembers && (
                  <Button size="sm" className="gap-1.5" onClick={handleSave}>
                    <Pencil className="h-3.5 w-3.5" />
                    <span className="hidden xs:inline">Uredi podatke</span>
                    <span className="xs:hidden">Uredi</span>
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

      <div className={`flex-1 overflow-y-auto ${isEditing ? 'pb-24 sm:pb-0' : ''}`}>
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

      {member.doNotContact && (
        <div className="mx-4 md:mx-6 mt-4 rounded-2xl border-2 border-red-300 bg-red-50 px-4 py-3.5 text-red-950 shadow-sm flex items-start gap-3">
          <Ban className="h-5 w-5 text-red-700 shrink-0 mt-0.5" />
          <div className="space-y-1 text-sm">
            <p className="font-bold text-red-900">
              Zabrana kontakta — Na izričitu napomenu član je zatražio da ga se ne kontaktira.
            </p>
            <p className="text-xs text-red-800 leading-relaxed">
              Slanje e-mailova, podsjetnika za uplatu, pozivnica, rođendanskih čestitki, zahtjeva za dopunu podataka i bilo kakvo kontaktiranje kroz aplikaciju trajno je onemogućeno.
            </p>
            {(member.doNotContactDate || member.doNotContactNote) && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs font-medium text-red-900">
                {member.doNotContactDate && (
                  <span>
                    Datum zahtjeva: <strong>{formatDateDMY(member.doNotContactDate, member.doNotContactDate)}</strong>
                  </span>
                )}
                {member.doNotContactNote && (
                  <span>
                    Napomena: <strong>{member.doNotContactNote}</strong>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========== SADRŽAJ ========== */}
      <div className="p-4 md:p-6 w-full">
        <div className="w-full">
          <div className="grid gap-6 lg:grid-cols-[1.55fr_1fr]">

            {/* ===== LIJEVA KOLONA ===== */}
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
                  {member.doNotContact && (
                    <Badge className="ml-auto bg-red-100 text-red-800 border border-red-300 text-[10px] font-bold gap-1">
                      <Ban className="h-3 w-3" />
                      Kontaktiranje zabranjeno (zahtjev člana)
                    </Badge>
                  )}
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
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Zanimanje, vještine i rodoslovna istraživanja</h3>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Zvanje i zanimanje</Label>
                    <Input value={formState.occupation ?? ''} onChange={(e) => handleFieldChange('occupation', e.target.value)} disabled={!isEditing} placeholder="Npr. prof. povijesti, dipl. ing." />
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
                      placeholder="Npr. čitanje glagoljice, gotica, paleografija, obrada fotografija..."
                      className="resize-none"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs">Lokacije i prezimena koja istražuje</Label>
                    {isEditing ? (
                      <Textarea
                        value={researchAreasInput}
                        onChange={(e) => {
                          setResearchAreasInput(e.target.value)
                          setShowSaveConfirmDialog(false)
                        }}
                        rows={2}
                        placeholder="Upišite lokacije i prezimena odvojena zarezom (npr. Horvat, Kovačić, Zagorje, Lika)"
                        className="resize-none"
                      />
                    ) : (
                      <div className="min-h-[44px] rounded-xl border border-border bg-muted/20 p-2.5 flex flex-wrap gap-1.5 items-center">
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

              {/* 4. MATIČNI PODACI, ČLANSTVO I POSEBNI STATUSI */}
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Matični podaci, članstvo i posebni statusi</h3>
                </div>
                <div className="space-y-4">
                  {/* Matični brojevi, datum upisa i status */}
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
                        <div className="h-10 flex items-center flex-wrap gap-1.5">
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

                    {/* Ne kontaktirati - CRVENO */}
                    <label className={`sm:col-span-2 flex items-start gap-3 rounded-xl border-2 p-3 transition-all ${
                      isEditing ? 'cursor-pointer' : 'cursor-default'
                    } ${
                      formState.doNotContact
                        ? 'border-red-500 bg-red-50 text-red-900 shadow-sm'
                        : 'border-border bg-background text-foreground hover:border-red-200'
                    }`}>
                      <input
                        type="checkbox"
                        checked={formState.doNotContact ?? false}
                        onChange={(e) => {
                          const checked = e.target.checked
                          setFormState((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  doNotContact: checked,
                                  doNotContactDate:
                                    checked && !String(prev.doNotContactDate || '').trim()
                                      ? formatDateDMY(new Date())
                                      : prev.doNotContactDate,
                                }
                              : null
                          )
                          setShowSaveConfirmDialog(false)
                        }}
                        disabled={!isEditing}
                        className="mt-0.5 h-4 w-4 accent-red-600 shrink-0"
                      />
                      <Ban className={`mt-0.5 h-4 w-4 shrink-0 ${formState.doNotContact ? 'text-red-700' : 'text-muted-foreground'}`} />
                      <div className="min-w-0">
                        <span className="text-sm font-semibold block">Ne kontaktirati (na izričitu napomenu člana)</span>
                        <span className="text-[11px] text-muted-foreground block">
                          Trajno onemogućuje slanje e-mailova, podsjetnika za uplatu, pozivnica i kontaktiranje kroz aplikaciju
                        </span>
                      </div>
                    </label>
                  </div>

                  {/* Uvjetna polja kada je označeno Ne kontaktirati */}
                  {formState.doNotContact && (
                    <div className="rounded-xl bg-red-50 border border-red-200 p-3 grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        {isEditing ? (
                          <DateOrYearInput
                            label="Datum zahtjeva (ne kontaktirati)"
                            value={formState.doNotContactDate ?? ''}
                            onChange={(val) => handleFieldChange('doNotContactDate', val)}
                            placeholder="DD/MM/YYYY"
                          />
                        ) : (
                          <>
                            <Label className="text-xs text-red-700 font-bold">Datum zahtjeva (ne kontaktirati)</Label>
                            <Input value={formatDateDMY(formState.doNotContactDate, '')} disabled className="h-9" placeholder="—" />
                          </>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-red-700 font-bold">Napomena / razlog zahtjeva</Label>
                        <Input
                          value={formState.doNotContactNote ?? ''}
                          onChange={(e) => handleFieldChange('doNotContactNote', e.target.value)}
                          disabled={!isEditing}
                          placeholder="Npr. Član je izričito zatražio da ga se ne kontaktira"
                          className="h-9"
                        />
                      </div>
                    </div>
                  )}

                  {/* Uvjetna polja za datum smrti */}
                  {formState.deceased && (
                    <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 space-y-1.5">
                      {isEditing ? (
                        <DateOrYearInput
                          label="Datum smrti"
                          value={formState.deathDate ?? ''}
                          onChange={(val) => handleFieldChange('deathDate', val)}
                          placeholder="DD/MM/YYYY"
                        />
                      ) : (
                        <>
                          <Label className="text-xs text-gray-600 font-bold">Datum smrti</Label>
                          <Input value={formatDateDMY(formState.deathDate, '')} disabled className="h-9" placeholder="—" />
                        </>
                      )}
                    </div>
                  )}

                  {/* Uvjetna polja za ispis */}
                  {formState.expelled && (
                    <div className="rounded-xl bg-red-50 border border-red-200 p-3 grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        {isEditing ? (
                          <DateOrYearInput
                            label="Datum ispisa"
                            value={formState.expulsionDate ?? ''}
                            onChange={(val) => handleFieldChange('expulsionDate', val)}
                            placeholder="DD/MM/YYYY"
                          />
                        ) : (
                          <>
                            <Label className="text-xs text-red-700 font-bold">Datum ispisa</Label>
                            <Input value={formatDateDMY(formState.expulsionDate, '')} disabled className="h-9" placeholder="—" />
                          </>
                        )}
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

                    <ModuleAccessCardsSection
                      rights={parsedAccessRights}
                      onChangeModuleRight={(key, field, value) => handleAccessChange(key, field, value)}
                      onSetAllModules={handleSetAllModules}
                      disabled={!isAdmin}
                    />

                    <Separator />

                    <MemberActionsCardsSection
                      rights={parsedAccessRights}
                      onToggleAction={(key, enabled) => handleMemberActionToggle(key, enabled)}
                      onSetAllActions={handleSetAllMemberActions}
                      disabled={!isAdmin}
                    />
                  </div>
                </div>
              )}

              {/* Funkcije u društvu */}
              {canViewFunctions && (
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Funkcije u društvu</h3>
                  {canEditFunctions && (
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
                  )}
                </div>

                <div className="space-y-3">
                  {canEditFunctions && (showAddFunction || isEditing) && (
                    <div className="rounded-xl bg-muted/50 border border-border p-3 space-y-3">
                      <div className="flex items-center justify-between pb-1 border-b border-border/50">
                        <span className="text-xs font-semibold">Nova funkcija</span>
                        <span className="text-[10px] text-muted-foreground">Prazno &quot;Do godine&quot; označava aktivnu funkciju</span>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Funkcija</Label>
                          <input
                            list="member-page-available-functions"
                            className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                            value={newFunctionName}
                            onChange={(e) => setNewFunctionName(e.target.value)}
                            placeholder="Odaberite ili upišite..."
                          />
                          <datalist id="member-page-available-functions">
                            {settings.availableFunctions?.map((fn, idx) => (
                              <option key={`${fn}-${idx}`} value={fn} />
                            ))}
                          </datalist>
                        </div>
                        <DateOrYearInput
                          label="Od godine ili datuma"
                          value={newFunctionFrom}
                          onChange={setNewFunctionFrom}
                          allowYearOnly
                          placeholder="npr. 2020 ili 15/05/2020"
                        />
                        <DateOrYearInput
                          label="Do godine ili datuma"
                          value={newFunctionTo}
                          onChange={setNewFunctionTo}
                          allowYearOnly
                          placeholder="prazno za aktivnu ili npr. 2024 / 15/05/2024"
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
                                    list={`member-page-edit-functions-${fn.id}`}
                                    className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    value={editFunctionName}
                                    onChange={(e) => setEditFunctionName(e.target.value)}
                                    placeholder="Naziv funkcije..."
                                  />
                                  <datalist id={`member-page-edit-functions-${fn.id}`}>
                                    {settings.availableFunctions?.map((f, idx) => (
                                      <option key={`${f}-${idx}`} value={f} />
                                    ))}
                                  </datalist>
                                </div>
                                <DateOrYearInput
                                  label="Od godine ili datuma"
                                  value={editFunctionFrom}
                                  onChange={setEditFunctionFrom}
                                  allowYearOnly
                                  placeholder="npr. 2020 ili 15/05/2020"
                                />
                                <DateOrYearInput
                                  label="Do godine ili datuma"
                                  value={editFunctionTo}
                                  onChange={setEditFunctionTo}
                                  allowYearOnly
                                  placeholder="prazno za aktivnu ili npr. 2024 / 15/05/2024"
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
                            {canEditFunctions && (
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
                            )}
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
              )}
            </div>

            {/* ===== DESNA KOLONA ===== */}
            <div className="space-y-5">

              {/* Pristup sustavu i evidencija pozivnice */}
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-primary" />
                    <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Pristup sustavu i evidencija pozivnice</h3>
                  </div>
                  {memberActions.posalji_pozivnicu && member.email && (
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

                  <div className="rounded-xl bg-muted/40 p-3 space-y-1 sm:col-span-2">
                    <span className="text-muted-foreground text-[11px] font-medium block">
                      Online obrazac za dopunu podataka (evidencija)
                    </span>
                    <div className="space-y-1 text-xs">
                      <p>
                        <span className="text-muted-foreground">Zamolba poslana: </span>
                        <strong>
                          {member.lastMissingDataEmailAt ? formatDateTimeDMY(member.lastMissingDataEmailAt) : 'Još nije poslana'}
                        </strong>
                      </p>
                      <p>
                        <span className="text-muted-foreground">Pogledao formu: </span>
                        <strong className={member.dataFormViewedAt ? 'text-blue-700' : ''}>
                          {member.dataFormViewedAt ? formatDateTimeDMY(member.dataFormViewedAt) : '—'}
                        </strong>
                      </p>
                      <p>
                        <span className="text-muted-foreground">Popunio i predao: </span>
                        <strong className={member.dataFormSubmittedAt ? 'text-emerald-700' : ''}>
                          {member.dataFormSubmittedAt ? formatDateTimeDMY(member.dataFormSubmittedAt) : '—'}
                        </strong>
                      </p>
                      {member.dataFormUpdatedFields && member.dataFormUpdatedFields.length > 0 && (
                        <p className="text-[11px] text-emerald-800">
                          Dopunjena polja: {member.dataFormUpdatedFields.join(', ')}
                        </p>
                      )}
                      <p>
                        <span className="text-muted-foreground">Status poveznice: </span>
                        {member.dataFormSubmittedAt && !member.dataFormToken ? (
                          <strong className="text-emerald-700">
                            Poništena nakon predaje podataka (pristup zaključan)
                          </strong>
                        ) : member.dataFormToken && member.dataFormSingleUse && member.dataFormViewedAt ? (
                          <strong className="text-red-700">
                            Jednokratni pristup iskorišten — zatvorena
                          </strong>
                        ) : member.dataFormToken && member.dataFormSingleUse ? (
                          <strong className="text-blue-700">
                            Aktivna (jednokratna — 1 pristup)
                          </strong>
                        ) : member.dataFormToken ? (
                          <strong className="text-blue-700">
                            Aktivna (vrijedi do predaje podataka)
                          </strong>
                        ) : (
                          <strong className="text-muted-foreground">
                            Nema aktivne poveznice
                          </strong>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {!canViewFinances && member.email && !member.doNotContact && (memberActions.rodjendanske_cestitke || memberActions.obavijesti_za_placanje) && (
                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-3">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-primary" />
                    <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Brze e-mail akcije</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {memberActions.obavijesti_za_placanje && (
                      <Button
                        size="sm"
                        variant={member.status_clana === 'DUG' ? 'default' : 'outline'}
                        className={`gap-1.5 h-8 text-xs ${member.status_clana === 'DUG' ? 'bg-amber-600 hover:bg-amber-700' : ''}`}
                        onClick={handleSendPaymentReminder}
                      >
                        <Mail className="h-3.5 w-3.5" />
                        {member.status_clana === 'DUG' ? 'Pošalji podsjetnik za dug' : 'Pošalji obavijest o plaćanju'}
                      </Button>
                    )}
                    {memberActions.rodjendanske_cestitke && !member.deceased && !member.doNotContact && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 h-8 text-xs border-pink-300 text-pink-700 hover:bg-pink-50 hover:text-pink-800"
                        onClick={() => setShowBirthdayDialog(true)}
                      >
                        <Cake className="h-3.5 w-3.5" />
                        Pošalji rođendansku čestitku
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Financije */}
              {canViewFinances && (
                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-primary" />
                      <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Financije</h3>
                    </div>
                    
                    {/* Brza akcija: Slanje obavijesti (sada na vrhu radi veće vidljivosti) */}
                    {memberActions.obavijesti_za_placanje && member.email && !member.doNotContact && (
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
                          {sortedPayments[0]?.date ? (
                            <span>
                              {formatDate(sortedPayments[0].date)}
                              {sortedPayments[0].forYear ? (
                                <span className="ml-1.5 text-xs font-medium text-blue-700">
                                  (za {sortedPayments[0].forYear}. god.)
                                </span>
                              ) : null}
                            </span>
                          ) : (
                            <span className="text-muted-foreground font-normal">—</span>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Zadnja poslana obavijest</Label>
                        <div className="h-10 flex items-center text-sm font-semibold">
                          {(member as any).lastPaymentReminderAt ? formatDateTimeDMY((member as any).lastPaymentReminderAt) : <span className="text-muted-foreground font-normal">—</span>}
                        </div>
                      </div>
                      <div className="space-y-1.5 sm:col-span-3 pt-2 border-t border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <Label className="text-xs">Zadnja rođendanska čestitka (evidencija)</Label>
                          <div className="text-sm font-semibold mt-0.5 flex items-center gap-1.5">
                            <Cake className="h-3.5 w-3.5 text-pink-600" />
                            {member.lastBirthdayEmailAt ? formatDateTimeDMY(member.lastBirthdayEmailAt) : <span className="text-muted-foreground font-normal">Nije još poslana</span>}
                          </div>
                        </div>
                        {memberActions.rodjendanske_cestitke && member.email && !member.deceased && !member.doNotContact && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 h-8 px-3 border-pink-300 text-pink-700 hover:bg-pink-50 hover:text-pink-800 shrink-0"
                            onClick={() => setShowBirthdayDialog(true)}
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
                          <thead className="bg-muted">
                            <tr>
                              <th className="px-3 py-2 text-left font-bold uppercase text-[10px] text-muted-foreground">Datum</th>
                              <th className="px-3 py-2 text-left font-bold uppercase text-[10px] text-muted-foreground">Za godinu</th>
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
                                  <td className="px-3 py-2">
                                    {editingPaymentId === p.id ? (
                                      <select
                                        value={editPaymentForYear}
                                        onChange={(e) => setEditPaymentForYear(e.target.value)}
                                        className="h-7 rounded border border-input bg-background px-1.5 text-xs"
                                      >
                                        <option value="">Po datumu</option>
                                        {paymentYearOptions.map((yr) => (
                                          <option key={yr} value={String(yr)}>
                                            {yr}.
                                          </option>
                                        ))}
                                      </select>
                                    ) : p.forYear ? (
                                      <Badge variant="outline" className="text-[10px] font-mono bg-blue-50 text-blue-700 border-blue-200">
                                        {p.forYear}. god.
                                      </Badge>
                                    ) : (
                                      <span className="text-muted-foreground">—</span>
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
                                <td colSpan={canEditFinances ? 5 : 4} className="px-3 py-6 text-center text-muted-foreground">
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
                            <p className="text-[10px] text-muted-foreground">Datum: {formatDateDMY(poll.created_at)}</p>
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

              {/* Povezana evidencija modula Arhiv */}
              {canViewArchive && (
                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Archive className="h-4 w-4 text-[#CEA369]" />
                      <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        Arhiv — Evidencija prikupljanja građe
                      </h3>
                    </div>
                    <Link href="/archive">
                      <Button variant="outline" size="sm" className="h-7 px-2.5 text-[11px] font-semibold">
                        Otvori Arhiv
                      </Button>
                    </Link>
                  </div>

                  {archiveInfo ? (
                    <div className="space-y-2.5 text-xs">
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="rounded-xl border border-border bg-muted/20 p-2.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                            Kontaktiran
                          </span>
                          {member.doNotContact && !archiveInfo.contacted ? (
                            <Badge className="bg-red-100 text-red-800 border border-red-300 text-[10px] font-bold gap-1">
                              <Ban className="h-2.5 w-2.5" /> Zabranjeno
                            </Badge>
                          ) : (
                            <Badge
                              className={
                                archiveInfo.contacted
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-bold'
                                  : 'bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-semibold'
                              }
                            >
                              {archiveInfo.contacted ? 'Da (Kontaktiran)' : 'Ne (Nije kontaktiran)'}
                            </Badge>
                          )}
                        </div>
                        <div className="rounded-xl border border-border bg-muted/20 p-2.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                            Kada je kontaktiran
                          </span>
                          <span className="font-mono font-semibold text-foreground">
                            {archiveInfo.contactedAt || '—'}
                          </span>
                        </div>
                      </div>

                      <div className="rounded-xl border border-border bg-muted/20 p-2.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                          Rezultat kontakta
                        </span>
                        <span className="font-semibold text-foreground">
                          {archiveInfo.contactResult ? getArchiveResultLabel(archiveInfo.contactResult) : '—'}
                        </span>
                      </div>

                      {archiveInfo.note && (
                        <div className="rounded-xl border border-border bg-muted/20 p-2.5 space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                            Napomena iz Arhiva
                          </span>
                          <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                            {archiveInfo.note}
                          </p>
                        </div>
                      )}

                      {(archiveInfo.updatedByName || archiveInfo.updatedAt) && (
                        <p className="text-[10px] text-muted-foreground font-mono">
                          Zadnja izmjena u Arhivu: {archiveInfo.updatedByName ? `${archiveInfo.updatedByName} • ` : ''}
                          {archiveInfo.updatedAt ? formatDateTimeDMY(archiveInfo.updatedAt, archiveInfo.updatedAt) : ''}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Učitavanje arhivske evidencije...</p>
                  )}
                </div>
              )}

              {/* Bilješke */}
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Bilješke</h3>
                {isEditing ? (
                  <Textarea
                    value={formState.notes ?? formState.note ?? ''}
                    onChange={(e) => handleFieldChange('notes', e.target.value)}
                    rows={6}
                    placeholder="Dodatne bilješke o članu..."
                    className="resize-none"
                  />
                ) : (
                  <div className="min-h-[120px] rounded-xl border border-border bg-muted/20 p-3 text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">
                    {formState.notes || formState.note ? (
                      <Linkify text={formState.notes ?? formState.note} />
                    ) : (
                      <span className="italic text-muted-foreground">Nema bilješki.</span>
                    )}
                  </div>
                )}
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

      {/* Potvrda i pregled slanja pozivnice */}
      <InvitationPreviewDialog
        member={member}
        open={showInvitationDialog}
        onOpenChange={setShowInvitationDialog}
        onSuccess={({ sentAt, email }) => {
          setSaveNotice(`✓ Pozivnica je uspješno poslana na ${email} (${formatInvitationDateTime(sentAt)}).`)
        }}
      />

      {/* Potvrda i pregled slanja obavijesti o plaćanju */}
      <PaymentReminderDialog
        open={showPaymentReminderDialog}
        onOpenChange={setShowPaymentReminderDialog}
        mode="single"
        member={member}
        onSuccess={() => {
          setPaymentNotice('✓ Obavijest o plaćanju je uspješno poslana.')
        }}
      />

      {/* Pregled, odobrenje i slanje rođendanske čestitke */}
      <BirthdayEmailDialog
        member={member}
        open={showBirthdayDialog}
        onOpenChange={setShowBirthdayDialog}
        onSuccess={(sentAt) => {
          setSaveNotice(`✓ Rođendanska čestitka je uspješno poslana (${formatDateTimeDMY(sentAt)}).`)
        }}
      />

      {/* Slanje personaliziranog linka i PDF-a za dopunu podataka */}
      {(isAdmin || memberActions.zatrazi_dopunu) && (
        <MissingDataEmailDialog
          open={showMissingDataDialog}
          onOpenChange={setShowMissingDataDialog}
          initialMemberIds={[member.id]}
        />
      )}


      {/* Potvrda spremanja */}
      {showSaveConfirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-xl">
            <h3 className="text-lg font-bold mb-2">
              {saveDuplicateMatches.length > 0 ? '⚠ Mogući duplikat člana!' : 'Potvrdi spremanje'}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {saveDuplicateMatches.length > 0
                ? 'Podaci ovog člana podudaraju se s već postojećim članom u bazi. Provjerite prije potvrde da nije riječ o duploj osobi:'
                : 'Jeste li sigurni da želite ažurirati podatke ovog člana?'}
            </p>
            {saveDuplicateMatches.length > 0 && (
              <div className="mb-4 max-h-44 overflow-y-auto space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs">
                {saveDuplicateMatches.map((m) => (
                  <div key={m.member.id} className="rounded-lg bg-white border border-amber-200 p-2">
                    <p className="font-bold text-amber-950">{m.member.name}</p>
                    <p className="text-muted-foreground">
                      Matica: {m.member.registryNumber || '—'} • Prijavnica: {m.member.membershipNumber || '—'} • Email: {m.member.email || '—'}
                    </p>
                    <p className="text-amber-800 font-semibold mt-0.5">
                      Podudaranje: {m.reasons.join(', ')}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowSaveConfirmDialog(false)}>Odustani</Button>
              <Button
                size="sm"
                className={saveDuplicateMatches.length > 0 ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}
                onClick={confirmSave}
              >
                {saveDuplicateMatches.length > 0 ? 'Potvrdi da nije duplikat i spremi' : 'Spremi'}
              </Button>
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
              <div className="flex justify-between"><span className="text-muted-foreground">Datum uplate:</span><strong>{formatDateDMY(paymentDate)}</strong></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Iznos:</span><strong>{paymentAmount} €</strong></div>
              {paymentForYear && <div className="flex justify-between"><span className="text-muted-foreground">Za godinu:</span><strong>{paymentForYear}. godina</strong></div>}
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

      <UnsavedChangesGuard
        when={hasUnsavedChanges}
        description={
          isEditing
            ? `Uređivanje podataka za člana ${member.name} je trenutno u tijeku, a promjene još nisu spremljene. Ako prijeđete na drugi modul bez spremanja, svi upisani podaci bit će izgubljeni.`
            : `Imate nedovršen i nespremljen unos (uplata ili funkcija člana) za člana ${member.name}. Ako napustite stranicu bez spremanja, upisani podaci bit će izgubljeni.`
        }
        onDiscard={handleDiscardAllUnsaved}
        onSaveAndLeave={isEditing ? handleSaveAndLeave : undefined}
        pendingHref={pendingLeaveHref}
        onClearPendingHref={() => setPendingLeaveHref(null)}
      />
      </div>

      {/* Mobilna fiksna traka tijekom uređivanja da se ne mora skrolati na vrh */}
      {isEditing && (
        <div
          className="sm:hidden fixed bottom-16 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur px-4 py-2.5 flex items-center justify-between gap-3 shadow-lg"
          style={{ paddingBottom: "max(0.625rem, env(safe-area-inset-bottom))" }}
        >
          <Button variant="outline" size="sm" onClick={handleCancelEdit} className="flex-1">
            Odustani
          </Button>
          <Button
            size="sm"
            className="flex-1 gap-1.5 bg-green-600 hover:bg-green-700 text-white"
            onClick={handleSave}
          >
            <CheckCircle className="h-3.5 w-3.5" />
            Spremi izmjene
          </Button>
        </div>
      )}
      </main>
    </div>
  )
}