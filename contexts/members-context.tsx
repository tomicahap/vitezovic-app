"use client"

import React, { createContext, useContext, useMemo, useState, useEffect, ReactNode } from 'react'
import { useActivityLog } from './activity-log-context'
import { useAuth } from './auth-context'
import { useSettings } from './settings-context'
import { computeMemberStates } from '@/lib/member-status'
import { generateId, getMemberActiveFunctions, formatDateDMY } from '@/lib/utils'

export interface MemberPayment {
  id: string
  date: string
  amount: number
  note?: string
}

export interface MemberFunctionAssignment {
  id: string
  functionName: string
  fromYear?: string
  toYear?: string
}

export type AccessCategory =
  | 'members'
  | 'meetings'
  | 'projects'
  | 'finances'
  | 'archive'
  | 'drive'
  | 'logs'
  | 'reports'
  | 'contacts'
  | 'library'
  | 'lectures'
  | 'links'
  | 'gmail'
  | 'chronicle'
  | 'polls'
  | 'notifications'
  | 'research_inquiries'

export interface MemberAccessRight {
  view: boolean
  edit: boolean
}

export interface Member {
  id: number
  name: string
  email: string
  initials: string
  phone?: string
  birthDate?: string
  address?: string
  membershipNumber?: string
  registryNumber?: string
  status: 'active' | 'expired' | 'pending'
  paymentStatus: 'paid' | 'overdue' | 'pending'
  joinDate: string
  researchAreas: string[]
  additionalAreas: number
  functions?: MemberFunctionAssignment[]
  note?: string
  avatar?: string
  role: 'admin' | 'moderator' | 'member'
  invitationSent?: boolean
  invitationSentAt?: string | null
  isTempPassword?: boolean
  accessRights?: Record<AccessCategory, MemberAccessRight>
  payments?: MemberPayment[]
  honorary?: boolean
  exemptFromPayment?: boolean
  expelled?: boolean
  expulsionDate?: string
  expulsionReason?: string
  deceased?: boolean
  deathDate?: string
  lastPayment?: string
  expiry?: string
  allPayments?: string
  notes?: string
  password?: string
  datum_zadnje_uplate?: string | null
  status_clana?: 'AKTIVAN' | 'DUG' | 'ISPISAN'
  lastPaymentReminderAt?: string | null
  personal_notes?: string
  personal_todos?: { id: string; text: string; done: boolean; priority?: boolean }[]
}

interface MembersContextType {
  members: Member[]
  rawMembers: Member[]
  addMember: (member: Omit<Member, 'id'>) => void
  updateMember: (id: number, updates: Partial<Member>) => void
  deleteMember: (id: number) => void
  addPayment: (memberId: number, payment: Omit<MemberPayment, 'id'>) => void
  importMembers: (members: Omit<Member, 'id'>[]) => void
  exportMembers: () => Promise<void>
  getMemberById: (id: number) => Member | undefined
  filteredMembers: Member[]
  searchTerm: string
  statusFilter: string
  paymentFilter: string
  honoraryFilter: boolean
  activeFunctionsOnlyFilter: boolean
  setSearchTerm: (term: string) => void
  setStatusFilter: (status: string) => void
  setPaymentFilter: (status: string) => void
  setHonoraryFilter: (honorary: boolean) => void
  setActiveFunctionsOnlyFilter: (activeOnly: boolean) => void
  clearFilters: () => void
  updatePayment: (memberId: number, paymentId: string, updates: Partial<MemberPayment>) => void
  deletePayment: (memberId: number, paymentId: string) => void
  updatePersonalData: (notes: string, todos: { id: string; text: string; done: boolean; priority?: boolean }[]) => Promise<void>
}

const MembersContext = createContext<MembersContextType | undefined>(undefined)

export function isAdminAccountEntry(m: any): boolean {
  if (!m) return false
  const r = String(m.role || '').trim().toLowerCase()
  const e = String(m.email || '').trim().toLowerCase()
  const n = String(m.name || '').trim().toLowerCase()
  return r === 'admin' || e === 'admin' || n === 'administrator' || n === 'rezervni administrator'
}

