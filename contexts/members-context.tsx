"use client"

import React, { createContext, useContext, useMemo, useState, useEffect, useRef, ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { useActivityLog } from './activity-log-context'
import { useAuth } from './auth-context'
import { useSettings } from './settings-context'
import { computeMemberStates } from '@/lib/member-status'
import { generateId, getMemberActiveFunctions, formatDateDMY } from '@/lib/utils'
import { getMemberActionPermissions } from '@/lib/inquiry-permissions'
import { normalizeMemberDateToIso } from '@/lib/date-validation'

function normalizeMemberDatesForState<T extends Record<string, any>>(data: T): T {
  const next: any = { ...data }
  const dateFields = ['joinDate', 'birthDate', 'expulsionDate', 'deathDate', 'doNotContactDate'] as const
  for (const field of dateFields) {
    if (field in next && next[field] !== undefined && next[field] !== null) {
      next[field] = normalizeMemberDateToIso(next[field])
    }
  }
  if ('payments' in next && Array.isArray(next.payments)) {
    next.payments = next.payments.map((p: any) => {
      if (!p || typeof p !== 'object' || p.date === undefined || p.date === null) return p
      return { ...p, date: normalizeMemberDateToIso(p.date) }
    })
  }
  return next
}

export interface MemberPayment {
  id: string
  date: string
  amount: number
  note?: string
  forYear?: number
}

export interface MemberFunctionAssignment {
  id: string
  functionName: string
  fromYear?: string
  toYear?: string
}

export type AccessCategory =
  | 'members'
  | 'functions'
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
  | 'research_inquiries_zaprimljeno'
  | 'research_inquiries_uradu'
  | 'research_inquiries_zavrseno'
  | 'member_action_zatrazi_dopunu'
  | 'member_action_posalji_pozivnicu'
  | 'member_action_rodjendanske_cestitke'
  | 'member_action_duplikati'
  | 'member_action_krivi_datumi'
  | 'member_action_ciscenje_datuma_uplata'
  | 'member_action_dopuna_podataka'
  | 'member_action_uvezi_clanove'
  | 'member_action_obavijesti_za_placanje'
  | 'member_action_obavijest_tijelima'

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
  landlinePhone?: string
  maidenName?: string
  oib?: string
  birthDate?: string
  birthPlace?: string
  birthCountry?: string
  address?: string
  occupation?: string
  workExperience?: string
  hobbiesSkills?: string
  foreignLanguages?: string
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
  hasPassword?: boolean
  lastLoginAt?: string | null
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
  doNotContact?: boolean
  doNotContactDate?: string
  doNotContactNote?: string
  lastPayment?: string
  expiry?: string
  allPayments?: string
  notes?: string
  password?: string
  datum_zadnje_uplate?: string | null
  status_clana?: 'AKTIVAN' | 'DUG' | 'ISPISAN'
  lastPaymentReminderAt?: string | null
  lastBirthdayEmailAt?: string | null
  lastMissingDataEmailAt?: string | null
  dataFormToken?: string | null
  dataFormViewedAt?: string | null
  dataFormSubmittedAt?: string | null
  dataFormSingleUse?: boolean
  dataFormUpdatedFields?: string[]
  personal_notes?: string
  personal_todos?: { id: string; text: string; done: boolean; priority?: boolean }[]
}

export interface AddMemberResult {
  ok: boolean
  id?: number
  error?: string
  code?: string
  duplicates?: Array<{
    id: number
    name: string
    email?: string
    registryNumber?: string
    membershipNumber?: string
    joinDate?: string
    reasons: string[]
  }>
}

