"use client"

import * as React from "react"
import { Search, Mail, Download, UserPlus, Pencil, Filter, ChevronLeft, ChevronRight, AlertTriangle, Trash2, ArrowUp, ArrowDown, ArrowUpDown, Phone, Euro, Award, Wrench, Medal, Cake, FileText } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useSearchParams } from "next/navigation"
import { useMembers } from "@/contexts/members-context"
import { useSettings } from "@/contexts/settings-context"
import { useAuth } from "@/contexts/auth-context"
import { useActivityLog } from "@/contexts/activity-log-context"
import { AddMemberDialog } from "@/components/add-member-dialog"
import { MembersImportDialog } from "@/components/members-import-dialog"
import { InvitationPreviewDialog, formatInvitationDateTime } from "@/components/invitation-preview-dialog"
import { PaymentReminderDialog } from "@/components/payment-reminder-dialog"
import { BirthdayEmailDialog } from "@/components/birthday-email-dialog"
import { MissingDataEmailDialog } from "@/components/missing-data-email-dialog"
import { AdminMembersCleanupDialog } from "@/components/admin-members-cleanup-dialog"
import { getMemberDateIssues, inspectMemberDate } from "@/lib/date-validation"
import { findDuplicateMemberIds } from "@/lib/member-duplicates"
import { Member } from "@/contexts/members-context"
import { isMandateActive, parseDateOrYearToTimestamp, formatMandatePeriod, getMemberActiveFunctions, getMemberDisplayRole, formatDateDMY } from "@/lib/utils"
import Link from "next/link"
import { DesktopHeaderNav } from "@/components/desktop-header-nav"
import { getFunctionsPermissions } from "@/lib/inquiry-permissions"


function formatDate(dateStr: string | null | undefined) {
  return formatDateDMY(dateStr, '-');
}

