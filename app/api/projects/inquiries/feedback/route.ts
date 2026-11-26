import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import {
  DatabaseService,
  ExternalUsersDB,
  InquiryFeedbackDB,
  MailSendersDB,
  ResearchInquiriesDB,
  getAppDb,
} from '@/lib/database'
import { extractActor, type TrashActor } from '@/lib/trash'
import { parseAccessRights } from '@/lib/inquiry-permissions'
import { getDoNotContactEmailSet } from '@/lib/do-not-contact'
import { getGoogleWorkspaceClients, formatGmailError } from '@/lib/google-auth'
import {
  buildRawMimeMessage,
  cleanBase64,
  getSocietyLogoFromSettings,
  isGmailOrGoogleHostedImageUrl,
  looksLikeBarcodeOrSlipInsteadOfLogo,
  processHtmlImagesAndExtractInlineAttachments,
} from '@/lib/mime-builder'
import { sendEmail } from '@/lib/mail'
import { getCampaignSettings } from '@/lib/mailcrawl/db'
import { formatHrdEmailDate } from '@/lib/hrd-email-system'
import {
  buildInquiryFeedbackEmail,
  INQUIRY_FEEDBACK_QUESTIONS,
  type InquiryFeedbackStats,
} from '@/lib/inquiry-feedback'
import { generateId, getMemberActiveFunctions } from '@/lib/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function extractEmailAddress(raw?: string | null): string {
  if (!raw) return ''
  const match = String(raw).match(/<([^>]+)>/)
  if (match) return match[1].trim().toLowerCase()
  const emailMatch = String(raw).match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
  return emailMatch ? emailMatch[0].trim().toLowerCase() : ''
}

