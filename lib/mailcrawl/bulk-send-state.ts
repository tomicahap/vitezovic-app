import 'server-only'
import {
  db,
  getCampaignSettings,
  getDailySentCount,
  isOptedOut,
  normalizeEmail,
  recordSentMail,
  updateLead,
} from './db'
import { createPooledSmtpTransporter, sendDonationEmail } from './mailer'
import { buildGreeting, buildSmartFallbackEmail, capitalizeRespectfulPronouns } from './ai'
import { assertEmailsAllowedToContact } from '@/lib/do-not-contact'
import { DatabaseService } from '@/lib/database'
import { abortableSleep } from '@/lib/ndjson-stream'
import type {
  Lead,
  SentRegistryItem,
  BulkSendJobState,
  BulkSendLogItem,
  PreflightSummary,
} from './types'
import type { TrashActor } from '@/lib/trash'

export type { BulkSendJobState, BulkSendLogItem, PreflightSummary }

const globalForBulkSend = globalThis as unknown as {
  __mailcrawlBulkSendJob?: BulkSendJobState
  __mailcrawlBulkSendAbort?: AbortController | null
}

function createInitialState(): BulkSendJobState {
  const settings = getCampaignSettings()
  const parsedLimit = parseInt(String(settings.bulk_send_daily_limit || '150'), 10)
  return {
    running: false,
    cancelled: false,
    mode: 'initial',
    total: 0,
    processed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    currentLeadId: null,
    currentName: '',
    currentEmail: '',
    delaySec: parseFloat(String(settings.bulk_send_delay_sec || '3.5')) || 3.5,
    startedAt: null,
    finishedAt: null,
    pausedReason: null,
    consecutiveErrors: 0,
    dailySentCount: getDailySentCount(),
    dailyLimit: Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 150,
    logs: [],
  }
}

export function getBulkSendJobState(): BulkSendJobState {
  if (!globalForBulkSend.__mailcrawlBulkSendJob) {
    globalForBulkSend.__mailcrawlBulkSendJob = createInitialState()
  }
  const job = globalForBulkSend.__mailcrawlBulkSendJob
  job.dailySentCount = getDailySentCount()
  const settings = getCampaignSettings()
  const parsedLimit = parseInt(String(settings.bulk_send_daily_limit || '150'), 10)
  if (Number.isFinite(parsedLimit) && parsedLimit > 0) {
    job.dailyLimit = parsedLimit
  }
  return job
}

function addBulkLog(
  msg: string,
  type: 'info' | 'success' | 'warn' | 'error' | 'done' = 'info'
) {
  const job = getBulkSendJobState()
  job.logs.push({
    time: new Date().toLocaleTimeString('hr-HR'),
    message: msg,
    type,
  })
  if (job.logs.length > 250) {
    job.logs.shift()
  }
}

export function cancelBulkSendJob(): boolean {
  const job = getBulkSendJobState()
  if (!job.running) return false
  job.cancelled = true
  job.pausedReason = 'Slanje zaustavljeno od strane administratora.'
  if (globalForBulkSend.__mailcrawlBulkSendAbort) {
    try {
      globalForBulkSend.__mailcrawlBulkSendAbort.abort(new Error('Zaustavljeno od strane korisnika'))
    } catch {}
  }
  addBulkLog('Zahtjev za zaustavljanjem slanja zaprimljen...', 'warn')
  return true
}

function clampDelaySec(val?: number): number {
  const n = Number(val)
  if (!Number.isFinite(n)) return 3.5
  return Math.min(Math.max(n, 1.5), 15)
}

function validateSmtpSettingsOrThrow() {
  const settings = getCampaignSettings()
  if (!settings.smtp_host?.trim() || !settings.smtp_user?.trim() || !settings.smtp_pass?.trim()) {
    throw new Error(
      'SMTP postavke nisu potpune. Unesite SMTP poslužitelj, korisničko ime i lozinku u Postavkama kampanje.'
    )
  }
  return settings
}

