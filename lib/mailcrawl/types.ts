export interface Lead {
  id?: number
  name: string
  entity_type?: 'tvrtka' | 'obrt' | 'udruga' | string
  oib?: string
  city?: string
  address?: string
  website?: string
  domain_norm?: string
  email?: string
  email_norm?: string
  all_emails?: string
  phone?: string
  contact_person?: string
  contact_role?: string
  activity_category?: string
  activity_summary?: string
  raw_scraped_text?: string
  source?: string
  source_url?: string
  email_subject?: string
  email_body?: string
  ai_personalization_note?: string
  status?: 'new' | 'draft_ready' | 'sent' | 'donor' | 'rejected'
  sent_at?: string
  send_count?: number
  sent_history?: string
  donated_at?: string
  donated_amount?: string
  donation_note?: string
  is_invalid_email?: number
  invalid_reason?: string
  error_message?: string
  created_at?: string
  updated_at?: string
}

export interface SentRegistryItem {
  id?: number
  lead_id?: number
  email_norm: string
  recipient_email?: string
  domain_norm?: string
  oib?: string
  company_name?: string
  contact_person?: string
  contact_role?: string
  subject?: string
  body?: string
  sent_at?: string
  send_count?: number
  sent_history?: string // JSON array: [{ sent_at: string, recipient?: string, subject?: string }]
  donated_at?: string
  donated_amount?: string
  donor_name?: string
  donation_note?: string
  status?: 'sent' | 'donor'
  is_invalid_email?: number
  invalid_reason?: string
}

export interface CampaignSettings {
  org_name: string
  org_street: string
  org_city: string
  org_oib: string
  org_iban: string
  payment_model: string
  payment_reference: string
  payment_purpose: string
  payment_description: string
  suggested_amount_eur: string
  include_hub3_barcode: string
  campaign_goal: string
  sender_name: string
  sender_email: string
  email_signature: string
  gemini_api_key: string
  gemini_model: string
  smtp_host: string
  smtp_port: string
  smtp_secure: string
  smtp_user: string
  smtp_pass: string
  custom_logo?: string
}