interface MembersContextType {
  members: Member[]
  rawMembers: Member[]
  addMember: (member: Omit<Member, 'id'> & { forceDuplicate?: boolean }) => Promise<AddMemberResult>
  updateMember: (id: number, updates: Partial<Member>) => Promise<{ ok: boolean; error?: string }>
  deleteMember: (id: number) => void
  addPayment: (memberId: number, payment: Omit<MemberPayment, 'id'>) => void
  importMembers: (members: Omit<Member, 'id'>[]) => void
  exportMembers: () => Promise<void>
  getMemberById: (id: number) => Member | undefined
  filteredMembers: Member[]
  searchTerm: string
  statusFilter: string
  paymentFilter: string
  accessFilter: string
  honoraryFilter: boolean
  activeFunctionsOnlyFilter: boolean
  setSearchTerm: (term: string) => void
  setStatusFilter: (status: string) => void
  setPaymentFilter: (status: string) => void
  setAccessFilter: (status: string) => void
  setHonoraryFilter: (honorary: boolean) => void
  setActiveFunctionsOnlyFilter: (activeOnly: boolean) => void
  clearFilters: () => void
  updatePayment: (memberId: number, paymentId: string, updates: Partial<MemberPayment>) => void
  deletePayment: (memberId: number, paymentId: string) => void
  updatePersonalData: (notes: string, todos: { id: string; text: string; done: boolean; priority?: boolean }[]) => Promise<void>
  reloadMembers: () => Promise<void>
  bulkCleanupMembers: (mode: 'clear-payments' | 'clear-join-dates' | 'clear-both' | 'normalize-dates' | 'fill-missing-join-date-2007' | 'recalculate-statuses', memberIds?: number[]) => Promise<number>
  batchUpdateMemberDates: (items: Array<{ id: number; joinDate?: string; birthDate?: string; clearPayments?: boolean }>) => Promise<number>
}

const MembersContext = createContext<MembersContextType | undefined>(undefined)

export function isAdminAccountEntry(m: any): boolean {
  if (!m) return false
  const r = String(m.role || '').trim().toLowerCase()
  const e = String(m.email || '').trim().toLowerCase()
  const n = String(m.name || '').trim().toLowerCase()
  return r === 'admin' || e === 'admin' || n === 'administrator' || n === 'rezervni administrator'
}

function compareMembersByRegistryAndName(a: Member, b: Member): number {
  const aRaw = a.registryNumber || a.membershipNumber || ''
  const bRaw = b.registryNumber || b.membershipNumber || ''
  const aNum = parseInt(aRaw.replace(/\D/g, '') || '999999', 10)
  const bNum = parseInt(bRaw.replace(/\D/g, '') || '999999', 10)
  if (aNum !== bNum) return aNum - bNum
  return a.name.localeCompare(b.name, 'hr-HR')
}

