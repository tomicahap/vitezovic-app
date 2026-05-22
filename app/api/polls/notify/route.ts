import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/mail'
import { MemberService } from '@/src/services/member-service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { pollTitle, targetType, selectedMemberIds } = body

    const memberService = new MemberService()
    const allMembers = await memberService.getAllMembers()
    
    let targetMembers = []
    if (targetType === 'all') {
      targetMembers = allMembers
    } else {
      targetMembers = allMembers.filter(m => selectedMemberIds.includes(m.id))
    }

    console.log(`Slanje obavijesti o glasovanju "${pollTitle}" za ${targetMembers.length} članova.`)

    const subject = `Obavezno glasovanje: ${pollTitle}`

    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || request.nextUrl.host
    const protocol = request.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https')
    const origin = `${protocol}://${host}`
    
    const emailPromises = targetMembers.map(async (member) => {
      if (!member.email) return

      const emailBody = `
Poštovani/a ${member.name},

Obavještavamo Vas da je u sustavu HRD otvoreno novo obavezno glasovanje:

"${pollTitle}"

Molimo Vas da se prijavite u sustav kako biste dali svoj glas. Prema pravilniku Društva, Vaše sudjelovanje je obavezno za donošenje pravovaljanih odluka.

Link za prijavu: ${origin}

Srdačan pozdrav,
Tajništvo Društva`

      try {
        await sendEmail({
          to: member.email,
          subject: subject,
          body: emailBody
        })
      } catch (e) {
        console.error(`Greška pri slanju maila članu ${member.email}:`, e)
      }
    })

    await Promise.all(emailPromises)

    return NextResponse.json({ success: true, message: `Poslano ${targetMembers.length} obavijesti.` })
  } catch (error: any) {
    console.error('General Notification API error:', error)
    return NextResponse.json({ error: error.message || 'Interna greška servera.' }, { status: 500 })
  }
}
