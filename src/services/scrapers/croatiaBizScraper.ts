import * as cheerio from "cheerio";
import crypto from "crypto";
import {
  RawCompanyRecord,
  CompanySearchOptions,
  PlaceInfo,
  ScraperProgressEvent,
} from "../../types/company-search";
import { CompanyStorage } from "./companyStorage";

// Ensure Node handles servers with incomplete intermediate SSL certificate chains (like croatia.biz)
if (process.env.NODE_TLS_REJECT_UNAUTHORIZED !== "0") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
];

export class CroatiaBizScraper {
  private baseUrl = "https://www.croatia.biz";
  private storage: CompanyStorage;
  private defaultTimeoutMs = 15000;
  private delayMinMs = 1500;
  private delayMaxMs = 3000;

  constructor(storage?: CompanyStorage) {
    this.storage = storage || new CompanyStorage();
  }

  /**
   * Pomoćna funkcija za nasumičnu odgodu (Rate Limiting 1.5 - 3.0s)
   */
  private async sleep(ms?: number): Promise<void> {
    const delay = ms ?? (this.delayMinMs + Math.random() * (this.delayMaxMs - this.delayMinMs));
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * Rotacija User-Agent zaglavlja
   */
  private getRandomUserAgent(): string {
    const idx = Math.floor(Math.random() * USER_AGENTS.length);
    return USER_AGENTS[idx];
  }

  /**
   * Robustan HTTP GET zahtjev s exponential backoff mehanizmom ponavljanja (3 pokušaja)
   */
  public async fetchWithRetry(
    url: string,
    options: {
      retries?: number;
      timeoutMs?: number;
      headers?: Record<string, string>;
    } = {}
  ): Promise<string> {
    const maxRetries = options.retries ?? 3;
    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;
    let attempt = 0;
    let lastError: any = null;

    while (attempt < maxRetries) {
      attempt++;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(url, {
          method: "GET",
          headers: {
            "User-Agent": this.getRandomUserAgent(),
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "hr,en-US;q=0.9,en;q=0.8,bs;q=0.7,sr;q=0.6",
            "Cache-Control": "no-cache",
            ...options.headers,
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          if (response.status === 429 || response.status >= 500) {
            throw new Error(`Server returned status ${response.status}`);
          }
          throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
        }

        const html = await response.text();
        return html;
      } catch (err: any) {
        lastError = err;
        const isAbort = err.name === "AbortError";
        const backoffMs = Math.pow(2, attempt) * 1000 + Math.random() * 500;

        if (attempt < maxRetries) {
          console.warn(
            `[CroatiaBizScraper] Zahtjev na ${url} nije uspio (${isAbort ? "TIMEOUT 15s" : err.message}). Pokušaj ${attempt}/${maxRetries} za ${Math.round(backoffMs)}ms...`
          );
          await this.sleep(backoffMs);
        }
      }
    }

    throw new Error(`Neuspjelo dohvaćanje ${url} nakon ${maxRetries} pokušaja. Greška: ${lastError?.message}`);
  }

  /**
   * FAZA 1 - Korak 1: Dohvaća i parsira indeks svih mjesta / gradova s https://www.croatia.biz/mjesta.php
   */
  public async getPlacesList(): Promise<PlaceInfo[]> {
    const targetUrl = `${this.baseUrl}/mjesta.php`;
    const html = await this.fetchWithRetry(targetUrl);
    const $ = cheerio.load(html);

    const placesMap = new Map<string, PlaceInfo>();

    $("a").each((_, el) => {
      const href = $(el).attr("href") || "";
      const text = $(el).text().trim();

      if (href.includes("/mjesta/") && text.length > 1) {
        // Npr. /mjesta/pakrac/ ili /mjesta/zagreb/
        const cleanHref = href.startsWith("http") ? href : `${this.baseUrl}${href.startsWith("/") ? "" : "/"}${href}`;
        const match = href.match(/\/mjesta\/([^/]+)/);
        const slug = match ? decodeURIComponent(match[1]).toLowerCase() : text.toLowerCase();

        if (!placesMap.has(slug)) {
          placesMap.set(slug, {
            name: text.toUpperCase(),
            slug: slug,
            url: cleanHref,
          });
        }
      }
    });

    const places = Array.from(placesMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    return places;
  }

  /**
   * Pomoćna metoda za određivanje vrste subjekta na temelju naziva
   */
  private detectEntityType(name: string): "tvrtka" | "obrt" | "udruga" | "ostalo" {
    const lower = name.toLowerCase();
    if (lower.includes("obrt") || lower.includes("vl.") || lower.includes("vlasnik")) return "obrt";
    if (lower.includes("d.o.o.") || lower.includes("j.d.o.o.") || lower.includes("d.d.") || lower.includes("k.d.")) return "tvrtka";
    if (lower.includes("udruga") || lower.includes("društvo") || lower.includes("klub") || lower.includes("savez")) return "udruga";
    return "tvrtka";
  }

  /**
   * Parsira detaljni profil pojedinačne tvrtke s njezine poddomene na croatia.biz
   * (npr. https://energetski-inzenjering.croatia.biz)
   */
  public async scrapeCompanyProfile(profileUrl: string, baseCompanyName?: string, placeName?: string): Promise<Partial<RawCompanyRecord>> {
    try {
      const html = await this.fetchWithRetry(profileUrl);
      const $ = cheerio.load(html);
      const text = $("body").text();

      // Puni naziv
      let legalFullName: string | undefined;
      const legalMatch = text.match(/PUNI\s+NAZIV\s*:\s*([^ADRESAOIBTELEFON\n\r]+)/i);
      if (legalMatch) {
        legalFullName = legalMatch[1].trim();
      }

      // Adresa
      let address: string | null = null;
      let postalCode: string | null = null;
      const addressMatch = text.match(/ADRESA\s*:\s*([^OIBTELEFONDJELATNOST\n\r]+)/i);
      if (addressMatch) {
        address = addressMatch[1].trim();
        const zipMatch = address.match(/(\d{5})\s+([^,]+)/);
        if (zipMatch) {
          postalCode = zipMatch[1];
        }
      }

      // OIB (11 znamenki)
      let oib: string | null = null;
      const oibMatch = text.match(/OIB\s*:\s*(\d{11})/i);
      if (oibMatch) {
        oib = oibMatch[1];
      }

      // Telefon
      let phone: string | null = null;
      const phoneMatch = text.match(/TELEFON\s*:\s*([0-9/+\s-]{6,25})/i);
      if (phoneMatch) {
        phone = phoneMatch[1].trim();
      }

      // Telefax
      let fax: string | null = null;
      const faxMatch = text.match(/TELEFAX\s*:\s*([0-9/+\s-]{6,25})/i);
      if (faxMatch) {
        fax = faxMatch[1].trim();
      }

      // Djelatnost (NKD)
      let activityCode: string | null = null;
      let activityName: string | null = null;
      const activityMatch = text.match(/DJELATNOST\s*:\s*(\d{4})\s*-\s*([^VELIČINASTATUS\n\r]+)/i);
      if (activityMatch) {
        activityCode = activityMatch[1].trim();
        activityName = activityMatch[2].trim();
      }

      // Veličina
      let companySize: string | null = null;
      const sizeMatch = text.match(/VELIČINA\s*:\s*([^\s\n\r]+)/i);
      if (sizeMatch) {
        companySize = sizeMatch[1].trim();
      }

      // Status
      let activeStatus: string | null = null;
      const statusMatch = text.match(/STATUS\s*:\s*([^©Zatražite\n\r]+)/i);
      if (statusMatch) {
        activeStatus = statusMatch[1].trim();
      }

      // Web link ako je naveden
      let websiteUrl: string | null = null;
      $("a").each((_, el) => {
        const href = $(el).attr("href") || "";
        if (
          href.startsWith("http") &&
          !href.includes("croatia.biz") &&
          !href.includes("facebook.com") &&
          !href.includes("twitter.com") &&
          !href.includes("openstreetmap.org") &&
          !href.includes("google.com")
        ) {
          websiteUrl = href;
        }
      });

      return {
        legalFullName: legalFullName || baseCompanyName,
        address,
        postalCode,
        oib,
        phone,
        fax,
        activityCode,
        activityName,
        companySize,
        activeStatus,
        websiteUrl,
      };
    } catch (err: any) {
      console.warn(`[CroatiaBizScraper] Profil ${profileUrl} nije mogao biti potpuno parsiran:`, err.message);
      return {};
    }
  }

  /**
   * FAZA 1 - Korak 2 & 3: Scraping subjekata za odabrano mjesto s paginacijom i spremanjem među-stanja
   */
  public async scrapePlace(
    placeSlugOrName: string,
    options: CompanySearchOptions = {}
  ): Promise<RawCompanyRecord[]> {
    const cleanSlug = encodeURIComponent(placeSlugOrName.toLowerCase().trim());
    const initialUrl = `${this.baseUrl}/mjesta/${cleanSlug}/`;
    const limit = options.limit && options.limit > 0 ? options.limit : Infinity;
    const resume = options.resume !== false;

    console.log(`\n========================================================`);
    console.log(`[FAZA 1] Pokrećem scraping kataloga za mjesto: "${placeSlugOrName.toUpperCase()}"`);
    console.log(`Poveznica: ${initialUrl}`);
    console.log(`Limit: ${limit === Infinity ? "Neograničeno" : limit} subjekata | Resume cache: ${resume ? "AKTIVAN" : "ISKLJUČEN"}`);
    console.log(`========================================================\n`);

    const collectedRecords: RawCompanyRecord[] = [];
    const visitedPages = new Set<string>();
    const pagesToVisit: string[] = [initialUrl];

    let pageNum = 1;

    while (pagesToVisit.length > 0 && collectedRecords.length < limit) {
      const currentUrl = pagesToVisit.shift()!;
      if (visitedPages.has(currentUrl)) continue;
      visitedPages.add(currentUrl);

      console.log(`[Katalog] Obrađujem stranicu ${pageNum}: ${currentUrl}`);
      let html: string;
      try {
        html = await this.fetchWithRetry(currentUrl);
      } catch (err: any) {
        console.error(`[Katalog] Greška pri učitavanju stranice ${currentUrl}:`, err.message);
        break;
      }

      const $ = cheerio.load(html);

      // Pronalaženje paginacije
      $(".pagination a, a").each((_, el) => {
        const href = $(el).attr("href") || "";
        const text = $(el).text().trim();
        // Brojčane stranice (npr. '2', '3') ili relativni linkovi na brojeve
        if (/^\d+$/.test(text)) {
          let nextUrl = "";
          if (href.startsWith("http")) {
            nextUrl = href;
          } else if (href.startsWith("/")) {
            nextUrl = `${this.baseUrl}${href}`;
          } else if (href !== "#") {
            nextUrl = `${this.baseUrl}/mjesta/${cleanSlug}/${href}`;
          }
          if (nextUrl && !visitedPages.has(nextUrl) && !pagesToVisit.includes(nextUrl)) {
            pagesToVisit.push(nextUrl);
          }
        }
      });

      // Pronalaženje poveznica na profile tvrtki
      const companyLinks: { name: string; url: string }[] = [];
      $('a[href*=".croatia.biz"]').each((_, el) => {
        const link = $(el);
        const href = link.attr("href") || "";
        const text = link.text().trim();

        // Filtriraj navigacijske linkove
        if (
          text &&
          !href.includes("www.croatia.biz") &&
          !href.includes("facebook.com") &&
          !href.includes("twitter.com") &&
          !href.includes("sharer.php") &&
          text !== "Croatia.biz" &&
          text !== "NASLOVNICA"
        ) {
          companyLinks.push({ name: text, url: href });
        }
      });

      console.log(`[Katalog] Stranica ${pageNum}: pronađeno ${companyLinks.length} subjekata.`);

      for (const item of companyLinks) {
        if (collectedRecords.length >= limit) break;

        // Resume check: ako je već u bazi, preskačemo dohvat profila
        if (resume && this.storage.isUrlScraped(item.url)) {
          console.log(`[Cache Hit] Preskačem već prikupljen subjekt: "${item.name}"`);
          continue;
        }

        // Rate limiting odgoda
        await this.sleep();

        options.onProgress?.({
          stage: "SCRAPING_PROFILE",
          place: placeSlugOrName,
          currentCompany: item.name,
          processedCount: collectedRecords.length,
          totalEstimated: limit === Infinity ? undefined : limit,
          message: `Dohvaćam profil subjekta: ${item.name}`,
          timestamp: new Date().toISOString(),
        });

        console.log(`[Profil] Dohvaćam: ${item.name} (${item.url})`);
        const profileData = await this.scrapeCompanyProfile(item.url, item.name, placeSlugOrName);

        const recordId = `cbiz_${crypto.createHash("md5").update(item.url).digest("hex").substring(0, 12)}`;
        const now = new Date().toISOString();

        const rawRecord: RawCompanyRecord = {
          id: recordId,
          companyName: item.name,
          legalFullName: profileData.legalFullName || item.name,
          place: placeSlugOrName,
          postalCode: profileData.postalCode || null,
          address: profileData.address || null,
          oib: profileData.oib || null,
          mbs: null,
          phone: profileData.phone || null,
          fax: profileData.fax || null,
          activityCode: profileData.activityCode || null,
          activityName: profileData.activityName || null,
          companySize: profileData.companySize || null,
          entityType: this.detectEntityType(item.name),
          activeStatus: profileData.activeStatus || "Aktivan",
          websiteUrl: profileData.websiteUrl || null,
          sourceUrl: item.url,
          status: "PENDING_ENRICHMENT",
          createdAt: now,
          updatedAt: now,
        };

        // Spremamo u SQLite radi trajnosti i resume capability
        this.storage.upsertRaw(rawRecord);
        collectedRecords.push(rawRecord);

        console.log(
          ` -> [Spremljeno] ${rawRecord.companyName} | OIB: ${rawRecord.oib || "N/A"} | Mjesto: ${rawRecord.place} | Tel: ${rawRecord.phone || "N/A"}`
        );
      }

      pageNum++;
    }

    console.log(`\n[FAZA 1 Završena] Za mjesto "${placeSlugOrName}" prikupljeno ukupno: ${collectedRecords.length} novih subjekata.`);
    return collectedRecords;
  }

  public getStorage(): CompanyStorage {
    return this.storage;
  }
}