export function MembersProvider({ children }: { children: ReactNode }) {
  const [members, setMembers] = useState<Member[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [accessFilter, setAccessFilter] = useState('all')
  const [honoraryFilter, setHonoraryFilter] = useState(false)
  const [activeFunctionsOnlyFilter, setActiveFunctionsOnlyFilter] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const pathname = usePathname()
  const loadedForUserKeyRef = useRef<string>('')
  const prevStatusRuleRef = useRef<string | null>(null)
  const { addLog } = useActivityLog()
  const { user } = useAuth()
  const { settings, isSettingsLoaded, refreshSettings } = useSettings()

  const reloadMembers = async () => {
    try {
      const response = await fetch('/api/members', { cache: 'no-store' })
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
      }
    } catch (error) {
      console.error('Failed to reload members:', error)
    }
  }

  // Load members only when authenticated and not on public pages or external-only accounts
  useEffect(() => {
    if (
      pathname?.startsWith('/dopuna-podataka') ||
      pathname?.startsWith('/pozivnica') ||
      pathname?.startsWith('/ocjena-istrazivanja')
    ) return

    if (!user) {
      loadedForUserKeyRef.current = ''
      setMembers([])
      setIsLoaded(false)
      return
    }

    if (user.role === 'external') {
      loadedForUserKeyRef.current = `${user.id}:${user.role}`
      setMembers([])
      setIsLoaded(true)
      return
    }

    const userKey = `${user.id}:${user.role}`
    if (loadedForUserKeyRef.current === userKey && isLoaded) return
    loadedForUserKeyRef.current = userKey

    let cancelled = false
    const loadMembers = async () => {
      await reloadMembers()
      if (!cancelled) {
        setIsLoaded(true)
      }
    }

    loadMembers()
    return () => {
      cancelled = true
    }
  }, [user?.id, user?.role, user, pathname, isLoaded])

  // Auto-create member record for logged-in user if not exists
  useEffect(() => {
    if (!isLoaded || !user) return
    if (user.role === 'external') return
    const memberRole = user.role

    // CRITICAL: Administrator is NOT a member and must never be in the register
    if (isAdminAccountEntry(user)) return

    const memberExists = members.some(m => (m.email || '').toLowerCase() === (user.email || '').toLowerCase())
    if (!memberExists) {
      const createMe = async () => {
        const newMember: Omit<Member, 'id'> = {
          name: user.name,
          email: user.email,
          initials: user.name.split(' ').map(n => n[0]).join('').toUpperCase(),
          role: memberRole,
          status: 'active',
          paymentStatus: 'paid',
          joinDate: new Date().toISOString().split('T')[0],
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
        const { status, paymentStatus, status_clana, datum_zadnje_uplate } = computeMemberStates(member, {
          overdueAfterDays: settings.overdueAfterDays,
          expiredAfterDays: settings.expiredAfterDays,
          requirePaymentToBeActive: settings.requirePaymentToBeActive,
        })
        return {
          ...member,
          status,
          paymentStatus,
          status_clana,
          datum_zadnje_uplate,
          joinDate: member.joinDate,
        }
      })
  }, [members, settings.overdueAfterDays, settings.expiredAfterDays, settings.requirePaymentToBeActive, isLoaded])

  // Sync statuses only for admins on real settings rule change or at most once per 12h
  useEffect(() => {
    if (!isLoaded || !isSettingsLoaded || members.length === 0) return

    const ruleKey = `${settings.overdueAfterDays}|${settings.expiredAfterDays}|${Boolean(settings.requirePaymentToBeActive)}`
    const isRuleChange = prevStatusRuleRef.current !== null && prevStatusRuleRef.current !== ruleKey
    prevStatusRuleRef.current = ruleKey

    if (user?.role !== 'admin') return

    const SYNC_INTERVAL_MS = 12 * 60 * 60 * 1000
    const STORAGE_KEY = 'hrd_last_status_sync_ts'
    if (!isRuleChange) {
      try {
        const lastSync = Number(localStorage.getItem(STORAGE_KEY) || 0)
        if (lastSync > 0 && Date.now() - lastSync < SYNC_INTERVAL_MS) {
          return
        }
      } catch {}
    }

    const syncStatuses = async () => {
      try {
        const response = await fetch('/api/members', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'bulk-update-status', settings })
        })
        if (response.ok) {
          try {
            localStorage.setItem(STORAGE_KEY, String(Date.now()))
          } catch {}
          const { updated } = await response.json()
          if (updated > 0) {
            console.log(`Synchronized ${updated} member statuses.`)
          }
        }
      } catch (error) {
        console.error('Failed to sync member statuses:', error)
      }
    }

    const timer = setTimeout(syncStatuses, isRuleChange ? 800 : 5000)
    return () => clearTimeout(timer)
  }, [settings.overdueAfterDays, settings.expiredAfterDays, settings.requirePaymentToBeActive, isLoaded, isSettingsLoaded, user?.role, members.length])

  const addMember = async (memberData: Omit<Member, 'id'> & { forceDuplicate?: boolean }): Promise<AddMemberResult> => {
    if (isAdminAccountEntry(memberData)) return { ok: false, error: 'Administrator se ne može dodati kao član.' }
    const { forceDuplicate, ...cleanMemberData } = memberData
    const normalizedMemberData = normalizeMemberDatesForState(cleanMemberData)
    const { status, paymentStatus, status_clana, datum_zadnje_uplate } = computeMemberStates(normalizedMemberData, settings)

    const payload = {
      ...normalizedMemberData,
      status,
      paymentStatus,
      status_clana,
      datum_zadnje_uplate,
      payments: normalizedMemberData.payments ?? [],
      functions: normalizedMemberData.functions ?? [],
    }

    try {
      const response = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', forceDuplicate: Boolean(forceDuplicate), ...payload })
      })

      const resData = await response.json().catch(() => ({}))

      if (response.ok && resData.id) {
        const syncedMember = {
          ...payload,
          id: resData.id,
          ...(resData.membershipNumber !== undefined ? { membershipNumber: resData.membershipNumber } : {}),
          ...(resData.registryNumber !== undefined ? { registryNumber: resData.registryNumber } : {}),
        } as Member
        setMembers(prev => [...prev, syncedMember])
        if (user) {
          addLog({
            userId: user.id.toString(),
            userName: user.name,
            userRole: user.role,
            action: 'Dodavanje člana',
            details: `Dodan novi član: ${cleanMemberData.name} (${cleanMemberData.email}) sa ulogom ${cleanMemberData.role || 'member'}`,
          })
        }
        return { ok: true, id: resData.id }
      } else {
        console.error('Failed to add member via API:', response.status, resData)
        return {
          ok: false,
          error: resData.error || 'Greška pri dodavanju člana.',
          code: resData.code,
          duplicates: resData.duplicates,
        }
      }
    } catch (error) {
      console.error('Failed to add member (network error):', error)
      return { ok: false, error: 'Mrežna greška pri dodavanju člana.' }
    }
  }

  const updateMember = async (id: number, updates: Partial<Member>): Promise<{ ok: boolean; error?: string }> => {
    const memberToUpdate = members.find(m => m.id === id)
    if (!memberToUpdate) return { ok: false, error: 'Član nije pronađen.' }

    const normalizedUpdates = normalizeMemberDatesForState(updates)
    const { status, paymentStatus, status_clana, datum_zadnje_uplate } = computeMemberStates({ ...memberToUpdate, ...normalizedUpdates }, settings)
    const updatedMember = { ...memberToUpdate, ...normalizedUpdates, status, paymentStatus, status_clana, datum_zadnje_uplate }

    try {
      const response = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', id, ...normalizedUpdates, status, paymentStatus, status_clana, datum_zadnje_uplate })
      })

      const resData = await response.json().catch(() => ({}))
      if (response.ok) {
        const syncedUpdatedMember = {
          ...updatedMember,
          ...(resData.membershipNumber !== undefined ? { membershipNumber: resData.membershipNumber } : {}),
          ...(resData.registryNumber !== undefined ? { registryNumber: resData.registryNumber } : {}),
        }
        setMembers(prev => prev.map(member =>
          member.id === id ? syncedUpdatedMember : member
        ))
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
        return { ok: true }
      } else {
        console.error('Failed to update member via API:', resData)
        return { ok: false, error: resData.error || 'Greška pri ažuriranju člana.' }
      }
    } catch (error) {
      console.error('Failed to update member:', error)
      return { ok: false, error: 'Mrežna greška pri ažuriranju člana.' }
    }
  }

  const addPayment = async (memberId: number, payment: Omit<MemberPayment, 'id'>) => {
    const paymentEntry: MemberPayment = {
      ...payment,
      date: normalizeMemberDateToIso(payment.date),
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
        details: `Dodana uplata za ${memberToUpdate.name}: ${payment.amount} € na datum ${formatDateDMY(payment.date)}${payment.forYear ? ` (za ${payment.forYear}. god.)` : ''}`,
      })
    }
  }

  const updatePayment = async (memberId: number, paymentId: string, updates: Partial<MemberPayment>) => {
    const member = members.find(m => m.id === memberId)
    if (!member) return

    const normalizedUpdates =
      'date' in updates && updates.date !== undefined
        ? { ...updates, date: normalizeMemberDateToIso(updates.date) }
        : updates

    const updatedPayments = (member.payments ?? []).map(p =>
      p.id === paymentId ? { ...p, ...normalizedUpdates } : p
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
        await reloadMembers()
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

    const data = [...derivedMembers].sort(compareMembersByRegistryAndName).map(member => {
      const nameParts = member.name.trim().split(/\s+/)
      const firstName = nameParts[0] || ''
      const lastName = nameParts.slice(1).join(' ') || ''

      const functionsStr = (member.functions || []).map(f => f.functionName).join('; ')
      const allPaymentsStr = (member.payments || [])
        .map(p => `${formatDateDMY(p.date, p.date)}${p.forYear ? ` (za ${p.forYear}.)` : ''}`)
        .join('; ')

      const lastPaymentDate = member.payments && member.payments.length > 0
        ? formatDateDMY([...member.payments].sort((a, b) => b.date.localeCompare(a.date))[0].date, '')
        : (member.lastPayment ? formatDateDMY(member.lastPayment, member.lastPayment) : '')

      return {
        "Br. Prijave": member.membershipNumber || '',
        "Br. Matice": member.registryNumber || '',
        "Ime": firstName,
        "Prezime": lastName,
        "Djevojačko prezime": member.maidenName || '',
        "OIB": member.oib || '',
        "Datum Rođenja": member.birthDate ? formatDateDMY(member.birthDate, member.birthDate) : '',
        "Mjesto rođenja": member.birthPlace || '',
        "Zemlja rođenja": member.birthCountry || '',
        "Email": member.email || '',
        "Mobitel": member.phone || '',
        "Telefon": member.landlinePhone || '',
        "Adresa": member.address || '',
        "Zvanje i zanimanje": member.occupation || '',
        "Radno iskustvo": member.workExperience || '',
        "Hobi/vještine i znanja": member.hobbiesSkills || '',
        "Strani jezici": member.foreignLanguages || '',
        "Lokacije i prezimena koja istražuje": (member.researchAreas || []).join('; '),
        "Datum Upisa": member.joinDate ? formatDateDMY(member.joinDate, member.joinDate) : '',
        "Status": member.status === 'active' ? 'Aktivan' : member.status === 'expired' ? 'Neaktivan' : 'Na čekanju',
        "Počasni": member.honorary ? 'Da' : 'Ne',
        "Oslobođen plaćanja": member.exemptFromPayment ? 'Da' : 'Ne',
        "Ispisan/a": member.expelled ? 'Da' : 'Ne',
        "Datum Ispisa": member.expulsionDate ? formatDateDMY(member.expulsionDate, member.expulsionDate) : '',
        "Razlog Ispisa": member.expulsionReason || '',
        "Preminuo/la": member.deceased ? 'Da' : 'Ne',
        "Datum Smrti": member.deathDate ? formatDateDMY(member.deathDate, member.deathDate) : '',
        "Ne kontaktirati": member.doNotContact ? 'Da' : 'Ne',
        "Datum zabrane kontakta": member.doNotContactDate ? formatDateDMY(member.doNotContactDate, member.doNotContactDate) : '',
        "Napomena zabrane kontakta": member.doNotContactNote || '',
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

  const deferredSearchTerm = React.useDeferredValue(searchTerm)

  const foldCroatianSearch = (val?: string | null): string =>
    String(val || '')
      .toLowerCase()
      .replace(/č|ć/g, 'c')
      .replace(/ž/g, 'z')
      .replace(/š/g, 's')
      .replace(/đ/g, 'd')
      .replace(/\s+/g, ' ')
      .trim()

  const filteredMembers = React.useMemo(() => derivedMembers.filter(member => {
    const activeFns = getMemberActiveFunctions(member)
    const q = deferredSearchTerm.trim().toLowerCase()
    const qFolded = foldCroatianSearch(q)
    const qTokens = qFolded ? qFolded.split(' ').filter(Boolean) : []
    const qDigits = /^\d+$/.test(q) ? String(parseInt(q, 10)) : ''
    const regStr = String(member.registryNumber || '').trim().toLowerCase()
    const memStr = String(member.membershipNumber || '').trim().toLowerCase()
    const regDigits = /^\d+$/.test(regStr) ? String(parseInt(regStr, 10)) : ''
    const memDigits = /^\d+$/.test(memStr) ? String(parseInt(memStr, 10)) : ''

    const combinedSearchableFolded = foldCroatianSearch(
      [
        member.name,
        regStr,
        memStr,
        String(member.id),
        member.maidenName,
        member.oib,
        member.phone,
        member.landlinePhone,
        member.address,
        member.birthPlace,
        member.birthCountry,
        member.occupation,
        member.workExperience,
        member.hobbiesSkills,
        member.foreignLanguages,
        ...(member.researchAreas || []),
        member.email,
        ...activeFns,
      ]
        .filter(Boolean)
        .join(' ')
    )

    const matchesSearch =
      !q ||
      member.name.toLowerCase().includes(q) ||
      regStr.includes(q) ||
      memStr.includes(q) ||
      (qDigits !== '' && (regDigits === qDigits || memDigits === qDigits)) ||
      String(member.id) === q ||
      (member.maidenName || '').toLowerCase().includes(q) ||
      (member.oib || '').toLowerCase().includes(q) ||
      (member.phone || '').toLowerCase().includes(q) ||
      (member.landlinePhone || '').toLowerCase().includes(q) ||
      (member.address || '').toLowerCase().includes(q) ||
      (member.birthPlace || '').toLowerCase().includes(q) ||
      (member.birthCountry || '').toLowerCase().includes(q) ||
      (member.occupation || '').toLowerCase().includes(q) ||
      (member.workExperience || '').toLowerCase().includes(q) ||
      (member.hobbiesSkills || '').toLowerCase().includes(q) ||
      (member.foreignLanguages || '').toLowerCase().includes(q) ||
      (member.researchAreas || []).some(r => r.toLowerCase().includes(q)) ||
      (member.email || '').toLowerCase().includes(q) ||
      activeFns.some(fn => fn.toLowerCase().includes(q)) ||
      (qTokens.length > 0 && qTokens.every((t) => combinedSearchableFolded.includes(t)))

    // Kada je unesena pretraga, uvijek traži kroz SVE članove neovisno o uključenim filterima
    if (q) {
      return matchesSearch
    }

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'do_not_contact'
        ? member.doNotContact === true
        : member.status === statusFilter)
    const matchesPayment = paymentFilter === 'all' || member.paymentStatus === paymentFilter
    const isActivated = Boolean(
      member.lastLoginAt || (member.hasPassword && !member.isTempPassword)
    )
    const accessState = isActivated
      ? 'activated'
      : member.invitationSent
      ? 'invited_pending'
      : 'not_invited'
    const matchesAccess = accessFilter === 'all' || accessState === accessFilter
    const matchesHonorary = !honoraryFilter || member.honorary === true
    const matchesActiveFunctionsOnly = !activeFunctionsOnlyFilter || activeFns.length > 0

    return (
      matchesStatus &&
      matchesPayment &&
      matchesAccess &&
      matchesHonorary &&
      matchesActiveFunctionsOnly
    )
  }).sort(compareMembersByRegistryAndName), [derivedMembers, deferredSearchTerm, statusFilter, paymentFilter, accessFilter, honoraryFilter, activeFunctionsOnlyFilter])

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
      accessFilter,
      honoraryFilter,
      activeFunctionsOnlyFilter,
      setSearchTerm,
      setStatusFilter,
      setPaymentFilter,
      setAccessFilter,
      setHonoraryFilter,
      setActiveFunctionsOnlyFilter,
      clearFilters: () => {
        setSearchTerm('')
        setStatusFilter('active')
        setPaymentFilter('all')
        setAccessFilter('all')
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
      },
      reloadMembers,
      bulkCleanupMembers: async (mode, memberIds) => {
        if (!getMemberActionPermissions(user).ciscenje_datuma_uplata) return 0
        const response = await fetch('/api/members', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'bulk-cleanup',
            adminRole: user?.role,
            actorId: user?.id,
            actorEmail: user?.email,
            mode,
            memberIds,
            settings,
          })
        })
        if (!response.ok) {
          throw new Error('Neuspješno skupno čišćenje članova')
        }
        const data = await response.json()
        await reloadMembers()
        if (user) {
          addLog({
            userId: user.id.toString(),
            userName: user.name,
            userRole: user.role,
            action: 'Admin čišćenje baze članova',
            details: `Izvršena akcija "${mode}" nad ${data.updated ?? 0} članova.`,
          })
        }
        return data.updated ?? 0
      },
      batchUpdateMemberDates: async (items) => {
        if (!getMemberActionPermissions(user).krivi_datumi) return 0
        const response = await fetch('/api/members', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'batch-update-dates',
            adminRole: user?.role,
            actorId: user?.id,
            actorEmail: user?.email,
            items,
            settings,
          })
        })
        if (!response.ok) {
          throw new Error('Neuspješno spremanje datuma članova')
        }
        const data = await response.json()
        await reloadMembers()
        if (user) {
          addLog({
            userId: user.id.toString(),
            userName: user.name,
            userRole: user.role,
            action: 'Skupno uređivanje datuma članova',
            details: `Ažurirani datumi/uplate za ${data.updated ?? 0} članova.`,
          })
        }
        return data.updated ?? 0
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
