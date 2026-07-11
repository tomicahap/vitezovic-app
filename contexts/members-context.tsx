"use client"

import React, { createContext, useContext, useMemo, useState, useEffect, ReactNode } from 'react'
import { useActivityLog } from './activity-log-context'
import { useAuth } from './auth-context'
import { useSettings } from './settings-context'
import { computeMemberStates } from '@/lib/member-status'
import { generateId } from '@/lib/utils'

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
  | 'contacts'
  | 'library'
  | 'lectures'
  | 'links'
  | 'gmail'
  | 'chronicle'
  | 'polls'

export interface MemberAccessRight {
  view: boolean
  edit: boolean
  notify?: boolean
}

const createAccessRights = (overrides: Partial<Record<AccessCategory, MemberAccessRight>> = {}): Record<AccessCategory, MemberAccessRight> => ({
  members: { view: true, edit: false, notify: false },
  meetings: { view: true, edit: false, notify: false },
  projects: { view: true, edit: false },
  finances: { view: true, edit: false },
  archive: { view: true, edit: false },
  drive: { view: true, edit: false },
  logs: { view: false, edit: false },
  contacts: { view: true, edit: false },
  library: { view: true, edit: false, notify: false },
  lectures: { view: true, edit: false, notify: false },
  links: { view: true, edit: false },
  gmail: { view: true, edit: false },
  chronicle: { view: true, edit: false },
  polls: { view: true, edit: false },
  ...overrides,
})

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
  isTempPassword?: boolean
  accessRights?: Record<AccessCategory, MemberAccessRight>
  payments?: MemberPayment[]
  // Nova polja iz Excel-a
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
  setSearchTerm: (term: string) => void
  setStatusFilter: (status: string) => void
  setPaymentFilter: (status: string) => void
  setHonoraryFilter: (honorary: boolean) => void
  clearFilters: () => void
  updatePayment: (memberId: number, paymentId: string, updates: Partial<MemberPayment>) => void
  deletePayment: (memberId: number, paymentId: string) => void
  updatePersonalData: (notes: string, todos: { id: string; text: string; done: boolean }[]) => Promise<void>
}

const MembersContext = createContext<MembersContextType | undefined>(undefined)