function getUpcomingBirthdayDiff(birthDate?: string | null): number | null {
  if (!birthDate) return null;
  const inspected = inspectMemberDate(birthDate);
  if (!inspected.isoDate) return null;
  const parts = inspected.isoDate.split('-').map(Number);
  if (parts.length !== 3) return null;
  const [, month, day] = parts;
  if (!month || !day) return null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let nextBday = new Date(today.getFullYear(), month - 1, day);
  if (nextBday.getTime() < today.getTime()) {
    nextBday = new Date(today.getFullYear() + 1, month - 1, day);
  }
  const diffDays = Math.round((nextBday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays >= 0 && diffDays <= 15 ? diffDays : null;
}

function MembershipBadge({ member }: { member: any }) {
  let label = 'Nepoznato';
  let variant = { bg: 'bg-gray-50', text: 'text-gray-700', dot: 'bg-gray-500' };

  if (member.deceased) {
    label = 'Preminuo/la';
    variant = { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-500' };
  } else if (member.expelled) {
    label = 'Ispisan/a';
    variant = { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' };
  } else if (member.status === 'active') {
    label = 'Aktivan';
    variant = { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' };
  } else if (member.status === 'expired') {
    label = 'Ispisan/a';
    variant = { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' };
  }

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${variant.bg} ${variant.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${variant.dot}`} />
      {label}
    </span>
  )
}

function FinancialBadge({ member }: { member: any }) {
  let badge = null;
  if (member.expelled || member.deceased) {
    badge = <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium bg-gray-50 text-gray-500 border-gray-200">Zatvoreno</span>;
  } else if (member.honorary || member.exemptFromPayment) {
    badge = <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium bg-blue-50 text-blue-700 border-blue-200">Oslobođeno</span>;
  } else if (member.paymentStatus === 'paid') {
    badge = <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium bg-green-50 text-green-700 border-green-200">Plaćeno</span>;
  } else if (member.paymentStatus === 'overdue') {
    badge = <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium bg-amber-50 text-amber-700 border-amber-200">Dug</span>;
  } else {
    badge = <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium bg-gray-50 text-gray-500 border-gray-200">-</span>;
  }

  const hasPayments = member.payments && member.payments.length > 0;

  if (!hasPayments) return badge;

  return (
    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      {badge}
      <Popover>
        <PopoverTrigger asChild>
          <button className="text-muted-foreground hover:text-foreground transition-colors" title="Zadnje uplate">
            <Euro className="h-4 w-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-3" side="top" onClick={(e) => e.stopPropagation()}>
          <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-2">Zadnje uplate</h4>
          <div className="space-y-1.5">
            {member.payments.slice(0, 5).map((p: any, i: number) => (
              <div key={i} className="flex justify-between text-sm">
                <span>{new Date(p.date).toLocaleDateString('en-GB')}</span>
                <span className="font-medium">{p.amount} €</span>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}


export function MembersContent() {
  const { 
    filteredMembers, 
    members, 
    searchTerm, 
    setSearchTerm, 
    setStatusFilter, 
    setPaymentFilter, 
    honoraryFilter,
    setHonoraryFilter,
    activeFunctionsOnlyFilter,
    setActiveFunctionsOnlyFilter,
    clearFilters, 
    updateMember,
    deleteMember, 
    exportMembers 
  } = useMembers()
  const { settings } = useSettings()
  const { user } = useAuth()
  const { addLog } = useActivityLog()
  const [birthdayMember, setBirthdayMember] = React.useState<Member | null>(null)
  const [missingDataDialogOpen, setMissingDataDialogOpen] = React.useState(false)
  const hasLoggedRef = React.useRef(false)

  React.useEffect(() => {
    if (user && !hasLoggedRef.current) {
      hasLoggedRef.current = true
      addLog({
        userId: user.id.toString(),
        userName: user.name,
        userRole: user.role,
        action: 'Pregled članova',
        details: `Korisnik ${user.name} je pregledao imenik / popis članova društva`
      })
    }
  }, [user?.id])
  const fnPerms = React.useMemo(() => getFunctionsPermissions(user), [user])
  const canViewFunctions = fnPerms.view
  const canEditFunctions = fnPerms.edit
  const canViewMembers =
    user?.role === 'admin' ||
    user?.role === 'moderator' ||
    user?.accessRights?.members?.view === true ||
    (user?.accessRights?.members?.view !== false && !canViewFunctions)

  const canEdit = user?.role === 'admin' || user?.accessRights?.members?.edit === true
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = React.useState<'members' | 'organization'>(() => {
    if (searchParams?.get('tab') === 'organization') return 'organization'
    if (!canViewMembers && canViewFunctions) return 'organization'
    return 'members'
  })

  React.useEffect(() => {
    if (searchParams?.get('tab') === 'organization' && activeTab !== 'organization') {
      setActiveTab('organization')
    } else if (!canViewMembers && canViewFunctions && activeTab !== 'organization') {
      setActiveTab('organization')
    }
  }, [searchParams, canViewMembers, canViewFunctions, activeTab])
  const [selectedMemberIds, setSelectedMemberIds] = React.useState<number[]>([])
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = React.useState(false)
  const [deleteNotice, setDeleteNotice] = React.useState('')
  const [pageSize, setPageSize] = React.useState<'5' | '10' | '20' | '30' | 'all'>('10')
  const [currentPage, setCurrentPage] = React.useState(1)
  const [sortConfig, setSortConfig] = React.useState<{ key: string, direction: 'asc' | 'desc' } | null>(null)
  const [invitationMember, setInvitationMember] = React.useState<Member | null>(null)
  const [bulkPaymentDialogOpen, setBulkPaymentDialogOpen] = React.useState(false)
  const [cleanupDialogOpen, setCleanupDialogOpen] = React.useState(false)
  const [invalidDateFilter, setInvalidDateFilter] = React.useState(false)
  const [duplicateFilter, setDuplicateFilter] = React.useState(false)

  const isAdmin = user?.role === 'admin'
  const invalidDateMembersCount = React.useMemo(
    () => (isAdmin ? members.filter((m) => getMemberDateIssues(m).length > 0).length : 0),
    [members, isAdmin]
  )
  const duplicateMemberIds = React.useMemo(() => findDuplicateMemberIds(members), [members])

  const sortedMembers = React.useMemo(() => {
    let sortableItems = [...filteredMembers]
    if (isAdmin && invalidDateFilter) {
      sortableItems = sortableItems.filter((m) => getMemberDateIssues(m).length > 0)
    }
    if (duplicateFilter) {
      sortableItems = sortableItems.filter((m) => duplicateMemberIds.has(m.id))
    }
    if (sortConfig !== null) {
      sortableItems.sort((a: any, b: any) => {
        let aValue = a[sortConfig.key]
        let bValue = b[sortConfig.key]

        // Handle numeric sorting for membership/registry numbers
        if (['membershipNumber', 'registryNumber'].includes(sortConfig.key)) {
          const aNum = parseInt(String(aValue || '').replace(/\D/g, '') || '0', 10)
          const bNum = parseInt(String(bValue || '').replace(/\D/g, '') || '0', 10)
          return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum
        }

        // Handle date sorting
        if (['joinDate', 'datum_zadnje_uplate'].includes(sortConfig.key)) {
          const aDate = aValue ? new Date(aValue).getTime() : 0
          const bDate = bValue ? new Date(bValue).getTime() : 0
          return sortConfig.direction === 'asc' ? aDate - bDate : bDate - aDate
        }

        // Handle sorting by role/function
        if (sortConfig.key === 'role') {
          const aRole = getMemberDisplayRole(a)
          const bRole = getMemberDisplayRole(b)
          return sortConfig.direction === 'asc' 
            ? aRole.localeCompare(bRole, 'hr') 
            : bRole.localeCompare(aRole, 'hr')
        }

        // Default string sorting
        const aStr = String(aValue || '').toLowerCase()
        const bStr = String(bValue || '').toLowerCase()

        if (aStr < bStr) {
          return sortConfig.direction === 'asc' ? -1 : 1
        }
        if (aStr > bStr) {
          return sortConfig.direction === 'asc' ? 1 : -1
        }
        return 0
      })
    }
    return sortableItems
  }, [filteredMembers, sortConfig, isAdmin, invalidDateFilter, duplicateFilter, duplicateMemberIds])

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc'
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
  }

  const getSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
    }
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="ml-1 h-3 w-3 text-primary" /> 
      : <ArrowDown className="ml-1 h-3 w-3 text-primary" />
  }

  // Handle URL filters
  React.useEffect(() => {
    const status = searchParams.get('status')
    const payment = searchParams.get('paymentStatus')
    
    if (status) setStatusFilter(status)
    if (payment) setPaymentFilter(payment)
    
    // Clear search if navigating from dashboard? No, let's keep it minimal
  }, [searchParams, setStatusFilter, setPaymentFilter])

  const pageSizeNumber = pageSize === 'all' ? sortedMembers.length || 1 : Number(pageSize)
  const totalPages = Math.max(1, pageSize === 'all' ? 1 : Math.ceil(sortedMembers.length / pageSizeNumber))
  const currentPageStart = (currentPage - 1) * pageSizeNumber
  const currentPageMembers = pageSize === 'all'
    ? sortedMembers
    : sortedMembers.slice(currentPageStart, currentPageStart + pageSizeNumber)

  React.useEffect(() => {
    setCurrentPage(1)
  }, [filteredMembers.length, sortedMembers.length, pageSize, sortConfig, invalidDateFilter, duplicateFilter])

  const allSelected = currentPageMembers.length > 0 && currentPageMembers.every((member) => selectedMemberIds.includes(member.id))

  const handleToggleSelect = (id: number, checked: boolean | "indeterminate") => {
    if (checked) {
      setSelectedMemberIds((prev) => [...prev, id])
    } else {
      setSelectedMemberIds((prev) => prev.filter((item) => item !== id))
    }
  }

  const handleSelectAll = (checked: boolean | "indeterminate") => {
    if (checked) {
      setSelectedMemberIds(filteredMembers.map((member) => member.id))
    } else {
      setSelectedMemberIds([])
    }
  }

  const handleDeleteSelected = () => {
    if (selectedMemberIds.length === 0) {
      setDeleteNotice('Odaberite barem jednog člana za brisanje.')
      return
    }
    setShowBulkDeleteConfirm(true)
    setDeleteNotice('Potvrdite brisanje označenih članova pomoću gumba Potvrdi ili Odustani.')
  }

  const confirmDeleteSelected = () => {
    const count = selectedMemberIds.length
    selectedMemberIds.forEach((id) => deleteMember(id))
    setSelectedMemberIds([])
    setShowBulkDeleteConfirm(false)
    setDeleteNotice(`Obrisano ${count} označenih člana.`)
  }

  const cancelDeleteSelected = () => {
    setShowBulkDeleteConfirm(false)
    setDeleteNotice('Brisanje je otkazano.')
  }

  return (
    <main className="flex-1 min-w-0 overflow-auto">
      {/* Top Header */}
            <DesktopHeaderNav activeItem="members" showBar />
      <header className="border-b border-border bg-background/95 backdrop-blur md:sticky md:top-0 md:z-10">
        <div className="flex items-center justify-between px-4 py-3 md:px-8 md:py-4">
          {/* Search */}
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Pretraži po imenu, emailu ili ID-u..."
              className="border-border bg-card pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </header>

      <div className="p-4 md:p-8">
        {/* Page Header */}
        <div className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="font-serif text-2xl font-bold md:text-4xl">Registar članova</h2>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground md:mt-2 md:text-base">
              Upravljajte sa članstvom i uplatama članarina
            </p>
            <div className="mt-4 flex gap-6 overflow-x-auto border-b border-border md:mt-6">
              {canViewMembers && (
                <button
                  onClick={() => setActiveTab('members')}
                  className={`shrink-0 pb-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'members' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                >
                  Popis članova
                </button>
              )}
              {canViewFunctions && (
                <button
                  onClick={() => setActiveTab('organization')}
                  className={`shrink-0 pb-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'organization' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                >
                  Odbor i Povijest funkcija
                </button>
              )}
            </div>
          </div>
          
          {/* Action Buttons */}
          {canViewMembers && (
          <div className="flex flex-col items-stretch gap-3 md:items-end sm:flex-row sm:items-center">
            <div className="flex flex-wrap items-center gap-2 md:gap-3">
              <Button 
                variant="outline" 
                className="gap-2 border-amber-300 bg-amber-50/50 text-amber-900 hover:bg-amber-100/70"
                onClick={() => setBulkPaymentDialogOpen(true)}
              >
                <Mail className="h-4 w-4 text-amber-600" />
                Obavijesti za plaćanje ({members.filter(m => m.status_clana === 'DUG' || m.paymentStatus === 'overdue').length})
              </Button>
              <Button variant="outline" className="gap-2" onClick={exportMembers}>
                <Download className="h-4 w-4" />
                Izvezi u Excel
              </Button>
              {canEdit && (
                <>
                  {isAdmin && (
                    <>
                      <Button
                        variant="outline"
                        className="gap-2 border-[#CEA369] bg-[#1B2B36] text-white hover:bg-[#1B2B36]/90 hover:text-white"
                        onClick={() => setMissingDataDialogOpen(true)}
                      >
                        <FileText className="h-4 w-4 text-[#CEA369]" />
                        {selectedMemberIds.length > 0
                          ? `Zatraži dopunu podataka (${selectedMemberIds.length})`
                          : 'Dopuna podataka (Link + PDF)'}
                      </Button>
                      <Button
                        variant="outline"
                        className="gap-2 border-amber-400 bg-amber-50 text-amber-900 hover:bg-amber-100"
                        onClick={() => setCleanupDialogOpen(true)}
                      >
                        <Wrench className="h-4 w-4 text-amber-700" />
                        Admin: Čišćenje datuma i uplata
                      </Button>
                    </>
                  )}
                  {user?.role === 'admin' && <MembersImportDialog />}
                  <AddMemberDialog />
                </>
              )}
            </div>
            {selectedMemberIds.length > 0 && canEdit && (
              <Button className="gap-2 bg-red-600 text-white hover:bg-red-700" onClick={handleDeleteSelected}>
                <Trash2 className="h-4 w-4" />
                Obriši označeno ({selectedMemberIds.length})
              </Button>
            )}
          </div>
          )}
        </div>

        {activeTab === 'members' ? (
          <>
            {/* Filters */}
            <div className="mb-6 rounded-xl border border-border bg-card p-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="grid grid-cols-2 gap-3 md:flex md:items-center md:gap-4">
                  {/* Status Filter */}
                  <div>
                    <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      STATUS
                    </label>
                    <Select defaultValue="all" onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-full md:w-36 border-border bg-background">
                        <SelectValue placeholder="Svi statusi" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Svi statusi</SelectItem>
                        <SelectItem value="active">Aktivan</SelectItem>
                        <SelectItem value="expired">Neaktivan</SelectItem>
                        <SelectItem value="pending">Na čekanju</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Payment Filter */}
                  <div>
                    <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      PLAĆANJE
                    </label>
                    <Select defaultValue="all" onValueChange={setPaymentFilter}>
                      <SelectTrigger className="w-full md:w-36 border-border bg-background">
                        <SelectValue placeholder="Sva plaćanja" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Sva plaćanja</SelectItem>
                        <SelectItem value="paid">Plaćeno</SelectItem>
                        <SelectItem value="overdue">Dug</SelectItem>
                        <SelectItem value="pending">Na čekanju</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Membership Level */}
                  <div>
                    <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      RAZINA ČLANSTVA
                    </label>
                    <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setHonoraryFilter(!honoraryFilter)}
                          className={`rounded-full border transition-all px-4 py-2 text-xs font-bold ${
                            honoraryFilter 
                            ? "bg-primary text-white border-primary shadow-md shadow-primary/20" 
                            : "bg-secondary text-muted-foreground border-border hover:border-primary/50"
                          }`}
                        >
                          POČASNI ČLANOVI
                        </button>
                    </div>
                  </div>

                  {/* Active Functions Filter */}
                  <div>
                    <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      FUNKCIJE / DUŽNOSTI
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveFunctionsOnlyFilter(!activeFunctionsOnlyFilter)}
                        className={`rounded-full border transition-all px-4 py-2 text-xs font-bold flex items-center gap-1.5 ${
                          activeFunctionsOnlyFilter 
                          ? "bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-600/20" 
                          : "bg-secondary text-muted-foreground border-border hover:border-amber-600/50"
                        }`}
                        title="Prikaži samo članove s trenutno aktivnom dužnosti u društvu"
                      >
                        <Award className="h-3.5 w-3.5" />
                        AKTIVNE DUŽNOSTI ({members.filter(m => getMemberActiveFunctions(m).length > 0).length})
                      </button>
                    </div>
                  </div>

                  {/* Page Size */}
                  <div>
                    <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      PRIKAZ PO STRANICI
                    </label>
                    <Select value={pageSize} onValueChange={(value) => setPageSize(value as '5' | '10' | '20' | '30' | 'all')}>
                      <SelectTrigger className="w-full md:w-36 border-border bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5</SelectItem>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="30">30</SelectItem>
                        <SelectItem value="all">Svi</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {isAdmin && (
                    <div>
                      <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        KONTROLA DATUMA
                      </label>
                      <button
                        type="button"
                        onClick={() => setInvalidDateFilter(!invalidDateFilter)}
                        className={`rounded-full border transition-all px-4 py-2 text-xs font-bold flex items-center gap-1.5 ${
                          invalidDateFilter
                            ? "bg-red-600 text-white border-red-600 shadow-md shadow-red-600/20"
                            : invalidDateMembersCount > 0
                            ? "bg-amber-50 text-amber-900 border-amber-300 hover:border-amber-500"
                            : "bg-secondary text-muted-foreground border-border"
                        }`}
                        title="Prikaži samo članove koji imaju krivi ili nestandardni format datuma"
                      >
                        <AlertTriangle className="h-3.5 w-3.5" />
                        KRIVI DATUMI ({invalidDateMembersCount})
                      </button>
                    </div>
                  )}
                  {(duplicateMemberIds.size > 0 || duplicateFilter) && (
                    <div>
                      <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        KONTROLA DUPLIKATA
                      </label>
                      <button
                        type="button"
                        onClick={() => setDuplicateFilter(!duplicateFilter)}
                        className={`rounded-full border transition-all px-4 py-2 text-xs font-bold flex items-center gap-1.5 ${
                          duplicateFilter
                            ? "bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-600/20"
                            : "bg-amber-50 text-amber-900 border-amber-300 hover:border-amber-500"
                        }`}
                        title="Prikaži članove koji imaju isto ime/prezime, e-mail, OIB ili broj matice"
                      >
                        <AlertTriangle className="h-3.5 w-3.5" />
                        DUPLIKATI ({duplicateMemberIds.size})
                      </button>
                    </div>
                  )}
                </div>

                <button
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                  onClick={() => { setInvalidDateFilter(false); setDuplicateFilter(false); clearFilters() }}
                >
                  <Filter className="h-4 w-4" />
                  Očisti filtere
                </button>
              </div>
            </div>

            {/* Members – mobilne kartice */}
            <div className="md:hidden space-y-3">
              {currentPageMembers.length > 0 && (
                <label className="flex items-center gap-3 px-1 text-sm text-muted-foreground">
                  <Checkbox checked={allSelected} onCheckedChange={handleSelectAll} />
                  Označi sve na stranici
                </label>
              )}
              {currentPageMembers.map((member) => (
                <div key={member.id} className={`relative rounded-xl border border-border bg-card p-4 shadow-sm ${member.deceased ? 'opacity-80' : ''}`}>
                  {member.deceased && (
                    <div className="pointer-events-none absolute inset-0 rounded-xl bg-neutral-400/20" aria-hidden="true" />
                  )}
                  <div className="flex items-start gap-3">
                    <Checkbox
                      className="mt-1"
                      checked={selectedMemberIds.includes(member.id)}
                      onCheckedChange={(checked) => handleToggleSelect(member.id, checked)}
                    />
                    <Link href={`/members/${member.id}`} className="min-w-0 flex-1">
                      <p className="text-base font-bold leading-tight text-primary">{member.name}</p>
                      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                        {(() => {
                          const activeFns = getMemberActiveFunctions(member);
                          const isHonorary = Boolean(member.honorary);
                          const isDeceased = Boolean(member.deceased);
                          const hasRoleBadge = activeFns.length > 0 || member.role === 'admin' || member.role === 'moderator';

                          return (
                            <>
                              {activeFns.map((fn, idx) => (
                                <Badge key={`fn-${idx}`} variant="outline" className="border-amber-300 bg-amber-50 text-amber-900 text-[10px] py-0 px-1.5 font-semibold">
                                  {fn.replace(/\s*\(\?-\?\)/g, '').trim()}
                                </Badge>
                              ))}
                              {member.role === 'admin' && (
                                <Badge variant="outline" className="border-purple-300 bg-purple-50 text-purple-900 text-[10px] py-0 px-1.5 font-semibold">
                                  Administrator
                                </Badge>
                              )}
                              {member.role === 'moderator' && (
                                <Badge variant="outline" className="border-indigo-300 bg-indigo-50 text-indigo-900 text-[10px] py-0 px-1.5 font-semibold">
                                  Moderator
                                </Badge>
                              )}
                              {!hasRoleBadge && (
                                <span className="text-xs text-muted-foreground">Član</span>
                              )}
                              {isHonorary && (
                                <span
                                  title="Počasni član"
                                  aria-label="Počasni član"
                                  className="inline-flex items-center justify-center rounded border border-amber-300 bg-amber-50/90 p-0.5 text-amber-600"
                                >
                                  <Medal className="h-3.5 w-3.5 shrink-0" />
                                </span>
                              )}
                              {isDeceased && (
                                <span
                                  title="Preminuo/la"
                                  className="inline-flex items-center justify-center rounded border border-neutral-400 bg-neutral-100 px-1.5 py-0 text-xs font-bold leading-tight text-black"
                                >
                                  ✝
                                </span>
                              )}
                            </>
                          );
                        })()}
                        {member.membershipNumber && (
                          <span className="text-xs text-muted-foreground">· Br. {member.membershipNumber}</span>
                        )}
                      </div>
                    </Link>
                    <Link href={`/members/${member.id}`} className="shrink-0 rounded-md border border-border bg-background p-2.5 text-muted-foreground" aria-label="Uredi člana">
                      <Pencil className="h-4 w-4" />
                    </Link>
                  </div>

                  <div className="mt-3 space-y-1.5 text-sm">
                    {member.phone && (
                      <a href={`tel:${member.phone}`} className="flex items-center gap-2 text-foreground">
                        <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">{member.phone}</span>
                      </a>
                    )}
                    {member.email && (
                      <a href={`mailto:${member.email}`} className="flex items-center gap-2 text-foreground">
                        <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">{member.email}</span>
                      </a>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                    <MembershipBadge member={member} />
                    <FinancialBadge member={member} />
                    <span className="ml-auto text-xs text-muted-foreground">
                      Zadnja uplata: <span className="font-medium text-foreground">{formatDate(member.datum_zadnje_uplate)}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Members Table */}
            <div className="mt-3 md:mt-0 rounded-xl border border-border bg-card overflow-hidden">
              <div className="hidden md:block overflow-x-auto w-full">
                <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="w-12 p-4">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={handleSelectAll}
                      />
                    </th>
                    <th 
                      className="p-4 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-primary transition-colors"
                      onClick={() => requestSort('membershipNumber')}
                    >
                      <div className="flex items-center">
                        Br. prijavnice {getSortIcon('membershipNumber')}
                      </div>
                    </th>
                    <th 
                      className="p-4 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-primary transition-colors"
                      onClick={() => requestSort('registryNumber')}
                    >
                      <div className="flex items-center">
                        Br. matice {getSortIcon('registryNumber')}
                      </div>
                    </th>
                    <th 
                      className="p-4 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-primary transition-colors"
                      onClick={() => requestSort('name')}
                    >
                      <div className="flex items-center">
                        Ime i prezime {getSortIcon('name')}
                      </div>
                    </th>
                    <th 
                      className="p-4 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-primary transition-colors"
                      onClick={() => requestSort('role')}
                    >
                      <div className="flex items-center">
                        Uloga {getSortIcon('role')}
                      </div>
                    </th>
                    <th 
                      className="p-4 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-primary transition-colors"
                      onClick={() => requestSort('email')}
                    >
                      <div className="flex items-center">
                        Email {getSortIcon('email')}
                      </div>
                    </th>
                    <th 
                      className="p-4 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-primary transition-colors"
                      onClick={() => requestSort('phone')}
                    >
                      <div className="flex items-center">
                        Telefon {getSortIcon('phone')}
                      </div>
                    </th>
                    <th 
                      className="p-4 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-primary transition-colors"
                      onClick={() => requestSort('joinDate')}
                    >
                      <div className="flex items-center">
                        Datum upisa {getSortIcon('joinDate')}
                      </div>
                    </th>
                    <th className="p-4 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Status članstva
                    </th>
                    <th className="p-4 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Financije
                    </th>
                    <th 
                      className="p-4 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-primary transition-colors"
                      onClick={() => requestSort('datum_zadnje_uplate')}
                    >
                      <div className="flex items-center">
                        Zadnja uplata {getSortIcon('datum_zadnje_uplate')}
                      </div>
                    </th>
                    <th className="w-12 p-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {currentPageMembers.map((member) => (
                    <tr
                      key={member.id}
                      className={`border-b border-border last:border-0 transition-colors ${
                        member.deceased
                          ? 'bg-neutral-300/40 opacity-75 hover:bg-neutral-300/55'
                          : 'hover:bg-secondary/30'
                      }`}
                    >
                      <td className="p-4">
                        <Checkbox
                          checked={selectedMemberIds.includes(member.id)}
                          onCheckedChange={(checked) => handleToggleSelect(member.id, checked)}
                        />
                      </td>
                      <td className="p-4 text-sm font-medium">{member.membershipNumber || '-'}</td>
                      <td className="p-4 text-sm font-medium">{member.registryNumber || '-'}</td>
                      <td className="p-4">
                        <Link href={`/members/${member.id}`} className="text-left text-primary underline-offset-2 hover:text-primary/80 hover:underline focus:outline-none focus:ring-2 focus:ring-primary/50">
                          <div>
                            <p className="font-bold text-primary text-sm">{member.name}</p>
                          </div>
                        </Link>
                      </td>
                      <td className="p-4 text-sm">
                        {(() => {
                          const activeFns = getMemberActiveFunctions(member);
                          const isHonorary = Boolean(member.honorary);
                          const isDeceased = Boolean(member.deceased);
                          const hasRoleBadge = activeFns.length > 0 || member.role === 'admin' || member.role === 'moderator';

                          return (
                            <div className="flex flex-wrap items-center gap-1.5">
                              {activeFns.map((fn, idx) => {
                                const cleanFn = fn.replace(/\s*\(\?-\?\)/g, '').trim();
                                return (
                                  <Badge 
                                    key={`fn-${idx}`} 
                                    variant="outline" 
                                    className="border-amber-300 bg-amber-50/90 text-amber-900 font-semibold text-xs py-0.5 px-2 whitespace-normal text-left"
                                  >
                                    {cleanFn}
                                  </Badge>
                                );
                              })}
                              {member.role === 'admin' && (
                                <Badge variant="outline" className="border-purple-300 bg-purple-50 text-purple-900 font-semibold text-xs">
                                  Administrator
                                </Badge>
                              )}
                              {member.role === 'moderator' && (
                                <Badge variant="outline" className="border-indigo-300 bg-indigo-50 text-indigo-900 font-semibold text-xs">
                                  Moderator
                                </Badge>
                              )}
                              {!hasRoleBadge && (
                                <span className="text-muted-foreground font-medium text-xs">Član</span>
                              )}
                              {isHonorary && (
                                <span
                                  title="Počasni član"
                                  aria-label="Počasni član"
                                  className="inline-flex items-center justify-center rounded border border-amber-300 bg-amber-50/90 p-1 text-amber-600"
                                >
                                  <Medal className="h-4 w-4 shrink-0" />
                                </span>
                              )}
                              {isDeceased && (
                                <span
                                  title="Preminuo/la"
                                  className="inline-flex items-center justify-center rounded border border-neutral-400 bg-neutral-100 px-1.5 py-0.5 text-sm font-bold leading-none text-black"
                                >
                                  ✝
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="p-4 text-sm">
                        <div className="font-medium">{member.email || '-'}</div>
                        {member.invitationSent ? (
                          <div 
                            className="text-[10px] text-blue-700 font-semibold flex items-center gap-1 mt-0.5 cursor-help" 
                            title={`Pozivnica poslana: ${member.invitationSentAt ? formatInvitationDateTime(member.invitationSentAt) : 'Evidentirano'}`}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                            Pozivnica: {member.invitationSentAt ? formatInvitationDateTime(member.invitationSentAt) : 'Poslana'}
                          </div>
                        ) : (
                          <div className="text-[10px] text-muted-foreground/70 italic mt-0.5">
                            Pozivnica nije poslana
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-sm">{member.phone || '-'}</td>
                      <td className="p-4 text-sm">
                        <div>{formatDate(member.joinDate)}</div>
                        {isAdmin && (() => {
                          const check = inspectMemberDate(member.joinDate)
                          if (check.status === 'invalid' || check.status === 'convertible') {
                            return (
                              <div className="mt-1 flex flex-wrap items-center gap-1">
                                <span
                                  className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                    check.status === 'invalid'
                                      ? 'bg-red-100 text-red-800'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}
                                  title={`${check.reason || 'Krivi format'} (izvorno: "${check.raw}")`}
                                >
                                  <AlertTriangle className="h-2.5 w-2.5" />
                                  Krivi format
                                </span>
                                <button
                                  type="button"
                                  onClick={() => updateMember(member.id, { joinDate: '2007-01-01' })}
                                  className="inline-flex items-center rounded border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors"
                                  title="Ispravi datum upisa ovog člana na 01/01/2007"
                                >
                                  Upiši 01/01/2007
                                </button>
                              </div>
                            )
                          }
                          return null
                        })()}
                      </td>
                      <td className="p-4">
                        <MembershipBadge member={member} />
                      </td>
                      <td className="p-4">
                        <FinancialBadge member={member} />
                        {member.lastPaymentReminderAt && (
                          <div
                            className="text-[10px] text-amber-700 font-semibold flex items-center gap-1 mt-1 cursor-help whitespace-nowrap"
                            title={`Podsjetnik za članarinu poslan: ${formatInvitationDateTime(member.lastPaymentReminderAt)}`}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-600" />
                            Podsjetnik: {formatInvitationDateTime(member.lastPaymentReminderAt)}
                          </div>
                        )}
                        {member.lastBirthdayEmailAt && (
                          <div
                            className="text-[10px] text-pink-700 font-semibold flex items-center gap-1 mt-1 cursor-help whitespace-nowrap"
                            title={`Rođendanska čestitka poslana: ${formatInvitationDateTime(member.lastBirthdayEmailAt)}`}
                          >
                            <Cake className="h-2.5 w-2.5 text-pink-600" />
                            Čestitka: {formatInvitationDateTime(member.lastBirthdayEmailAt)}
                          </div>
                        )}
                        {member.dataFormSubmittedAt ? (
                          <div
                            className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1 mt-1 cursor-help whitespace-nowrap"
                            title={`Član je popunio i predao obrazac: ${formatInvitationDateTime(member.dataFormSubmittedAt)}`}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                            Predao podatke: {formatInvitationDateTime(member.dataFormSubmittedAt)}
                          </div>
                        ) : member.dataFormViewedAt ? (
                          <div
                            className="text-[10px] text-blue-700 font-semibold flex items-center gap-1 mt-1 cursor-help whitespace-nowrap"
                            title={`Član je pogledao obrazac za dopunu: ${formatInvitationDateTime(member.dataFormViewedAt)}`}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                            Pogledao formu: {formatInvitationDateTime(member.dataFormViewedAt)}
                          </div>
                        ) : member.lastMissingDataEmailAt ? (
                          <div
                            className="text-[10px] text-slate-600 font-medium flex items-center gap-1 mt-1 cursor-help whitespace-nowrap"
                            title={`Poslana zamolba za dopunu podataka: ${formatInvitationDateTime(member.lastMissingDataEmailAt)}`}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                            Dopuna poslana: {formatInvitationDateTime(member.lastMissingDataEmailAt)}
                          </div>
                        ) : null}
                      </td>
                      <td className="p-4 text-sm whitespace-nowrap">
                        <div>{formatDate(member.datum_zadnje_uplate)}</div>
                        {isAdmin && (() => {
                          const paymentIssues = getMemberDateIssues(member).filter((i) => i.field === 'payment')
                          if (paymentIssues.length > 0) {
                            return (
                              <div
                                className="mt-1 inline-flex items-center gap-1 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-800"
                                title={paymentIssues.map((i) => `${i.raw}: ${i.reason}`).join('; ')}
                              >
                                <AlertTriangle className="h-2.5 w-2.5" />
                                Krivi datum uplate
                              </div>
                            )
                          }
                          return null
                        })()}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {canEdit && member.email && !member.deceased && getUpcomingBirthdayDiff(member.birthDate) !== null && (
                            <button
                              type="button"
                              onClick={() => setBirthdayMember(member)}
                              className={`inline-flex items-center justify-center rounded-md border p-2 transition ${
                                member.lastBirthdayEmailAt && new Date(member.lastBirthdayEmailAt).getFullYear() === new Date().getFullYear()
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                  : 'border-pink-200 bg-pink-50 text-pink-700 hover:bg-pink-100'
                              }`}
                              title={
                                member.lastBirthdayEmailAt
                                  ? `Rođendanska čestitka poslana ${formatInvitationDateTime(member.lastBirthdayEmailAt)} - Kliknite za pregled ili ponovno slanje`
                                  : 'Pošalji rođendansku čestitku (pregled predloška)'
                              }
                            >
                              <Cake className="h-4 w-4" />
                            </button>
                          )}
                          {canEdit && member.email && (
                            <button
                              type="button"
                              onClick={() => setInvitationMember(member)}
                              className={`inline-flex items-center justify-center rounded-md border p-2 transition ${
                                member.invitationSent
                                  ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                                  : 'border-border bg-background text-muted-foreground hover:bg-secondary/70 hover:text-foreground'
                              }`}
                              title={
                                member.invitationSent
                                  ? `Pozivnica poslana ${member.invitationSentAt ? formatInvitationDateTime(member.invitationSentAt) : ''} - Kliknite za pregled ili ponovno slanje`
                                  : 'Pregledaj i pošalji pozivnicu'
                              }
                            >
                              <Mail className="h-4 w-4" />
                            </button>
                          )}
                          <Link href={`/members/${member.id}`} className="inline-block rounded-md border border-border bg-background p-2 text-muted-foreground transition hover:bg-secondary/70 hover:text-foreground" title="Uredi člana">
                            <Pencil className="h-4 w-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              {deleteNotice && (
                <div className="border-t border-border px-4 py-3 text-sm text-muted-foreground">
                  {deleteNotice}
                </div>
              )}

              {showBulkDeleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
                  <div className="w-full max-w-md rounded-[1.5rem] border border-red-200 bg-white p-6 shadow-xl">
                    <h3 className="text-xl font-semibold text-red-700">Potvrdi brisanje</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Jeste li sigurni da želite obrisati {selectedMemberIds.length} označenih članova? Obrisani članovi bit će premješteni u Smeće gdje ih administrator može vratiti.
                    </p>
                    <div className="mt-6 flex justify-end gap-3">
                      <Button variant="outline" onClick={cancelDeleteSelected}>
                        Odustani
                      </Button>
                      <Button className="bg-red-600 text-white hover:bg-red-700" onClick={confirmDeleteSelected}>
                        Potvrdi
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Pagination */}
              <div className="flex flex-col gap-3 border-t border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Prikazano <span className="font-medium text-foreground">{currentPageMembers.length > 0 ? `${currentPageStart + 1}-${currentPageStart + currentPageMembers.length}` : '0-0'}</span> od{" "}
                  <span className="font-medium text-foreground">{filteredMembers.length}</span> članova
                </p>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    Stranica <span className="font-medium text-foreground">{currentPage}</span> od <span className="font-medium text-foreground">{totalPages}</span>
                  </span>
                  <button
                    className="rounded p-2 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    className="rounded p-2 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage >= totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-8">
            {/* Trenutna postava odbora */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="border-b border-border bg-muted/30 px-6 py-4">
                <h3 className="font-serif text-xl font-bold">Trenutna postava odbora</h3>
                <p className="text-sm text-muted-foreground">Aktivne funkcije dodijeljene članovima</p>
              </div>
              <div className="overflow-x-auto w-full">
                <table className="w-full">
                  <thead>
                  <tr className="border-b border-border bg-muted/10">
                    <th className="p-4 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Funkcija</th>
                    <th className="p-4 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Osoba / Član</th>
                    <th className="p-4 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Mandat od</th>
                  </tr>
                </thead>
                <tbody>
                  {(settings.availableFunctions || []).map(fnName => {
                    const currentHolders = members.filter(m => 
                      m.role !== 'admin' && (m.functions || []).some(f => f.functionName === fnName && isMandateActive(f.toYear))
                    )
                    
                    if (currentHolders.length === 0) {
                      return (
                        <tr key={fnName} className="border-b border-border last:border-0 opacity-60">
                          <td className="p-4 text-sm font-semibold">{fnName}</td>
                          <td className="p-4 text-sm text-muted-foreground italic">Nije dodijeljeno</td>
                          <td className="p-4 text-sm text-muted-foreground">-</td>
                        </tr>
                      )
                    }

                    return currentHolders.map((holder, idx) => {
                      const assignment = holder.functions?.find(f => f.functionName === fnName)
                      return (
                        <tr key={`${fnName}-${holder.id}`} className="border-b border-border last:border-0 hover:bg-secondary/20">
                          <td className="p-4 text-sm font-semibold">{idx === 0 ? fnName : ""}</td>
                          <td className="p-4">
                            <Link href={`/members/${holder.id}`} className="hover:underline">
                              <span className="text-sm font-bold text-primary">{holder.name}</span>
                            </Link>
                            {(holder.email || holder.phone) && (
                              <div className="mt-1.5 flex flex-col gap-1">
                                {holder.email && (
                                  <span className="flex items-center text-xs text-muted-foreground">
                                    <Mail className="mr-1.5 h-3 w-3 opacity-70" />
                                    {holder.email}
                                  </span>
                                )}
                                {holder.phone && (
                                  <span className="flex items-center text-xs text-muted-foreground">
                                    <Phone className="mr-1.5 h-3 w-3 opacity-70" />
                                    {holder.phone}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="p-4 text-sm">{assignment?.fromYear || "-"}</td>
                        </tr>
                      )
                    })
                  })}
                </tbody>
              </table>
              </div>
            </div>

            {/* Povijest funkcija */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
               <div className="border-b border-border bg-muted/30 px-6 py-4">
                <h3 className="font-serif text-xl font-bold">Povijest obnašanja funkcija</h3>
                <p className="text-sm text-muted-foreground">Pregled svih mandata kroz povijest društva</p>
              </div>
              <div className="p-4">
                <div className="relative border-l-2 border-primary/20 ml-4 pl-8 space-y-8 py-4">
                  {members
                    .filter(m => m.role !== 'admin')
                    .flatMap(m => (m.functions || []).map(f => ({ ...f, memberName: m.name, memberId: m.id, avatar: m.avatar, initials: m.initials })))
                    .sort((a, b) => parseDateOrYearToTimestamp(b.fromYear) - parseDateOrYearToTimestamp(a.fromYear))
                    .map((item, idx) => (
                      <div key={idx} className="relative">
                        <div className="absolute -left-[41px] top-1.5 h-4 w-4 rounded-full border-2 border-primary bg-background shadow-sm" />
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-border bg-background p-4 shadow-sm hover:shadow-md transition-shadow">
                          <div>
                            <p className="text-xs font-bold text-primary uppercase tracking-wider">
                              {formatMandatePeriod(item.fromYear, item.toYear)}
                            </p>
                            <h4 className="text-lg font-bold mt-1">{item.functionName}</h4>
                          </div>
                          <Link href={`/members/${item.memberId}`} className="flex items-center gap-3 bg-secondary/50 px-4 py-2 rounded-lg hover:bg-secondary transition-colors">
                            <span className="font-bold text-sm text-primary">{item.memberName}</span>
                          </Link>
                        </div>
                      </div>
                    ))}
                  {members.filter(m => m.role !== 'admin').every(m => (m.functions || []).length === 0) && (
                    <div className="text-center py-12 text-muted-foreground">
                      Nema zabilježene povijesti funkcija.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal za pregled i slanje pozivnice */}
      <InvitationPreviewDialog
        member={invitationMember}
        open={!!invitationMember}
        onOpenChange={(open) => !open && setInvitationMember(null)}
      />

      {/* Modal za pregled, odobrenje i slanje rođendanske čestitke */}
      <BirthdayEmailDialog
        member={birthdayMember}
        open={!!birthdayMember}
        onOpenChange={(open) => !open && setBirthdayMember(null)}
      />

      {/* Modal za pregled i slanje skupnih obavijesti o plaćanju */}
      <PaymentReminderDialog
        open={bulkPaymentDialogOpen}
        onOpenChange={setBulkPaymentDialogOpen}
        mode="bulk"
        debtorsList={members.filter(m => m.status_clana === 'DUG' || m.paymentStatus === 'overdue')}
      />

      {/* Privremeni Admin alat za čišćenje datuma i uplata */}
      {isAdmin && (
        <>
          <AdminMembersCleanupDialog
            open={cleanupDialogOpen}
            onOpenChange={setCleanupDialogOpen}
            selectedMemberIds={selectedMemberIds}
          />
          <MissingDataEmailDialog
            open={missingDataDialogOpen}
            onOpenChange={setMissingDataDialogOpen}
            initialMemberIds={selectedMemberIds}
          />
        </>
      )}

    </main>
  )
}
