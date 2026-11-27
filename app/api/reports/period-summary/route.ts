import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService } from '@/lib/database'
import { getMailcrawlDbPath } from '@/lib/db-path'
import { CHANGELOG_DATA } from '@/lib/changelog-data'
import { computeMemberStates, type MemberPayment } from '@/lib/member-status'
import { getInquiryStatusCategory } from '@/lib/inquiry-permissions'
import { INQUIRY_FEEDBACK_QUESTIONS } from '@/lib/inquiry-feedback'
import fs from 'fs'
import DatabaseConstructor from 'better-sqlite3'
import { getGoogleWorkspaceClients } from '@/lib/google-auth'

const Database = (DatabaseConstructor as any).default || DatabaseConstructor

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

export interface NormalizedReportPayment {
  id: string
  memberId: number
  memberName: string
  registryNumber: string
  date: string // YYYY-MM-DD
  rawDate: string
  amount: number
  note: string
  forYear?: number
  source: 'member_json' | 'payments_table'
}

export interface ReactivatedMemberEntry {
  id: number
  name: string
  email: string
  registryNumber: string
  membershipNumber: string
  previousStatus: string
  previousCategory: 'expelled_inactive' | 'overdue'
  reactivatedAt: string
  previousPaymentDate: string | null
  gapDays: number | null
  paymentAmount: number
  method: 'uplata' | 'rucno'
  reason: string
  currentStatus: string
}

function isAdminRow(m: any): boolean {
  if (!m) return true
  const role = String(m.role || '').trim().toLowerCase()
  const email = String(m.email || '').trim().toLowerCase()
  const name = String(m.name || '').trim().toLowerCase()
  return (
    role === 'admin' ||
    email === 'admin' ||
    name === 'administrator' ||
    name === 'rezervni administrator'
  )
}

function parseAnyDateToIso(raw?: string | null): string | null {
  if (!raw) return null
  const trimmed = String(raw).trim()
  if (!trimmed || trimmed === '-' || trimmed === '—') return null

  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (isoMatch) {
    const y = Number(isoMatch[1])
    const m = Number(isoMatch[2])
    const d = Number(isoMatch[3])
    if (y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    }
  }

  const dmyMatch = trimmed.match(/^(\d{1,2})\s*[./]\s*(\d{1,2})\s*[./]\s*(\d{4})/)
  if (dmyMatch) {
    const d = Number(dmyMatch[1])
    const m = Number(dmyMatch[2])
    const y = Number(dmyMatch[3])
    if (y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    }
  }

  const parsed = new Date(trimmed)
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10)
  }
  return null
}

function extractPaymentAmount(rawAmount: any, rawDate?: string | null, rawNote?: string | null): number {
  const numeric = Number(String(rawAmount ?? '').replace(',', '.'))
  if (Number.isFinite(numeric) && numeric > 0) {
    return Math.round(numeric * 100) / 100
  }
  const sources = [String(rawDate || ''), String(rawNote || '')]
  for (const src of sources) {
    const match = src.match(/(\d+(?:[.,]\d{1,2})?)\s*(?:€|eur\b)/i)
    if (match) {
      const parsed = parseFloat(match[1].replace(',', '.'))
      if (Number.isFinite(parsed) && parsed > 0) {
        return Math.round(parsed * 100) / 100
      }
    }
  }
  return 0
}

function parseDonationAmount(raw: any): number {
  const cleaned = String(raw ?? '0').replace(',', '.').replace(/[^0-9.\-]/g, '')
  const num = parseFloat(cleaned)
  return Number.isFinite(num) ? Math.round(num * 100) / 100 : 0
}

function daysBetweenIso(earlierIso: string, laterIso: string): number {
  const a = new Date(`${earlierIso}T12:00:00Z`).getTime()
  const b = new Date(`${laterIso}T12:00:00Z`).getTime()
  if (isNaN(a) || isNaN(b)) return 0
  return Math.floor((b - a) / (1000 * 60 * 60 * 24))
}