const initialMembers: Member[] = [
  {
    id: 1,
    name: "Eleanor Lynde",
    email: "e.lynde@archive.org",
    initials: "EL",
    phone: "+44 20 7946 0958",
    birthDate: "17.05.1982",
    address: "12 High Street, London",
    membershipNumber: "174",
    registryNumber: "174",
    status: "active",
    paymentStatus: "paid",
    joinDate: "12 Oct 2018",
    researchAreas: ["Colonial Virginia"],
    additionalAreas: 2,
    functions: [
      { id: generateId(), functionName: "Predsjednik odbora", fromYear: "2022", toYear: "2024" },
      { id: generateId(), functionName: "Edukacijski koordinator", fromYear: "2023", toYear: "2024" },
    ],
    note: "Glavni član tima za digitalizaciju arhiva.",
    avatar: "/placeholder.svg",
    role: "member",
    honorary: false,
    exemptFromPayment: false,
    expelled: false,
    expulsionDate: undefined,
    expulsionReason: undefined,
    deceased: false,
    deathDate: undefined,
    lastPayment: undefined,
    expiry: undefined,
    allPayments: undefined,
    notes: "Glavni član tima za digitalizaciju arhiva.",
    accessRights: createAccessRights(),
  },
  {
    id: 2,
    name: "Julian Montgomery",
    email: "j.monty@familyhistory.net",
    initials: "JM",
    phone: "+44 20 7946 1045",
    birthDate: "03.11.1975",
    address: "34 Fleet Road, London",
    membershipNumber: "102",
    registryNumber: "102",
    status: "expired",
    paymentStatus: "overdue",
    joinDate: "04 Jan 2021",
    researchAreas: ["Viking Age"],
    additionalAreas: 0,
    functions: [
      { id: generateId(), functionName: "Član povjerenstva za članstvo", fromYear: "2021", toYear: "2023" },
    ],
    note: "Planira povratak u aktivno članstvo nakon završetka terenskog istraživanja.",
    avatar: "/placeholder.svg",
    role: "member",
    honorary: false,
    exemptFromPayment: false,
    expelled: false,
    expulsionDate: undefined,
    expulsionReason: undefined,
    deceased: false,
    deathDate: undefined,
    lastPayment: undefined,
    expiry: undefined,
    allPayments: undefined,
    notes: "Planira povratak u aktivno članstvo nakon završetka terenskog istraživanja.",
    accessRights: createAccessRights(),
  },
  {
    id: 3,
    name: "Sarah Whitmore",
    email: "whitmore.s@edu.uk",
    initials: "SW",
    phone: "+44 20 7946 1123",
    birthDate: "08.03.1990",
    address: "67 Pilgrim Lane, Bristol",
    membershipNumber: "221",
    registryNumber: "221",
    status: "active",
    paymentStatus: "paid",
    joinDate: "22 Nov 2015",
    researchAreas: ["Cornish Mining", "Devon"],
    additionalAreas: 0,
    functions: [
      { id: generateId(), functionName: "Urednik newslettera", fromYear: "2020", toYear: "2024" },
    ],
    note: "Voditeljica arhivskog odjela i urednica godišnjeg izvještaja.",
    avatar: "/placeholder.svg",
    role: "member",
    honorary: false,
    exemptFromPayment: false,
    expelled: false,
    expulsionDate: undefined,
    expulsionReason: undefined,
    deceased: false,
    deathDate: undefined,
    lastPayment: undefined,
    expiry: undefined,
    allPayments: undefined,
    notes: "Voditeljica arhivskog odjela i urednica godišnjeg izvještaja.",
    accessRights: createAccessRights(),
  },
  {
    id: 4,
    name: "Robert Kincaid",
    email: "rob.k@heritage.com",
    initials: "RK",
    phone: "+44 20 7946 1234",
    birthDate: "21.09.1987",
    address: "9 Queens Street, Dublin",
    membershipNumber: "314",
    registryNumber: "314",
    status: "active",
    paymentStatus: "paid",
    joinDate: "15 May 2023",
    researchAreas: ["Irish Diaspora"],
    additionalAreas: 0,
    functions: [
      { id: generateId(), functionName: "Koordinator terenskih radionica", fromYear: "2023", toYear: "2025" },
    ],
    note: "Odgovoran za suradnju s međunarodnim arhivima.",
    avatar: "/placeholder.svg",
    role: "member",
    honorary: false,
    exemptFromPayment: false,
    expelled: false,
    expulsionDate: undefined,
    expulsionReason: undefined,
    deceased: false,
    deathDate: undefined,
    lastPayment: undefined,
    expiry: undefined,
    allPayments: undefined,
    notes: "Odgovoran za suradnju s međunarodnim arhivima.",
    accessRights: createAccessRights(),
  },
  {
    id: 5,
    name: "Mary Callahan",
    email: "m.callahan@archives.ie",
    initials: "MC",
    phone: "+44 20 7946 1345",
    birthDate: "14.02.1995",
    address: "5 Abbey Road, Dublin",
    membershipNumber: "401",
    registryNumber: "401",
    status: "pending",
    paymentStatus: "pending",
    joinDate: "02 Feb 2024",
    researchAreas: ["New York City"],
    additionalAreas: 0,
    functions: [],
    payments: [],
    note: "Novo prijavljena članica, trenutno u probnom razdoblju.",
    avatar: "/placeholder.svg",
    role: "member",
    honorary: false,
    exemptFromPayment: false,
    expelled: false,
    expulsionDate: undefined,
    expulsionReason: undefined,
    deceased: false,
    deathDate: undefined,
    lastPayment: undefined,
    expiry: undefined,
    allPayments: undefined,
    notes: "Novo prijavljena članica, trenutno u probnom razdoblju.",
    accessRights: createAccessRights(),
  }
]

