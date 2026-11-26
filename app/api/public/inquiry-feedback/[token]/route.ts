import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService, InquiryFeedbackDB, ResearchInquiriesDB } from '@/lib/database'
import { formatHrdEmailDate } from '@/lib/hrd-email-system'
import { type FinancialSupportChoice } from '@/lib/inquiry-feedback'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const VALID_SUPPORT_VALUES = new Set<FinancialSupportChoice>(['', 'da', 'mozda', 'ne'])

function parseStarRating(val: any): number | null {
  const num = Number(val)
  if (!Number.isInteger(num) || num < 1 || num > 5) return null
  return num
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
        societyName: 'Hrvatsko rodoslovno društvo „Pavao Ritter Vitezović”',
        iban,
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

    return NextResponse.json({
      isPreview: false,
      alreadySubmitted: false,
      inquiry: {
        id: Number(inquiryRow.id),
        subject: inquiryRow.subject || `Predmet #${inquiryRow.id}`,
        requesterName: inquiryRow.requester_name || feedbackRow.recipient_name || 'Naručitelj',
        researcherName: inquiryRow.assigned_to_name || null,
        inquiryDate: inquiryRow.inquiry_date || null,
      },
      societyName: 'Hrvatsko rodoslovno društvo „Pavao Ritter Vitezović”',
      iban,
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

    const body = await request.json()
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

    return NextResponse.json({
      success: true,
      submittedAt,
      averageRating,
    })
  } catch (e: any) {
    console.error('Error in POST /api/public/inquiry-feedback/[token]:', e)
    return NextResponse.json(
      { error: e.message || 'Greška pri spremanju Vaše ocjene.' },
      { status: 500 }
    )
  }
}
