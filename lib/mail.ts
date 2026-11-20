import 'server-only'
import nodemailer from 'nodemailer'
import { SettingsService } from '@/src/services/settings-service'
import { assertEmailsAllowedToContact } from '@/lib/do-not-contact'

const settingsService = new SettingsService()

interface SendEmailParams {
  to: string
  cc?: string
  bcc?: string
  subject: string
  body?: string
  html?: string
  config?: any
  attachments?: {
    filename: string
    content?: any
    path?: string
    cid?: string
    encoding?: string
    contentType?: string
    contentDisposition?: 'inline' | 'attachment'
  }[]
}
let cachedTransporter: nodemailer.Transporter | null = null;
let lastConfigKey: string | null = null;

export async function sendEmail({ to, cc, bcc, subject, body, html, config, attachments }: SendEmailParams) {
  // Stroga poslužiteljska zaštita: članovi s oznakom "Ne kontaktirati" nikada ne smiju primiti e-mail
  assertEmailsAllowedToContact(to, cc, bcc)

  // If config is not provided, load from DB using the new Service
  const settingsFromDb: any = config ? {} : await settingsService.getSettings()
  
  const host = (config?.smtpHost || settingsFromDb?.smtpHost || '').trim()
  const port = Number(config?.smtpPort || settingsFromDb?.smtpPort) || 587
  const user = (config?.smtpUser || settingsFromDb?.smtpUser || '').trim()
  const rawPass = (config?.smtpPass || settingsFromDb?.smtpPass || '')
  let pass = typeof rawPass === 'string' ? rawPass.trim() : String(rawPass || '')
  if (host.includes('gmail') && pass.includes(' ')) {
    pass = pass.replace(/\s+/g, '')
  }
  const secure = config?.smtpSecure !== undefined ? Boolean(config.smtpSecure) : Boolean(settingsFromDb?.smtpSecure)
  const from = (config?.smtpFrom || settingsFromDb?.smtpFrom || '').trim()

  if (!host) {
    console.error('SMTP Error: Host not found in config or DB', { config, settingsFromDb })
    throw new Error('SMTP poslužitelj nije konfiguriran.')
  }

  const configKey = `${host}:${port}:${user}:${pass}:${secure}`

  if (!cachedTransporter || lastConfigKey !== configKey) {
    cachedTransporter = nodemailer.createTransport({
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      host,
      port,
      secure: secure && (port === 465),
      auth: {
        user: user || '',
        pass: pass || '',
      },
      tls: {
        rejectUnauthorized: false
      }
    })
    lastConfigKey = configKey
  }

  const fromEmail = from || user || 'noreply@rodoslovlje.hr'

  try {
    const info = await cachedTransporter.sendMail({
      from: `"Hrvatsko rodoslovno društvo „Pavao Ritter Vitezović”" <${fromEmail}>`,
      to,
      ...(cc ? { cc } : {}),
      ...(bcc ? { bcc } : {}),
      subject,
      text: body,
      html: html || (body ? body.replace(/\n/g, '<br>') : ''),
      attachments: attachments || [],
    })

    console.log('Email sent: %s', info.messageId)
    return { success: true, messageId: info.messageId }
  } catch (error: any) {
    console.error('SMTP error:', error)
    cachedTransporter = null
    lastConfigKey = null
    throw new Error(`Greška pri slanju: ${error.message}`)
  }
}
