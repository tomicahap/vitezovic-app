"use client"

import * as React from "react"
import { Search, Mail, Download, UserPlus, Pencil, Filter, ChevronLeft, ChevronRight, AlertTriangle, Trash2, ArrowUp, ArrowDown, ArrowUpDown, Phone } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
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
import { AddMemberDialog } from "@/components/add-member-dialog"
import { MembersImportDialog } from "@/components/members-import-dialog"
import Link from "next/link"


function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '-';
  // Check if YYYY-MM-DD
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}.${parts[1]}.${parts[0]}.`;
  }
  return dateStr; // fallback for already formatted
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
  // If expelled, we don't care deeply about financial tracking active warnings
  if (member.expelled || member.deceased) {
    return <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium bg-gray-50 text-gray-500 border-gray-200">Zatvoreno</span>;
  }
  
  if (member.honorary || member.exemptFromPayment) {
    return <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium bg-blue-50 text-blue-700 border-blue-200">Oslobođeno</span>;
  }

  if (member.paymentStatus === 'paid') {
    return <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium bg-green-50 text-green-700 border-green-200">Plaćeno</span>;
  } else if (member.paymentStatus === 'overdue') {
    return <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium bg-amber-50 text-amber-700 border-amber-200">Dug</span>;
  } else {
    return <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium bg-gray-50 text-gray-500 border-gray-200">-</span>;
  }
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
    clearFilters, 
    deleteMember, 
    exportMembers 
  } = useMembers()
  const { settings } = useSettings()
  const { user } = useAuth()
  const canEdit = user?.role === 'admin' || user?.accessRights?.members?.edit === true
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = React.useState<'members' | 'organization'>('members')
  const [selectedMemberIds, setSelectedMemberIds] = React.useState<number[]>([])
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = React.useState(false)
  const [deleteNotice, setDeleteNotice] = React.useState('')
  const [pageSize, setPageSize] = React.useState<'5' | '10' | '20' | '30' | 'all'>('10')
  const [currentPage, setCurrentPage] = React.useState(1)
  const [sortConfig, setSortConfig] = React.useState<{ key: string, direction: 'asc' | 'desc' } | null>(null)

  const sortedMembers = React.useMemo(() => {
    let sortableItems = [...filteredMembers]
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
  }, [filteredMembers, sortConfig])

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
  }, [filteredMembers.length, pageSize, sortConfig])

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
    <main className="flex-1 overflow-auto">
      {/* Top Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex items-center justify-between px-8 py-4">
          {/* Search */}
          <div className="relative w-96">
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

      <div className="p-8">
        {/* Page Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h2 className="font-serif text-4xl font-bold">Registar članova</h2>
            <p className="mt-2 max-w-xl text-muted-foreground">
              Upravljajte sa članstvom i uplatama članarina
            </p>
            <div className="mt-6 flex gap-6 border-b border-border">
              <button
                onClick={() => setActiveTab('members')}
                className={`pb-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'members' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              >
                Popis članova
              </button>
              <button
                onClick={() => setActiveTab('organization')}
                className={`pb-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'organization' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              >
                Odbor i Povijest funkcija
              </button>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex flex-col items-end gap-3 sm:flex-row sm:items-center">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" className="gap-2">
                <Mail className="h-4 w-4" />
                Pošalji email
              </Button>
              <Button variant="outline" className="gap-2" onClick={exportMembers}>
                <Download className="h-4 w-4" />
                Izvezi u Excel
              </Button>
              {canEdit && (
                <>
                  <MembersImportDialog />
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
        </div>

        {activeTab === 'members' ? (
          <>
            {/* Filters */}
            <div className="mb-6 rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Status Filter */}
                  <div>
                    <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      STATUS
                    </label>
                    <Select defaultValue="all" onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-36 border-border bg-background">
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
                      <SelectTrigger className="w-36 border-border bg-background">
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
                          onClick={() => setHonoraryFilter(!honoraryFilter)}
                          className={`rounded-full border transition-all px-6 py-2 text-xs font-bold ${
                            honoraryFilter 
                            ? "bg-primary text-white border-primary shadow-md shadow-primary/20" 
                            : "bg-secondary text-muted-foreground border-border hover:border-primary/50"
                          }`}
                        >
                          POČASNI ČLANOVI
                        </button>
                    </div>
                  </div>

                  {/* Page Size */}
                  <div>
                    <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      PRIKAZ PO STRANICI
                    </label>
                    <Select value={pageSize} onValueChange={(value) => setPageSize(value as '5' | '10' | '20' | '30' | 'all')}>
                      <SelectTrigger className="w-36 border-border bg-background">
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
                </div>

                <button
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                  onClick={clearFilters}
                >
                  <Filter className="h-4 w-4" />
                  Očisti filtere
                </button>
              </div>
            </div>

            {/* Members Table */}
            <div className="rounded-xl border border-border bg-card">
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
                    <tr key={member.id} className="border-b border-border last:border-0 hover:bg-secondary/30">
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
                      <td className="p-4 text-sm font-medium">
                        {member.role === 'admin' ? 'Administrator' : member.role === 'moderator' ? 'Moderator' : 'Član'}
                      </td>
                      <td className="p-4 text-sm">{member.email}</td>
                      <td className="p-4 text-sm">{member.phone || '-'}</td>
                      <td className="p-4 text-sm">{formatDate(member.joinDate)}</td>
                      <td className="p-4">
                        <MembershipBadge member={member} />
                      </td>
                      <td className="p-4">
                        <FinancialBadge member={member} />
                      </td>
                      <td className="p-4 text-sm whitespace-nowrap">
                        {formatDate(member.datum_zadnje_uplate)}
                      </td>
                      <td className="p-4 text-right">
                        <Link href={`/members/${member.id}`} className="inline-block rounded-md border border-border bg-background p-2 text-muted-foreground transition hover:bg-secondary/70 hover:text-foreground">
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                      Jeste li sigurni da želite obrisati {selectedMemberIds.length} označenih članova? Ovaj korak je nepovratan.
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
                      m.role !== 'admin' && (m.functions || []).some(f => f.functionName === fnName && (!f.toYear || parseInt(f.toYear) >= new Date().getFullYear()))
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
                    .sort((a, b) => (b.fromYear || "").localeCompare(a.fromYear || ""))
                    .map((item, idx) => (
                      <div key={idx} className="relative">
                        <div className="absolute -left-[41px] top-1.5 h-4 w-4 rounded-full border-2 border-primary bg-background shadow-sm" />
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-border bg-background p-4 shadow-sm hover:shadow-md transition-shadow">
                          <div>
                            <p className="text-xs font-bold text-primary uppercase tracking-wider">
                              {item.fromYear} – {item.toYear || "danas"}
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

        {/* Bottom Cards */}
        <div className="mt-8 grid grid-cols-3 gap-6">
          {/* Growth Rate */}
          <div className="rounded-xl border border-border bg-card p-6">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              STOPA RASTA
            </p>
            <p className="mt-2 font-serif text-4xl font-bold text-accent">+12%</p>
            <div className="mt-4 h-1 w-24 rounded-full bg-primary" />
            <p className="mt-4 text-sm text-muted-foreground">Mjesečni trend aktivnih članova</p>
          </div>

          {/* Annual Meeting */}
          <div className="rounded-xl bg-secondary p-6">
            <h3 className="font-serif text-2xl font-bold">Godišnja skupština</h3>
            <p className="mt-3 text-sm text-muted-foreground">
              Zakazana za 15. listopada. Osigurajte da su sve članske vjerodajnice ažurirane za pravo glasa.
            </p>
            <Button variant="outline" className="mt-6 bg-card">
              Upravljaj događajem
            </Button>
            {/* Decorative */}
            <div className="pointer-events-none absolute right-8 bottom-4 opacity-10">
              <svg className="h-24 w-24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z"/>
              </svg>
            </div>
          </div>

          {/* Urgent Task */}
          <div className="rounded-xl border-2 border-red-200 bg-red-50 p-6">
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-[10px] font-semibold uppercase tracking-wider">HITAN ZADATAK</span>
            </div>
            <h3 className="mt-3 font-serif text-2xl font-bold text-red-900">
              42 Istekla članstva
            </h3>
            <p className="mt-2 text-sm text-red-700">
              Obavijesti o obnovi nisu poslane za prethodni fiskalni kvartal.
            </p>
            <button className="mt-4 text-sm font-semibold text-red-700 underline underline-offset-2">
              Pokreni tijek obnove
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
