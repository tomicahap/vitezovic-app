import nodemailer from 'nodemailer'
import { SettingsService } from '@/src/services/settings-service'

const settingsService = new SettingsService()

interface SendEmailParams {
  to: string
  subject: string
  body?: string
  html?: string
  config?: any
  attachments?: { filename: string, content?: any, path?: string, cid?: string, encoding?: string }[]
}
let cachedTransporter: nodemailer.Transporter | null = null;
let lastHost: string | null = null;

export async function sendEmail({ to, subject, body, html, config, attachments }: SendEmailParams) {
  // If config is not provided, load from DB using the new Service
  const settingsFromDb = config ? {} : await settingsService.getSettings()
  
  const host = config?.smtpHost || settingsFromDb?.smtpHost
  const port = config?.smtpPort || settingsFromDb?.smtpPort
  const user = config?.smtpUser || settingsFromDb?.smtpUser
  const pass = config?.smtpPass || settingsFromDb?.smtpPass
  const secure = config?.smtpSecure !== undefined ? config.smtpSecure : settingsFromDb?.smtpSecure
  const from = config?.smtpFrom || settingsFromDb?.smtpFrom

  if (!host) {
    console.error('SMTP Error: Host not found in config or DB', { config, settingsFromDb })
    throw new Error('SMTP poslužitelj nije konfiguriran.')
  }

  if (!cachedTransporter || lastHost !== host) {
    cachedTransporter = nodemailer.createTransport({
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      host,
      port: Number(port) || 587,
      secure: !!secure && (Number(port) === 465),
      auth: {
        user: user || '',
        pass: pass || '',
      },
      tls: {
        rejectUnauthorized: false
      }
    })
    lastHost = host;
  }

  const fromEmail = from || user || 'noreply@rodoslovlje.hr'

  try {
    const info = await cachedTransporter.sendMail({
      from: `"HRD Pavao Ritter Vitezović" <${fromEmail}>`,
      to,
      subject,
      text: body,
      html: html || (body ? body.replace(/\n/g, '<br>') : ''),
      attachments: attachments || [],
    })

    console.log('Email sent: %s', info.messageId)
    return { success: true, messageId: info.messageId }
  } catch (error: any) {
    console.error('SMTP error:', error)
    throw new Error(`Greška pri slanju: ${error.message}`)
  }
}