function resolveOrigin(request: NextRequest, settings: any): string {
  const originHeader = request.headers.get('origin')
  if (originHeader && /^https?:\/\//i.test(originHeader)) {
    return originHeader.replace(/\/+$/, '')
  }
  const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host')
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https'
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`.replace(/\/+$/, '')
  }
  const configured = String(settings?.officialWebsiteUrl || '').trim()
  if (configured && /^https?:\/\//i.test(configured)) {
    return configured.replace(/\/+$/, '')
  }
  return 'https://rodoslovlje.hr'
}

async function resolveAuthorizedActor(
  request: NextRequest,
  body?: any
): Promise<{ actor: TrashActor; dbUser: any | null }> {
  const actor = extractActor(request, body)
  const roleLower = (actor.role || '').trim().toLowerCase()
  const hasId = Boolean(actor.id && actor.id !== 'unknown')
  const emailLower = (actor.email || '').trim().toLowerCase()

  if (roleLower === 'admin') {
    return {
      actor,
      dbUser: {
        id: Number.isFinite(Number(actor.id)) ? Number(actor.id) : 2579,
        name: actor.name || 'Administrator',
        email: actor.email || 'admin',
        role: 'admin',
        accessRights: null,
      },
    }
  }

  const db = getAppDb()
  const numericId = Number(actor.id)
  let member: any = null

  if (roleLower !== 'external') {
    if (hasId && Number.isFinite(numericId) && numericId > 0) {
      member = db
        .prepare('SELECT id, name, email, role, access_rights, functions FROM members WHERE id = ? LIMIT 1')
        .get(numericId)
    }

    if (!member && emailLower) {
      member = db
        .prepare(
          'SELECT id, name, email, role, access_rights, functions FROM members WHERE lower(trim(email)) = ? LIMIT 1'
        )
        .get(emailLower)
    }
  }

  if (!member) {
    const ext =
      (hasId && Number.isFinite(numericId) && numericId > 0
        ? ExternalUsersDB.getRawById(numericId)
        : null) || (emailLower ? ExternalUsersDB.getRawByEmail(emailLower) : null)

    if (!ext || ext.is_active === 0 || ext.is_active === false) {
      return { actor, dbUser: null }
    }

    const parsedExtRights = parseAccessRights(ext.access_rights)
    return {
      actor: {
        id: String(ext.id),
        name: ext.name || actor.name,
        role: 'external',
        email: ext.email || actor.email || '',
      },
      dbUser: {
        id: Number(ext.id),
        name: ext.name,
        email: ext.email,
        role: 'external',
        isExternal: true,
        accessRights: parsedExtRights,
        access_rights: parsedExtRights,
      },
    }
  }

  const parsedRights = parseAccessRights(member.access_rights)
  return {
    actor: {
      id: String(member.id),
      name: member.name || actor.name,
      role: member.role || actor.role || 'member',
      email: member.email || actor.email || '',
    },
    dbUser: {
      id: member.id,
      name: member.name,
      email: member.email,
      role: member.role || 'member',
      functions: member.functions,
      accessRights: parsedRights,
      access_rights: parsedRights,
    },
  }
}

async function deliverSurveyEmail(params: {
  to: string
  subject: string
  html: string
  plainText: string
  inlineAttachments?: any[]
  appSettings: any
  senderName: string
  senderId: string
  senderRole: string
  isTest: boolean
  threadId?: string | null
}): Promise<{ sent: boolean; channel: 'gmail' | 'smtp' | 'none'; messageId?: string | null; threadId?: string | null; error?: string }> {
  const effectiveSubject =
    params.isTest && !params.subject.toUpperCase().startsWith('[TEST]')
      ? `[TEST] ${params.subject}`
      : params.subject

  try {
    const { gmail, targetEmail, settings: gwSettings } = getGoogleWorkspaceClients({
      requireTargetEmail: true,
    })
    const campaignSettings = getCampaignSettings()

    let displayName = ''
    try {
      const sendAsRes = await gmail.users.settings.sendAs.list({ userId: 'me' })
      const aliases: any[] = sendAsRes?.data?.sendAs ?? []
      const matched =
        aliases.find((a) => a.sendAsEmail?.toLowerCase() === targetEmail.toLowerCase()) ||
        aliases.find((a) => a.isPrimary) ||
        aliases.find((a) => a.isDefault) ||
        aliases[0]
      if (matched) displayName = matched.displayName || ''
    } catch {}

    const mappedInline = (params.inlineAttachments || []).map((att) => ({
      filename: att.filename,
      mimeType: att.contentType || 'image/png',
      contentBase64: Buffer.isBuffer(att.content)
        ? att.content.toString('base64')
        : String(att.content || ''),
      contentId: att.cid,
    }))

    const societyLogo = getSocietyLogoFromSettings()
    let htmlToProcess = params.html
    if (societyLogo) {
      htmlToProcess = htmlToProcess.replace(/<img\b[^>]*>/gi, (imgTag) => {
        const srcMatch = imgTag.match(/\bsrc=(["'])(.*?)\1/i)
        if (!srcMatch) return imgTag
        const src = srcMatch[2].replace(/&amp;/g, '&').trim()
        if (/^https?:\/\//i.test(src) && isGmailOrGoogleHostedImageUrl(src)) {
          return imgTag.replace(srcMatch[0], `src="${societyLogo.dataUrl}"`)
        }
        if (/^data:image\//i.test(src) && looksLikeBarcodeOrSlipInsteadOfLogo(cleanBase64(src), imgTag)) {
          return imgTag.replace(srcMatch[0], `src="${societyLogo.dataUrl}"`)
        }
        return imgTag
      })
    }

    const { processedHtml, inlineAttachments, remainingAttachments } =
      await processHtmlImagesAndExtractInlineAttachments(htmlToProcess, [], gmail)

    const mergedInline = [...mappedInline, ...inlineAttachments]
    const rawMime = await buildRawMimeMessage({
      from: targetEmail,
      fromDisplayName:
        campaignSettings.sender_name ||
        displayName ||
        'Hrvatsko rodoslovno društvo "Pavao Ritter Vitezović"',
      to: params.to,
      subject: effectiveSubject,
      htmlBody: processedHtml,
      attachments: remainingAttachments,
      inlineAttachments: mergedInline,
    })

    const sendRes = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: rawMime,
        threadId: !params.isTest ? params.threadId || undefined : undefined,
      },
    })
    const newMsgId = sendRes.data.id || null
    const newThreadId = sendRes.data.threadId || params.threadId || null

    if (!params.isTest && newMsgId) {
      try {
        MailSendersDB.recordSender({
          messageId: newMsgId,
          threadId: newThreadId || undefined,
          userId: params.senderId,
          userName: params.senderName,
          userRole: params.senderRole,
          actionType: 'inquiry_satisfaction_survey',
          recipient: params.to,
          subject: effectiveSubject,
        })
      } catch {}
    }

    return { sent: true, channel: 'gmail', messageId: newMsgId, threadId: newThreadId }
  } catch (gmailErr: any) {
    if (params.appSettings?.smtpHost && params.appSettings?.smtpFrom) {
      try {
        await sendEmail({
          to: params.to,
          subject: effectiveSubject,
          body: params.plainText,
          html: params.html,
          config: params.appSettings,
          attachments: params.inlineAttachments,
        })
        return { sent: true, channel: 'smtp', messageId: null, threadId: null }
      } catch (smtpErr: any) {
        return {
          sent: false,
          channel: 'smtp',
          error: smtpErr?.message || gmailErr?.message || 'Greška pri SMTP slanju.',
        }
      }
    }
    return {
      sent: false,
      channel: 'none',
      error: formatGmailError(gmailErr) || gmailErr?.message || 'Ni Gmail ni SMTP nisu konfigurirani.',
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    const { dbUser } = await resolveAuthorizedActor(request)
    if (!dbUser) {
      return NextResponse.json({ error: 'Potrebna je prijava u sustav.' }, { status: 401 })
    }

    const completedInquiries = ResearchInquiriesDB.getAll('completed')
    const feedbackRows = InquiryFeedbackDB.getAllWithInquiries()
    const feedbackByInquiryId = new Map<number, any>()
    for (const row of feedbackRows) {
      feedbackByInquiryId.set(Number(row.inquiry_id), row)
    }

    const blockedEmails = getDoNotContactEmailSet()
    const submittedRows = feedbackRows.filter((r) => r.submitted_at && String(r.submitted_at).trim() !== '')
    const sentRows = feedbackRows.filter((r) => r.sent_at && String(r.sent_at).trim() !== '')

    const totalCompletedInquiries = completedInquiries.length
    const totalSent = sentRows.length
    const totalSubmitted = submittedRows.length
    const responseRatePct = totalSent > 0 ? Math.round((totalSubmitted / totalSent) * 100) : 0

    let overallSum = 0
    for (const r of submittedRows) {
      overallSum += Number(r.average_rating || 0)
    }
    const overallAverage = totalSubmitted > 0 ? Math.round((overallSum / totalSubmitted) * 100) / 100 : 0

    const questionAverages = INQUIRY_FEEDBACK_QUESTIONS.map((q) => {
      const vals = submittedRows
        .map((r) => Number(r[q.key]))
        .filter((n) => Number.isFinite(n) && n >= 1 && n <= 5)
      const avg = vals.length > 0 ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100 : 0
      return {
        key: q.key,
        shortTitle: q.shortTitle,
        average: avg,
        count: vals.length,
      }
    })

    const distCounts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    for (const r of submittedRows) {
      const rounded = Math.min(5, Math.max(1, Math.round(Number(r.average_rating || 0))))
      distCounts[rounded] = (distCounts[rounded] || 0) + 1
    }
    const ratingDistribution = ([5, 4, 3, 2, 1] as const).map((stars) => ({
      stars,
      count: distCounts[stars] || 0,
      pct: totalSubmitted > 0 ? Math.round(((distCounts[stars] || 0) / totalSubmitted) * 100) : 0,
    }))

    const financialSupportSummary = {
      da: 0,
      mozda: 0,
      ne: 0,
      unspecified: 0,
    }
    for (const r of submittedRows) {
      const val = String(r.financial_support || '').trim().toLowerCase()
      if (val === 'da') financialSupportSummary.da++
      else if (val === 'mozda') financialSupportSummary.mozda++
      else if (val === 'ne') financialSupportSummary.ne++
      else financialSupportSummary.unspecified++
    }

    const recentSubmissions = submittedRows.map((r) => ({
      id: Number(r.id),
      inquiryId: Number(r.inquiry_id),
      subject: r.inquiry_subject || `Predmet #${r.inquiry_id}`,
      requesterName: r.recipient_name || r.inquiry_requester_name || 'Naručitelj',
      requesterEmail: r.recipient_email || r.inquiry_requester_email || '',
      researcherName: r.inquiry_researcher_name || '',
      inquiryDate: r.inquiry_date || '',
      sentAt: r.sent_at || null,
      submittedAt: r.submitted_at,
      averageRating: Number(r.average_rating || 0),
      rating_overall: Number(r.rating_overall || 0),
      rating_clarity: Number(r.rating_clarity || 0),
      rating_communication: Number(r.rating_communication || 0),
      rating_timeliness: Number(r.rating_timeliness || 0),
      rating_recommendation: Number(r.rating_recommendation || 0),
      financialSupport: String(r.financial_support || ''),
      comment: String(r.comment || ''),
    }))

    const pendingClosedInquiries = completedInquiries
      .filter((inq) => {
        const fb = feedbackByInquiryId.get(Number(inq.id))
        return !(fb && fb.submitted_at && String(fb.submitted_at).trim() !== '')
      })
      .map((inq) => {
        const reqEmail = (inq.requester_email || '').trim() || extractEmailAddress(inq.requester_contact)
        const fb = feedbackByInquiryId.get(Number(inq.id))
        return {
          inquiryId: Number(inq.id),
          subject: inq.subject || `Predmet #${inq.id}`,
          requesterName: inq.requester_name || 'Naručitelj',
          requesterEmail: reqEmail,
          researcherName: inq.assigned_to_name || '',
          inquiryDate: inq.inquiry_date || '',
          sentAt: fb?.sent_at || null,
          openedAt: fb?.opened_at || null,
          blockedDoNotContact: Boolean(reqEmail && blockedEmails.has(reqEmail.toLowerCase())),
        }
      })

    const stats: InquiryFeedbackStats = {
      totalCompletedInquiries,
      totalSent,
      totalSubmitted,
      responseRatePct,
      overallAverage,
      questionAverages,
      ratingDistribution,
      financialSupportSummary,
      recentSubmissions,
      pendingClosedInquiries,
    }

    return NextResponse.json(stats)
  } catch (e: any) {
    console.error('Error in GET /api/projects/inquiries/feedback:', e)
    return NextResponse.json({ error: e.message || 'Greška pri dohvaćanju statistike zadovoljstva.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { actor, dbUser } = await resolveAuthorizedActor(request, body)
    if (!dbUser) {
      return NextResponse.json({ error: 'Potrebna je prijava u sustav.' }, { status: 401 })
    }
    if (String(dbUser.role || '').toLowerCase() !== 'admin') {
      return NextResponse.json(
        { error: 'Samo Administrator može poslati anketu za provjeru zadovoljstva korisnika.' },
        { status: 403 }
      )
    }

    const inquiryId = Number(body.inquiryId || body.id)
    if (!Number.isFinite(inquiryId) || inquiryId <= 0) {
      return NextResponse.json({ error: 'Nedostaje valjani ID istraživačkog predmeta.' }, { status: 400 })
    }

    const inquiryRow = ResearchInquiriesDB.get(inquiryId)
    if (!inquiryRow) {
      return NextResponse.json({ error: 'Istraživački predmet nije pronađen.' }, { status: 404 })
    }
    if (inquiryRow.status !== 'completed') {
      return NextResponse.json(
        { error: 'Anketa zadovoljstva može se poslati isključivo za zatvorene predmete (status: Završeno).' },
        { status: 400 }
      )
    }

    const isTest = Boolean(body.isTest)
    const testEmail = String(body.testEmail || '').trim()
    const appSettings = DatabaseService.getSettings()
    const origin = resolveOrigin(request, appSettings)
    const senderName = actor.name || dbUser.name || 'Administrator'

    const requesterEmail =
      String(inquiryRow.requester_email || '').trim() || extractEmailAddress(inquiryRow.requester_contact)

    const senderIdentity = {
      userId: actor.id || dbUser.id,
      userName: senderName,
      userEmail: actor.email || dbUser.email,
      userRole: 'admin',
      userFunction: 'Administrator',
    }

    if (isTest) {
      if (!testEmail || !testEmail.includes('@')) {
        return NextResponse.json(
          { error: 'Unesite valjanu testnu e-mail adresu za slanje [TEST] ankete.' },
          { status: 400 }
        )
      }
      const previewUrl = `${origin}/ocjena-istrazivanja/test-pregled`
      const built = buildInquiryFeedbackEmail({
        inquiry: {
          id: inquiryId,
          subject: inquiryRow.subject || 'Rodoslovno istraživanje',
          requesterName: inquiryRow.requester_name || 'Naručitelj',
          researcherName: inquiryRow.assigned_to_name || null,
          inquiryDate: inquiryRow.inquiry_date || null,
        },
        surveyUrl: previewUrl,
        settings: appSettings,
        sender: senderIdentity,
      })

      const delivery = await deliverSurveyEmail({
        to: testEmail,
        subject: built.subject,
        html: built.html,
        plainText: built.plainText,
        inlineAttachments: built.inlineAttachments,
        appSettings,
        senderName,
        senderId: String(senderIdentity.userId || 'admin'),
        senderRole: 'admin',
        isTest: true,
      })

      if (!delivery.sent) {
        return NextResponse.json(
          { error: delivery.error || 'Slanje testne ankete nije uspjelo.' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        isTest: true,
        message: `Testni e-mail s anketom zadovoljstva uspješno je poslan na ${testEmail} (${delivery.channel.toUpperCase()}).`,
      })
    }

    if (!requesterEmail) {
      return NextResponse.json(
        { error: 'Naručitelj ovog istraživanja nema upisanu e-mail adresu.' },
        { status: 400 }
      )
    }

    const blockedEmails = getDoNotContactEmailSet()
    if (blockedEmails.has(requesterEmail.toLowerCase())) {
      return NextResponse.json(
        { error: `Slanje nije dopušteno jer adresa ${requesterEmail} ima oznaku „Ne kontaktirati”.` },
        { status: 403 }
      )
    }

    const existingFeedback = InquiryFeedbackDB.getByInquiryId(inquiryId)
    if (existingFeedback && existingFeedback.submitted_at && String(existingFeedback.submitted_at).trim() !== '') {
      return NextResponse.json(
        { error: 'Naručitelj je već ispunio i predao ocjenu zadovoljstva za ovaj predmet.' },
        { status: 409 }
      )
    }

    const token = crypto.randomBytes(24).toString('hex')
    const surveyUrl = `${origin}/ocjena-istrazivanja/${token}`

    const built = buildInquiryFeedbackEmail({
      inquiry: {
        id: inquiryId,
        subject: inquiryRow.subject || 'Rodoslovno istraživanje',
        requesterName: inquiryRow.requester_name || 'Naručitelj',
        researcherName: inquiryRow.assigned_to_name || null,
        inquiryDate: inquiryRow.inquiry_date || null,
      },
      surveyUrl,
      settings: appSettings,
      sender: senderIdentity,
    })

    const delivery = await deliverSurveyEmail({
      to: requesterEmail,
      subject: built.subject,
      html: built.html,
      plainText: built.plainText,
      inlineAttachments: built.inlineAttachments,
      appSettings,
      senderName,
      senderId: String(senderIdentity.userId || 'admin'),
      senderRole: 'admin',
      isTest: false,
      threadId: inquiryRow.gmail_thread_id || null,
    })

    if (!delivery.sent) {
      return NextResponse.json(
        { error: delivery.error || 'Slanje e-maila za provjeru zadovoljstva nije uspjelo.' },
        { status: 500 }
      )
    }

    const nowIso = new Date().toISOString()
    const savedFeedback = InquiryFeedbackDB.upsertSentSurvey({
      inquiryId,
      token,
      sentAt: nowIso,
      sentById: String(senderIdentity.userId || 'admin'),
      sentByName: senderName,
      recipientName: inquiryRow.requester_name || 'Naručitelj',
      recipientEmail: requesterEmail,
    })

    let emailLogs: any[] = []
    if (inquiryRow.email_logs) {
      try {
        emailLogs =
          typeof inquiryRow.email_logs === 'string'
            ? JSON.parse(inquiryRow.email_logs)
            : inquiryRow.email_logs
      } catch {
        emailLogs = []
      }
    }
    if (!Array.isArray(emailLogs)) emailLogs = []
    emailLogs.push({
      id: generateId(),
      type: 'satisfaction_survey',
      sent_at: nowIso,
      sent_by_id: String(senderIdentity.userId || 'admin'),
      sent_by_name: senderName,
      sent_by_role: 'admin',
      to: requesterEmail,
      cc: '',
      subject: built.subject,
      html_body: built.html,
      gmail_message_id: delivery.messageId || null,
      gmail_thread_id: delivery.threadId || inquiryRow.gmail_thread_id || null,
    })
    ResearchInquiriesDB.update(inquiryId, { email_logs: JSON.stringify(emailLogs) })

    try {
      DatabaseService.insertLog({
        userId: String(senderIdentity.userId || 'admin'),
        userName: senderName,
        userRole: 'admin',
        action: 'Poslana anketa zadovoljstva (Istraživanja)',
        details: `Administrator ${senderName} poslao je e-mail za ocjenu zadovoljstva za zatvoreni predmet #${inquiryId} ("${inquiryRow.subject || ''}") naručitelju ${requesterEmail} (${formatHrdEmailDate(nowIso)}).`,
        timestamp: nowIso,
      })
    } catch {}

    return NextResponse.json({
      success: true,
      channel: delivery.channel,
      sentTo: requesterEmail,
      feedback: {
        ...savedFeedback,
        token: undefined,
        hasToken: true,
      },
      message: `Anketa zadovoljstva uspješno je poslana na ${requesterEmail}.`,
    })
  } catch (e: any) {
    console.error('Error in POST /api/projects/inquiries/feedback:', e)
    return NextResponse.json(
      { error: formatGmailError(e) || e.message || 'Greška pri slanju ankete zadovoljstva.' },
      { status: 500 }
    )
  }
}
