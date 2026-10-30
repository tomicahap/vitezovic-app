import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService } from '@/lib/database'
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
      ORDER BY id ASC
    `).all(startDate, endDate, startDate, endDate) as any[]

    // Ukupno aktivnih članova i članova s dugom
    const membersSummary = db.prepare(`
      SELECT 
        COUNT(*) as totalMembers,
        SUM(CASE WHEN status_clana = 'DUG' THEN 1 ELSE 0 END) as overdueCount,
        SUM(CASE WHEN status_clana = 'AKTIVAN' OR status_clana IS NULL THEN 1 ELSE 0 END) as activeCount
      FROM members
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
    const mailcrawlDbPath = path.join(path.dirname(dbPath), 'mailcrawl.db')
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

    // 8. KLJUČNE AKTIVNOSTI IZ LOGOVA
    const recentLogs = db.prepare(`
      SELECT id, userName, userRole, action, details, timestamp
      FROM activity_logs
      WHERE substr(timestamp, 1, 10) >= ? AND substr(timestamp, 1, 10) <= ?
      ORDER BY id ASC
      LIMIT 100
    `).all(startDate, endDate) as any[]

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
      },
    })
  } catch (err: any) {
    console.error('[Reports API] Error generating period report:', err)
    return NextResponse.json({ error: err.message || 'Greška pri generiranju izvješća.' }, { status: 500 })
  }
}
