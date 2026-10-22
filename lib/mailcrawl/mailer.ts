import nodemailer from 'nodemailer'
import { generateHub3BarcodeBuffer } from './hub3'
import type { CampaignSettings, Lead } from './types'

function escapeHtml(str: string | undefined): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function resolveReference(settings: CampaignSettings, lead?: Partial<Lead>): string {
  let ref = (settings.payment_reference || '2026-DONACIJA').trim()
  if (lead && lead.oib && ref.includes('{OIB}')) {
    ref = ref.replace('{OIB}', lead.oib)
  } else if (ref.includes('{OIB}')) {
    ref = ref.replace('{OIB}', new Date().getFullYear().toString())
  }
  return ref
}

/**
 * Parses custom campaign logo if uploaded by the user in campaign settings.
 * Does NOT pull automatically from main app.db per user instruction.
 */
export function getCampaignLogo(settings: CampaignSettings): { dataUrl: string; buffer: Buffer; mime: string } | null {
  try {
    const raw = (settings.custom_logo || '').trim()
    if (raw && raw.startsWith('data:image/')) {
      const parts = raw.split(',')
      const mimeMatch = parts[0].match(/:(.*?);/)
      const mime = mimeMatch ? mimeMatch[1] : 'image/png'
      const buffer = Buffer.from(parts[1], 'base64')
      return { dataUrl: raw, buffer, mime }
    }
  } catch (e: any) {
    console.error('Greška pri obradi logotipa kampanje:', e.message)
  }
  return null
}

/**
 * Builds both the HTML and Plain Text email content, including the donation payment box,
 * optional HUB-3A 2D barcode, and the custom uploaded campaign logo in the signature.
 */