export function analyzeInitialBulkLeads(
  leadIds: number[],
  autoFillTemplate: boolean
): { eligible: Lead[]; preflight: PreflightSummary } {
  const cleanIds = Array.from(new Set(leadIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)))
  if (cleanIds.length === 0) {
    return {
      eligible: [],
      preflight: {
        totalRequested: 0,
        eligibleCount: 0,
        skippedCount: 0,
        skippedAlreadySent: 0,
        skippedBlocked: 0,
        skippedMissingEmail: 0,
        skippedMissingDraft: 0,
        skippedInvalidOrRejected: 0,
      },
    }
  }

  const placeholders = cleanIds.map(() => '?').join(',')
  const rows = db.prepare(`SELECT * FROM leads WHERE id IN (${placeholders})`).all(...cleanIds) as Lead[]
  const rowMap = new Map<number, Lead>(rows.map((r) => [Number(r.id), r]))

  const eligible: Lead[] = []
  const seenEmails = new Set<string>()
  let skippedAlreadySent = 0
  let skippedBlocked = 0
  let skippedMissingEmail = 0
  let skippedMissingDraft = 0
  let skippedInvalidOrRejected = 0

  for (const id of cleanIds) {
    const lead = rowMap.get(id)
    if (!lead) {
      skippedInvalidOrRejected++
      continue
    }
    if (lead.status === 'rejected' || lead.status === 'donor' || lead.is_invalid_email === 1) {
      skippedInvalidOrRejected++
      continue
    }
    if (lead.status === 'sent') {
      skippedAlreadySent++
      continue
    }

    const emailNorm = normalizeEmail(lead.email)
    if (!emailNorm || !emailNorm.includes('@')) {
      skippedMissingEmail++
      continue
    }

    if (seenEmails.has(emailNorm)) {
      skippedAlreadySent++
      continue
    }

    const alreadyInSent = db.prepare('SELECT id FROM sent_registry WHERE email_norm = ?').get(emailNorm)
    if (alreadyInSent) {
      skippedAlreadySent++
      continue
    }

    let blocked = false
    try {
      assertEmailsAllowedToContact(emailNorm)
    } catch {
      blocked = true
    }
    if (!blocked) {
      const opt = isOptedOut({ email: emailNorm, website: lead.website, oib: lead.oib })
      if (opt.optedOut) blocked = true
    }
    if (blocked) {
      skippedBlocked++
      continue
    }

    if (!autoFillTemplate && (!lead.email_subject?.trim() || !lead.email_body?.trim())) {
      skippedMissingDraft++
      continue
    }

    seenEmails.add(emailNorm)
    eligible.push(lead)
  }

  const skippedCount =
    skippedAlreadySent +
    skippedBlocked +
    skippedMissingEmail +
    skippedMissingDraft +
    skippedInvalidOrRejected

  return {
    eligible,
    preflight: {
      totalRequested: cleanIds.length,
      eligibleCount: eligible.length,
      skippedCount,
      skippedAlreadySent,
      skippedBlocked,
      skippedMissingEmail,
      skippedMissingDraft,
      skippedInvalidOrRejected,
    },
  }
}

