import { NextRequest, NextResponse } from 'next/server'
import { getCampaignSettings, insertLead, updateLead, insertManualDonation } from '@/lib/mailcrawl/db'
import { generatePersonalizedEmail } from '@/lib/mailcrawl/ai'
import { requireMailcrawlAdmin } from '@/lib/mailcrawl/auth'
import { DatabaseService } from '@/lib/database'

export async function POST(req: NextRequest) {
  const auth = requireMailcrawlAdmin(req)
  if (!auth.ok) return auth.response
  try {
    const data = await req.json().catch(() => ({}))

    if (data.isDirectDonation) {
      const requestedMemberId = Number(data.member_id)
      const hasMemberId = Number.isFinite(requestedMemberId) && requestedMemberId > 0
      let memberRecord: any = null

      if (hasMemberId) {
        memberRecord = DatabaseService.getMemberById(requestedMemberId)
        if (!memberRecord || String(memberRecord.role || '').toLowerCase() === 'admin') {
          return NextResponse.json(
            { ok: false, error: 'Odabrani član Društva nije pronađen.' },
            { status: 404 }
          )
        }
      }

      const donorName = String(data.name || memberRecord?.name || '').trim()
      if (!donorName || !data.donated_amount) {
        return NextResponse.json(
          { ok: false, error: 'Naziv donatora i iznos donacije su obavezni.' },
          { status: 400 }
        )
      }

      const donorEmail = String(data.email || memberRecord?.email || '').trim()
      const donorOib = String(data.oib || memberRecord?.oib || '').trim()
      const donorPhone = String(data.phone || memberRecord?.phone || '').trim()
      const donorAddress = String(data.address || memberRecord?.address || '').trim()

      const donorLead = insertManualDonation({
        member_id: hasMemberId ? requestedMemberId : null,
        name: donorName,
        oib: donorOib,
        email: donorEmail,
        phone: donorPhone,
        city: data.city,
        address: donorAddress,
        website: data.website,
        entity_type: hasMemberId ? 'clan' : (data.entity_type || 'fizicka_osoba'),
        donated_amount: data.donated_amount,
        donated_at: data.donated_at,
        payment_method: data.payment_method,
        donation_note: data.donation_note,
      })

      try {
        DatabaseService.insertLog({
          userId: auth.actor.id || 'admin',
          userName: auth.actor.name || 'Administrator',
          userRole: auth.actor.role || 'admin',
          action: hasMemberId
            ? 'Evidentirana donacija člana Društva'
            : 'Evidentirana direktna donacija',
          details: `${auth.actor.name || 'Administrator'} evidentirao je donaciju u iznosu ${data.donated_amount} EUR za ${
            hasMemberId ? `člana Društva #${requestedMemberId} (${donorName})` : `vanjskog donatora "${donorName}"`
          }.`,
          timestamp: new Date().toISOString(),
        })
      } catch {}

      return NextResponse.json({ ok: true, lead: donorLead, isDirectDonation: true })
    }

    if (!data.name || !data.email) {
      return NextResponse.json({ ok: false, error: 'Naziv subjekta i e-mail adresa su obavezni.' }, { status: 400 })
    }

    const insertRes = insertLead({
      ...data,
      source: 'Ručni unos'
    })

    if (!insertRes.inserted) {
      return NextResponse.json({
        ok: false,
        duplicate: true,
        error: `Zaštita od duplikata: ${insertRes.reason}`
      }, { status: 409 })
    }

    let finalLead = insertRes.lead!
    if (data.autoGenerateAi) {
      const settings = getCampaignSettings()
      const aiRes = await generatePersonalizedEmail(finalLead, settings)
      const updated = updateLead(finalLead.id!, {
        email_subject: aiRes.subject,
        email_body: aiRes.body,
        ai_personalization_note: aiRes.personalization_note,
        status: 'draft_ready'
      })
      if (updated) finalLead = updated
    }

    return NextResponse.json({ ok: true, lead: finalLead })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
