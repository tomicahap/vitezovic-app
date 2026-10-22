import * as cheerio from "cheerio";
import {
  RawCompanyRecord,
  EnrichedCompanyRecord,
  LegalRepresentative,
  EnrichmentStatus,
  CompanySearchOptions,
} from "../../types/company-search";
import { CompanyStorage } from "../scrapers/companyStorage";

// Filter list za lažne i generičke placeholder adrese
const DUMMY_EMAIL_PATTERNS = [
  "example.com",
  "domain.com",
  "wix.com",
  "wordpress.com",
  "sentry.io",
  "test.com",
  "mysite.com",
  "bootstrap",
  "schema.org",
  "youremail",
  "email@email.com",
  "info@croatia.biz",
  "noreply",
  "no-reply",
];

const GENERIC_EMAIL_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "t-com.hr",
  "zg.t-com.hr",
  "net.hr",
  "post.t-com.hr",
  "email.t-com.hr",
];

export class CompanyEnricher {
  private storage: CompanyStorage;
  private timeoutMs = 12000;

  constructor(storage?: CompanyStorage) {
    this.storage = storage || new CompanyStorage();
  }

  private async sleep(ms: number = 1500): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Pomoćna funkcija za siguran fetch stranice s timeoutom
   */
  private async safeFetch(url: string): Promise<string | null> {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), this.timeoutMs);

      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        signal: controller.signal,
      });

      clearTimeout(id);
      if (!res.ok) return null;
      return await res.text();
    } catch {
      return null;
    }
  }

  /**
   * Ekstrakcija i čišćenje e-mail adresa iz teksta ili HTML-a
   */
  public extractEmails(content: string, preferredDomain?: string): string[] {
    const rawMatches = content.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
    const validEmails = new Set<string>();

    for (const email of rawMatches) {
      const clean = email.toLowerCase().trim();

      // Provjeri ekstenzije koje nisu email već nazivi slika (npr. icon@2x.png)
      if (/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(clean)) continue;

      // Filtriraj dummy/placeholder adrese
      const isDummy = DUMMY_EMAIL_PATTERNS.some((pattern) => clean.includes(pattern));
      if (isDummy) continue;

      validEmails.add(clean);
    }

    const emailList = Array.from(validEmails);

    // Sortiraj e-mailove:
    // 1. Službene korporativne domene koje sadrže domenu tvrtke
    // 2. Info / kontakt / ured adrese
    // 3. Generički freemail (gmail, yahoo) na kraju
    emailList.sort((a, b) => {
      const aDomain = a.split("@")[1] || "";
      const bDomain = b.split("@")[1] || "";

      const aIsGeneric = GENERIC_EMAIL_DOMAINS.includes(aDomain);
      const bIsGeneric = GENERIC_EMAIL_DOMAINS.includes(bDomain);

      if (preferredDomain) {
        const cleanPref = preferredDomain.replace(/^www\./, "").toLowerCase();
        const aMatchesPref = aDomain.includes(cleanPref);
        const bMatchesPref = bDomain.includes(cleanPref);
        if (aMatchesPref && !bMatchesPref) return -1;
        if (!aMatchesPref && bMatchesPref) return 1;
      }

      if (!aIsGeneric && bIsGeneric) return -1;
      if (aIsGeneric && !bIsGeneric) return 1;

      return 0;
    });

    return emailList;
  }

  /**
   * Ekstrakcija odgovorne osobe (direktor, član uprave, vlasnik, prokurist)
   */
  public extractLegalRepresentative(text: string, companyName?: string): LegalRepresentative | null {
    // 1. Provjeri obrt iz samog naziva (npr. "AUTO SERVIS, vl. Marko Marković" ili "STOLARIJA, vlasnik Ivan Horvat")
    if (companyName) {
      const obrtMatch = companyName.match(/(?:vl\.|vlasnik|osnivač)\s+([A-ZČĆŽŠĐ][a-zčćžšđ]+(?:\s+[A-ZČĆŽŠĐ][a-zčćžšđ]+){1,2})/i);
      if (obrtMatch && obrtMatch[1]) {
        return {
          name: this.normalizeName(obrtMatch[1]),
          role: "Vlasnik",
          confidence: "high",
          source: "company_name",
        };
      }
    }

    // 2. Regex detekcija vodećih funkcija s imenom i prezimenom
    const patterns: { regex: RegExp; role: string; confidence: "high" | "medium" }[] = [
      {
        regex: /(?:direktor(?:ica)?|predsjednik(?:\s+uprave)?)\s*[:\-–]?\s*([A-ZČĆŽŠĐ][a-zčćžšđ]+(?:\s+[A-ZČĆŽŠĐ][a-zčćžšđ]+){1,2})/iu,
        role: "Direktor",
        confidence: "high",
      },
      {
        regex: /(?:član(?:ica)?\s+uprave)\s*[:\-–]?\s*([A-ZČĆŽŠĐ][a-zčćžšđ]+(?:\s+[A-ZČĆŽŠĐ][a-zčćžšđ]+){1,2})/iu,
        role: "Član uprave",
        confidence: "high",
      },
      {
        regex: /(?:vlasnik|vlasnica|osnivač(?:ica)?)\s*[:\-–]?\s*([A-ZČĆŽŠĐ][a-zčćžšđ]+(?:\s+[A-ZČĆŽŠĐ][a-zčćžšđ]+){1,2})/iu,
        role: "Vlasnik",
        confidence: "high",
      },
      {
        regex: /(?:prokurist(?:ica)?)\s*[:\-–]?\s*([A-ZČĆŽŠĐ][a-zčćžšđ]+(?:\s+[A-ZČĆŽŠĐ][a-zčćžšđ]+){1,2})/iu,
        role: "Prokurist",
        confidence: "high",
      },
      {
        regex: /(?:voditelj(?:ica)?|menadžer(?:ica)?)\s*[:\-–]?\s*([A-ZČĆŽŠĐ][a-zčćžšđ]+(?:\s+[A-ZČĆŽŠĐ][a-zčćžšđ]+){1,2})/iu,
        role: "Voditelj",
        confidence: "medium",
      },
      // Obrnuti sintaktički oblik: "Marko Horvat, direktor"
      {
        regex: /([A-ZČĆŽŠĐ][a-zčćžšđ]+(?:\s+[A-ZČĆŽŠĐ][a-zčćžšđ]+){1,2})\s*,\s*(?:direktor(?:ica)?|predsjednik(?:\s+uprave)?)/iu,
        role: "Direktor",
        confidence: "high",
      },
      {
        regex: /([A-ZČĆŽŠĐ][a-zčćžšđ]+(?:\s+[A-ZČĆŽŠĐ][a-zčćžšđ]+){1,2})\s*,\s*(?:vlasnik|vlasnica|osnivač(?:ica)?)/iu,
        role: "Vlasnik",
        confidence: "high",
      },
    ];

    for (const item of patterns) {
      const match = text.match(item.regex);
      if (match && match[1]) {
        const candidateName = this.normalizeName(match[1]);
        // Ignoriraj ako je slučajno ulovljena uobičajena riječ
        if (!this.isFalseName(candidateName)) {
          return {
            name: candidateName,
            role: item.role,
            confidence: item.confidence,
            source: "text_pattern",
          };
        }
      }
    }

    return null;
  }

  private normalizeName(str: string): string {
    return str
      .trim()
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }

  private isFalseName(name: string): boolean {
    const invalidWords = [
      "Republika",
      "Hrvatska",
      "Zagreb",
      "Društvo",
      "Ugovor",
      "Zakon",
      "Registarski",
      "Trgovački",
      "Sud",
      "Djelatnost",
      "Temeljni",
      "Kapital",
      "Kontakt",
      "Adresa",
      "Email",
      "Telefon",
      "Internet",
    ];
    return invalidWords.some((w) => name.includes(w));
  }

  /**
   * Pretraživanje web stranice tvrtke i ključnih podstranica:
   * /kontakt, /contact, /o-nama, /about-us, /impressum
   */
  public async scrapeCompanyWebsite(
    baseUrl: string
  ): Promise<{ emails: string[]; rep: LegalRepresentative | null }> {
    const emailsSet = new Set<string>();
    let rep: LegalRepresentative | null = null;

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`);
    } catch {
      return { emails: [], rep: null };
    }

    const domain = parsedUrl.hostname;
    const origin = parsedUrl.origin;

    const subpagesToVisit = [
      origin,
      `${origin}/kontakt`,
      `${origin}/kontakt/`,
      `${origin}/contact`,
      `${origin}/o-nama`,
      `${origin}/o-nama/`,
      `${origin}/about-us`,
      `${origin}/impressum`,
    ];

    for (const pageUrl of subpagesToVisit) {
      const html = await this.safeFetch(pageUrl);
      if (!html) continue;

      const $ = cheerio.load(html);
      // Ukloni skripte i stilove
      $("script, style, noscript").remove();
      const pageText = $("body").text();

      // Izvuci e-mailove iz mailto: linkova i iz samog HTML teksta
      $('a[href^="mailto:"]').each((_, el) => {
        const href = $(el).attr("href") || "";
        const email = href.replace(/^mailto:/i, "").split("?")[0].trim();
        if (email) emailsSet.add(email);
      });

      const extracted = this.extractEmails(html + " " + pageText, domain);
      extracted.forEach((e) => emailsSet.add(e));

      // Pokušaj pronaći odgovornu osobu ako već nismo našli
      if (!rep) {
        rep = this.extractLegalRepresentative(pageText);
      }

      // Ako imamo barem 1 email i odgovornu osobu, ne moramo nužno pretraživati sve preostale podstranice
      if (emailsSet.size > 0 && rep) break;
    }

    const finalEmails = this.extractEmails(Array.from(emailsSet).join(" "), domain);
    return { emails: finalEmails, rep };
  }

  /**
   * Pretraživanje weba putem DuckDuckGo HTML pretraživača:
   * "{naziv_tvrtke}" "{mjesto}" (kontakt OR email OR direktor OR uprava)
   */
  public async searchWebForCompany(
    companyName: string,
    place: string,
    oib?: string | null
  ): Promise<{ websiteUrl: string | null; emails: string[]; rep: LegalRepresentative | null }> {
    const cleanName = companyName
      .replace(/d\.o\.o\.|j\.d\.o\.o\.|d\.d\.|k\.d\.|obrt/gi, "")
      .trim();

    const queries = [
      `${cleanName} ${place} kontakt email`,
      `${cleanName} ${place} direktor OR vlasnik`,
    ];

    if (oib) {
      queries.push(`${oib} direktor OR uprava`);
    }

    let foundWebsite: string | null = null;
    const emailsSet = new Set<string>();
    let rep: LegalRepresentative | null = null;

    for (const q of queries) {
      try {
        const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
        const res = await fetch(searchUrl, {
          method: "POST",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: `q=${encodeURIComponent(q)}`,
        });

        if (!res.ok) continue;

        const html = await res.text();
        const $ = cheerio.load(html);

        $(".result__body, .result").each((_, el) => {
          const title = $(el).find(".result__title").text().trim();
          const snippet = $(el).find(".result__snippet").text().trim();
          const href = $(el).find("a.result__url, .result__title a").attr("href") || "";

          const combinedText = `${title} ${snippet}`;

          // Ekstrakcija e-mail adresa iz snippet-a
          const extractedEmails = this.extractEmails(combinedText);
          extractedEmails.forEach((e) => emailsSet.add(e));

          // Ekstrakcija odgovorne osobe
          if (!rep) {
            rep = this.extractLegalRepresentative(combinedText, companyName);
          }

          // Ako pronađemo potencijalnu službenu web stranicu
          if (!foundWebsite && href.startsWith("http")) {
            if (
              !href.includes("duckduckgo.com") &&
              !href.includes("croatia.biz") &&
              !href.includes("facebook.com") &&
              !href.includes("instagram.com") &&
              !href.includes("poslovna.hr") &&
              !href.includes("companywall.hr") &&
              !href.includes("fininfo.hr") &&
              !href.includes("moj-posao.net") &&
              !href.includes("infobel.com")
            ) {
              foundWebsite = href;
            }
          }
        });

        if (emailsSet.size > 0 && rep) break;
        await this.sleep(1200);
      } catch {
        // Nastavi na sljedeći upit
      }
    }

    return {
      websiteUrl: foundWebsite,
      emails: Array.from(emailsSet),
      rep,
    };
  }

  /**
   * Glavna metoda za obogaćivanje pojedinačnog subjekta (FAZA 2)
   */
  public async enrichCompany(raw: RawCompanyRecord): Promise<EnrichedCompanyRecord> {
    console.log(`\n[FAZA 2: Enrichment] Obrađujem: "${raw.companyName}" (${raw.place})`);

    let websiteUrl = raw.websiteUrl;
    let emails: string[] = [];
    let representative: LegalRepresentative | null = null;

    // 1. Ako već imamo odgovornu osobu iz naziva obrta
    representative = this.extractLegalRepresentative(raw.companyName, raw.companyName);

    // 2. Ako profil na croatia.biz sadrži web domenu tvrtke:
    if (websiteUrl) {
      console.log(`[Web] Posjećujem službenu domenu tvrtke: ${websiteUrl}`);
      const siteResult = await this.scrapeCompanyWebsite(websiteUrl);
      emails.push(...siteResult.emails);
      if (!representative && siteResult.rep) {
        representative = siteResult.rep;
      }
    }

    // 3. Ako web domena ne postoji ili nema email -> pokreni web pretragu
    if (emails.length === 0 || !representative) {
      console.log(`[Search] Pokrećem web pretragu za kontakte i odgovornu osobu...`);
      const searchResult = await this.searchWebForCompany(raw.companyName, raw.place, raw.oib);

      if (!websiteUrl && searchResult.websiteUrl) {
        websiteUrl = searchResult.websiteUrl;
        console.log(`[Web Found] Otkrivena službena web stranica: ${websiteUrl}`);
        // Posjeti novootkrivenu domenu
        const siteResult = await this.scrapeCompanyWebsite(websiteUrl);
        emails.push(...siteResult.emails);
        if (!representative && siteResult.rep) {
          representative = siteResult.rep;
        }
      }

      emails.push(...searchResult.emails);
      if (!representative && searchResult.rep) {
        representative = searchResult.rep;
      }
    }

    // Očisti i filtriraj e-mailove
    const uniqueEmails = this.extractEmails(emails.join(" "));
    const primaryEmail = uniqueEmails.length > 0 ? uniqueEmails[0] : null;

    // Odredi status obogaćivanja
    let enrichmentStatus: EnrichmentStatus = "FAILED";
    if (primaryEmail && representative) {
      enrichmentStatus = "SUCCESS";
    } else if (primaryEmail || representative) {
      enrichmentStatus = "PARTIAL";
    }

    const now = new Date().toISOString();

    const enrichedRecord: EnrichedCompanyRecord = {
      id: raw.id,
      companyName: raw.companyName,
      oib: raw.oib,
      place: raw.place,
      address: raw.address,
      websiteUrl: websiteUrl || null,
      emails: uniqueEmails,
      primaryEmail,
      legalRepresentative: representative,
      phone: raw.phone,
      activity: raw.activityName || raw.activityCode || undefined,
      sourceUrl: raw.sourceUrl,
      enrichmentStatus,
      updatedAt: now,
    };

    // Spremamo obogaćeni zapis u bazu
    this.storage.upsertEnriched(enrichedRecord);
    this.storage.updateRawStatus(raw.id, "COMPLETED");

    console.log(
      ` -> [Rezultat Faze 2] Status: ${enrichmentStatus} | Email: ${primaryEmail || "N/A"} | Osoba: ${representative ? `${representative.name} (${representative.role})` : "N/A"}`
    );

    return enrichedRecord;
  }

  /**
   * Obogaćivanje svih subjekata koji čekaju obradu (PENDING_ENRICHMENT)
   */
  public async enrichPendingRecords(
    place?: string,
    options: CompanySearchOptions = {}
  ): Promise<EnrichedCompanyRecord[]> {
    const limit = options.limit && options.limit > 0 ? options.limit : undefined;
    const pending = this.storage.getPendingRawRecords(place, limit);

    console.log(`\n========================================================`);
    console.log(`[FAZA 2] Započinjem obogaćivanje za ${pending.length} subjekata na čekanju.`);
    console.log(`Mjesto: ${place || "Sva mjesta"}`);
    console.log(`========================================================\n`);

    const enrichedList: EnrichedCompanyRecord[] = [];

    for (let i = 0; i < pending.length; i++) {
      const raw = pending[i];
      options.onProgress?.({
        stage: "ENRICHING_WEB",
        place: raw.place,
        currentCompany: raw.companyName,
        processedCount: i + 1,
        totalEstimated: pending.length,
        message: `Obogaćujem podatke za: ${raw.companyName}`,
        timestamp: new Date().toISOString(),
      });

      const enriched = await this.enrichCompany(raw);
      enrichedList.push(enriched);

      // Kratka odgoda između obrada da ne preopteretimo mrežne izvore
      await this.sleep(1500);
    }

    return enrichedList;
  }
}