export function startBulkDonationSend(options: {
  leadIds: number[]
  delaySec?: number
  autoFillTemplate?: boolean
  actor?: TrashActor
}): { started: boolean; preflight: PreflightSummary; job: BulkSendJobState } {
  const current = getBulkSendJobState()
  if (current.running) {
    throw new Error('Skupno slanje donacijskih e-mailova je već u tijeku. Pričekajte završetak ili ga zaustavite.')
  }

  const settings = validateSmtpSettingsOrThrow()
  const delaySec = clampDelaySec(
    options.delaySec ?? (parseFloat(String(settings.bulk_send_delay_sec || '3.5')) || 3.5)
  )
  const autoFillTemplate = Boolean(options.autoFillTemplate)
  const { eligible, preflight } = analyzeInitialBulkLeads(options.leadIds, autoFillTemplate)

  if (eligible.length === 0) {
    throw new Error('Nijedan odabrani kontakt ne ispunjava uvjete za slanje (provjerite nacrte, e-mailove i postojeće slanje).')
  }

  const abortController = new AbortController()
  globalForBulkSend.__mailcrawlBulkSendAbort = abortController

  const dailyLimitParsed = parseInt(String(settings.bulk_send_daily_limit || '150'), 10)
  const job: BulkSendJobState = {
    running: true,
    cancelled: false,
    mode: 'initial',
    total: eligible.length,
    processed: 0,
    sent: 0,
    failed: 0,
    skipped: preflight.skippedCount,
    currentLeadId: null,
    currentName: '',
    currentEmail: '',
    delaySec,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    pausedReason: null,
    consecutiveErrors: 0,
    dailySentCount: getDailySentCount(),
    dailyLimit: Number.isFinite(dailyLimitParsed) && dailyLimitParsed > 0 ? dailyLimitParsed : 150,
    logs: [],
  }
  globalForBulkSend.__mailcrawlBulkSendJob = job

  addBulkLog(
    `Pokrećem skupno slanje za ${eligible.length} subjekata (preskočeno u provjeri: ${preflight.skippedCount}, razmak: ${delaySec} s).`,
    'info'
  )

  ;(async () => {
    const transporter = createPooledSmtpTransporter(settings)
    try {
      for (let i = 0; i < eligible.length; i++) {
        if (abortController.signal.aborted || job.cancelled) {
          job.cancelled = true
          break
        }

        let lead = eligible[i]
        job.currentLeadId = lead.id || null
        job.currentName = lead.name
        job.currentEmail = lead.email || ''

        try {
          // Pripremi brzi predložak ako nedostaje tekst a korisnik je odobrio autoFillTemplate
          if (autoFillTemplate && (!lead.email_subject?.trim() || !lead.email_body?.trim())) {
            const fallback = buildSmartFallbackEmail(lead, settings)
            const updated = updateLead(lead.id!, {
              email_subject: fallback.subject,
              email_body: fallback.body,
              ai_personalization_note: fallback.personalization_note,
              status: 'draft_ready',
            })
            if (updated) lead = updated
          }

          await sendDonationEmail(lead, settings, null, transporter)

          const nowStr = new Date().toLocaleString('hr-HR')
          recordSentMail({
            leadId: lead.id,
            recipientEmail: lead.email!,
            companyName: lead.name,
            oib: lead.oib,
            website: lead.website,
            contactPerson: lead.contact_person,
            contactRole: lead.contact_role,
            subject: lead.email_subject || 'Poziv za donaciju',
            body: lead.email_body || '',
            timestamp: nowStr,
          })

          job.sent++
          job.processed++
          job.consecutiveErrors = 0
          job.dailySentCount = getDailySentCount()
          addBulkLog(`[${job.sent}/${job.total}] Poslano: ${lead.name} (${lead.email})`, 'success')
        } catch (err: any) {
          job.failed++
          job.processed++
          job.consecutiveErrors++
          const msg = err?.message || 'Greška pri slanju'
          if (lead.id) {
            try {
              updateLead(lead.id, { error_message: msg })
            } catch {}
          }
          addBulkLog(`Neuspješno za ${lead.name} (${lead.email}): ${msg}`, 'error')

          if (job.consecutiveErrors >= 3) {
            job.pausedReason = `Automatska pauza nakon 3 uzastopne SMTP greške: ${msg}`
            addBulkLog(job.pausedReason, 'warn')
            break
          }
        }

        if (i < eligible.length - 1 && !abortController.signal.aborted && !job.cancelled) {
          const jitterMs = Math.floor(Math.random() * 1200)
          const waitMs = Math.round(delaySec * 1000) + jitterMs
          const ok = await abortableSleep(waitMs, abortController.signal)
          if (!ok) {
            job.cancelled = true
            break
          }
        }
      }

      addBulkLog(
        `=== Skupno slanje završeno! Poslano: ${job.sent}/${job.total} · Neuspjelo: ${job.failed} · Preskočeno: ${job.skipped} ===`,
        job.cancelled || job.pausedReason ? 'warn' : 'done'
      )
    } finally {
      try {
        transporter.close()
      } catch {}
      job.running = false
      job.finishedAt = new Date().toISOString()
      globalForBulkSend.__mailcrawlBulkSendAbort = null

      if (job.sent > 0 || job.failed > 0) {
        try {
          DatabaseService.insertLog({
            userId: options.actor?.id || 'system',
            userName: options.actor?.name || 'Administrator',
            userRole: options.actor?.role || 'admin',
            action: 'Skupno slanje donacijskih mailova',
            details: `Poslano donacijskih mailova: ${job.sent}/${job.total} (Neuspjelo: ${job.failed}, Preskočeno: ${job.skipped})${job.cancelled ? ' [Zaustavljeno]' : ''}${job.pausedReason ? ` [${job.pausedReason}]` : ''}.`,
            timestamp: new Date().toISOString(),
          })
        } catch {}
      }
    }
  })()

  return { started: true, preflight, job }
}