export function MembersProvider({ children }: { children: ReactNode }) {
  const [members, setMembers] = useState<Member[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [honoraryFilter, setHonoraryFilter] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const { addLog } = useActivityLog()
  const { user } = useAuth()
  const { settings } = useSettings()

  // Load members from API on mount
  useEffect(() => {
    const loadMembers = async () => {
      try {
        const response = await fetch('/api/members')
        if (response.ok) {
          const loadedMembers = await response.json()
          // Inject missing IDs for older payments and functions so they can be managed/deleted
          const mappedMembers = loadedMembers.map((m: any) => ({
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

    // CRITICAL: Administrator is NOT a member and should never be in the register
    if (user.role === 'admin') return

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
          joinDate: new Date().toLocaleDateString("hr-HR"),
          researchAreas: [],
          additionalAreas: 0,
          payments: [],
          functions: [],
          avatar: user.avatar || '/placeholder.svg'
        }
        await addMember(newMember)
        // Refresh local list
        const resp = await fetch('/api/members')
        if (resp.ok) {
          const updated = await resp.json()
          setMembers(updated)
        }
      }
      createMe()
    }
  }, [isLoaded, user, members.length])

  const derivedMembers = useMemo(() => {
    if (!isLoaded) return []
    return members
      .filter(m => m.role !== 'admin') // Administrator is NOT a member
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
          // Optionally reload members to get the latest DB state, 
          // but local derivedMembers already handles visual sync.
          const { updated } = await response.json()
          if (updated > 0) {
            console.log(`Synchronized ${updated} member statuses.`)
          }
        }
      } catch (error) {
        console.error('Failed to sync member statuses:', error)
      }
    }

    // Debounce or just wait for load
    const timer = setTimeout(syncStatuses, 1000)
    return () => clearTimeout(timer)
  }, [settings.overdueAfterDays, settings.expiredAfterDays, isLoaded])

  const addMember = async (memberData: Omit<Member, 'id'>) => {
    const { status, paymentStatus, status_clana, datum_zadnje_uplate } = computeMemberStates(memberData, settings)
    
    // Do NOT calculate ID on client, let DB handle it
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
        setMembers(prev => [...prev, { ...payload, id } as Member])
      } else {
        const errorText = await response.text();
        console.error('Failed to add member via API:', response.status, errorText);
      }
    } catch (error) {
      console.error('Failed to add member (network error):', error);
    }

    // Log member addition
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

    // Log member update
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
      // First add the payment
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
        details: `Dodana uplata za ${memberToUpdate.name}: ${payment.amount} € na datum ${payment.date}`,
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

    // Optimistic update
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
      // Rollback on error? For simplicity we just log, but in production we'd revert
    }
  }

  const deletePayment = async (memberId: number, paymentId: string) => {
    const member = members.find(m => m.id === memberId)
    if (!member) return

    const updatedPayments = (member.payments ?? []).filter(p => p.id !== paymentId)

    const { status, paymentStatus, status_clana, datum_zadnje_uplate } = computeMemberStates({ ...member, payments: updatedPayments }, settings)

    // Optimistic update
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
    const maxId = Math.max(...members.map(m => m.id), 0)
    const newMembers: Member[] = importedMembers.map((member, index) => {
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
      // Split name into first and last if possible, or just use as is
      const nameParts = member.name.trim().split(/\s+/)
      const firstName = nameParts[0] || ''
      const lastName = nameParts.slice(1).join(' ') || ''

      // Format functions
      const functionsStr = (member.functions || []).map(f => f.functionName).join('; ')

      // Format all payments
      const allPaymentsStr = (member.payments || []).map(p => p.date).join('; ')
      
      const lastPaymentDate = member.payments && member.payments.length > 0 
        ? [...member.payments].sort((a,b) => b.date.localeCompare(a.date))[0].date 
        : (member.lastPayment || '')

      return {
        "Br. Prijave": member.membershipNumber || '',
        "Br. Matice": member.registryNumber || '',
        "Ime": firstName,
        "Prezime": lastName,
        "Datum Rođenja": member.birthDate || '',
        "Email": member.email || '',
        "Telefon": member.phone || '',
        "Adresa": member.address || '',
        "Datum Upisa": member.joinDate || '',
        "Status": member.status === 'active' ? 'Aktivan' : member.status === 'expired' ? 'Neaktivan' : 'Na čekanju',
        "Počasni": member.honorary ? 'Da' : 'Ne',
        "Oslobođen plaćanja": member.exemptFromPayment ? 'Da' : 'Ne',
        "Ispisan/a": member.expelled ? 'Da' : 'Ne',
        "Datum Ispisa": member.expulsionDate || '',
        "Razlog Ispisa": member.expulsionReason || '',
        "Preminuo/la": member.deceased ? 'Da' : 'Ne',
        "Datum Smrti": member.deathDate || '',
        "Zadnja Uplata": lastPaymentDate,
        "Istek": member.expiry || '',
        "Funkcije": functionsStr,
        "Sve Uplate": allPaymentsStr,
        "Bilješke": member.notes || member.note || ''
      }
    })

    const worksheet = XLSX.utils.json_to_sheet(data)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Članovi")
    
    // Generate file and trigger download
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

    // Log member deletion
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
    const matchesSearch = member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || member.status === statusFilter
    const matchesPayment = paymentFilter === 'all' || member.paymentStatus === paymentFilter
    const matchesHonorary = !honoraryFilter || member.honorary === true

    return matchesSearch && matchesStatus && matchesPayment && matchesHonorary
  }).sort((a, b) => {
    // 1. Aktivni članovi (koji nisu preminuli ili ispisani) imaju prioritet
    const aActive = a.status === 'active' && !a.deceased && !a.expelled
    const bActive = b.status === 'active' && !b.deceased && !b.expelled
    
    if (aActive && !bActive) return -1
    if (!aActive && bActive) return 1
    
    // 2. Sortiranje po matičnom broju (uzlazno)
    const aNum = parseInt(a.registryNumber?.replace(/\D/g, '') || '999999', 10)
    const bNum = parseInt(b.registryNumber?.replace(/\D/g, '') || '999999', 10)
    
    if (aNum !== bNum) return aNum - bNum
    
    // 3. Sekundarno sortiranje po imenu
    return a.name.localeCompare(b.name, 'hr-HR')
  })

  return (
    <MembersContext.Provider value={{
      members: derivedMembers,
      rawMembers: members,
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
      setSearchTerm,
      setStatusFilter,
      setPaymentFilter,
      setHonoraryFilter,
      clearFilters: () => { 
        setSearchTerm(''); 
        setStatusFilter('all'); 
        setPaymentFilter('all');
        setHonoraryFilter(false);
      },
      updatePayment,
      deletePayment,
      updatePersonalData: async (notes: string, todos: any[]) => {
        if (!user) return
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