export async function composeEmailContent(
  lead: Partial<Lead>,
  settings: CampaignSettings,
  useCidForBarcode: boolean = false
): Promise<{
  html: string
  plainText: string
  barcodeBuffer: Buffer | null
  barcodeDataUrl: string
  logoAttachment: { filename: string; content: Buffer; cid: string; contentType: string } | null
}> {
  const bodyText = (lead.email_body || '').trim()
  const signatureText = (settings.email_signature || 'Srdačan pozdrav,\nHrvatsko rodoslovno društvo\nrodoslovlje@rodoslovlje.hr').trim()
  const ref = resolveReference(settings, lead)
  const rawAmount = parseFloat(String(settings.suggested_amount_eur || '0').replace(',', '.'))
  const amountDisplay = !isNaN(rawAmount) && rawAmount > 0
    ? `${rawAmount.toFixed(2).replace('.', ',')} EUR (ili proizvoljni iznos prema Vašim mogućnostima)`
    : 'Proizvoljni iznos prema Vašim mogućnostima'

  let barcodeBuffer: Buffer | null = null
  let barcodeDataUrl = ''
  const includeBarcode = String(settings.include_hub3_barcode) !== 'false'

  if (includeBarcode) {
    try {
      const res = await generateHub3BarcodeBuffer(settings, lead)
      barcodeBuffer = res.pngBuffer
      barcodeDataUrl = `data:image/png;base64,${res.pngBuffer.toString('base64')}`
    } catch (err: any) {
      console.error('Greška pri generiranju HUB3 barkoda:', err.message)
    }
  }

  // Custom uploaded logo in signature (only if uploaded)
  const logoInfo = getCampaignLogo(settings)
  let logoImgHtml = ''
  let logoAttachment: { filename: string; content: Buffer; cid: string; contentType: string } | null = null

  if (logoInfo) {
    if (useCidForBarcode) {
      logoImgHtml = `<img src="cid:campaignlogo@rodoslovlje.hr" alt="Logo" style="max-width: 140px; max-height: 70px; object-fit: contain; display: block;" />`
      logoAttachment = {
        filename: 'campaign-logo.png',
        content: logoInfo.buffer,
        cid: 'campaignlogo@rodoslovlje.hr',
        contentType: logoInfo.mime
      }
    } else {
      logoImgHtml = `<img src="${logoInfo.dataUrl}" alt="Logo" style="max-width: 140px; max-height: 70px; object-fit: contain; display: block;" />`
    }
  }

  // Convert body paragraphs to HTML
  const paragraphsHtml = bodyText
    .split(/\n\s*\n/)
    .map(p => `<p style="margin: 0 0 14px 0; line-height: 1.65; color: #1f2937; font-size: 15px;">${escapeHtml(p.trim()).replace(/\n/g, '<br>')}</p>`)
    .join('')

  const signatureHtml = escapeHtml(signatureText).replace(/\n/g, '<br>')
  const barcodeImgSrc = useCidForBarcode ? 'cid:hub3barcode@rodoslovlje.hr' : barcodeDataUrl

  const barcodeHtmlBlock = (includeBarcode && barcodeBuffer) ? `
    <div style="margin-top: 16px; padding-top: 14px; border-top: 1px dashed #cbd5e1; text-align: center;">
      <div style="font-size: 12px; color: #475569; margin-bottom: 8px; font-weight: 600;">
        2D barkod za brzu uplatu donacije putem mobilnog bankarstva (HUB-3A):
      </div>
      <img src="${barcodeImgSrc}" alt="HUB-3A 2D barkod za donaciju" style="max-width: 260px; height: auto; border: 1px solid #e2e8f0; padding: 6px; background: #ffffff; border-radius: 6px;" />
      <div style="font-size: 11px; color: #64748b; margin-top: 4px;">
        Skenirajte barkod u aplikaciji Vaše banke (iznos možete slobodno prilagoditi prije potvrde).
      </div>
    </div>
  ` : ''

  const html = `<!DOCTYPE html>
<html lang="hr">
<head>
  <meta charset="UTF-8">
</head>
<body style="margin: 0; padding: 20px; background-color: #f8fafc; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <div style="max-width: 640px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; border: 1px solid #e2e8f0; padding: 28px 32px;">
    ${paragraphsHtml}

    <div style="margin: 22px 0; padding: 18px 20px; background-color: #f8fafc; border-left: 4px solid #7c2d12; border-radius: 6px; border-top: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0;">
      <div style="font-size: 14px; font-weight: 700; color: #7c2d12; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 10px;">
        Podaci za uplatu donacije
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 13.5px; color: #1e293b;">
        <tr>
          <td style="padding: 4px 0; color: #64748b; width: 155px;">Primatelj:</td>
          <td style="padding: 4px 0; font-weight: 600;">${escapeHtml(settings.org_name)}, ${escapeHtml(settings.org_street)}, ${escapeHtml(settings.org_city)}</td>
        </tr>
        ${settings.org_oib ? `<tr>
          <td style="padding: 4px 0; color: #64748b;">OIB društva:</td>
          <td style="padding: 4px 0;">${escapeHtml(settings.org_oib)}</td>
        </tr>` : ''}
        <tr>
          <td style="padding: 4px 0; color: #64748b;">IBAN račun:</td>
          <td style="padding: 4px 0; font-weight: 700; color: #0f172a; font-family: monospace; font-size: 14.5px;">${escapeHtml(settings.org_iban)}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #64748b;">Model i poziv na br.:</td>
          <td style="padding: 4px 0; font-family: monospace;">${escapeHtml(settings.payment_model)} ${escapeHtml(ref)}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #64748b;">Opis plaćanja:</td>
          <td style="padding: 4px 0;">${escapeHtml(settings.payment_description)}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #64748b;">Iznos donacije:</td>
          <td style="padding: 4px 0; font-weight: 600; color: #15803d;">${escapeHtml(amountDisplay)}</td>
        </tr>
      </table>
      ${barcodeHtmlBlock}
    </div>

    <!-- Potpis s logotipom društva (logo ispod potpisa) -->
    <div style="margin-top: 24px; padding-top: 18px; border-top: 1px solid #e2e8f0;">
      <div style="font-size: 13.5px; line-height: 1.6; color: #334155;">
        ${signatureHtml}
      </div>
      ${logoImgHtml ? `
      <div style="margin-top: 14px;">
        ${logoImgHtml}
      </div>` : ''}
    </div>
  </div>
</body>
</html>`

  const plainText = `${bodyText}

--------------------------------------------------
PODACI ZA UPLATU DONACIJE:
Primatelj: ${settings.org_name}, ${settings.org_street}, ${settings.org_city}${settings.org_oib ? ` (OIB: ${settings.org_oib})` : ''}
IBAN: ${settings.org_iban}
Model i poziv na broj: ${settings.payment_model} ${ref}
Opis plaćanja: ${settings.payment_description}
Iznos: ${amountDisplay}
--------------------------------------------------

${signatureText}`

  return {
    html,
    plainText,
    barcodeBuffer,
    barcodeDataUrl,
    logoAttachment
  }
}

