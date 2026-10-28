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
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1B2B36; background-color: #F2EFE9; margin: 0; padding: 24px; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #E8E4DE; overflow: hidden; box-shadow: 0 4px 20px rgba(27, 43, 54, 0.08); }
    .header { background: #1B2B36; color: #ffffff; padding: 26px 32px; border-bottom: 3px solid #CEA369; }
    .header h2 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.01em; color: #ffffff; }
    .header p { margin: 6px 0 0; font-size: 13px; color: #CEA369; font-weight: 500; }
    .content { padding: 32px; }
    .greeting { font-size: 16px; font-weight: 700; color: #1B2B36; margin-bottom: 16px; }
    .lead { font-size: 14px; color: #334155; margin-bottom: 24px; line-height: 1.6; }
    .credentials-box { background: #FBF9F6; border-radius: 12px; border: 1px solid #E8E4DE; border-left: 4px solid #CEA369; padding: 20px; margin-bottom: 24px; }
    .btn-container { text-align: center; margin: 32px 0 28px; }
    .btn { display: inline-block; background-color: #1B2B36; color: #ffffff !important; text-decoration: none; padding: 13px 36px; border-radius: 9999px; font-weight: 700; font-size: 14px; letter-spacing: 0.03em; border: 2px solid #CEA369; box-shadow: 0 4px 14px rgba(27, 43, 54, 0.25); }
    .note { font-size: 12px; color: #6B7280; background: #FBF9F6; border: 1px solid #E8E4DE; border-radius: 8px; padding: 14px; margin-bottom: 24px; }
    .footer { font-size: 13px; color: #6B7280; border-top: 1px solid #E8E4DE; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h2>Hrvatsko rodoslovno društvo</h2>
      <p>"Pavao Ritter Vitezović" — Pozivnica za članstvo</p>
    </div>
    <div class="content">
      <div class="greeting">Poštovani/a ${name},</div>
      <div class="lead">
        Pozivamo Vas da se prijavite u naš novi sustav za evidenciju članstva.
      </div>
      
      <div class="credentials-box">
        <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; color: #CEA369; margin-bottom: 12px;">Podaci za prijavu</div>
        <div style="margin-bottom: 8px; font-size: 14px;"><strong>Korisničko ime:</strong> <code style="background: #E8E4DE; padding: 2px 8px; border-radius: 4px; color: #1B2B36;">${email}</code></div>
        <div style="font-size: 14px;"><strong>Privremena lozinka:</strong> <code style="background: #E8E4DE; padding: 2px 8px; border-radius: 4px; font-size: 15px; color: #1B2B36; font-weight: bold;">${tempPassword}</code></div>
      </div>

      <div class="btn-container">
        <a href="${origin}/" class="btn" target="_blank">Prijavite se u sustav &rarr;</a>
      </div>

      <div class="note">
        <strong style="color: #1B2B36;">Sigurnosna napomena:</strong> Ovo je privremena lozinka. Molimo Vas da je promijenite odmah nakon prve prijave klikom na "Postavke" u gornjem desnom kutu vašeg profila.
      </div>

      <div class="footer">
        Srdačan pozdrav,<br>
        <strong style="color: #1B2B36;">Tajništvo Društva</strong><br>
        <span style="font-size: 12px; color: #9CA3AF;">Hrvatsko rodoslovno društvo "Pavao Ritter Vitezović"</span>
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
