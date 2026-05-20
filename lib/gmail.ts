import { google } from 'googleapis'
import { DatabaseService } from './database'

/**
 * Sends an email using the Google Gmail API and the stored Service Account credentials.
 * Requires "Domain-wide Delegation" if you want to send on behalf of a user (gmailMailbox).
 */
export async function sendEmail({ to, subject, body }: { to: string, subject: string, body: string }) {
  const settings = DatabaseService.getSettings()
  
  if (!settings.googleServiceAccountJson) {
    throw new Error('Google Service Account JSON nije konfiguriran.')
  }
  
  let credentials
  try {
    credentials = JSON.parse(settings.googleServiceAccountJson)
  } catch (error) {
    throw new Error('Neispravna Google Service Account JSON konfiguracija.')
  }

  // Koristimo gmailMailbox kao pošiljatelja (impersonacija)
  // Za ovo je potrebna "Domain-wide Delegation" u Google Admin konzoli
  const impersonatedUserEmail = settings.gmailMailbox || credentials.client_email

  const auth = new google.auth.JWT(
    credentials.client_email,
    undefined,
    credentials.private_key,
    ['https://www.googleapis.com/auth/gmail.send'],
    impersonatedUserEmail
  )

  const gmail = google.gmail({ version: 'v1', auth })

  // Formatiranje e-maila u base64url formatu koji Gmail API zahtijeva
  const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
  const messageParts = [
    `From: <${impersonatedUserEmail}>`,
    `To: <${to}>`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    `Subject: ${utf8Subject}`,
    '',
    body,
  ];
  const message = messageParts.join('\n');
  const encodedMessage = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  try {
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
      },
    })
    return { success: true }
  } catch (error: any) {
    console.error('Gmail API error:', error)
    // Ako impersonacija ne radi (nema delecije), bacamo jasniju grešku
    if (error.message?.includes('unauthorized_client') || error.message?.includes('access_denied')) {
      throw new Error('Gmail API: Pristup odbijen. Provjerite "Domain-wide Delegation" za Service Account.')
    }
    throw error
  }
}
