import { google } from 'googleapis'
import { DatabaseService } from './database'

export const GOOGLE_WORKSPACE_SCOPES = [
  // Gmail
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.modify',
  // Google Drive
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file',
]

export interface ServiceAccountCredentials {
  project_id: string
  client_email: string
  private_key: string
  [key: string]: any
}

export function validateServiceAccountJson(rawJson?: string | null): {
  valid: boolean
  credentials?: ServiceAccountCredentials
  error?: string
} {
  if (!rawJson || !rawJson.trim()) {
    return { valid: false, error: 'Service Account JSON ključ nije unesen.' }
  }

  try {
    const parsed = JSON.parse(rawJson.trim())
    if (!parsed || typeof parsed !== 'object') {
      return { valid: false, error: 'Neispravan JSON format.' }
    }
    if (!parsed.project_id || typeof parsed.project_id !== 'string') {
      return { valid: false, error: 'U JSON ključu nedostaje polje "project_id".' }
    }
    if (!parsed.client_email || typeof parsed.client_email !== 'string') {
      return { valid: false, error: 'U JSON ključu nedostaje polje "client_email".' }
    }
    if (!parsed.private_key || typeof parsed.private_key !== 'string') {
      return { valid: false, error: 'U JSON ključu nedostaje polje "private_key".' }
    }
    return { valid: true, credentials: parsed as ServiceAccountCredentials }
  } catch (err: any) {
    return {
      valid: false,
      error: 'Neispravan JSON format: ' + (err.message || 'greška pri parsiranju'),
    }
  }
}

export interface GoogleWorkspaceConfigOptions {
  rawJsonOverride?: string | null
  targetEmailOverride?: string | null
  requireTargetEmail?: boolean
}

/**
 * Creates a unified google.auth.JWT client with both Gmail and Google Drive scopes,
 * impersonating the society's Google Workspace account (settings.gmailMailbox).
 */
export function getGoogleWorkspaceClients(options: GoogleWorkspaceConfigOptions = {}) {
  const settings = DatabaseService.getSettings()
  const jsonToUse = options.rawJsonOverride ?? settings?.googleServiceAccountJson
  const targetEmail = (options.targetEmailOverride ?? settings?.gmailMailbox ?? '').trim()

  const validation = validateServiceAccountJson(jsonToUse)
  if (!validation.valid || !validation.credentials) {
    throw new Error(
      validation.error || 'Google Service Account JSON ključ nije konfiguriran u Postavkama.'
    )
  }

  if (options.requireTargetEmail !== false && !targetEmail) {
    throw new Error(
      'Adresa sandučića / Google Workspace računa (Impersonated User) nije definirana u Postavkama.'
    )
  }

  const serviceAccount = validation.credentials
  const normalizedKey = serviceAccount.private_key.replace(/\\n/g, '\n')

  const auth = new google.auth.JWT({
    email: serviceAccount.client_email,
    key: normalizedKey,
    scopes: GOOGLE_WORKSPACE_SCOPES,
    subject: targetEmail || undefined,
  })

  const gmail = google.gmail({ version: 'v1', auth })
  const drive = google.drive({ version: 'v3', auth })

  return {
    auth,
    gmail,
    drive,
    targetEmail,
    serviceAccount,
    settings,
  }
}

export function formatGmailError(error: any, targetEmail?: string): string {
  const msg = error?.message || String(error)
  if (
    msg.includes('invalid_grant') ||
    msg.includes('unauthorized_client') ||
    msg.includes('Client is unauthorized')
  ) {
    return `Autorizacija odbijena (invalid_grant / unauthorized_client) za račun "${
      targetEmail || 'nepoznato'
    }". Provjerite jesu li u Google Workspace Admin konzoli (Domain-Wide Delegation) na ovaj Client ID odobreni svi Gmail i Google Drive scopeovi te postoji li navedena e-mail adresa u vašoj domeni.`
  }
  if (msg.includes('Precondition check failed') || msg.includes('Mail service not enabled')) {
    return `Gmail usluga nije aktivirana za korisnika "${
      targetEmail || ''
    }" ili korisnik nema aktivan Google Workspace sandučić.`
  }
  if (msg.includes('accessNotConfigured') || msg.includes('Gmail API has not been used')) {
    return 'Gmail API nije omogućen u vašem Google Cloud projektu. Uključite Gmail API u Google Cloud Console.'
  }
  return msg
}

export function formatDriveError(error: any, targetEmail?: string, folderId?: string): string {
  const status = error?.code || error?.status || error?.response?.status
  const msg = error?.message || String(error)
  const accountLabel = targetEmail
    ? `impersonirani račun "${targetEmail}"`
    : 'Service Account'

  if (
    msg.includes('invalid_grant') ||
    msg.includes('unauthorized_client') ||
    msg.includes('Client is unauthorized')
  ) {
    return `Autorizacija odbijena (invalid_grant / unauthorized_client) za ${accountLabel}. Provjerite jesu li u Google Workspace Admin konzoli (Domain-Wide Delegation) odobreni Drive scopeovi (https://www.googleapis.com/auth/drive i https://www.googleapis.com/auth/drive.file) uz Gmail scopeove.`
  }

  if (
    status === 403 ||
    msg.toLowerCase().includes('insufficient permissions') ||
    msg.toLowerCase().includes('insufficientfilepermissions') ||
    msg.toLowerCase().includes('forbidden')
  ) {
    return `Nedovoljne ovlasti na Google Driveu (403 Forbidden / Insufficient permissions): ${accountLabel} nema dozvolu za traženu mapu ili datoteku${
      folderId ? ` (ID: ${folderId})` : ''
    }. Provjerite je li mapa podijeljena s računom ${
      targetEmail || 'društva'
    } s ovlastima uređivanja (Editor).`
  }

  if (status === 404 || msg.toLowerCase().includes('file not found')) {
    return `Mapa ili datoteka nije pronađena na Google Driveu (404 Not Found)${
      folderId ? ` za ID "${folderId}"` : ''
    }. Provjerite je li ID mape točan i ima li ${accountLabel} pristup toj mapi.`
  }

  if (msg.includes('storage quota')) {
    return `Prekoračena kvota pohrane ili nije postavljena adresa Google Workspace računa (Impersonated User) u Postavkama.`
  }

  return `Greška Google Drive-a: ${msg}`
}