export function createSmtpTransporter(settings: CampaignSettings) {
  const host = (settings.smtp_host || '').trim()
  const port = parseInt(String(settings.smtp_port || '465'), 10)
  const isExplicitSecure = String(settings.smtp_secure) === 'true'
  // Port 465 is SSL (secure = true). Port 587 or 25 is STARTTLS (secure = false).
  const secure = port === 465 ? true : (port === 587 || port === 25 ? false : isExplicitSecure)
  const user = (settings.smtp_user || '').trim()
  let pass = settings.smtp_pass || ''
  if (host.includes('gmail') && pass.includes(' ')) {
    pass = pass.replace(/\s+/g, '')
  }

  if (!host || !user || !pass) {
    throw new Error('SMTP postavke nisu potpune. Unesite SMTP poslužitelj, korisničko ime i lozinku u Postavkama.')
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    connectionTimeout: 20000,
    greetingTimeout: 20000,
    socketTimeout: 20000,
    tls: {
      rejectUnauthorized: false
    }
  })
}

export async function verifySmtpConnection(settings: CampaignSettings): Promise<boolean> {
  const transporter = createSmtpTransporter(settings)
  await transporter.verify()
  return true
}

export async function sendDonationEmail(
  lead: Partial<Lead>,
  settings: CampaignSettings,
  customRecipient: string | null = null
): Promise<any> {
  const transporter = createSmtpTransporter(settings)
  const recipient = (customRecipient || lead.email || '').trim()
  if (!recipient) {
    throw new Error('Primatelj nema unesenu e-mail adresu.')
  }

  const senderEmail = (settings.sender_email || 'rodoslovlje@rodoslovlje.hr').trim()
  const senderName = (settings.sender_name || settings.org_name || 'Hrvatsko rodoslovno društvo').trim()

  const { html, plainText, barcodeBuffer, logoAttachment } = await composeEmailContent(lead, settings, true)

  const attachments: any[] = []
  if (barcodeBuffer && String(settings.include_hub3_barcode) !== 'false') {
    attachments.push({
      filename: 'donacija-2d-barkod.png',
      content: barcodeBuffer,
      cid: 'hub3barcode@rodoslovlje.hr'
    })
  }

  if (logoAttachment) {
    attachments.push(logoAttachment)
  }

  // Personalize recipient 'To' header with contact person and entity name
  const contact = (lead.contact_person || '').trim().replace(/"/g, '')
  const company = (lead.name || '').trim().replace(/"/g, '')
  let formattedTo = recipient
  if (customRecipient) {
    formattedTo = recipient
  } else if (contact && company) {
    formattedTo = `"${contact} (${company})" <${recipient}>`
  } else if (contact) {
    formattedTo = `"${contact}" <${recipient}>`
  } else if (company) {
    formattedTo = `"${company}" <${recipient}>`
  }

  const info = await transporter.sendMail({
    from: `"${senderName.replace(/"/g, '')}" <${senderEmail}>`,
    replyTo: senderEmail,
    to: formattedTo,
    subject: (lead.email_subject || 'Poziv na podršku očuvanju hrvatske rodoslovne baštine').trim(),
    text: plainText,
    html,
    attachments
  })

  return info
}
