import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/mail'
import { SettingsService } from '@/src/services/settings-service'

export async function POST(request: NextRequest) {
  try {
    const config = await request.json()
    
    if (!config.smtpHost || !config.smtpFrom) {
      return NextResponse.json({ error: 'Nedostaju podaci za slanje (Host i From).' }, { status: 400 })
    }

    // Call sendEmail with the provided configuration directly (for testing)
    await sendEmail({
      to: config.smtpFrom, // Send test email to the sender's address
      subject: 'HRD CMS - Test mail za SMTP postavke',
      body: 'Ovo je testni e-mail kako bi se potvrdilo da SMTP postavke ispravno rade u sustavu HRD CMS.',
      config: {
        smtpHost: config.smtpHost,
        smtpPort: config.smtpPort,
        smtpUser: config.smtpUser,
        smtpPass: config.smtpPass,
        smtpSecure: config.smtpSecure ? 1 : 0, // Convert to DB format (integer)
        smtpFrom: config.smtpFrom
      }
    })

    return NextResponse.json({ success: true, message: 'Testni email poslan.' })
  } catch (error: any) {
    console.error('Test email error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    
    const settingsService = new SettingsService()
    const settings = await settingsService.getSettings()
    
    if (!settings || !settings.smtpFrom) {
      return NextResponse.json({ error: 'SMTP nije konfiguriran.' }, { status: 400 })
    }
    
    let subject = ''
    let body = ''
    
    if (type === 'payment') {
      subject = settings.paymentEmailSubject || 'Test: Obavijest o članarini'
      body = (settings.paymentEmailBody || '') + '\n\n' + (settings.paymentEmailSignature || '')
    } else if (type === 'invitation') {
      subject = settings.invitationEmailSubject || 'Test: Pozivnica'
      body = (settings.invitationEmailBody || '').replace('{email}', 'test@test.hr').replace('{tempPassword}', '12345').replace('{link}', 'http://localhost:3000')
    } else if (type === 'poll') {
      subject = (settings.pollEmailSubject || '').replace('{pollTitle}', 'Testno glasovanje')
      body = (settings.pollEmailBody || '').replace('{pollTitle}', 'Testno glasovanje').replace('{link}', 'http://localhost:3000/login')
    } else if (type === 'meeting') {
      subject = (settings.meetingNotificationSubject || '').replace('{NASLOV}', 'Testna sjednica')
      body = (settings.meetingNotificationBody || '').replace('{NASLOV}', 'Testna sjednica').replace('{DATUM}', '01.01.2027.').replace('{VRIJEME}', '18:00').replace('{LOKACIJA}', 'Online')
    } else if (type === 'lecture') {
      subject = (settings.lectureNotificationSubject || '').replace('{NASLOV}', 'Testno predavanje')
      body = (settings.lectureNotificationBody || '').replace('{NASLOV}', 'Testno predavanje').replace('{DATUM}', '01.01.2027.').replace('{VRIJEME}', '18:00').replace('{LOKACIJA}', 'Online').replace('{PREDAVAČ}', 'Ivan Horvat')
    } else {
      return NextResponse.json({ error: 'Nepoznat tip predloška.' }, { status: 400 })
    }

    await sendEmail({
      to: settings.smtpFrom, // Send to the admin's email
      subject: '[TEST] ' + subject,
      body: body
    })

    return NextResponse.json({ success: true, message: 'Testni email poslan.' })
  } catch (error: any) {
    console.error('Test template error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
