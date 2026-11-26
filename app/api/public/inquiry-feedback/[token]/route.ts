import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService, InquiryFeedbackDB, ResearchInquiriesDB } from '@/lib/database'
import { formatHrdEmailDate } from '@/lib/hrd-email-system'
import { type FinancialSupportChoice } from '@/lib/inquiry-feedback'
import {
  buildAdminDonationInterestNotificationEmail,
  buildDonationInstructionsEmail,
  buildDonationPaymentAssets,
  createDonationEmailActionToken,
  deliverPublicEmail,
  resolveAdminNotificationEmails,
  verifyDonationEmailActionToken,
} from '@/lib/inquiry-donation-email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const VALID_SUPPORT_VALUES = new Set<FinancialSupportChoice>(['', 'da', 'mozda', 'ne'])
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function parseStarRating(val: any): number | null {
  const num = Number(val)
  if (!Number.isInteger(num) || num < 1 || num > 5) return null
  return num
}

function serializeDonationPaymentForClient(
  assets: Awaited<ReturnType<typeof buildDonationPaymentAssets>>
) {
  return {
    recipientName: assets.recipientName,
    recipientStreet: assets.recipientStreet,
    recipientCity: assets.recipientCity,
    iban: assets.iban,
    model: assets.model,
    reference: assets.reference,
    purpose: assets.purpose,
    description: assets.description,
    amountNote: assets.amountNote,
    hub3BarcodeDataUrl: assets.hub3DataUrl,
    epcQrDataUrl: assets.epcQrDataUrl,
  }
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params
    const cleanToken = decodeURIComponent(String(token || '')).trim()
    if (!cleanToken) {
      return NextResponse.json({ error: 'Nedostaje token obrasca.' }, { status: 400 })
    }

    const settings = DatabaseService.getSettings()
    const iban = String(settings?.iban || 'HR6523600001102892498').trim()

    if (cleanToken === 'test-pregled') {
      const assets = await buildDonationPaymentAssets('Primjer naručitelja', settings)
      return NextResponse.json({
        isPreview: true,
        alreadySubmitted: false,
        inquiry: {
          id: 0,
          subject: 'Primjer rodoslovnog istraživanja (Testni pregled)',
          requesterName: 'Poštovani naručitelju',
          researcherName: 'Istraživač Društva',
          inquiryDate: formatHrdEmailDate(new Date()),
        },
        requesterEmail: 'primjer.korisnika@rodoslovlje.hr',
        paymentInfoSentAt: null,
        paymentInfoSentTo: null,
        donationPayment: serializeDonationPaymentForClient(assets),
        societyName: 'Hrvatsko rodoslovno društvo „Pavao Ritter Vitezović”',
        iban: assets.iban || iban,
      })
    }

    const feedbackRow = InquiryFeedbackDB.getByToken(cleanToken)
    if (!feedbackRow) {
      return NextResponse.json(
        {
          error:
            'Poveznica za ocjenjivanje nije valjana ili je anketa već ispunjena i zaključana. Zahvaljujemo na razumijevanju!',
          code: 'INVALID_OR_USED_TOKEN',
        },
        { status: 404 }
      )
    }

    const inquiryRow = ResearchInquiriesDB.get(Number(feedbackRow.inquiry_id))
    if (!inquiryRow) {
      return NextResponse.json({ error: 'Istraživački predmet više ne postoji.' }, { status: 404 })
    }

    if (feedbackRow.submitted_at && String(feedbackRow.submitted_at).trim() !== '') {
      return NextResponse.json({
        alreadySubmitted: true,
        submittedAt: feedbackRow.submitted_at,
        inquiry: {
          id: Number(inquiryRow.id),
          subject: inquiryRow.subject || `Predmet #${inquiryRow.id}`,
          requesterName: inquiryRow.requester_name || feedbackRow.recipient_name || 'Naručitelj',
          researcherName: inquiryRow.assigned_to_name || null,
          inquiryDate: inquiryRow.inquiry_date || null,
        },
      })
    }

    const nowIso = new Date().toISOString()
    InquiryFeedbackDB.markOpened(Number(feedbackRow.id), nowIso)

    const requesterName = inquiryRow.requester_name || feedbackRow.recipient_name || 'Naručitelj'
    const requesterEmail = String(
      feedbackRow.recipient_email || inquiryRow.requester_email || ''
    ).trim()
    const assets = await buildDonationPaymentAssets(requesterName, settings)

    return NextResponse.json({
      isPreview: false,
      alreadySubmitted: false,
      inquiry: {
        id: Number(inquiryRow.id),
        subject: inquiryRow.subject || `Predmet #${inquiryRow.id}`,
        requesterName,
        researcherName: inquiryRow.assigned_to_name || null,
        inquiryDate: inquiryRow.inquiry_date || null,
      },
      requesterEmail,
      paymentInfoSentAt: feedbackRow.payment_info_sent_at || null,
      paymentInfoSentTo: feedbackRow.payment_info_sent_to || null,
      donationPayment: serializeDonationPaymentForClient(assets),
      societyName: 'Hrvatsko rodoslovno društvo „Pavao Ritter Vitezović”',
      iban: assets.iban || iban,
    })
  } catch (e: any) {
    console.error('Error in GET /api/public/inquiry-feedback/[token]:', e)
    return NextResponse.json(
      { error: e.message || 'Greška pri učitavanju obrasca za ocjenjivanje.' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params
    const cleanToken = decodeURIComponent(String(token || '')).trim()
    if (!cleanToken) {
      return NextResponse.json({ error: 'Nedostaje token obrasca.' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const appSettings = DatabaseService.getSettings()

    // Grana A: Korisnik je zatražio slanje podataka i QR/2D koda za uplatu donacije na svoj e-mail
    if (body?.action === 'send-payment-info') {
      if (cleanToken === 'test-pregled') {
        const previewTarget =
          String(body?.email || '').trim() || 'primjer.korisnika@rodoslovlje.hr'
        return NextResponse.json({
          success: true,
          isPreview: true,
          sentTo: previewTarget,
          sentAt: new Date().toISOString(),
          message: `Testni pregled: u stvarnoj anketi sustav šalje kompletan e-mail s uputama, 2D HUB-3A barkodom i SEPA QR kodom na ${previewTarget} te kratku obavijest Administratoru.`,
        })
      }

      let feedbackRow = InquiryFeedbackDB.getByToken(cleanToken)
      if (!feedbackRow && body?.paymentEmailToken) {
        const verified = verifyDonationEmailActionToken(
          String(body.paymentEmailToken),
          appSettings
        )
        if (verified) {
          feedbackRow = InquiryFeedbackDB.getById(verified.fid)
          if (
            feedbackRow &&
            Number(feedbackRow.inquiry_id) !== Number(verified.iid)
          ) {
            feedbackRow = null
          }
        }
      }

      if (!feedbackRow) {
        return NextResponse.json(
          {
            error:
              'Poveznica za slanje podataka za uplatu više nije aktivna ili je istekla.',
            code: 'INVALID_OR_USED_TOKEN',
          },
          { status: 404 }
        )
      }

      if (feedbackRow.payment_info_sent_at && String(feedbackRow.payment_info_sent_at).trim() !== '') {
        return NextResponse.json({
          success: true,
          alreadySent: true,
          sentTo: feedbackRow.payment_info_sent_to || feedbackRow.recipient_email || '',
          sentAt: feedbackRow.payment_info_sent_at,
          message: `Podaci i QR kod za uplatu već su poslani na e-mail ${feedbackRow.payment_info_sent_to || feedbackRow.recipient_email || ''}.`,
        })
      }

      const inquiryRow = ResearchInquiriesDB.get(Number(feedbackRow.inquiry_id))
      if (!inquiryRow) {
        return NextResponse.json({ error: 'Istraživački predmet više ne postoji.' }, { status: 404 })
      }

      const requestedEmail = String(body?.email || '').trim()
      const fallbackEmail = String(
        feedbackRow.recipient_email || inquiryRow.requester_email || ''
      ).trim()
      const targetEmail = requestedEmail || fallbackEmail

      if (!targetEmail || !EMAIL_REGEX.test(targetEmail)) {
        return NextResponse.json(
          { error: 'Molimo unesite valjanu e-mail adresu za primanje podataka za uplatu.' },
          { status: 400 }
        )
      }

      const requesterName =
        inquiryRow.requester_name || feedbackRow.recipient_name || 'Naručitelj'
      const assets = await buildDonationPaymentAssets(requesterName, appSettings)
      const userMail = buildDonationInstructionsEmail({
        inquiry: {
          id: Number(inquiryRow.id),
          subject: inquiryRow.subject || `Predmet #${inquiryRow.id}`,
          requesterName,
        },
        assets,
        settings: appSettings,
      })

      const userDelivery = await deliverPublicEmail({
        to: targetEmail,
        subject: userMail.subject,
        html: userMail.html,
        plainText: userMail.plainText,
        inlineAttachments: userMail.inlineAttachments,
        appSettings,
        actionType: 'inquiry_donation_instructions',
        threadId: inquiryRow.gmail_thread_id || null,
      })

      if (!userDelivery.sent) {
        return NextResponse.json(
          {
            error:
              userDelivery.error ||
              'Slanje e-maila s uputama za uplatu trenutno nije uspjelo. Molimo pokušajte kasnije ili upotrijebite prikazani QR/2D kod.',
          },
          { status: 500 }
        )
      }

      const nowIso = new Date().toISOString()
      InquiryFeedbackDB.markPaymentInfoSent(Number(feedbackRow.id), nowIso, targetEmail)

      // Administratoru šaljemo isključivo kratku obavijest da se to dogodilo (bez slika uplatnice/barkoda)
      let adminNotified = false
      try {
        const adminRecipients = resolveAdminNotificationEmails(appSettings)
        const adminNotice = buildAdminDonationInterestNotificationEmail({
          inquiry: {
            id: Number(inquiryRow.id),
            subject: inquiryRow.subject || `Predmet #${inquiryRow.id}`,
            requesterName,
            researcherName: inquiryRow.assigned_to_name || null,
          },
          targetEmail,
          requestedAtIso: nowIso,
          settings: appSettings,
        })

        for (const adminTo of adminRecipients) {
          const resAdmin = await deliverPublicEmail({
            to: adminTo,
            subject: adminNotice.subject,
            html: adminNotice.html,
            plainText: adminNotice.plainText,
            inlineAttachments: adminNotice.inlineAttachments,
            appSettings,
            actionType: 'inquiry_donation_admin_notice',
          })
          if (resAdmin.sent) adminNotified = true
        }
      } catch (adminErr) {
        console.warn('[Donation Admin Notice Warning]:', adminErr)
      }

      try {
        DatabaseService.insertLog({
          userId: 'public_feedback',
          userName: requesterName,
          userRole: 'public',
          action: 'Zatraženi podaci za donaciju (Anketa zadovoljstva)',
          details: `Naručitelj ${requesterName} (${targetEmail}) za istraživanje #${inquiryRow.id} („${inquiryRow.subject || ''}”) odabrao je financijsku podršku radu Društva i poslao sebi kompletne upute s QR/2D kodom za uplatu na e-mail. Administrator je obaviješten.`,
          timestamp: nowIso,
        })
      } catch {}

      return NextResponse.json({
        success: true,
        sentTo: targetEmail,
        sentAt: nowIso,
        channel: userDelivery.channel,
        adminNotified,
        message: `Kompletni podaci za uplatu, 2D HUB-3A barkod i SEPA QR kod uspješno su poslani na ${targetEmail}.`,
      })
    }

    // Grana B: Standardna predaja ankete zadovoljstva
    if (cleanToken === 'test-pregled') {
      return NextResponse.json(
        { error: 'Ovo je samo testni pregled obrasca — ocjena se ne sprema u bazu.' },
        { status: 400 }
      )
    }

    const feedbackRow = InquiryFeedbackDB.getByToken(cleanToken)
    if (!feedbackRow) {
      return NextResponse.json(
        {
          error:
            'Poveznica za ocjenjivanje više nije aktivna jer je anketa već predana ili je poveznica istekla.',
          code: 'INVALID_OR_USED_TOKEN',
        },
        { status: 404 }
      )
    }

    if (feedbackRow.submitted_at && String(feedbackRow.submitted_at).trim() !== '') {
      return NextResponse.json(
        { error: 'Ocjena za ovo istraživanje već je uspješno predana.' },
        { status: 409 }
      )
    }

    const rOverall = parseStarRating(body.rating_overall)
    const rClarity = parseStarRating(body.rating_clarity)
    const rCommunication = parseStarRating(body.rating_communication)
    const rTimeliness = parseStarRating(body.rating_timeliness)
    const rRecommendation = parseStarRating(body.rating_recommendation)

    if (!rOverall || !rClarity || !rCommunication || !rTimeliness || !rRecommendation) {
      return NextResponse.json(
        { error: 'Molimo ocijenite svih 5 pitanja zvjezdicama od 1 do 5.' },
        { status: 400 }
      )
    }

    const rawSupport = String(body.financial_support || '').trim().toLowerCase() as FinancialSupportChoice
    const financialSupport: FinancialSupportChoice = VALID_SUPPORT_VALUES.has(rawSupport)
      ? rawSupport
      : ''

    const comment = String(body.comment || '').trim().slice(0, 2000)
    const averageRating =
      Math.round(((rOverall + rClarity + rCommunication + rTimeliness + rRecommendation) / 5) * 100) /
      100
    const submittedAt = new Date().toISOString()

    InquiryFeedbackDB.submitFeedback({
      id: Number(feedbackRow.id),
      submittedAt,
      ratingOverall: rOverall,
      ratingClarity: rClarity,
      ratingCommunication: rCommunication,
      ratingTimeliness: rTimeliness,
      ratingRecommendation: rRecommendation,
      averageRating,
      financialSupport,
      comment,
    })

    const inquiryRow = ResearchInquiriesDB.get(Number(feedbackRow.inquiry_id))
    try {
      DatabaseService.insertLog({
        userId: 'public_feedback',
        userName: inquiryRow?.requester_name || feedbackRow.recipient_name || 'Naručitelj',
        userRole: 'public',
        action: 'Zaprimljena ocjena zadovoljstva istraživanja',
        details: `Naručitelj ${inquiryRow?.requester_name || feedbackRow.recipient_name || ''} ocijenio je istraživanje #${feedbackRow.inquiry_id} ("${inquiryRow?.subject || ''}") prosječnom ocjenom ${averageRating.toFixed(2)}/5.${financialSupport ? ` Financijska podrška: ${financialSupport}.` : ''}`,
        timestamp: submittedAt,
      })
    } catch {}

    const paymentEmailToken =
      financialSupport === 'da' && !feedbackRow.payment_info_sent_at
        ? createDonationEmailActionToken(
            Number(feedbackRow.id),
            Number(feedbackRow.inquiry_id),
            appSettings
          )
        : null

    return NextResponse.json({
      success: true,
      submittedAt,
      averageRating,
      paymentEmailToken,
    })
  } catch (e: any) {
    console.error('Error in POST /api/public/inquiry-feedback/[token]:', e)
    return NextResponse.json(
      { error: e.message || 'Greška pri spremanju Vaše ocjene.' },
      { status: 500 }
    )
  }
}
