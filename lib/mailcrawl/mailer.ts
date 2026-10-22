import nodemailer from 'nodemailer'
import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
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
 * Retrieves the official society logo from the main app database or public files.
 */
export function getAppLogo(): { dataUrl: string; buffer: Buffer; mime: string } | null {
  try {
    const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'app.db')
    if (fs.existsSync(dbPath)) {
      const appDb = new Database(dbPath, { readonly: true })
      const row = appDb.prepare('SELECT logoUrl FROM settings LIMIT 1').get() as { logoUrl?: string } | undefined
      appDb.close()
      if (row?.logoUrl && row.logoUrl.startsWith('data:image/')) {
        const parts = row.logoUrl.split(',')
        const mimeMatch = parts[0].match(/:(.*?);/)
        const mime = mimeMatch ? mimeMatch[1] : 'image/png'
        const buffer = Buffer.from(parts[1], 'base64')
        return { dataUrl: row.logoUrl, buffer, mime }
      }
    }
  } catch (e: any) {
    console.error('Greška pri dohvatu logotipa društva:', e.message)
  }

  try {
    const fallbackPath = path.join(process.cwd(), 'public', 'placeholder-logo.png')
    if (fs.existsSync(fallbackPath)) {
      const buffer = fs.readFileSync(fallbackPath)
      const dataUrl = `data:image/png;base64,${buffer.toString('base64')}`
      return { dataUrl, buffer, mime: 'image/png' }
    }
  } catch {}

  return null
}

/**
 * Builds both the HTML and Plain Text email content, including the donation payment box,
 * optional HUB-3A 2D barcode, and the official society logo in the signature.
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

  // Logo in signature
  const logoInfo = getAppLogo()
  let logoImgHtml = ''
  let logoAttachment: { filename: string; content: Buffer; cid: string; contentType: string } | null = null

  if (logoInfo) {
    if (useCidForBarcode) {
      logoImgHtml = `<img src="cid:orglogo@rodoslovlje.hr" alt="Logo" width="56" height="56" style="width: 56px; height: 56px; border-radius: 50%; object-fit: cover; display: block; border: 1px solid #cbd5e1;" />`
      logoAttachment = {
        filename: 'rodoslovlje-logo.png',
        content: logoInfo.buffer,
        cid: 'orglogo@rodoslovlje.hr',
        contentType: logoInfo.mime
      }
    } else {
      logoImgHtml = `<img src="${logoInfo.dataUrl}" alt="Logo" width="56" height="56" style="width: 56px; height: 56px; border-radius: 50%; object-fit: cover; display: block; border: 1px solid #cbd5e1;" />`
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

    <!-- Potpis s logotipom društva -->
    <div style="margin-top: 24px; padding-top: 18px; border-top: 1px solid #e2e8f0;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          ${logoImgHtml ? `
            <td style="width: 68px; vertical-align: top; padding-right: 14px;">
              ${logoImgHtml}
            </td>
          ` : ''}
          <td style="vertical-align: top; font-size: 13.5px; line-height: 1.6; color: #334155;">
            ${signatureHtml}
          </td>
        </tr>
      </table>
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
  const port = parseInt(settings.smtp_port || '465', 10)
  const secure = String(settings.smtp_secure) === 'true' || port === 465
  const user = (settings.smtp_user || 'rodoslovlje@rodoslovlje.hr').trim()
  const pass = settings.smtp_pass || ''

  if (!host || !user || !pass) {
    throw new Error('SMTP postavke nisu potpune. Unesite SMTP poslužitelj, korisničko ime i lozinku u Postavkama.')
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 8000,
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

  const info = await transporter.sendMail({
    from: `"${senderName.replace(/"/g, '')}" <${senderEmail}>`,
    replyTo: senderEmail,
    to: recipient,
    subject: (lead.email_subject || 'Poziv na podršku očuvanju hrvatske rodoslovne baštine').trim(),
    text: plainText,
    html,
    attachments
  })

  return info
}
