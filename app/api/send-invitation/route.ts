import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/mail'
import { MemberService } from '@/src/services/member-service'

const memberService = new MemberService()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { memberId, email, name, tempPassword, subject, customBody } = body

    console.log('Slanje pozivnice za:', { memberId, email, name })

    if (!email || !name || !tempPassword) {
      return NextResponse.json({ 
        error: 'Nedostaju obvezni podaci za slanje pozivnice (email, ime ili lozinka).' 
      }, { status: 400 })
    }

    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || request.nextUrl.host
    const protocol = request.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https')
    const origin = `${protocol}://${host}`

    const emailSubject = subject?.trim() || 'Pozivnica za pristup sustavu HRD'

    const defaultText = `Poštovani/a ${name},

Hrvatsko rodoslovno društvo "Pavao Ritter Vitezović" Vas poziva da se prijavite u naš novi sustav za evidenciju članstva.

Vaši podaci za prijavu:
Korisničko ime (Username): ${email}
Privremena lozinka: ${tempPassword}

Link za prijavu: ${origin}/

Sigurnosna napomena:
Ovo je privremena lozinka. Molimo Vas da je promijenite odmah nakon prve prijave klikom na "Postavke" u gornjem desnom kutu vašeg profila.

Srdačan pozdrav,
Hrvatsko rodoslovno društvo "Pavao Ritter Vitezović"`

    const emailText = customBody?.trim() ? customBody.trim() : defaultText

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 24px; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .header { background: #1e3a8a; color: #ffffff; padding: 24px 32px; }
    .header h2 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }
    .header p { margin: 6px 0 0; font-size: 13px; color: #93c5fd; }
    .content { padding: 32px; }
    .greeting { font-size: 16px; font-weight: 600; color: #0f172a; margin-bottom: 16px; }
    .lead { font-size: 14px; color: #334155; margin-bottom: 24px; }
    .credentials-box { background: #f1f5f9; border-radius: 12px; border: 1px solid #cbd5e1; padding: 20px; margin-bottom: 24px; }
    .cred-row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px; }
    .cred-row:last-child { margin-bottom: 0; }
    .cred-label { color: #64748b; font-size: 13px; font-weight: 500; }
    .cred-value { font-family: monospace; font-weight: 700; color: #0f172a; }
    .btn-container { text-align: center; margin: 28px 0; }
    .btn { display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 14px; }
    .note { font-size: 12px; color: #64748b; background: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 12px; margin-bottom: 24px; }
    .footer { font-size: 13px; color: #475569; border-top: 1px solid #e2e8f0; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h2>Hrvatsko rodoslovno društvo</h2>
      <p>"Pavao Ritter Vitezović"</p>
    </div>
    <div class="content">
      <div class="greeting">Poštovani/a ${name},</div>
      <div class="lead">
        Pozivamo Vas da se prijavite u naš novi sustav za evidenciju članstva.
      </div>
      
      <div class="credentials-box">
        <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; color: #475569; margin-bottom: 12px;">Podaci za prijavu</div>
        <div style="margin-bottom: 8px;"><strong>Korisničko ime:</strong> <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${email}</code></div>
        <div><strong>Privremena lozinka:</strong> <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-size: 15px; color: #1d4ed8;">${tempPassword}</code></div>
      </div>

      <div class="btn-container">
        <a href="${origin}/" class="btn" target="_blank">Prijavite se u sustav</a>
      </div>

      <div class="note">
        <strong>Sigurnosna napomena:</strong> Ovo je privremena lozinka generirana od strane administratora. Molimo Vas da je promijenite odmah nakon prve prijave klikom na "Postavke" u gornjem desnom kutu vašeg profila.
      </div>

      <div class="footer">
        Srdačan pozdrav,<br>
        <strong>Tajništvo Društva</strong><br>
        <span style="font-size: 12px; color: #94a3b8;">Hrvatsko rodoslovno društvo "Pavao Ritter Vitezović"</span>
      </div>
    </div>
  </div>
</body>
</html>`

    const sentAt = new Date().toISOString()

    try {
      await sendEmail({
        to: email,
        subject: emailSubject,
        body: emailText,
        html: emailHtml
      })
      
      console.log('Pozivnica uspješno poslana na:', email, 'u', sentAt)

      // Ako je poslan memberId, ažuriraj podatke u bazi
      if (memberId) {
        try {
          await memberService.updateMember(Number(memberId), {
            invitationSent: 1,
            invitation_sent_at: sentAt,
            invitationSentAt: sentAt,
            password: tempPassword,
            is_temp_password: 1
          })
          console.log(`Član ${memberId} uspješno ažuriran s datumom pozivnice:`, sentAt)
        } catch (dbErr) {
          console.error('Greška pri ažuriranju evidencije u bazi:', dbErr)
        }
      }

      return NextResponse.json({ 
        success: true, 
        message: `Pozivnica je uspješno poslana na ${email}.`,
        sentAt,
        email,
        name
      })
    } catch (smtpError: any) {
      console.error('SMTP Error in API:', smtpError)
      return NextResponse.json({ 
        error: `Greška pri slanju emaila: ${smtpError.message || 'Provjerite SMTP postavke.'}`,
        details: smtpError.stack || 'No stack available'
      }, { status: 500 })
    }

  } catch (error: any) {
    console.error('General Invitation API error:', error)
    return NextResponse.json({ 
      error: error.message || 'Interna greška servera.',
      details: error.stack || 'No stack available'
    }, { status: 500 })
  }
}
