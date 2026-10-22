/**
 * Tipizirana sučelja za pretraživanje, scraping i obogaćivanje (enrichment)
 * podataka o hrvatskim tvrtkama i obrtima (croatia.biz + web enrichment).
 */

export type ScraperStatus = "PENDING_ENRICHMENT" | "COMPLETED" | "FAILED";

export type EnrichmentStatus = "SUCCESS" | "PARTIAL" | "FAILED";

/**
 * Sirovi zapis prikupljen u Fazi 1 (katalog croatia.biz)
 */
export interface RawCompanyRecord {
  id: string;
  companyName: string;
  legalFullName?: string;
  place: string;
  postalCode: string | null;
  address: string | null;
  oib: string | null;
  mbs: string | null;
  phone: string | null;
  fax?: string | null;
  activityCode?: string | null;
  activityName?: string | null;
  companySize?: string | null;
  entityType?: "tvrtka" | "obrt" | "udruga" | "ostalo";
  activeStatus?: string | null;
  websiteUrl: string | null;
  sourceUrl: string;
  status: ScraperStatus;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

/**
 * Podaci o odgovornoj osobi / pravnom zastupniku
 */
export interface LegalRepresentative {
  name: string;
  role: string; // npr. "Direktor", "Član uprave", "Vlasnik", "Osnivač", "Prokurist", "Predsjednik"
  confidence?: "high" | "medium" | "low";
  source?: string;
}

/**
 * Finalni obogaćeni zapis nakon Faze 2 (Enrichment)
 */
export interface EnrichedCompanyRecord {
  id: string;
  companyName: string;
  oib: string | null;
  place: string;
  address: string | null;
  websiteUrl: string | null;
  emails: string[];
  primaryEmail: string | null;
  legalRepresentative: LegalRepresentative | null;
  phone?: string | null;
  activity?: string | null;
  sourceUrl: string;
  enrichmentStatus: EnrichmentStatus;
  updatedAt: string; // ISO format
}

/**
 * Informacije o gradu / mjestu s kataloga croatia.biz
 */
export interface PlaceInfo {
  name: string;
  slug: string;
  url: string;
  count?: number;
}

/**
 * Opcije pretraživanja i izvršavanja pipelinea
 */
export interface CompanySearchOptions {
  /** Odabrano mjesto (npr. "Pakrac", "Zagreb", "Varaždin") */
  place?: string;
  /** Ako je true, iterira redom kroz sva mjesta */
  allPlaces?: boolean;
  /** Maksimalan broj subjekata za prikupiti/obraditi */
  limit?: number;
  /** Faza izvršavanja: "1" (samo scraping), "2" (samo enrichment), "all" (kompletan pipeline) */
  faza?: "1" | "2" | "all";
  /** Nastavi prekinuti rad iz baze bez ponavljanja (default: true) */
  resume?: boolean;
  /** Raspon odgode u milisekundama za rate limiting (default: { min: 1500, max: 3000 }) */
  delayMs?: {
    min: number;
    max: number;
  };
  /** Timeout po zahtjevu u milisekundama (default: 15000) */
  timeoutMs?: number;
  /** Format za izvoz rezultata */
  exportFormat?: "json" | "csv" | "none";
  /** Putanja za izvoznu datoteku */
  outputFilePath?: string;
  /** Callback za praćenje napretka */
  onProgress?: (event: ScraperProgressEvent) => void;
}

/**
 * Događaj praćenja napretka
 */
export interface ScraperProgressEvent {
  stage: "SCRAPING_CATALOG" | "SCRAPING_PROFILE" | "ENRICHING_WEB" | "ENRICHING_REPRESENTATIVE" | "SAVING";
  place?: string;
  currentCompany?: string;
  processedCount: number;
  totalEstimated?: number;
  message: string;
  timestamp: string;
}

/**
 * Statistika izvršavanja
 */
export interface ScraperStats {
  placesProcessed: number;
  companiesScraped: number;
  companiesEnriched: number;
  emailsFound: number;
  representativesFound: number;
  durationSeconds: number;
  errorsCount: number;
}

/**
 * Rezultat funkcije searchAndEnrichCompanies
 */
export interface CompanySearchResult {
  success: boolean;
  rawRecords: RawCompanyRecord[];
  enrichedRecords: EnrichedCompanyRecord[];
  stats: ScraperStats;
  exportPath?: string;
}