function extractNormalizedMemberPayments(
  member: any,
  sqlPaymentsForMember: any[]
): NormalizedReportPayment[] {
  const memberId = Number(member.id)
  const memberName = String(member.name || `Član #${memberId}`).trim()
  const registryNumber = String(member.registryNumber || member.membershipNumber || '').trim()

  const candidates: NormalizedReportPayment[] = []

  let jsonList: any[] = []
  if (Array.isArray(member.payments)) {
    jsonList = member.payments
  } else if (typeof member.payments === 'string' && member.payments.trim()) {
    try {
      const parsed = JSON.parse(member.payments)
      if (Array.isArray(parsed)) jsonList = parsed
    } catch {}
  }

  for (let idx = 0; idx < jsonList.length; idx++) {
    const p = jsonList[idx]
    if (!p || typeof p !== 'object') continue
    const isoDate = parseAnyDateToIso(p.date)
    if (!isoDate) continue
    const amount = extractPaymentAmount(p.amount, p.date, p.note)
    const note = String(p.note || '').trim() || 'Godišnja članarina'
    const forYear =
      p.forYear !== undefined && p.forYear !== null && String(p.forYear).trim() !== ''
        ? Number(p.forYear)
        : undefined
    candidates.push({
      id: String(p.id || `json-${memberId}-${idx}`),
      memberId,
      memberName,
      registryNumber,
      date: isoDate,
      rawDate: String(p.date || isoDate),
      amount,
      note,
      forYear: Number.isInteger(forYear) ? forYear : undefined,
      source: 'member_json',
    })
  }

  for (const sp of sqlPaymentsForMember) {
    const isoDate = parseAnyDateToIso(sp.date) || parseAnyDateToIso(sp.created_at)
    if (!isoDate) continue
    const amount = extractPaymentAmount(sp.amount, sp.date, sp.note)
    const alreadyExists = candidates.some(
      (c) => c.date === isoDate && Math.abs(c.amount - amount) < 0.01
    )
    if (!alreadyExists) {
      candidates.push({
        id: `sql-${sp.id}`,
        memberId,
        memberName,
        registryNumber,
        date: isoDate,
        rawDate: String(sp.date || isoDate),
        amount,
        note: String(sp.note || '').trim() || 'Godišnja članarina',
        source: 'payments_table',
      })
    }
  }

  // Dedupliciraj uvezene duplikate istog datuma (npr. "16. 09. 2025.: 10€" i "16. 09. 2025." s amount=0)
  const byDate = new Map<string, NormalizedReportPayment[]>()
  for (const item of candidates) {
    const list = byDate.get(item.date) || []
    list.push(item)
    byDate.set(item.date, list)
  }

  const deduped: NormalizedReportPayment[] = []
  for (const [, list] of byDate.entries()) {
    const positiveItems = list.filter((i) => i.amount > 0)
    if (positiveItems.length > 0) {
      for (const pos of positiveItems) {
        deduped.push(pos)
      }
      // Zadrži zapise s 0 € samo ako imaju specifičnu bilješku koja nije generički uvoz
      for (const zero of list) {
        if (
          zero.amount <= 0 &&
          zero.note &&
          !/^(uvezeno|godišnja članarina)$/i.test(zero.note)
        ) {
          deduped.push(zero)
        }
      }
    } else {
      // Ako su svi 0 € za taj datum, zadrži samo jedan zapis (bez dupliciranja)
      deduped.push(list[0])
    }
  }

  return deduped.sort((a, b) => a.date.localeCompare(b.date))
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate') || ''
    const endDate = searchParams.get('endDate') || ''

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Parametri startDate i endDate su obavezni (YYYY-MM-DD).' },
        { status: 400 }
      )
    }

    const dbPath = DatabaseService.getDatabasePath()
    const db = new Database(dbPath, { readonly: true })

    // Postavke pragova statusa članstva
    let overdueAfterDays = 365
    let expiredAfterDays = 730
    let requirePaymentToBeActive = false
    try {
      const sRow = db
        .prepare('SELECT overdueAfterDays, inactiveAfterDays, requirePaymentToBeActive FROM settings WHERE id = 1')
        .get() as any
      if (sRow) {
        if (Number(sRow.overdueAfterDays) > 0) overdueAfterDays = Number(sRow.overdueAfterDays)
        if (Number(sRow.inactiveAfterDays) > 0) expiredAfterDays = Number(sRow.inactiveAfterDays)
        requirePaymentToBeActive = Boolean(sRow.requirePaymentToBeActive)
      }
    } catch {}
    const statusSettings = { overdueAfterDays, expiredAfterDays, requirePaymentToBeActive }

    // Dohvati eventualne uplate iz SQL tablice payments i poveži po memberId
    const sqlPaymentsByMember = new Map<number, any[]>()
    try {
      const sqlPayRows = db.prepare('SELECT id, memberId, date, amount, note, created_at FROM payments').all() as any[]
      for (const sp of sqlPayRows) {
        const mid = Number(sp.memberId)
        if (!Number.isFinite(mid)) continue
        const arr = sqlPaymentsByMember.get(mid) || []
        arr.push(sp)
        sqlPaymentsByMember.set(mid, arr)
      }
    } catch {}

    // Svi ne-admin članovi
    const rawMembers = db.prepare('SELECT * FROM members ORDER BY id ASC').all() as any[]
    const allNonAdminMembers = rawMembers.filter((m) => !isAdminRow(m))

    // Aktivnosti u razdoblju (koristimo za sekciju VIII i za ručne reaktivacije)
    const allPeriodLogs = db
      .prepare(
        `SELECT id, userName, userRole, action, details, timestamp
         FROM activity_logs
         WHERE substr(timestamp, 1, 10) >= ? AND substr(timestamp, 1, 10) <= ?
         ORDER BY id DESC`
      )
      .all(startDate, endDate) as any[]

    // 1. OBRADA ČLANSTVA, NOVIH ČLANOVA, UPLATA I PONOVNO AKTIVIRANIH ČLANOVA
    const newMembers: any[] = []
    const newMemberIds = new Set<number>()
    const periodPayments: NormalizedReportPayment[] = []
    const payingMemberIds = new Set<number>()
    const reactivatedMembers: ReactivatedMemberEntry[] = []
    const reactivatedMemberIds = new Set<number>()
    const memberById = new Map<number, any>()
    const memberByNameLower = new Map<string, any>()

    let activeMembersCount = 0
    let overdueMembersCount = 0
    let inactiveExpelledMembersCount = 0
    let deceasedMembersCount = 0
    let honoraryMembersCount = 0

    const completeness = {
      total: allNonAdminMembers.length,
      withOib: 0,
      withBirthDate: 0,
      withBirthPlace: 0,
      withPhone: 0,
      withAddress: 0,
      withOccupation: 0,
      withWorkExperience: 0,
      withHobbiesSkills: 0,
      withForeignLanguages: 0,
      withResearchAreas: 0,
    }

    const submittedMemberForms: Array<{
      id: number
      name: string
      submittedAt: string
      updatedFields: string[]
    }> = []
    let viewedMemberFormsCount = 0
    let dataRequestsSentCount = 0
    let birthdayEmailsSentCount = 0
    let invitationsSentCount = 0

    for (const m of allNonAdminMembers) {
      const mId = Number(m.id)
      const normalizedPayments = extractNormalizedMemberPayments(
        m,
        sqlPaymentsByMember.get(mId) || []
      )
      const isHonorary = Boolean(m.honorary === 1 || m.honorary === true)
      const isExempt = Boolean(
        m.exemptFromPayment === 1 ||
          m.exemptFromPayment === true ||
          m.exempt_from_payment === 1
      )
      const isExpelled = Boolean(m.expelled === 1 || m.expelled === true)
      const isDeceased = Boolean(m.deceased === 1 || m.deceased === true)

      const memberPaymentsForState: MemberPayment[] = normalizedPayments.map((p) => ({
        id: p.id,
        date: p.date,
        amount: p.amount,
        note: p.note,
        forYear: p.forYear,
      }))

      const liveState = computeMemberStates(
        {
          id: mId,
          name: m.name,
          joinDate: m.joinDate || '',
          payments: memberPaymentsForState,
          deceased: isDeceased,
          expelled: isExpelled,
          honorary: isHonorary,
          exemptFromPayment: isExempt,
          datum_zadnje_uplate: m.datum_zadnje_uplate,
        },
        statusSettings
      )

      memberById.set(mId, { ...m, normalizedPayments, liveState })
      if (m.name) {
        memberByNameLower.set(String(m.name).trim().toLowerCase(), {
          ...m,
          normalizedPayments,
          liveState,
        })
      }

      if (isDeceased) {
        deceasedMembersCount++
      } else {
        if (isHonorary) honoraryMembersCount++
        if (liveState.status === 'expired') {
          inactiveExpelledMembersCount++
        } else if (liveState.paymentStatus === 'overdue') {
          overdueMembersCount++
        } else {
          activeMembersCount++
        }
      }

      // Novi članovi u razdoblju
      const joinIso = parseAnyDateToIso(m.joinDate)
      const createdIso = parseAnyDateToIso(m.created_at)
      const hasRawJoin = Boolean(m.joinDate && String(m.joinDate).trim() !== '' && String(m.joinDate).trim() !== '-')
      const isNewMember =
        (joinIso && joinIso >= startDate && joinIso <= endDate) ||
        (!hasRawJoin &&
          createdIso &&
          createdIso >= startDate &&
          createdIso <= endDate &&
          !isExpelled &&
          !isDeceased &&
          liveState.status === 'active')

      if (isNewMember) {
        newMemberIds.add(mId)
        newMembers.push({
          id: mId,
          name: m.name,
          email: m.email || '',
          phone: m.phone || '',
          registryNumber: m.registryNumber || '',
          membershipNumber: m.membershipNumber || '',
          joinDate: joinIso || createdIso || '',
          created_at: m.created_at,
          status_clana: liveState.status_clana,
        })
      }

      // Uplate članarina u razdoblju
      const paymentsInPeriod = normalizedPayments.filter(
        (p) => p.date >= startDate && p.date <= endDate
      )
      for (const p of paymentsInPeriod) {
        periodPayments.push(p)
        payingMemberIds.add(mId)
      }

      // Signal A za ponovno aktivirane članove: uplata nakon razdoblja neaktivnosti ili duga
      if (!isNewMember && !isDeceased && paymentsInPeriod.length > 0) {
        const firstPeriodPayment = paymentsInPeriod[0]
        const priorPayments = normalizedPayments.filter((p) => p.date < firstPeriodPayment.date)
        const lastPriorPayment =
          priorPayments.length > 0 ? priorPayments[priorPayments.length - 1] : null

        const referenceIso = lastPriorPayment?.date || joinIso || null
        let gapDays: number | null = referenceIso
          ? daysBetweenIso(referenceIso, firstPeriodPayment.date)
          : null

        // Ako postoje prethodne uplate s eksplicitnim `forYear` (npr. plaćeno za 2024), pokriće vrijedi od 01.01. te godine
        if (lastPriorPayment?.forYear) {
          const forYearIso = `${lastPriorPayment.forYear}-01-01`
          const fyGap = daysBetweenIso(forYearIso, firstPeriodPayment.date)
          gapDays = Math.min(gapDays ?? fyGap, fyGap)
        }

        const isRecentlyJoined = Boolean(
          !lastPriorPayment &&
            joinIso &&
            daysBetweenIso(joinIso, firstPeriodPayment.date) <= overdueAfterDays
        )

        if (!isRecentlyJoined && !isHonorary && !isExempt) {
          let previousCategory: 'expelled_inactive' | 'overdue' | null = null
          let previousStatus = ''

          if (gapDays === null) {
            // Član bez ranijeg datuma uplate ni datuma upisa, a nije novi -> bio bez evidentiranih uplata / neaktivan
            previousCategory = 'expelled_inactive'
            previousStatus = 'Neaktivan / Bez prijašnjih uplata'
          } else if (gapDays > expiredAfterDays) {
            previousCategory = 'expelled_inactive'
            previousStatus = 'Ispisan / Neaktivan'
          } else if (gapDays > overdueAfterDays) {
            previousCategory = 'overdue'
            previousStatus = 'Neaktivan (Dug članarine)'
          }

          if (previousCategory) {
            reactivatedMemberIds.add(mId)
            reactivatedMembers.push({
              id: mId,
              name: m.name,
              email: m.email || '',
              registryNumber: m.registryNumber || '',
              membershipNumber: m.membershipNumber || '',
              previousStatus,
              previousCategory,
              reactivatedAt: firstPeriodPayment.date,
              previousPaymentDate: lastPriorPayment?.date || null,
              gapDays,
              paymentAmount: firstPeriodPayment.amount,
              method: 'uplata',
              reason: lastPriorPayment
                ? `Ponovna uplata nakon ${gapDays} dana (prethodna uplata: ${lastPriorPayment.date})`
                : joinIso
                ? `Uplata nakon ${gapDays} dana od upisa (${joinIso})`
                : 'Ponovna uplata nakon statusa bez evidencije uplata',
              currentStatus: liveState.status_clana,
            })
          }
        }
      }

      // Popunjenost matične knjige & forme
      if (String(m.oib || '').trim()) completeness.withOib++
      if (String(m.birthDate || '').trim()) completeness.withBirthDate++
      if (String(m.birth_place || '').trim()) completeness.withBirthPlace++
      if (String(m.phone || m.landline_phone || '').trim()) completeness.withPhone++
      if (String(m.address || '').trim()) completeness.withAddress++
      if (String(m.occupation || '').trim()) completeness.withOccupation++
      if (String(m.work_experience || '').trim()) completeness.withWorkExperience++
      if (String(m.hobbies_skills || '').trim()) completeness.withHobbiesSkills++
      if (String(m.foreign_languages || '').trim()) completeness.withForeignLanguages++
      const rAreas = m.researchAreas || m.research_areas || ''
      if (String(rAreas).replace(/[\[\]"\s]/g, '').length > 0) completeness.withResearchAreas++

      const subDate = m.data_form_submitted_at ? String(m.data_form_submitted_at).slice(0, 10) : ''
      if (subDate && subDate >= startDate && subDate <= endDate) {
        let parsedFields: string[] = []
        try {
          parsedFields = m.data_form_updated_fields ? JSON.parse(m.data_form_updated_fields) : []
        } catch {}
        submittedMemberForms.push({
          id: mId,
          name: m.name,
          submittedAt: m.data_form_submitted_at,
          updatedFields: Array.isArray(parsedFields) ? parsedFields : [],
        })
      }

      const viewDate = m.data_form_viewed_at ? String(m.data_form_viewed_at).slice(0, 10) : ''
      if (viewDate && viewDate >= startDate && viewDate <= endDate) viewedMemberFormsCount++

      const reqDate = m.last_missing_data_email_at ? String(m.last_missing_data_email_at).slice(0, 10) : ''
      if (reqDate && reqDate >= startDate && reqDate <= endDate) dataRequestsSentCount++

      const bdayDate = m.last_birthday_email_at ? String(m.last_birthday_email_at).slice(0, 10) : ''
      if (bdayDate && bdayDate >= startDate && bdayDate <= endDate) birthdayEmailsSentCount++

      const invDate = m.invitation_sent_at ? String(m.invitation_sent_at).slice(0, 10) : ''
      if (invDate && invDate >= startDate && invDate <= endDate) invitationsSentCount++
    }

    // Signal B za ponovno aktivirane članove: ručne promjene statusa u activity_logs
    for (const log of allPeriodLogs) {
      const act = String(log.action || '')
      const det = String(log.details || '')
      if (!act.match(/član|clan|status|reaktiv|obnov/i)) continue

      const fromExpelled =
        /expelled:\s*true\s*→\s*false/i.test(det) ||
        /status:\s*(?:expired|inactive)\s*→\s*active/i.test(det) ||
        /status_clana:\s*ISPISAN\s*→\s*AKTIVAN/i.test(det)
      const fromOverdue =
        /status_clana:\s*DUG\s*→\s*AKTIVAN/i.test(det) ||
        /paymentStatus:\s*overdue\s*→\s*paid/i.test(det)

      if (!fromExpelled && !fromOverdue) continue

      const nameMatch = det.match(/Ažuriran član\s+([^:]+):/i)
      const matchedName = nameMatch ? nameMatch[1].trim().toLowerCase() : ''
      const foundMember = matchedName ? memberByNameLower.get(matchedName) : null
      if (!foundMember) continue

      const fId = Number(foundMember.id)
      if (newMemberIds.has(fId) || reactivatedMemberIds.has(fId)) continue
      if (foundMember.deceased) continue

      reactivatedMemberIds.add(fId)
      reactivatedMembers.push({
        id: fId,
        name: foundMember.name,
        email: foundMember.email || '',
        registryNumber: foundMember.registryNumber || '',
        membershipNumber: foundMember.membershipNumber || '',
        previousStatus: fromExpelled ? 'Ispisan / Neaktivan' : 'Neaktivan (Dug članarine)',
        previousCategory: fromExpelled ? 'expelled_inactive' : 'overdue',
        reactivatedAt: String(log.timestamp || '').slice(0, 10) || startDate,
        previousPaymentDate: foundMember.liveState?.datum_zadnje_uplate || null,
        gapDays: null,
        paymentAmount: 0,
        method: 'rucno',
        reason: fromExpelled
          ? 'Ručna reaktivacija statusa člana (Ispisan → Aktivan)'
          : 'Ručna reaktivacija statusa članarine (Dug → Aktivan)',
        currentStatus: foundMember.liveState?.status_clana || 'AKTIVAN',
      })
    }

    periodPayments.sort((a, b) => a.date.localeCompare(b.date))
    reactivatedMembers.sort((a, b) => a.reactivatedAt.localeCompare(b.reactivatedAt))

    const paymentsTotalAmount =
      Math.round(periodPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0) * 100) / 100
    const reactivatedFromInactiveCount = reactivatedMembers.filter(
      (r) => r.previousCategory === 'expelled_inactive'
    ).length
    const reactivatedFromOverdueCount = reactivatedMembers.filter(
      (r) => r.previousCategory === 'overdue'
    ).length

    // 3. DONACIJE (iz mailcrawl.db ako postoji)
    let donations: any[] = []
    let donationsTotalAmount = 0
    let memberDonationsCount = 0
    let memberDonationsTotalAmount = 0
    let externalDonationsCount = 0
    let externalDonationsTotalAmount = 0

    const mailcrawlDbPath = getMailcrawlDbPath()
    if (fs.existsSync(mailcrawlDbPath)) {
      try {
        const mcDb = new Database(mailcrawlDbPath, { readonly: true })
        const leadCols = new Set(
          (mcDb.prepare('PRAGMA table_info(leads)').all() as Array<{ name: string }>).map((c) => c.name)
        )
        const selectMemberId = leadCols.has('member_id') ? 'member_id' : 'NULL AS member_id'
        const rawDonations = mcDb
          .prepare(
            `SELECT id, ${selectMemberId}, name, entity_type, donated_amount, donated_at, donation_note, city, email
             FROM leads
             WHERE donated_at IS NOT NULL AND TRIM(donated_at) != ''`
          )
          .all() as any[]

        donations = rawDonations
          .map((d) => {
            const iso = parseAnyDateToIso(d.donated_at)
            const amt = parseDonationAmount(d.donated_amount)
            return {
              ...d,
              donated_at: iso || d.donated_at,
              donated_amount: amt,
              isMemberDonor: Boolean(d.member_id || String(d.entity_type || '').toLowerCase() === 'clan'),
            }
          })
          .filter((d) => {
            const iso = parseAnyDateToIso(d.donated_at)
            return Boolean(iso && iso >= startDate && iso <= endDate)
          })
          .sort((a, b) => String(a.donated_at).localeCompare(String(b.donated_at)))

        for (const d of donations) {
          const amt = Number(d.donated_amount) || 0
          donationsTotalAmount += amt
          if (d.isMemberDonor) {
            memberDonationsCount++
            memberDonationsTotalAmount += amt
          } else {
            externalDonationsCount++
            externalDonationsTotalAmount += amt
          }
        }
        donationsTotalAmount = Math.round(donationsTotalAmount * 100) / 100
        memberDonationsTotalAmount = Math.round(memberDonationsTotalAmount * 100) / 100
        externalDonationsTotalAmount = Math.round(externalDonationsTotalAmount * 100) / 100
        mcDb.close()
      } catch (mcErr) {
        console.warn('[Report] Error reading donations from mailcrawl.db:', mcErr)
      }
    }

    // 4. SJEDNICE I GLASOVANJA
    const rawMeetings = db
      .prepare(
        `SELECT id, title, type, date, start_time, location, attendee_ids, external_attendees, status
         FROM meetings
         WHERE date IS NOT NULL`
      )
      .all() as any[]
    const meetings = rawMeetings
      .map((m) => ({ ...m, _isoDate: parseAnyDateToIso(m.date) }))
      .filter((m) => m._isoDate && m._isoDate >= startDate && m._isoDate <= endDate)
      .sort((a, b) => String(a._isoDate).localeCompare(String(b._isoDate)))

    // 5. PREDAVANJA I DRUŽENJA
    const rawLectures = db
      .prepare(
        `SELECT id, title, type, date, start_time, location, host, attendee_ids, external_attendees, status
         FROM lectures
         WHERE date IS NOT NULL`
      )
      .all() as any[]
    const lectures = rawLectures
      .map((l) => ({ ...l, _isoDate: parseAnyDateToIso(l.date) }))
      .filter((l) => l._isoDate && l._isoDate >= startDate && l._isoDate <= endDate)
      .sort((a, b) => String(a._isoDate).localeCompare(String(b._isoDate)))

    // 5c. PROJEKTI, RODOSLOVNI UPITI, KNJIŽNICA, GLASOVANJA
    let periodProjects: any[] = []
    try {
      periodProjects = db
        .prepare(
          `SELECT id, title, description, status, progress, lead_member_name, created_at
           FROM projects
           ORDER BY id DESC`
        )
        .all() as any[]
    } catch {}
    const activeProjectsCount = periodProjects.filter(
      (p) => !['completed', 'završeno', 'archived'].includes(String(p.status || '').toLowerCase())
    ).length

    let periodInquiries: any[] = []
    let forwardedInquiriesCount = 0
    let completedInquiriesCount = 0
    let activeInProgressInquiriesCount = 0
    let unassignedInquiriesCount = 0
    let inProgressInquiriesCount = 0
    const inquiriesByResearcher: Array<{
      researcherId: number | null
      researcherName: string
      totalAssigned: number
      inProgressCount: number
      completedCount: number
      inquiries: Array<{
        id: number
        subject: string
        requester_name: string
        inquiry_date: string
        status: string
        stage: 'zaprimljeno' | 'uradu' | 'zavrseno'
        statusLabel: string
      }>
    }> = []

    const inquiryFeedbackReport: {
      totalSent: number
      sentInPeriodCount: number
      totalOpened: number
      totalSubmitted: number
      submittedInPeriodCount: number
      responseRatePct: number
      overallAverage: number
      questionAverages: Array<{
        key: string
        shortTitle: string
        average: number
        count: number
      }>
      financialSupport: {
        da: number
        mozda: number
        ne: number
        bezOdgovora: number
        paymentInfoSentCount: number
      }
      items: Array<{
        id: number
        inquiry_id: number
        subject: string
        requester_name: string
        researcher_name: string
        sent_at: string | null
        submitted_at: string | null
        average_rating: number | null
        financial_support: string | null
        payment_info_sent_at: string | null
        comment: string | null
      }>
    } = {
      totalSent: 0,
      sentInPeriodCount: 0,
      totalOpened: 0,
      totalSubmitted: 0,
      submittedInPeriodCount: 0,
      responseRatePct: 0,
      overallAverage: 0,
      questionAverages: INQUIRY_FEEDBACK_QUESTIONS.map((q) => ({
        key: q.key,
        shortTitle: q.shortTitle,
        average: 0,
        count: 0,
      })),
      financialSupport: {
        da: 0,
        mozda: 0,
        ne: 0,
        bezOdgovora: 0,
        paymentInfoSentCount: 0,
      },
      items: [],
    }

    const feedbackByInquiryId = new Map<number, any>()

    try {
      const hasInqTable = Boolean(
        db
          .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'research_inquiries'")
          .get()
      )
      const hasFbTable = Boolean(
        db
          .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'inquiry_feedback'")
          .get()
      )

      if (hasFbTable) {
        const fbCols = new Set(
          (db.prepare('PRAGMA table_info(inquiry_feedback)').all() as Array<{ name: string }>).map(
            (c) => c.name
          )
        )
        const paySentAtExpr = fbCols.has('payment_info_sent_at')
          ? 'f.payment_info_sent_at'
          : 'NULL AS payment_info_sent_at'
        const allFbRows = db
          .prepare(
            `SELECT
              f.id, f.inquiry_id, f.sent_at, f.opened_at, f.submitted_at,
              f.rating_overall, f.rating_clarity, f.rating_communication,
              f.rating_timeliness, f.rating_recommendation, f.average_rating,
              f.financial_support, f.comment, ${paySentAtExpr},
              ri.subject AS inquiry_subject, ri.requester_name AS inquiry_requester_name,
              ri.assigned_to_name AS inquiry_researcher_name, ri.inquiry_date AS inquiry_date
             FROM inquiry_feedback f
             LEFT JOIN research_inquiries ri ON ri.id = f.inquiry_id
             ORDER BY COALESCE(f.submitted_at, f.sent_at, f.created_at) DESC, f.id DESC`
          )
          .all() as any[]

        for (const fb of allFbRows) {
          feedbackByInquiryId.set(Number(fb.inquiry_id), fb)
        }
      }

      if (hasInqTable) {
        const inqCols = new Set(
          (db.prepare('PRAGMA table_info(research_inquiries)').all() as Array<{ name: string }>).map(
            (c) => c.name
          )
        )
        const selectFields = [
          'id',
          'requester_name',
          'subject',
          'status',
          inqCols.has('assigned_to_id') ? 'assigned_to_id' : 'NULL AS assigned_to_id',
          'assigned_to_name',
          inqCols.has('assigned_date') ? 'assigned_date' : 'NULL AS assigned_date',
          'inquiry_date',
          'created_at',
          inqCols.has('email_logs') ? 'email_logs' : 'NULL AS email_logs',
        ]
        const rawInq = db
          .prepare(`SELECT ${selectFields.join(', ')} FROM research_inquiries ORDER BY id DESC`)
          .all() as any[]

        const filteredRawInq = rawInq.filter((inq) => {
          const dIso = parseAnyDateToIso(inq.inquiry_date) || parseAnyDateToIso(inq.created_at)
          return Boolean(dIso && dIso >= startDate && dIso <= endDate)
        })

        const researcherMap = new Map<
          string,
          {
            researcherId: number | null
            researcherName: string
            totalAssigned: number
            inProgressCount: number
            completedCount: number
            inquiries: Array<{
              id: number
              subject: string
              requester_name: string
              inquiry_date: string
              status: string
              stage: 'zaprimljeno' | 'uradu' | 'zavrseno'
              statusLabel: string
            }>
          }
        >()

        periodInquiries = filteredRawInq.map((inq) => {
          const stage = getInquiryStatusCategory(inq.status)
          const rawAssignedId =
            inq.assigned_to_id !== null &&
            inq.assigned_to_id !== undefined &&
            String(inq.assigned_to_id).trim() !== '' &&
            Number(inq.assigned_to_id) > 0
              ? Number(inq.assigned_to_id)
              : null
          const rawAssignedName = String(inq.assigned_to_name || '').trim()

          let forwardedViaEmail = false
          if (inq.email_logs) {
            try {
              const logsArr =
                typeof inq.email_logs === 'string' ? JSON.parse(inq.email_logs) : inq.email_logs
              if (Array.isArray(logsArr)) {
                forwardedViaEmail = logsArr.some(
                  (el: any) => String(el?.type || '').toLowerCase() === 'to_researcher'
                )
              }
            } catch {}
          }

          const hasResearcher = Boolean(rawAssignedId || rawAssignedName)
          const isForwarded = hasResearcher || forwardedViaEmail
          const statusLabel =
            stage === 'zavrseno'
              ? 'Završeno'
              : stage === 'uradu'
              ? 'U postupku (u radu)'
              : isForwarded
              ? 'U postupku (dodijeljeno)'
              : 'U postupku (čeka dodjelu)'

          if (isForwarded) forwardedInquiriesCount++
          if (stage === 'zavrseno') completedInquiriesCount++
          else if (stage === 'uradu') activeInProgressInquiriesCount++
          else unassignedInquiriesCount++

          if (isForwarded) {
            const displayResearcherName = rawAssignedName || 'Dodijeljeni istraživač'
            const key = rawAssignedId
              ? `id:${rawAssignedId}`
              : `name:${displayResearcherName.toLowerCase()}`
            let group = researcherMap.get(key)
            if (!group) {
              group = {
                researcherId: rawAssignedId,
                researcherName: displayResearcherName,
                totalAssigned: 0,
                inProgressCount: 0,
                completedCount: 0,
                inquiries: [],
              }
              researcherMap.set(key, group)
            }
            group.totalAssigned++
            if (stage === 'zavrseno') group.completedCount++
            else group.inProgressCount++
            group.inquiries.push({
              id: Number(inq.id),
              subject: inq.subject || '—',
              requester_name: inq.requester_name || '—',
              inquiry_date:
                parseAnyDateToIso(inq.inquiry_date) || parseAnyDateToIso(inq.created_at) || '',
              status: inq.status || 'unassigned',
              stage,
              statusLabel,
            })
          }

          const fb = feedbackByInquiryId.get(Number(inq.id))
          return {
            id: inq.id,
            requester_name: inq.requester_name,
            subject: inq.subject,
            status: inq.status,
            stage,
            statusLabel,
            assigned_to_id: rawAssignedId,
            assigned_to_name: rawAssignedName || null,
            assigned_date: inq.assigned_date || null,
            isForwarded,
            inquiry_date: inq.inquiry_date,
            created_at: inq.created_at,
            feedback: fb
              ? {
                  sent_at: fb.sent_at || null,
                  submitted_at: fb.submitted_at || null,
                  average_rating:
                    typeof fb.average_rating === 'number'
                      ? Number(fb.average_rating.toFixed(2))
                      : null,
                  financial_support: fb.financial_support || null,
                  payment_info_sent_at: fb.payment_info_sent_at || null,
                }
              : null,
          }
        })

        inProgressInquiriesCount = activeInProgressInquiriesCount + unassignedInquiriesCount

        inquiriesByResearcher.push(
          ...Array.from(researcherMap.values()).sort(
            (a, b) =>
              b.totalAssigned - a.totalAssigned ||
              a.researcherName.localeCompare(b.researcherName, 'hr')
          )
        )
      }

      if (hasFbTable) {
        const periodInquiryIds = new Set(periodInquiries.map((inq) => Number(inq.id)))
        const fbValues = Array.from(feedbackByInquiryId.values())
        const relevantFb = fbValues.filter((fb) => {
          const sentIso = parseAnyDateToIso(fb.sent_at)
          const subIso = parseAnyDateToIso(fb.submitted_at)
          const inBySent = Boolean(sentIso && sentIso >= startDate && sentIso <= endDate)
          const inBySub = Boolean(subIso && subIso >= startDate && subIso <= endDate)
          const inByInq = periodInquiryIds.has(Number(fb.inquiry_id))
          return inBySent || inBySub || inByInq
        })

        let ratingSum = 0
        let ratingCount = 0
        const qSums = new Map<string, { sum: number; count: number }>()
        for (const q of INQUIRY_FEEDBACK_QUESTIONS) {
          qSums.set(q.key, { sum: 0, count: 0 })
        }

        for (const fb of relevantFb) {
          const sentIso = parseAnyDateToIso(fb.sent_at)
          const subIso = parseAnyDateToIso(fb.submitted_at)
          if (fb.sent_at) inquiryFeedbackReport.totalSent++
          if (sentIso && sentIso >= startDate && sentIso <= endDate) {
            inquiryFeedbackReport.sentInPeriodCount++
          }
          if (fb.opened_at) inquiryFeedbackReport.totalOpened++
          if (fb.submitted_at) {
            inquiryFeedbackReport.totalSubmitted++
            if (subIso && subIso >= startDate && subIso <= endDate) {
              inquiryFeedbackReport.submittedInPeriodCount++
            }
            const avgVal =
              typeof fb.average_rating === 'number' && fb.average_rating > 0
                ? fb.average_rating
                : null
            if (avgVal !== null) {
              ratingSum += avgVal
              ratingCount++
            }
            for (const q of INQUIRY_FEEDBACK_QUESTIONS) {
              const val = Number(fb[q.key])
              if (val >= 1 && val <= 5) {
                const entry = qSums.get(q.key)!
                entry.sum += val
                entry.count++
              }
            }
            const sup = String(fb.financial_support || '').trim().toLowerCase()
            if (sup === 'da') inquiryFeedbackReport.financialSupport.da++
            else if (sup === 'mozda') inquiryFeedbackReport.financialSupport.mozda++
            else if (sup === 'ne') inquiryFeedbackReport.financialSupport.ne++
            else inquiryFeedbackReport.financialSupport.bezOdgovora++
          }
          if (fb.payment_info_sent_at) {
            inquiryFeedbackReport.financialSupport.paymentInfoSentCount++
          }

          inquiryFeedbackReport.items.push({
            id: Number(fb.id),
            inquiry_id: Number(fb.inquiry_id),
            subject: fb.inquiry_subject || `Upit #${fb.inquiry_id}`,
            requester_name: fb.inquiry_requester_name || '—',
            researcher_name: fb.inquiry_researcher_name || '—',
            sent_at: fb.sent_at || null,
            submitted_at: fb.submitted_at || null,
            average_rating:
              typeof fb.average_rating === 'number' ? Number(fb.average_rating.toFixed(2)) : null,
            financial_support: fb.financial_support || null,
            payment_info_sent_at: fb.payment_info_sent_at || null,
            comment: fb.comment || null,
          })
        }

        inquiryFeedbackReport.responseRatePct =
          inquiryFeedbackReport.totalSent > 0
            ? Math.min(
                100,
                Math.round(
                  (inquiryFeedbackReport.totalSubmitted / inquiryFeedbackReport.totalSent) * 100
                )
              )
            : 0
        inquiryFeedbackReport.overallAverage =
          ratingCount > 0 ? Number((ratingSum / ratingCount).toFixed(2)) : 0
        inquiryFeedbackReport.questionAverages = INQUIRY_FEEDBACK_QUESTIONS.map((q) => {
          const entry = qSums.get(q.key) || { sum: 0, count: 0 }
          return {
            key: q.key,
            shortTitle: q.shortTitle,
            average: entry.count > 0 ? Number((entry.sum / entry.count).toFixed(2)) : 0,
            count: entry.count,
          }
        })
      }
    } catch (inqErr) {
      console.warn('[Report] Error reading inquiries/feedback summary:', inqErr)
    }

    let periodBooks: any[] = []
    let periodJournals: any[] = []
    try {
      periodBooks = db
        .prepare(
          `SELECT id, naslov as title, autor as author, godina as year, is_scanned, is_digitized, created_at
           FROM library_books
           WHERE substr(created_at, 1, 10) >= ? AND substr(created_at, 1, 10) <= ?
           ORDER BY id DESC`
        )
        .all(startDate, endDate) as any[]
      periodJournals = db
        .prepare(
          `SELECT id, naslov as title, izdavac as publisher, svesci as issue, podrucje as category, created_at
           FROM library_journals
           WHERE substr(created_at, 1, 10) >= ? AND substr(created_at, 1, 10) <= ?
           ORDER BY id DESC`
        )
        .all(startDate, endDate) as any[]
    } catch {}

    let periodVotes: any[] = []
    try {
      const rawVotes = db
        .prepare(
          `SELECT id, title, description, options, status, created_at
           FROM votes
           WHERE substr(created_at, 1, 10) >= ? AND substr(created_at, 1, 10) <= ?
           ORDER BY id DESC`
        )
        .all(startDate, endDate) as any[]
      periodVotes = rawVotes.map((v) => {
        let totalCast = 0
        try {
          const r = db.prepare('SELECT COUNT(*) as c FROM vote_results WHERE vote_id = ?').get(v.id) as any
          totalCast = r?.c || 0
        } catch {}
        return { ...v, totalCast }
      })
    } catch {}

    // 5d. PROMJENE I NADOGRADNJE U APLIKACIJI
    const appChangesInPeriod = CHANGELOG_DATA.filter((entry) => {
      const m = entry.dateLabel.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
      if (!m) return false
      const iso = `${m[3]}-${m[2]}-${m[1]}`
      return iso >= startDate && iso <= endDate
    })

    // 6. E-MAIL KOMUNIKACIJA & OPOMENE
    let mailSendersStats: any[] = []
    try {
      mailSendersStats = db
        .prepare(
          `SELECT user_name, user_role, COUNT(*) as count, action_type
           FROM mail_senders
           WHERE substr(created_at, 1, 10) >= ? AND substr(created_at, 1, 10) <= ?
           GROUP BY user_name, action_type
           ORDER BY count DESC`
        )
        .all(startDate, endDate) as any[]
    } catch {}

    const internalSentRow = db
      .prepare(
        `SELECT COUNT(*) as internalSentCount
         FROM mail_senders
         WHERE substr(created_at, 1, 10) >= ? AND substr(created_at, 1, 10) <= ?`
      )
      .get(startDate, endDate) as any

    const paymentRemindersCountRow = db
      .prepare(
        `SELECT COUNT(*) as reminderCount
         FROM activity_logs
         WHERE (action LIKE '%podsjetnik%' OR action LIKE '%opomen%' OR action LIKE '%Obavijest o članarini%')
           AND substr(timestamp, 1, 10) >= ? AND substr(timestamp, 1, 10) <= ?`
      )
      .get(startDate, endDate) as any

    // 7. GMAIL API STATISTIKA
    let gmailStats = {
      connected: false,
      mailbox: null as string | null,
      receivedEmailsCount: 0,
      sentEmailsCount: 0,
      note: '',
    }

    try {
      const { gmail, targetEmail } = getGoogleWorkspaceClients({ requireTargetEmail: false })
      gmailStats.connected = true
      gmailStats.mailbox = targetEmail || null

      const startEpochSec = Math.floor(new Date(`${startDate}T00:00:00Z`).getTime() / 1000)
      const endEpochSec = Math.floor(new Date(`${endDate}T23:59:59Z`).getTime() / 1000)

      const sentRes = await gmail.users.messages
        .list({
          userId: 'me',
          q: `in:sent after:${startEpochSec} before:${endEpochSec + 86400}`,
          maxResults: 500,
          includeSpamTrash: false,
        })
        .catch(() => null)
      if (sentRes?.data) {
        gmailStats.sentEmailsCount = sentRes.data.messages?.length || sentRes.data.resultSizeEstimate || 0
      }

      const receivedRes = await gmail.users.messages
        .list({
          userId: 'me',
          q: `-in:sent -in:trash -in:spam after:${startEpochSec} before:${endEpochSec + 86400}`,
          maxResults: 500,
          includeSpamTrash: false,
        })
        .catch(() => null)
      if (receivedRes?.data) {
        gmailStats.receivedEmailsCount =
          receivedRes.data.messages?.length || receivedRes.data.resultSizeEstimate || 0
      }
    } catch (gErr: any) {
      gmailStats.note = gErr?.message || 'Google Workspace / Gmail API nije povezan.'
    }

    // 8. SAŽETAK AKTIVNOSTI IZ LOGOVA
    const categorizeAction = (action: string, details: string): string => {
      const text = `${action || ''} ${details || ''}`.toLowerCase()
      if (text.match(/član|clan|uplata|članarin|clanarin|opomen/)) {
        return 'Članstvo i evidencija članarina'
      }
      if (text.match(/mail|poruk|kampanj|donacij|poziv/)) {
        return 'E-pošta, donacije i komunikacija'
      }
      if (text.match(/istraživ|istraziv|upit|projekt|zadat/)) {
        return 'Upiti, istraživanja i projekti'
      }
      if (text.match(/sjednic|sastan|predavanj|arhiv|knjižnic|knjiznic|kronik|anket|dokument|drive/)) {
        return 'Sjednice, predavanja, arhiva i dokumenti'
      }
      return 'Sustav, administracija i prijave'
    }

    const userMap = new Map<
      string,
      {
        userName: string
        userRole: string
        totalCount: number
        lastTimestamp: string
        actionsMap: Map<string, number>
      }
    >()

    const actionMap = new Map<
      string,
      {
        action: string
        category: string
        count: number
        usersSet: Set<string>
        firstTimestamp: string
        lastTimestamp: string
        sampleDetails: string
      }
    >()

    const categoryMap = new Map<
      string,
      {
        category: string
        count: number
        uniqueActionsCount: number
        actionsSet: Set<string>
      }
    >()

    for (const log of allPeriodLogs) {
      const uName = (log.userName || 'Sustav').trim()
      const uRole = (log.userRole || '').trim()
      const act = (log.action || 'Aktivnost u sustavu').trim()
      const det = (log.details || '').trim()
      const ts = log.timestamp || ''
      const cat = categorizeAction(act, det)

      const existingUser = userMap.get(uName)
      if (!existingUser) {
        const aMap = new Map<string, number>()
        aMap.set(act, 1)
        userMap.set(uName, {
          userName: uName,
          userRole: uRole,
          totalCount: 1,
          lastTimestamp: ts,
          actionsMap: aMap,
        })
      } else {
        existingUser.totalCount += 1
        if (ts > existingUser.lastTimestamp) existingUser.lastTimestamp = ts
        if (!existingUser.userRole && uRole) existingUser.userRole = uRole
        existingUser.actionsMap.set(act, (existingUser.actionsMap.get(act) || 0) + 1)
      }

      const existingAction = actionMap.get(act)
      if (!existingAction) {
        actionMap.set(act, {
          action: act,
          category: cat,
          count: 1,
          usersSet: new Set([uName]),
          firstTimestamp: ts,
          lastTimestamp: ts,
          sampleDetails: det,
        })
      } else {
        existingAction.count += 1
        existingAction.usersSet.add(uName)
        if (ts < existingAction.firstTimestamp || !existingAction.firstTimestamp) {
          existingAction.firstTimestamp = ts
        }
        if (ts > existingAction.lastTimestamp) existingAction.lastTimestamp = ts
      }

      const existingCat = categoryMap.get(cat)
      if (!existingCat) {
        categoryMap.set(cat, {
          category: cat,
          count: 1,
          uniqueActionsCount: 1,
          actionsSet: new Set([act]),
        })
      } else {
        existingCat.count += 1
        existingCat.actionsSet.add(act)
        existingCat.uniqueActionsCount = existingCat.actionsSet.size
      }
    }

    const logsSummaryByUser = Array.from(userMap.values())
      .sort((a, b) => b.totalCount - a.totalCount)
      .map((u) => ({
        userName: u.userName,
        userRole: u.userRole,
        totalCount: u.totalCount,
        lastTimestamp: u.lastTimestamp,
        topActions: Array.from(u.actionsMap.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([action, count]) => ({ action, count })),
      }))

    const logsSummaryByAction = Array.from(actionMap.values())
      .sort((a, b) => b.count - a.count)
      .map((a) => ({
        action: a.action,
        category: a.category,
        count: a.count,
        users: Array.from(a.usersSet),
        firstTimestamp: a.firstTimestamp,
        lastTimestamp: a.lastTimestamp,
        sampleDetails: a.sampleDetails,
      }))

    const logsSummaryByCategory = Array.from(categoryMap.values())
      .sort((a, b) => b.count - a.count)
      .map((c) => ({
        category: c.category,
        count: c.count,
        uniqueActionsCount: c.uniqueActionsCount,
      }))

    const recentLogs = allPeriodLogs.slice(0, 15)
    db.close()

    const effectiveSentCount = gmailStats.connected
      ? gmailStats.sentEmailsCount
      : (internalSentRow?.internalSentCount || 0) + (paymentRemindersCountRow?.reminderCount || 0)

    return NextResponse.json({
      startDate,
      endDate,
      generatedAt: new Date().toISOString(),
      summary: {
        newMembersCount: newMembers.length,
        reactivatedMembersCount: reactivatedMembers.length,
        reactivatedFromInactiveCount,
        reactivatedFromOverdueCount,
        totalMembers: allNonAdminMembers.length,
        activeMembers: activeMembersCount,
        overdueMembers: overdueMembersCount,
        inactiveExpelledMembers: inactiveExpelledMembersCount,
        deceasedMembers: deceasedMembersCount,
        honoraryMembers: honoraryMembersCount,
        paymentsCount: periodPayments.length,
        uniquePayingMembersCount: payingMemberIds.size,
        paymentsTotalAmount,
        donationsCount: donations.length,
        donationsTotalAmount,
        memberDonationsCount,
        memberDonationsTotalAmount,
        externalDonationsCount,
        externalDonationsTotalAmount,
        totalRevenue: Math.round((paymentsTotalAmount + donationsTotalAmount) * 100) / 100,
        meetingsCount: meetings.length,
        lecturesCount: lectures.length,
        receivedEmailsCount: gmailStats.receivedEmailsCount,
        sentEmailsCount: effectiveSentCount,
        internalSentCount: internalSentRow?.internalSentCount || 0,
        paymentRemindersSent: paymentRemindersCountRow?.reminderCount || 0,
        birthdayEmailsSentCount,
        invitationsSentCount,
        dataRequestsSentCount,
        viewedMemberFormsCount,
        submittedMemberFormsCount: submittedMemberForms.length,
        inquiriesCount: periodInquiries.length,
        forwardedInquiriesCount,
        inProgressInquiriesCount,
        activeInProgressInquiriesCount,
        unassignedInquiriesCount,
        completedInquiriesCount,
        feedbackSentCount: inquiryFeedbackReport.totalSent,
        feedbackSubmittedCount: inquiryFeedbackReport.totalSubmitted,
        feedbackResponseRatePct: inquiryFeedbackReport.responseRatePct,
        feedbackOverallAverage: inquiryFeedbackReport.overallAverage,
        feedbackFinancialSupportYesCount: inquiryFeedbackReport.financialSupport.da,
        feedbackPaymentInfoSentCount: inquiryFeedbackReport.financialSupport.paymentInfoSentCount,
        projectsCount: periodProjects.length,
        activeProjectsCount,
        newBooksCount: periodBooks.length,
        newJournalsCount: periodJournals.length,
        votesCount: periodVotes.length,
        appVersionsCount: appChangesInPeriod.length,
        gmailConnected: gmailStats.connected,
        gmailMailbox: gmailStats.mailbox,
      },
      details: {
        newMembers,
        reactivatedMembers,
        payments: periodPayments,
        donations,
        meetings,
        lectures,
        submittedMemberForms,
        completeness,
        projects: periodProjects,
        inquiries: periodInquiries,
        inquiriesByResearcher,
        inquiryFeedback: inquiryFeedbackReport,
        books: periodBooks,
        journals: periodJournals,
        votes: periodVotes,
        appChangesInPeriod,
        mailSendersStats,
        recentLogs,
        totalLogsCount: allPeriodLogs.length,
        logsSummaryByUser,
        logsSummaryByAction,
        logsSummaryByCategory,
      },
    })
  } catch (err: any) {
    console.error('[Reports API] Error generating period report:', err)
    return NextResponse.json(
      { error: err.message || 'Greška pri generiranju izvješća.' },
      { status: 500 }
    )
  }
}