export function analyzeBulkResendItems(sentIds: number[]): {
  eligible: SentRegistryItem[]
  preflight: PreflightSummary
} {
  const cleanIds = Array.from(new Set(sentIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)))
  if (cleanIds.length === 0) {
    return {
      eligible: [],
      preflight: {
        totalRequested: 0,
        eligibleCount: 0,
        skippedCount: 0,
        skippedAlreadySent: 0,
        skippedBlocked: 0,
        skippedMissingEmail: 0,
        skippedMissingDraft: 0,
        skippedInvalidOrRejected: 0,
      },
    }
  }

  const placeholders = cleanIds.map(() => '?').join(',')
  const rows = db.prepare(`SELECT * FROM sent_registry WHERE id IN (${placeholders})`).all(...cleanIds) as SentRegistryItem[]
  const rowMap = new Map<number, SentRegistryItem>(rows.map((r) => [Number(r.id), r]))

  const eligible: SentRegistryItem[] = []
  let skippedBlocked = 0
  let skippedMissingEmail = 0
  let skippedInvalidOrRejected = 0

  for (const id of cleanIds) {
    const item = rowMap.get(id)
    if (!item || item.is_invalid_email === 1 || item.status === 'donor') {
      skippedInvalidOrRejected++
      continue
    }

    const email = normalizeEmail(item.recipient_email || item.email_norm)
    if (!email || !email.includes('@')) {
      skippedMissingEmail++
      continue
    }

    let blocked = false
    try {
      assertEmailsAllowedToContact(email)
    } catch {
      blocked = true
    }
    if (!blocked) {
      const opt = isOptedOut({ email, website: item.domain_norm, oib: item.oib })
      if (opt.optedOut) blocked = true
    }
    if (blocked) {
      skippedBlocked++
      continue
    }

    eligible.push(item)
  }

  const skippedCount = skippedBlocked + skippedMissingEmail + skippedInvalidOrRejected

  return {
    eligible,
    preflight: {
      totalRequested: cleanIds.length,
      eligibleCount: eligible.length,
      skippedCount,
      skippedAlreadySent: 0,
      skippedBlocked,
      skippedMissingEmail,
      skippedMissingDraft: 0,
      skippedInvalidOrRejected,
    },
  }
}

