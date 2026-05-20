import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/mail'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, name, tempPassword } = body

    console.log('Slanje pozivnice za:', { email, name })

    if (!email || !name || !tempPassword) {
      return NextResponse.json({ 
        error: 'Nedostaju podaci za slanje pozivnice (email, ime ili lozinka).' 
      }, { status: 400 })
    }

    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || request.nextUrl.host
    const protocol = request.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https')
    const origin = `${protocol}://${host}`

    const emailBody = `
Poštovani/a ${name},

Hrvatsko rodoslovno društvo "Pavao Ritter Vitezović" Vas poziva da se prijavite u naš novi sustav za evidenciju članstva.

Vaši podaci za prijavu:
Korisničko ime (Username): ${email}
Privremena lozinka: ${tempPassword}

Link za prijavu: ${origin}/

Sigurnosna napomena:
Ovo je privremena lozinka. Molimo Vas da je promijenite odmah nakon prve prijave klikom na "Postavke" u gornjem desnom kutu vašeg profila.

Srdačan pozdrav,
Tajništvo Društva`

    try {
      await sendEmail({
        to: email,
        subject: 'Pozivnica za pristup sustavu HRD',
        body: emailBody
      })
      
      console.log('Pozivnica uspješno poslana na:', email)
      return NextResponse.json({ success: true, message: 'Pozivnica poslana.' })
    } catch (smtpError: any) {
      console.error('SMTP Error in API:', smtpError)
      return NextResponse.json({ 
        error: `Greška u SMTP-u: ${smtpError.message || 'Nepoznata greška slanja'}`,
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
