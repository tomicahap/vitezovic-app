import { NextRequest, NextResponse } from 'next/server'
import { requireMailcrawlAdmin } from '@/lib/mailcrawl/auth'
import {
  getCampaignSettings,
  recordThankYouSent,
  resolveLinkedDonorRecords,
} from '@/lib/mailcrawl/db'
import {
  buildDonationThankYouEmailHtml,
  buildPersonalizedThankYouDraft,
  deliverDonationThankYouEmail,
  generateAiThankYouDraft,
  isPlaceholderDonorEmail,
  type DonorThankYouContext,
} from '@/lib/mailcrawl/thank-you'
import { DatabaseService } from '@/lib/database'
import { DoNotContactBlockedError } from '@/lib/do-not-contact'
import { formatDateDMY, getMemberActiveFunctions } from '@/lib/utils'
import type { SenderIdentityInput } from '@/lib/hrd-email-system'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function buildDonorContext(params: {
  leadId?: number
  sentId?: number
  contactPersonOverride?: string
}): DonorThankYouContext | null {
  const { lead, sent } = resolveLinkedDonorRecords({
    leadId: params.leadId,
    sentId: params.sentId,
  })

  if (!lead && !sent) return null

  const isDonorLead = Boolean(lead && (lead.status === 'donor' || String(lead.donated_amount || '').trim() !== ''))
  const isDonorSent = Boolean(sent && (sent.status === 'donor' || String(sent.donated_amount || '').trim() !== ''))
  if (!isDonorLead && !isDonorSent) {
    return null
  }

  const rawEmailCandidates = [
    sent?.thank_you_sent_to,
    lead?.thank_you_sent_to,
    sent?.recipient_email,
    lead?.email,
    sent?.email_norm,
    lead?.email_norm,
  ]
  const validEmail = rawEmailCandidates.find((e) => !isPlaceholderDonorEmail(e)) || ''

  const contactPerson =
    params.contactPersonOverride !== undefined
      ? params.contactPersonOverride.trim()
      : String(lead?.contact_person || sent?.contact_person || '').trim()

  return {
    leadId: lead?.id || sent?.lead_id || undefined,
    sentId: sent?.id || undefined,
    name: String(sent?.donor_name || sent?.company_name || lead?.name || 'Donator').trim(),
    entityType: lead?.entity_type || undefined,
    contactPerson,
    contactRole: lead?.contact_role || sent?.contact_role || '',
    email: validEmail,
    city: lead?.city || '',
    oib: String(lead?.oib || sent?.oib || '').trim(),
    website: lead?.website || sent?.domain_norm || '',
    activityCategory: lead?.activity_category || '',
    activitySummary: lead?.activity_summary || '',
    donatedAmount: String(sent?.donated_amount || lead?.donated_amount || '').trim(),
    donatedAt: String(sent?.donated_at || lead?.donated_at || '').trim(),
    donationNote: String(sent?.donation_note || lead?.donation_note || '').trim(),
    thankYouSentAt: String(sent?.thank_you_sent_at || lead?.thank_you_sent_at || '').trim(),
    thankYouSentTo: String(sent?.thank_you_sent_to || lead?.thank_you_sent_to || '').trim(),
    thankYouCount: Number(sent?.thank_you_count || lead?.thank_you_count || 0),
    thankYouSubject: String(sent?.thank_you_subject || lead?.thank_you_subject || '').trim(),
    thankYouBody: String(sent?.thank_you_body || lead?.thank_you_body || '').trim(),
  }
}

function resolveSenderIdentity(actor: { id?: string; name?: string; email?: string; role?: string }): SenderIdentityInput {
  const numericId = Number(actor.id)
  let userFunction = actor.role === 'admin' ? 'Administrator' : 'Član Društva'
  if (Number.isFinite(numericId) && numericId > 0) {
    try {
      const member = DatabaseService.getMemberById(numericId)
      if (member) {
        const activeFns = getMemberActiveFunctions(member)
        if (activeFns.length > 0) {
          userFunction = activeFns.join(', ')
        }
      }
    } catch {}
  }

  return {
    userId: actor.id,
    userName: actor.name || 'Administrator',
    userEmail: actor.email || '',
    userRole: actor.role || 'admin',
    userFunction,
  }
}

