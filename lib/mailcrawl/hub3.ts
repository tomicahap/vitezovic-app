import bwipjs from 'bwip-js'
import type { CampaignSettings, Lead } from './types'

/**
 * Generates the official Croatian HUB-3A payload string (HRVHUB30 specification).
 * Strict line-by-line format used by all Croatian mobile banking apps (m-zaba, PBZ, Erste George, OTP, RBA, HPB).
 */
export function buildHub3Payload(settings: CampaignSettings, lead: Partial<Lead> = {}): string {
  const rawAmount = parseFloat(String(settings.suggested_amount_eur || '0').replace(',', '.'))
  const amountCents = isNaN(rawAmount) || rawAmount < 0 ? 0 : Math.round(rawAmount * 100)
  const amountFormatted = String(amountCents).padStart(15, '0')

  // Payer info (optional in HUB3A, populated from lead if available, truncated to spec max lengths)
  const payerName = (lead.name || '').trim().slice(0, 30)
  const payerAddress = (lead.address || '').trim().slice(0, 27)
  const payerCity = (lead.city || '').trim().slice(0, 27)

  // Recipient info (Rodoslovno društvo)
  const recipientName = (settings.org_name || 'Hrvatsko rodoslovno društvo').trim().slice(0, 25)
  const recipientStreet = (settings.org_street || '').trim().slice(0, 25)
  const recipientCity = (settings.org_city || '10000 Zagreb').trim().slice(0, 27)

  const iban = (settings.org_iban || 'HR0000000000000000000').replace(/\s+/g, '').toUpperCase().slice(0, 21)
  const model = (settings.payment_model || 'HR00').replace(/\s+/g, '').toUpperCase().slice(0, 4)

  // Allow dynamic reference placeholder like {OIB} if lead has OIB
  let ref = (settings.payment_reference || '').trim()
  if (lead.oib && ref.includes('{OIB}')) {
    ref = ref.replace('{OIB}', lead.oib)
  } else if (ref.includes('{OIB}')) {
    ref = ref.replace('{OIB}', new Date().getFullYear().toString())
  }
  ref = ref.slice(0, 22)

  const purpose = (settings.payment_purpose || 'CHAR').trim().toUpperCase().slice(0, 4)
  const description = (settings.payment_description || 'Donacija za digitalizaciju rodoslovlja').trim().slice(0, 35)

  const lines = [
    'HRVHUB30',
    'EUR',
    amountFormatted,
    payerName,
    payerAddress,
    payerCity,
    recipientName,
    recipientStreet,
    recipientCity,
    iban,
    model,
    ref,
    purpose,
    description
  ]

  return lines.join('\n')
}

/**
 * Generates a PDF417 2D barcode PNG Buffer according to HUB-3A standard.
 */
export async function generateHub3BarcodeBuffer(settings: CampaignSettings, lead: Partial<Lead> = {}): Promise<{ pngBuffer: Buffer; payload: string }> {
  const payload = buildHub3Payload(settings, lead)
  const pngBuffer = await (bwipjs.toBuffer({
    bcid: 'pdf417',
    text: payload,
    scale: 2,
    height: 10,
    columns: 9,
    paddingwidth: 6,
    paddingheight: 6,
    backgroundcolor: 'FFFFFF'
  } as any) as unknown as Promise<Buffer>)

  return { pngBuffer, payload }
}
