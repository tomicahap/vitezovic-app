export interface ExternalLibrary {
  id: number;
  k_kod: string;
  naziv: string;
  postanski_broj: string;
  mjesto: string;
  adresa: string;
  email_sluzbeni: string;
  email_direktni: string;
  telefon: string;
  odgovorna_osoba: string;
  created_at: string;
  updated_at: string;
  last_contact_date?: string | null;
  contact_count?: number;
}

export interface LibraryContactLog {
  id: number;
  library_id: number;
  contact_date: string;
  contact_person_id: number | null;
  contact_person_name: string | null;
  library_contact_person: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