export async function POST(req: NextRequest) {
  const auth = requireMailcrawlAdmin(req)
  if (!auth.ok) return auth.response

  try {
    const body = await req.json().catch(() => ({}))
    const action = String(body?.action || 'draft').trim()
    const leadId = Number(body?.leadId) || undefined
    const sentId = Number(body?.sentId) || undefined

    if (!leadId && !sentId) {
      return NextResponse.json(
        { ok: false, error: 'Nedostaje identifikator donatora (leadId ili sentId).' },
        { status: 400 }
      )
    }

    const donor = buildDonorContext({
      leadId,
      sentId,
      contactPersonOverride:
        typeof body?.contactPerson === 'string' ? body.contactPerson : undefined,
    })

    if (!donor) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Odabrani subjekt još nema evidentiranu donaciju. Prvo zabilježite uplatu donacije.',
        },
        { status: 400 }
      )
    }

    const campaignSettings = getCampaignSettings()
    const appSettings = DatabaseService.getSettings()
    const senderIdentity = resolveSenderIdentity(auth.actor)
    const hasGeminiKey = Boolean(
      (campaignSettings.gemini_api_key || process.env.GEMINI_API_KEY || '').trim()
    )

    if (action === 'draft') {
      const draft = buildPersonalizedThankYouDraft(donor)
      const built = buildDonationThankYouEmailHtml({
        donor,
        subject: draft.subject,
        bodyText: draft.body,
        sender: senderIdentity,
        appSettings,
        forBrowserPreview: true,
      })
      return NextResponse.json({
        ok: true,
        donor,
        hasGeminiKey,
        subject: built.subject,
        body: draft.body,
        personalizationNote: draft.personalizationNote,
        previewHtml: built.html,
      })
    }

    if (action === 'generate_ai') {
      const customInstruction = String(body?.customInstruction || '').trim()
      const draft = await generateAiThankYouDraft(donor, campaignSettings, customInstruction)
      const built = buildDonationThankYouEmailHtml({
        donor,
        subject: draft.subject,
        bodyText: draft.body,
        sender: senderIdentity,
        appSettings,
        forBrowserPreview: true,
      })
      return NextResponse.json({
        ok: true,
        subject: built.subject,
        body: draft.body,
        personalizationNote: draft.personalizationNote,
        usedModel: draft.usedModel,
        previewHtml: built.html,
      })
    }

    if (action === 'preview') {
      const draftFallback = buildPersonalizedThankYouDraft(donor)
      const subject = String(body?.subject ?? draftFallback.subject).trim()
      const bodyText = String(body?.body ?? draftFallback.body).trim()
      const built = buildDonationThankYouEmailHtml({
        donor,
        subject,
        bodyText,
        sender: senderIdentity,
        appSettings,
        forBrowserPreview: true,
      })
      return NextResponse.json({
        ok: true,
        previewHtml: built.html,
      })
    }

    if (action === 'send_test') {
      const testEmail = String(body?.testEmail || '').trim()
      if (!testEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail)) {
        return NextResponse.json(
          { ok: false, error: 'Unesite valjanu testnu e-mail adresu.' },
          { status: 400 }
        )
      }

      const subject = String(body?.subject || '').trim()
      const bodyText = String(body?.body || '').trim()
      if (!subject || !bodyText) {
        return NextResponse.json(
          { ok: false, error: 'Predmet i tekst zahvale ne smiju biti prazni.' },
          { status: 400 }
        )
      }

      const built = buildDonationThankYouEmailHtml({
        donor,
        subject,
        bodyText,
        sender: senderIdentity,
        appSettings,
        forBrowserPreview: false,
      })

      const delivery = await deliverDonationThankYouEmail({
        to: testEmail,
        subject: built.subject,
        html: built.html,
        plainText: built.plainText,
        inlineAttachments: built.inlineAttachments,
        campaignSettings,
        appSettings,
        sender: senderIdentity,
        isTest: true,
      })

      if (!delivery.sent) {
        return NextResponse.json(
          { ok: false, error: delivery.error || 'Slanje testne zahvale nije uspjelo.' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        ok: true,
        isTest: true,
        channel: delivery.channel,
        message: `[TEST] Zahvala za donaciju (${donor.name}) uspješno je poslana na ${testEmail}.`,
      })
    }

    if (action === 'send') {
      const recipientEmail = String(body?.recipientEmail || donor.email || '').trim()
      const subject = String(body?.subject || '').trim()
      const bodyText = String(body?.body || '').trim()

      if (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
        return NextResponse.json(
          { ok: false, error: 'Unesite valjanu e-mail adresu primatelja.' },
          { status: 400 }
        )
      }
      if (!subject || !bodyText) {
        return NextResponse.json(
          { ok: false, error: 'Predmet i tekst zahvale ne smiju biti prazni.' },
          { status: 400 }
        )
      }

      const built = buildDonationThankYouEmailHtml({
        donor,
        subject,
        bodyText,
        sender: senderIdentity,
        appSettings,
        forBrowserPreview: false,
      })

      const delivery = await deliverDonationThankYouEmail({
        to: recipientEmail,
        subject: built.subject,
        html: built.html,
        plainText: built.plainText,
        inlineAttachments: built.inlineAttachments,
        campaignSettings,
        appSettings,
        sender: senderIdentity,
        website: donor.website,
        oib: donor.oib,
        isTest: false,
      })

      if (!delivery.sent) {
        return NextResponse.json(
          { ok: false, error: delivery.error || 'Slanje e-mail zahvale nije uspjelo.' },
          { status: 500 }
        )
      }

      const nowIso = new Date().toISOString()
      const saved = recordThankYouSent({
        leadId: donor.leadId,
        sentId: donor.sentId,
        recipientEmail,
        contactPerson: donor.contactPerson,
        subject: built.subject,
        body: bodyText,
        sentAtIso: nowIso,
      })

      try {
        const amountLabel = donor.donatedAmount ? `${donor.donatedAmount} EUR` : 'donacija'
        const dateLabel = donor.donatedAt ? formatDateDMY(donor.donatedAt, donor.donatedAt) : '—'
        DatabaseService.insertLog({
          userId: auth.actor.id || 'admin',
          userName: auth.actor.name || 'Administrator',
          userRole: auth.actor.role || 'admin',
          action: 'Poslana zahvala za donaciju',
          details: `${auth.actor.name || 'Administrator'} poslao je personaliziranu zahvalu za donaciju (${amountLabel}, datum ${dateLabel}) donatoru "${donor.name}" na ${recipientEmail}.`,
          timestamp: nowIso,
        })
      } catch {}

      return NextResponse.json({
        ok: true,
        channel: delivery.channel,
        sentAt: nowIso,
        sentTo: recipientEmail,
        lead: saved.lead,
        sentItem: saved.sentItem,
        message: `Personalizirana zahvala za donaciju uspješno je poslana na ${recipientEmail}!`,
      })
    }

    return NextResponse.json({ ok: false, error: 'Nepoznata akcija.' }, { status: 400 })
  } catch (err: any) {
    if (err instanceof DoNotContactBlockedError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 403 })
    }
    return NextResponse.json(
      { ok: false, error: err?.message || 'Greška na poslužitelju pri obradi zahvale.' },
      { status: 500 }
    )
  }
}
