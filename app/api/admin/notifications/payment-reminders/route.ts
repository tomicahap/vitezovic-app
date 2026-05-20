import { NextRequest, NextResponse } from 'next/server'
import { MemberService } from '@/src/services/member-service'
import { SettingsService } from '@/src/services/settings-service'
import { sendEmail } from '@/lib/mail'
import { computeMemberStates, StatusSettings } from '@/lib/member-status'

const memberService = new MemberService()
const settingsService = new SettingsService()

export async function POST(request: NextRequest) {
  try {
    const settings = await settingsService.getSettings()
    if (!settings) {
      return NextResponse.json({ error: 'Postavke nisu pronađene.' }, { status: 404 })
    }

    if (!settings.smtpHost || !settings.smtpFrom) {
      return NextResponse.json({ error: 'SMTP nije konfiguriran.' }, { status: 400 })
    }

    const body = await request.json()
    const { memberId } = body

    let membersToNotify = []

    if (memberId) {
      const member = await memberService.getMember(memberId)
      if (!member) {
        return NextResponse.json({ error: 'Član nije pronađen.' }, { status: 404 })
      }
      membersToNotify = [member]
    } else {
      const members = await memberService.getAllMembers()
      const statusSettings: StatusSettings = {
        overdueAfterDays: settings.overdueAfterDays || 365,
        expiredAfterDays: settings.expiredAfterDays || 730
      }

      // Filter members with status "DUG"
      membersToNotify = members.filter(m => {
        const state = computeMemberStates(m, statusSettings)
        return state.status_clana === 'DUG'
      })

      if (membersToNotify.length === 0) {
        return NextResponse.json({ success: true, count: 0, message: 'Nema članova sa statusom DUG.' })
      }
    }

    let sentCount = 0
    let errorCount = 0

    // Prepare attachments
    const attachments = []
    if (settings.paymentSlipUrl && settings.paymentSlipUrl.includes(',')) {
      attachments.push({
        filename: 'uplatnica.png',
        content: settings.paymentSlipUrl.split(',')[1],
        encoding: 'base64'
      })
    }
    if (settings.paymentQrUrl && settings.paymentQrUrl.includes(',')) {
      attachments.push({
        filename: '3d-qr-kod.png',
        content: settings.paymentQrUrl.split(',')[1],
        encoding: 'base64'
      })
    }

    const subject = settings.paymentEmailSubject || 'Obavijest o članarini'
    const bodyTemplate = settings.paymentEmailBody || 'Poštovani, molimo Vas da podmirite članarinu.'
    const signature = settings.paymentEmailSignature || ''
    
    const fullBodyTemplate = `${bodyTemplate}\n\n${signature}`

    const emailPromises = membersToNotify.map(async (member) => {
      if (!member.email) return

      try {
        const body = fullBodyTemplate
          .replace(/{{name}}/g, member.name)
          .replace(/{{ime}}/g, member.name)

        await sendEmail({
          to: member.email,
          subject,
          body,
          config: settings, // Pass config to avoid refetching
          attachments
        })
        
        // Zapiši trag kod člana
        await memberService.updateMember(member.id, {
          ...member,
          lastPaymentReminderAt: new Date().toISOString()
        })
        
        sentCount++
      } catch (err) {
        console.error(`Failed to send email to ${member.email}:`, err)
        errorCount++
      }
    })

    await Promise.all(emailPromises)

    return NextResponse.json({ 
      success: true, 
      count: sentCount, 
      errors: errorCount,
      message: `Poslano ${sentCount} obavijesti, ${errorCount} pogrešaka.` 
    })

  } catch (error: any) {
    console.error('Bulk notification error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
