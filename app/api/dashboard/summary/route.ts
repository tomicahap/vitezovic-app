import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService } from '@/lib/database'
import { getDonationPublicStats } from '@/lib/mailcrawl/db'
import { getGoogleWorkspaceClients } from '@/lib/google-auth'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function formatSenderShort(from: string): string {
  if (!from) return 'Nepoznato'
  const match = from.match(/^"?([^"<]+)"?\s*<.*>$/)
  return match ? match[1].trim() : from.replace(/<.*>/, '').trim() || from
}

async function getGmailSummarySince(sinceTime: string): Promise<{
  gmailConnected: boolean
  gmailMailbox: string | null
  newEmailsCount: number
  unreadEmailsCount: number
  newEmailPreviews: string[]
}> {
  try {
    const { gmail, targetEmail } = getGoogleWorkspaceClients({ requireTargetEmail: true })

    // Parse sinceTime (stored as UTC 'YYYY-MM-DD HH:mm:ss' or ISO string)
    const isoSince = sinceTime.includes('T') ? sinceTime : sinceTime.replace(' ', 'T') + 'Z'
    const sinceDate = new Date(isoSince)
    const sinceMs = isNaN(sinceDate.getTime()) ? Date.now() - 24 * 3600 * 1000 : sinceDate.getTime()
    // Subtract 60s buffer for Gmail's after: operator, then filter strictly by internalDate > sinceMs
    const afterEpochSec = Math.max(0, Math.floor(sinceMs / 1000) - 60)

    const [listRes, inboxLabelRes] = await Promise.all([
      gmail.users.messages
        .list({
          userId: 'me',
          labelIds: ['INBOX'],
          includeSpamTrash: false,
          q: `-in:trash -in:spam after:${afterEpochSec}`,
          maxResults: 25,
        })
        .catch(() => null),
      gmail.users.labels.get({ userId: 'me', id: 'INBOX' }).catch(() => null),
    ])

    const unreadEmailsCount = inboxLabelRes?.data?.messagesUnread ?? 0
    const candidateRefs = listRes?.data?.messages ?? []

    const verifiedMessages = await Promise.all(
      candidateRefs.map(async (m) => {
        if (!m.id) return null
        try {
          const msg = await gmail.users.messages.get({
            userId: 'me',
            id: m.id,
            format: 'metadata',
            metadataHeaders: ['From', 'Subject', 'Date'],
          })
          const labels = msg.data.labelIds ?? []
          if (labels.includes('TRASH') || labels.includes('SPAM') || !labels.includes('INBOX')) {
            return null
          }
          const internalDate = Number(msg.data.internalDate || 0)
          if (internalDate <= sinceMs) {
            return null
          }
          const headers = msg.data.payload?.headers ?? []
          const from = headers.find((h: any) => h.name?.toLowerCase() === 'from')?.value ?? ''
          const subject =
            headers.find((h: any) => h.name?.toLowerCase() === 'subject')?.value ?? '(bez naslova)'
          return {
            internalDate,
            preview: `${formatSenderShort(from)}: ${subject}`,
          }
        } catch {
          return null
        }
      })
    )

    const validNew = verifiedMessages
      .filter((m): m is NonNullable<typeof m> => m !== null)
      .sort((a, b) => b.internalDate - a.internalDate)

    return {
      gmailConnected: true,
      gmailMailbox: targetEmail,
      newEmailsCount: validNew.length,
      unreadEmailsCount,
      newEmailPreviews: validNew.slice(0, 5).map((m) => m.preview),
    }
  } catch (err) {
    console.error('Error fetching Gmail summary for dashboard:', err)
    return {
      gmailConnected: false,
      gmailMailbox: null,
      newEmailsCount: 0,
      unreadEmailsCount: 0,
      newEmailPreviews: [],
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 })
    }

    const { timestamp: sinceTime, hasPreviousLogin } = DatabaseService.getUserSummaryTimestamp(userId)
    const [summary, donations, gmailSummary] = await Promise.all([
      Promise.resolve(DatabaseService.getDashboardSummarySince(sinceTime)),
      Promise.resolve(getDonationPublicStats()),
      getGmailSummarySince(sinceTime),
    ])

    const totalNewWithEmail = (summary?.totalNew || 0) + (gmailSummary.newEmailsCount || 0)

    return NextResponse.json(
      {
        hasPreviousLogin,
        previousLoginTime: sinceTime,
        donations,
        ...summary,
        ...gmailSummary,
        totalNew: totalNewWithEmail,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    )
  } catch (error: any) {
    console.error('Error fetching dashboard summary:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
