import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/mail'

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