export function startBulkResend(options: {
  sentIds: number[]
  delaySec?: number
  addReminderPrefix?: boolean
  actor?: TrashActor
}): { started: boolean; preflight: PreflightSummary; job: BulkSendJobState } {
  const current = getBulkSendJobState()
  if (current.running) {
    throw new Error('Skupno slanje donacijskih e-mailova je već u tijeku. Pričekajte završetak ili ga zaustavite.')
  }

  const settings = validateSmtpSettingsOrThrow()
  const delaySec = clampDelaySec(
    options.delaySec ?? (parseFloat(String(settings.bulk_send_delay_sec || '3.5')) || 3.5)
  )
  const addReminderPrefix = options.addReminderPrefix !== false
  const { eligible, preflight } = analyzeBulkResendItems(options.sentIds)

  if (eligible.length === 0) {
    throw new Error('Nijedan odabrani zapis iz registra ne ispunjava uvjete za ponovno slanje.')
  }

  const abortController = new AbortController()
  globalForBulkSend.__mailcrawlBulkSendAbort = abortController

  const dailyLimitParsed = parseInt(String(settings.bulk_send_daily_limit || '150'), 10)
  const job: BulkSendJobState = {
    running: true,
    cancelled: false,
    mode: 'resend',
    total: eligible.length,
    processed: 0,
    sent: 0,
    failed: 0,
    skipped: preflight.skippedCount,
    currentLeadId: null,
    currentName: '',
    currentEmail: '',
    delaySec,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    pausedReason: null,
    consecutiveErrors: 0,
    dailySentCount: getDailySentCount(),
    dailyLimit: Number.isFinite(dailyLimitParsed) && dailyLimitParsed > 0 ? dailyLimitParsed : 150,
    logs: [],
  }
  globalForBulkSend.__mailcrawlBulkSendJob = job

  addBulkLog(
    `Pokrećem skupni podsjetnik za ${eligible.length} već kontaktiranih subjekata (razmak: ${delaySec} s).`,
    'info'
  )

  ;(async () => {
    const transporter = createPooledSmtpTransporter(settings)
    try {
      for (let i = 0; i < eligible.length; i++) {
        if (abortController.signal.aborted || job.cancelled) {
          job.cancelled = true
          break
        }

        const item = eligible[i]
        const recipient = (item.recipient_email || item.email_norm).trim()
        job.currentLeadId = item.lead_id || null
        job.currentName = item.company_name || recipient
        job.currentEmail = recipient

        const baseSubject = (item.subject || 'Zamolba za podršku Hrvatskom rodoslovnom društvu').trim()
        const finalSubject =
          addReminderPrefix && !baseSubject.startsWith('[Podsjetnik]')
            ? `[Podsjetnik] ${baseSubject}`
            : baseSubject

        const greeting = buildGreeting({ contact_person: item.contact_person })
        const rawBody =
          (item.body || '').trim() ||
          `${greeting}\n\nLjubazno Vam se ponovno obraćamo vezano uz podršku radu Hrvatskog rodoslovnog društva "Pavao Ritter Vitezović".\n\nPrikupljamo namjenska sredstva za kupnju profesionalnih arhivskih skenera i računala za digitalizaciju starih matičnih knjiga i rodoslovne građe.\n\nSvaka Vaša podrška, bez obzira na iznos, izravno pomaže očuvanju hrvatske baštine.`
        const finalBody = capitalizeRespectfulPronouns(rawBody)

        let leadObj: Partial<Lead> = {
          name: item.company_name || 'Poštovani',
          email: recipient,
          oib: item.oib,
          website: item.domain_norm ? `https://${item.domain_norm}` : '',
          contact_person: item.contact_person,
          email_subject: finalSubject,
          email_body: finalBody,
        }

        if (item.lead_id) {
          const realLead = db.prepare('SELECT * FROM leads WHERE id = ?').get(item.lead_id) as Lead | undefined
          if (realLead) {
            leadObj = { ...realLead, ...leadObj }
          }
        }

        try {
          await sendDonationEmail(leadObj, settings, null, transporter)

          const nowStr = new Date().toLocaleString('hr-HR')
          recordSentMail({
            leadId: item.lead_id,
            recipientEmail: recipient,
            companyName: item.company_name || leadObj.name || '',
            oib: item.oib,
            website: leadObj.website,
            contactPerson: item.contact_person || '',
            contactRole: leadObj.contact_role,
            subject: finalSubject,
            body: finalBody,
            timestamp: nowStr,
          })

          job.sent++
          job.processed++
          job.consecutiveErrors = 0
          job.dailySentCount = getDailySentCount()
          addBulkLog(`[${job.sent}/${job.total}] Poslan podsjetnik: ${job.currentName} (${recipient})`, 'success')
        } catch (err: any) {
          job.failed++
          job.processed++
          job.consecutiveErrors++
          const msg = err?.message || 'Greška pri slanju'
          addBulkLog(`Neuspješno za ${job.currentName} (${recipient}): ${msg}`, 'error')
          if (job.consecutiveErrors >= 3) {
            job.pausedReason = `Automatska pauza nakon 3 uzastopne SMTP greške: ${msg}`
            addBulkLog(job.pausedReason, 'warn')
            break
          }
        }

        if (i < eligible.length - 1 && !abortController.signal.aborted && !job.cancelled) {
          const jitterMs = Math.floor(Math.random() * 1200)
          const waitMs = Math.round(delaySec * 1000) + jitterMs
          const ok = await abortableSleep(waitMs, abortController.signal)
          if (!ok) {
            job.cancelled = true
            break
          }
        }
      }

      addBulkLog(
        `=== Skupno ponovno slanje završeno! Poslano: ${job.sent}/${job.total} · Neuspjelo: ${job.failed} ===`,
        job.cancelled || job.pausedReason ? 'warn' : 'done'
      )
    } finally {
      try {
        transporter.close()
      } catch {}
      job.running = false
      job.finishedAt = new Date().toISOString()
      globalForBulkSend.__mailcrawlBulkSendAbort = null

      if (job.sent > 0 || job.failed > 0) {
        try {
          DatabaseService.insertLog({
            userId: options.actor?.id || 'system',
            userName: options.actor?.name || 'Administrator',
            userRole: options.actor?.role || 'admin',
            action: 'Skupno slanje donacijskih podsjetnika',
            details: `Poslano donacijskih podsjetnika: ${job.sent}/${job.total} (Neuspjelo: ${job.failed}, Preskočeno: ${job.skipped})${job.cancelled ? ' [Zaustavljeno]' : ''}.`,
            timestamp: new Date().toISOString(),
          })
        } catch {}
      }
    }
  })()

  return { started: true, preflight, job }
}
