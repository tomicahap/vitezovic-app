import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService } from '@/lib/database'
import { getMailcrawlDbPath } from '@/lib/db-path'
import path from 'path'
import fs from 'fs'
import DatabaseConstructor from 'better-sqlite3'
import { getGoogleWorkspaceClients } from '@/lib/google-auth'

const Database = (DatabaseConstructor as any).default || DatabaseConstructor

export const dynamic = 'force-dynamic'
export const revalidate = 0

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

    // 1. ČLANSTVO: Novi članovi u tom periodu
    const newMembers = db.prepare(`
      SELECT id, name, email, phone, registryNumber, membershipNumber, joinDate, created_at, status_clana
      FROM members
      WHERE (
        (joinDate IS NOT NULL AND joinDate >= ? AND joinDate <= ?)
        OR
        (created_at IS NOT NULL AND substr(created_at, 1, 10) >= ? AND substr(created_at, 1, 10) <= ?)
      )
      AND LOWER(TRIM(COALESCE(role, ''))) != 'admin'
      AND LOWER(TRIM(COALESCE(email, ''))) != 'admin'
      AND LOWER(TRIM(COALESCE(name, ''))) NOT IN ('administrator', 'rezervni administrator')
      ORDER BY id ASC
    `).all(startDate, endDate, startDate, endDate) as any[]

    // Ukupno aktivnih članova i članova s dugom
    const membersSummary = db.prepare(`
      SELECT 
        COUNT(*) as totalMembers,
        SUM(CASE WHEN status_clana = 'DUG' THEN 1 ELSE 0 END) as overdueCount,
        SUM(CASE WHEN status_clana = 'AKTIVAN' OR status_clana IS NULL THEN 1 ELSE 0 END) as activeCount
      FROM members
      WHERE LOWER(TRIM(COALESCE(role, ''))) != 'admin'
        AND LOWER(TRIM(COALESCE(email, ''))) != 'admin'
        AND LOWER(TRIM(COALESCE(name, ''))) NOT IN ('administrator', 'rezervni administrator')
    `).get() as any

    // 2. FINANCIJE: Uplate članarina u tom periodu
    const payments = db.prepare(`
      SELECT p.id, p.memberId, p.amount, p.date, p.note, p.created_at, m.name as memberName, m.registryNumber
      FROM payments p
      LEFT JOIN members m ON p.memberId = m.id
      WHERE (
        (p.date IS NOT NULL AND substr(p.date, 1, 10) >= ? AND substr(p.date, 1, 10) <= ?)
        OR
        (p.created_at IS NOT NULL AND substr(p.created_at, 1, 10) >= ? AND substr(p.created_at, 1, 10) <= ?)
      )
      ORDER BY COALESCE(p.date, substr(p.created_at, 1, 10)) ASC
    `).all(startDate, endDate, startDate, endDate) as any[]

    const paymentsTotalAmount = payments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0)

    // 3. DONACIJE (iz mailcrawl.db ako postoji)
    let donations: any[] = []
    let donationsTotalAmount = 0
    const mailcrawlDbPath = getMailcrawlDbPath()
    if (fs.existsSync(mailcrawlDbPath)) {
      try {
        const mcDb = new Database(mailcrawlDbPath, { readonly: true })
        donations = mcDb.prepare(`
          SELECT id, name, donated_amount, donated_at, donation_note, city, email
          FROM leads
          WHERE donated_at IS NOT NULL 
            AND substr(donated_at, 1, 10) >= ? 
            AND substr(donated_at, 1, 10) <= ?
          ORDER BY donated_at ASC
        `).all(startDate, endDate) as any[]
        donationsTotalAmount = donations.reduce((acc, d) => acc + (Number(d.donated_amount) || 0), 0)
        mcDb.close()
      } catch (mcErr) {
        console.warn('[Report] Error reading donations from mailcrawl.db:', mcErr)
      }
    }

    // 4. SJEDNICE I GLASOVANJA
    const meetings = db.prepare(`
      SELECT id, title, type, date, start_time, location, attendee_ids, status
      FROM meetings
      WHERE date IS NOT NULL AND date >= ? AND date <= ?
      ORDER BY date ASC
    `).all(startDate, endDate) as any[]

    // 5. PREDAVANJA I DRUŽENJA
    const lectures = db.prepare(`
      SELECT id, title, type, date, start_time, location, host, attendee_ids, status
      FROM lectures
      WHERE date IS NOT NULL AND date >= ? AND date <= ?
      ORDER BY date ASC
    `).all(startDate, endDate) as any[]

    // 6. E-MAIL KOMUNIKACIJA & OPOMENE (iz mail_senders i activity_logs)
    let mailSendersStats: any[] = []
    try {
      mailSendersStats = db.prepare(`
        SELECT user_name, user_role, COUNT(*) as count, action_type
        FROM mail_senders
        WHERE substr(created_at, 1, 10) >= ? AND substr(created_at, 1, 10) <= ?
        GROUP BY user_name, action_type
        ORDER BY count DESC
      `).all(startDate, endDate) as any[]
    } catch {}

    const internalSentRow = db.prepare(`
      SELECT COUNT(*) as internalSentCount
      FROM mail_senders
      WHERE substr(created_at, 1, 10) >= ? AND substr(created_at, 1, 10) <= ?
    `).get(startDate, endDate) as any

    const paymentRemindersCountRow = db.prepare(`
      SELECT COUNT(*) as reminderCount
      FROM activity_logs
      WHERE (action LIKE '%podsjetnik%' OR action LIKE '%opomen%' OR action LIKE '%Obavijest o članarini%')
        AND substr(timestamp, 1, 10) >= ? AND substr(timestamp, 1, 10) <= ?
    `).get(startDate, endDate) as any

    // 7. GMAIL API STATISTIKA (Poslani i primljeni e-mailovi)
    let gmailStats = {
      connected: false,
      mailbox: null as string | null,
      receivedEmailsCount: 0,
      sentEmailsCount: 0,
      note: ''
    }

    try {
      const { gmail, targetEmail } = getGoogleWorkspaceClients({ requireTargetEmail: false })
      gmailStats.connected = true
      gmailStats.mailbox = targetEmail || null

      const startEpochSec = Math.floor(new Date(`${startDate}T00:00:00Z`).getTime() / 1000)
      const endEpochSec = Math.floor(new Date(`${endDate}T23:59:59Z`).getTime() / 1000)

      // Dohvat broja poslanih e-mailova iz Gmail sandučića
      const sentRes = await gmail.users.messages.list({
        userId: 'me',
        q: `in:sent after:${startEpochSec} before:${endEpochSec + 86400}`,
        maxResults: 500,
        includeSpamTrash: false
      }).catch((e: any) => {
        console.warn('[Reports API] Gmail sent list error:', e?.message)
        return null
      })
      if (sentRes?.data) {
        gmailStats.sentEmailsCount = sentRes.data.messages?.length || sentRes.data.resultSizeEstimate || 0
      }

      // Dohvat broja primljenih e-mailova iz Gmail sandučića
      const receivedRes = await gmail.users.messages.list({
        userId: 'me',
        q: `-in:sent -in:trash -in:spam after:${startEpochSec} before:${endEpochSec + 86400}`,
        maxResults: 500,
        includeSpamTrash: false
      }).catch((e: any) => {
        console.warn('[Reports API] Gmail received list error:', e?.message)
        return null
      })
      if (receivedRes?.data) {
        gmailStats.receivedEmailsCount = receivedRes.data.messages?.length || receivedRes.data.resultSizeEstimate || 0
      }
    } catch (gErr: any) {
      gmailStats.note = gErr?.message || 'Google Workspace / Gmail API nije povezan.'
    }

    // 8. KLJUČNE AKTIVNOSTI IZ LOGOVA (SAŽETAK ZA IZVJEŠĆE)
    const allPeriodLogs = db.prepare(`
      SELECT id, userName, userRole, action, details, timestamp
      FROM activity_logs
      WHERE substr(timestamp, 1, 10) >= ? AND substr(timestamp, 1, 10) <= ?
      ORDER BY id DESC
    `).all(startDate, endDate) as any[]

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

    const userMap = new Map<string, {
      userName: string
      userRole: string
      totalCount: number
      lastTimestamp: string
      actionsMap: Map<string, number>
    }>()

    const actionMap = new Map<string, {
      action: string
      category: string
      count: number
      usersSet: Set<string>
      firstTimestamp: string
      lastTimestamp: string
      sampleDetails: string
    }>()

    const categoryMap = new Map<string, {
      category: string
      count: number
      uniqueActionsCount: number
      actionsSet: Set<string>
    }>()

    for (const log of allPeriodLogs) {
      const uName = (log.userName || 'Sustav').trim()
      const uRole = (log.userRole || '').trim()
      const act = (log.action || 'Aktivnost u sustavu').trim()
      const det = (log.details || '').trim()
      const ts = log.timestamp || ''
      const cat = categorizeAction(act, det)

      // Po korisniku
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

      // Po vrsti operacije
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
        if (ts < existingAction.firstTimestamp || !existingAction.firstTimestamp) existingAction.firstTimestamp = ts
        if (ts > existingAction.lastTimestamp) existingAction.lastTimestamp = ts
      }

      // Po kategoriji
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

    // Ako Gmail API nije spojen, kao poslani koristimo zabilježene interne iz baze
    const effectiveSentCount = gmailStats.connected 
      ? gmailStats.sentEmailsCount 
      : ((internalSentRow?.internalSentCount || 0) + (paymentRemindersCountRow?.reminderCount || 0))

    return NextResponse.json({
      startDate,
      endDate,
      generatedAt: new Date().toISOString(),
      summary: {
        newMembersCount: newMembers.length,
        totalMembers: membersSummary?.totalMembers || 0,
        activeMembers: membersSummary?.activeCount || 0,
        overdueMembers: membersSummary?.overdueCount || 0,
        paymentsCount: payments.length,
        paymentsTotalAmount: Math.round(paymentsTotalAmount * 100) / 100,
        donationsCount: donations.length,
        donationsTotalAmount: Math.round(donationsTotalAmount * 100) / 100,
        totalRevenue: Math.round((paymentsTotalAmount + donationsTotalAmount) * 100) / 100,
        meetingsCount: meetings.length,
        lecturesCount: lectures.length,
        receivedEmailsCount: gmailStats.receivedEmailsCount,
        sentEmailsCount: effectiveSentCount,
        internalSentCount: internalSentRow?.internalSentCount || 0,
        paymentRemindersSent: paymentRemindersCountRow?.reminderCount || 0,
        gmailConnected: gmailStats.connected,
        gmailMailbox: gmailStats.mailbox,
      },
      details: {
        newMembers,
        payments,
        donations,
        meetings,
        lectures,
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
    return NextResponse.json({ error: err.message || 'Greška pri generiranju izvješća.' }, { status: 500 })
  }
}