export function MembersProvider({ children }: { children: ReactNode }) {
  const [members, setMembers] = useState<Member[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [honoraryFilter, setHonoraryFilter] = useState(false)
  const [activeFunctionsOnlyFilter, setActiveFunctionsOnlyFilter] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const { addLog } = useActivityLog()
  const { user } = useAuth()
  const { settings, refreshSettings } = useSettings()

  // Load members from API on mount
  useEffect(() => {
    const loadMembers = async () => {
      try {
        const response = await fetch('/api/members')
        if (response.ok) {
          const loadedMembers = await response.json()
          const mappedMembers = (Array.isArray(loadedMembers) ? loadedMembers : [])
            .filter((m: any) => !isAdminAccountEntry(m))
            .map((m: any) => ({
              ...m,
              payments: (m.payments || []).map((p: any) => ({
                ...p,
                id: p.id || generateId()
              })),
              functions: (m.functions || []).map((f: any) => ({
                ...f,
                id: f.id || generateId()
              }))
            }))
          setMembers(mappedMembers)
        } else {
          setMembers([])
        }
      } catch (error) {
        console.error('Failed to load members from API:', error)
        setMembers([])
      }
      setIsLoaded(true)
    }

    loadMembers()
  }, [])

  // Auto-create member record for logged-in user if not exists
  useEffect(() => {
    if (!isLoaded || !user) return

    // CRITICAL: Administrator is NOT a member and must never be in the register
    if (isAdminAccountEntry(user)) return

    const memberExists = members.some(m => (m.email || '').toLowerCase() === (user.email || '').toLowerCase())
    if (!memberExists) {
      const createMe = async () => {
        const newMember: Omit<Member, 'id'> = {
          name: user.name,
          email: user.email,
          initials: user.name.split(' ').map(n => n[0]).join('').toUpperCase(),
          role: user.role,
          status: 'active',
          paymentStatus: 'paid',
          joinDate: formatDateDMY(new Date()),
          researchAreas: [],
          additionalAreas: 0,
          payments: [],
          functions: [],
          avatar: user.avatar || '/placeholder.svg'
        }
        await addMember(newMember)
        const resp = await fetch('/api/members')
        if (resp.ok) {
          const updated = await resp.json()
          setMembers((Array.isArray(updated) ? updated : []).filter((m: any) => !isAdminAccountEntry(m)))
        }
      }
      createMe()
    }
  }, [isLoaded, user, members.length])

  const derivedMembers = useMemo(() => {
    if (!isLoaded) return []
    return members
      .filter(m => !isAdminAccountEntry(m)) // Administrator is NEVER a member
      .map(member => {
        const { status, paymentStatus } = computeMemberStates(member, settings)
        return {
          ...member,
          status,
          paymentStatus,
          joinDate: member.joinDate,
        }
      })
  }, [members, settings, isLoaded])

  // Sync statuses when settings change
  useEffect(() => {
    if (!isLoaded || members.length === 0) return

    const syncStatuses = async () => {
      try {
        const response = await fetch('/api/members', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'bulk-update-status', settings })
        })
        if (response.ok) {
          const { updated } = await response.json()
          if (updated > 0) {
            console.log(`Synchronized ${updated} member statuses.`)
          }
        }
      } catch (error) {
        console.error('Failed to sync member statuses:', error)
      }
    }

    const timer = setTimeout(syncStatuses, 1000)
    return () => clearTimeout(timer)
  }, [settings.overdueAfterDays, settings.expiredAfterDays, isLoaded])

  const addMember = async (memberData: Omit<Member, 'id'>) => {
    if (isAdminAccountEntry(memberData)) return
    const { status, paymentStatus, status_clana, datum_zadnje_uplate } = computeMemberStates(memberData, settings)

    const payload = {
      ...memberData,
      status,
      paymentStatus,
      status_clana,
      datum_zadnje_uplate,
      payments: memberData.payments ?? [],
      functions: memberData.functions ?? [],
    }

    try {
      const response = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', ...payload })
      })

      if (response.ok) {
        const { id } = await response.json()
        if (id) {
          setMembers(prev => [...prev, { ...payload, id } as Member])
        }
      } else {
        const errorText = await response.text()
        console.error('Failed to add member via API:', response.status, errorText)
      }
    } catch (error) {
      console.error('Failed to add member (network error):', error)
    }

    if (user) {
      addLog({
        userId: user.id.toString(),
        userName: user.name,
        userRole: user.role,
        action: 'Dodavanje člana',
        details: `Dodan novi član: ${memberData.name} (${memberData.email}) sa ulogom ${memberData.role || 'member'}`,
      })
    }
  }

  const updateMember = async (id: number, updates: Partial<Member>) => {
    const memberToUpdate = members.find(m => m.id === id)
    if (!memberToUpdate) return

    const { status, paymentStatus, status_clana, datum_zadnje_uplate } = computeMemberStates({ ...memberToUpdate, ...updates }, settings)
    const updatedMember = { ...memberToUpdate, ...updates, status, paymentStatus, status_clana, datum_zadnje_uplate }

    try {
      const response = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', id, ...updates, status, paymentStatus, status_clana, datum_zadnje_uplate })
      })

      if (response.ok) {
        setMembers(prev => prev.map(member =>
          member.id === id ? updatedMember : member
        ))
      } else {
        console.error('Failed to update member via API')
      }
    } catch (error) {
      console.error('Failed to update member:', error)
    }

    if (user && memberToUpdate) {
      const changes = Object.keys(updates).map(key => `${key}: ${memberToUpdate[key as keyof Member]} → ${updates[key as keyof Member]}`).join(', ')
      addLog({
        userId: user.id.toString(),
        userName: user.name,
        userRole: user.role,
        action: 'Ažuriranje člana',
        details: `Ažuriran član ${memberToUpdate.name}: ${changes}`,
      })
    }
  }

  const addPayment = async (memberId: number, payment: Omit<MemberPayment, 'id'>) => {
    const paymentEntry: MemberPayment = {
      ...payment,
      id: generateId(),
    }

    const memberToUpdate = members.find(m => m.id === memberId)
    if (!memberToUpdate) return

    const newPayments = [...(memberToUpdate.payments ?? []), paymentEntry]
    const { status, paymentStatus, status_clana, datum_zadnje_uplate } = computeMemberStates({ ...memberToUpdate, payments: newPayments }, settings)

    const updatedMember = {
      ...memberToUpdate,
      payments: newPayments,
      status,
      paymentStatus,
      status_clana,
      datum_zadnje_uplate
    }

    try {
      await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          id: memberId,
          payments: updatedMember.payments,
          status: updatedMember.status,
          paymentStatus: updatedMember.paymentStatus,
          status_clana: updatedMember.status_clana,
          datum_zadnje_uplate: updatedMember.datum_zadnje_uplate
        })
      })

      setMembers(prev => prev.map(member =>
        member.id === memberId ? updatedMember : member
      ))
    } catch (error) {
      console.error('Failed to add payment:', error)
    }

    if (user && memberToUpdate) {
      addLog({
        userId: user.id.toString(),
        userName: user.name,
        userRole: user.role,
        action: 'Evidencija uplate',
        details: `Dodana uplata za ${memberToUpdate.name}: ${payment.amount} € na datum ${formatDateDMY(payment.date)}`,
      })
    }
  }

  const updatePayment = async (memberId: number, paymentId: string, updates: Partial<MemberPayment>) => {
    const member = members.find(m => m.id === memberId)
    if (!member) return

    const updatedPayments = (member.payments ?? []).map(p =>
      p.id === paymentId ? { ...p, ...updates } : p
    )

    const { status, paymentStatus, status_clana, datum_zadnje_uplate } = computeMemberStates({ ...member, payments: updatedPayments }, settings)

    setMembers(prev => prev.map(m =>
      m.id === memberId ? { ...m, payments: updatedPayments, status, paymentStatus, status_clana, datum_zadnje_uplate } : m
    ))

    try {
      const response = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          id: memberId,
          payments: updatedPayments,
          status,
          paymentStatus,
          status_clana,
          datum_zadnje_uplate
        })
      })

      if (!response.ok) throw new Error('Failed to update')

      if (user) {
        addLog({
          userId: user.id.toString(),
          userName: user.name,
          userRole: user.role,
          action: 'Izmjena uplate',
          details: `Izmijenjena uplata za ${member.name}.`,
        })
      }
    } catch (error) {
      console.error('Failed to update payment:', error)
    }
  }

  const deletePayment = async (memberId: number, paymentId: string) => {
    const member = members.find(m => m.id === memberId)
    if (!member) return

    const updatedPayments = (member.payments ?? []).filter(p => p.id !== paymentId)

    const { status, paymentStatus, status_clana, datum_zadnje_uplate } = computeMemberStates({ ...member, payments: updatedPayments }, settings)

    setMembers(prev => prev.map(m =>
      m.id === memberId ? { ...m, payments: updatedPayments, status, paymentStatus, status_clana, datum_zadnje_uplate } : m
    ))

    try {
      const response = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          id: memberId,
          payments: updatedPayments,
          status,
          paymentStatus,
          status_clana,
          datum_zadnje_uplate
        })
      })

      if (!response.ok) throw new Error('Failed to delete')

      if (user) {
        addLog({
          userId: user.id.toString(),
          userName: user.name,
          userRole: user.role,
          action: 'Brisanje uplate',
          details: `Obrisana uplata za ${member.name}.`,
        })
      }
    } catch (error) {
      console.error('Failed to delete payment:', error)
    }
  }

  const importMembers = async (importedMembers: Omit<Member, 'id'>[]) => {
    const validImports = importedMembers.filter(m => !isAdminAccountEntry(m))
    const maxId = Math.max(...members.map(m => m.id), 0)
    const newMembers: Member[] = validImports.map((member, index) => {
      const { status, paymentStatus, status_clana, datum_zadnje_uplate } = computeMemberStates(member, settings)
      return {
        ...member,
        id: maxId + index + 1,
        status,
        paymentStatus,
        status_clana,
        datum_zadnje_uplate,
        initials: member.name.split(' ').map(n => n[0]).join('').toUpperCase(),
        payments: member.payments ?? [],
        functions: member.functions ?? [],
      }
    })

    try {
      const response = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'import', members: newMembers })
      })

      if (response.ok) {
        setMembers(prev => [...prev, ...newMembers])
      } else {
        console.error('Failed to import members via API')
      }
    } catch (error) {
      console.error('Failed to import members:', error)
    }

    if (user) {
      addLog({
        userId: user.id.toString(),
        userName: user.name,
        userRole: user.role,
        action: 'Uvoz članova',
        details: `Uvezeno ${newMembers.length} članova iz vanjske datoteke.`,
      })
    }
  }

  const exportMembers = async () => {
    const XLSX = await import('xlsx')

    const data = derivedMembers.map(member => {
      const nameParts = member.name.trim().split(/\s+/)
      const firstName = nameParts[0] || ''
      const lastName = nameParts.slice(1).join(' ') || ''

      const functionsStr = (member.functions || []).map(f => f.functionName).join('; ')
      const allPaymentsStr = (member.payments || []).map(p => formatDateDMY(p.date, p.date)).join('; ')

      const lastPaymentDate = member.payments && member.payments.length > 0
        ? formatDateDMY([...member.payments].sort((a, b) => b.date.localeCompare(a.date))[0].date, '')
        : (member.lastPayment ? formatDateDMY(member.lastPayment, member.lastPayment) : '')

      return {
        "Br. Prijave": member.membershipNumber || '',
        "Br. Matice": member.registryNumber || '',
        "Ime": firstName,
        "Prezime": lastName,
        "Datum Rođenja": member.birthDate ? formatDateDMY(member.birthDate, member.birthDate) : '',
        "Email": member.email || '',
        "Telefon": member.phone || '',
        "Adresa": member.address || '',
        "Datum Upisa": member.joinDate ? formatDateDMY(member.joinDate, member.joinDate) : '',
        "Status": member.status === 'active' ? 'Aktivan' : member.status === 'expired' ? 'Neaktivan' : 'Na čekanju',
        "Počasni": member.honorary ? 'Da' : 'Ne',
        "Oslobođen plaćanja": member.exemptFromPayment ? 'Da' : 'Ne',
        "Ispisan/a": member.expelled ? 'Da' : 'Ne',
        "Datum Ispisa": member.expulsionDate ? formatDateDMY(member.expulsionDate, member.expulsionDate) : '',
        "Razlog Ispisa": member.expulsionReason || '',
        "Preminuo/la": member.deceased ? 'Da' : 'Ne',
        "Datum Smrti": member.deathDate ? formatDateDMY(member.deathDate, member.deathDate) : '',
        "Zadnja Uplata": lastPaymentDate,
        "Istek": member.expiry ? formatDateDMY(member.expiry, member.expiry) : '',
        "Funkcije": functionsStr,
        "Sve Uplate": allPaymentsStr,
        "Bilješke": member.notes || member.note || ''
      }
    })

    const worksheet = XLSX.utils.json_to_sheet(data)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Članovi")

    XLSX.writeFile(workbook, `clanovi_export_${new Date().toISOString().split('T')[0]}.xlsx`)

    if (user) {
      addLog({
        userId: user.id.toString(),
        userName: user.name,
        userRole: user.role,
        action: 'Izvoz članova',
        details: `Izvezeno ${data.length} članova u Excel datoteku.`,
      })
    }
  }

  const getMemberById = (id: number) => {
    return derivedMembers.find(member => member.id === id)
  }

  const deleteMember = async (id: number) => {
    const memberToDelete = members.find(m => m.id === id)
    if (!memberToDelete) return

    try {
      const response = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id })
      })

      if (response.ok) {
        setMembers(prev => prev.filter(member => member.id !== id))
      } else {
        console.error('Failed to delete member via API')
      }
    } catch (error) {
      console.error('Failed to delete member:', error)
    }

    if (user && memberToDelete) {
      addLog({
        userId: user.id.toString(),
        userName: user.name,
        userRole: user.role,
        action: 'Brisanje člana',
        details: `Obrisan član: ${memberToDelete.name} (${memberToDelete.email})`,
      })
    }
  }

  const filteredMembers = derivedMembers.filter(member => {
    const activeFns = getMemberActiveFunctions(member)
    const matchesSearch = member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         activeFns.some(fn => fn.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesStatus = statusFilter === 'all' || member.status === statusFilter
    const matchesPayment = paymentFilter === 'all' || member.paymentStatus === paymentFilter
    const matchesHonorary = !honoraryFilter || member.honorary === true
    const matchesActiveFunctionsOnly = !activeFunctionsOnlyFilter || activeFns.length > 0

    return matchesSearch && matchesStatus && matchesPayment && matchesHonorary && matchesActiveFunctionsOnly
  }).sort((a, b) => {
    const aActive = a.status === 'active' && !a.deceased && !a.expelled
    const bActive = b.status === 'active' && !b.deceased && !b.expelled

    if (aActive && !bActive) return -1
    if (!aActive && bActive) return 1

    const aNum = parseInt(a.registryNumber?.replace(/\D/g, '') || '999999', 10)
    const bNum = parseInt(b.registryNumber?.replace(/\D/g, '') || '999999', 10)

    if (aNum !== bNum) return aNum - bNum

    return a.name.localeCompare(b.name, 'hr-HR')
  })

  return (
    <MembersContext.Provider value={{
      members: derivedMembers,
      rawMembers: derivedMembers,
      addMember,
      updateMember,
      deleteMember,
      addPayment,
      importMembers,
      exportMembers,
      getMemberById,
      filteredMembers,
      searchTerm,
      statusFilter,
      paymentFilter,
      honoraryFilter,
      activeFunctionsOnlyFilter,
      setSearchTerm,
      setStatusFilter,
      setPaymentFilter,
      setHonoraryFilter,
      setActiveFunctionsOnlyFilter,
      clearFilters: () => {
        setSearchTerm('')
        setStatusFilter('all')
        setPaymentFilter('all')
        setHonoraryFilter(false)
        setActiveFunctionsOnlyFilter(false)
      },
      updatePayment,
      deletePayment,
      updatePersonalData: async (notes: string, todos: { id: string; text: string; done: boolean; priority?: boolean }[]) => {
        if (!user) return
        if (isAdminAccountEntry(user)) {
          try {
            const response = await fetch('/api/settings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                adminPersonalNotes: notes,
                adminPersonalTodos: todos,
              })
            })
            if (response.ok) {
              await refreshSettings()
              addLog({
                userId: user.id.toString(),
                userName: user.name,
                userRole: user.role,
                action: 'Ažuriranje osobnog kutka',
                details: `Administrator (${user.name}) je ažurirao svoje osobne bilješke i todo listu.`,
              })
            }
          } catch (error) {
            console.error('Failed to update admin personal data:', error)
          }
          return
        }

        const currentMember = members.find(m =>
          (m.email && user.email && m.email.toLowerCase() === user.email.toLowerCase()) ||
          m.id === user.id
        )
        if (!currentMember) return

        const updatedMember = { ...currentMember, personal_notes: notes, personal_todos: todos }

        try {
          const response = await fetch('/api/members', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'update', id: currentMember.id, personal_notes: notes, personal_todos: todos })
          })

          if (response.ok) {
            setMembers(prev => prev.map(m => m.id === currentMember.id ? updatedMember : m))
            addLog({
              userId: user.id.toString(),
              userName: user.name,
              userRole: user.role,
              action: 'Ažuriranje osobnog kutka',
              details: `Korisnik ${user.name} je ažurirao svoje osobne bilješke i todo listu.`,
            })
          }
        } catch (error) {
          console.error('Failed to update personal data:', error)
        }
      }
    }}>
      {children}
    </MembersContext.Provider>
  )
}

export function useMembers() {
  const context = useContext(MembersContext)
  if (context === undefined) {
    throw new Error('useMembers must be used within a MembersProvider')
  }
  return context
}
