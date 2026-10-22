import fs from "fs";
import path from "path";
import {
  CompanySearchOptions,
  CompanySearchResult,
  RawCompanyRecord,
  EnrichedCompanyRecord,
  ScraperStats,
} from "../../types/company-search";
import { CroatiaBizScraper } from "./croatiaBizScraper";
import { CompanyEnricher } from "../enrichment/companyEnricher";
import { CompanyStorage } from "./companyStorage";

export * from "../../types/company-search";
export * from "./croatiaBizScraper";
export * from "./companyStorage";
export * from "../enrichment/companyEnricher";

/**
 * Glavna funkcija za programatsko pokretanje pretraživanja i dvofaznog obogaćivanja podataka.
 * Može se uvesti i pozvati iz bilo koje Next.js API rute, cron joba ili CLI skripte.
 */
export async function searchAndEnrichCompanies(
  options: CompanySearchOptions = {}
): Promise<CompanySearchResult> {
  const startTime = Date.now();
  const faza = options.faza || "all";
  const targetPlace = options.place?.trim();
  const storage = new CompanyStorage();
  const scraper = new CroatiaBizScraper(storage);
  const enricher = new CompanyEnricher(storage);

  const stats: ScraperStats = {
    placesProcessed: 0,
    companiesScraped: 0,
    companiesEnriched: 0,
    emailsFound: 0,
    representativesFound: 0,
    durationSeconds: 0,
    errorsCount: 0,
  };

  let allRaw: RawCompanyRecord[] = [];
  let allEnriched: EnrichedCompanyRecord[] = [];

  try {
    // ---------------------------------------------------------
    // FAZA 1: Scraping kataloga s croatia.biz
    // ---------------------------------------------------------
    if (faza === "1" || faza === "all") {
      if (options.allPlaces) {
        console.log(`[Pipeline] Dohvaćam popis svih gradova s croatia.biz...`);
        const places = await scraper.getPlacesList();
        console.log(`[Pipeline] Ukupno pronađeno ${places.length} mjesta u katalogu.`);

        for (const p of places) {
          stats.placesProcessed++;
          try {
            const raw = await scraper.scrapePlace(p.slug, options);
            allRaw.push(...raw);
            stats.companiesScraped += raw.length;
          } catch (err: any) {
            stats.errorsCount++;
            console.error(`[Pipeline Greška] Mjesto ${p.name}:`, err.message);
          }

          if (options.limit && allRaw.length >= options.limit) break;
        }
      } else {
        const placeName = targetPlace || "Pakrac";
        stats.placesProcessed = 1;
        const raw = await scraper.scrapePlace(placeName, options);
        allRaw.push(...raw);
        stats.companiesScraped += raw.length;
      }
    }

    // ---------------------------------------------------------
    // FAZA 2: Automatizirano obogaćivanje (Enrichment)
    // ---------------------------------------------------------
    if (faza === "2" || faza === "all") {
      const enriched = await enricher.enrichPendingRecords(targetPlace, options);
      allEnriched.push(...enriched);
      stats.companiesEnriched += enriched.length;

      for (const e of enriched) {
        if (e.primaryEmail) stats.emailsFound++;
        if (e.legalRepresentative) stats.representativesFound++;
      }
    }

    // ---------------------------------------------------------
    // Izvoz rezultata (JSON / CSV) ako je zatražen
    // ---------------------------------------------------------
    let exportPath: string | undefined;
    if (options.exportFormat && options.exportFormat !== "none") {
      const exportDir = path.join(process.cwd(), "data", "exports");
      if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const defaultFilename = `companies_${targetPlace ? targetPlace.toLowerCase() : "all"}_${timestamp}.${options.exportFormat}`;
      exportPath = options.outputFilePath || path.join(exportDir, defaultFilename);

      const recordsToExport = allEnriched.length > 0 ? allEnriched : allRaw;

      if (options.exportFormat === "json") {
        fs.writeFileSync(exportPath, JSON.stringify(recordsToExport, null, 2), "utf8");
        console.log(`[Export] Rezultati spremljeni u JSON: ${exportPath}`);
      } else if (options.exportFormat === "csv") {
        const csvHeader = [
          "ID",
          "Naziv",
          "OIB",
          "Mjesto",
          "Adresa",
          "Web",
          "Email",
          "Svi_Emailovi",
          "Odgovorna_Osoba",
          "Uloga",
          "Izvor",
          "Status",
        ].join(";");

        const csvRows = (recordsToExport as any[]).map((r) => {
          const email = r.primaryEmail || (Array.isArray(r.emails) && r.emails[0]) || "";
          const allEmails = Array.isArray(r.emails) ? r.emails.join(", ") : "";
          const repName = r.legalRepresentative?.name || "";
          const repRole = r.legalRepresentative?.role || "";
          const status = r.enrichmentStatus || r.status || "";

          return [
            `"${r.id || ""}"`,
            `"${(r.companyName || "").replace(/"/g, '""')}"`,
            `"${r.oib || ""}"`,
            `"${(r.place || "").replace(/"/g, '""')}"`,
            `"${(r.address || "").replace(/"/g, '""')}"`,
            `"${r.websiteUrl || ""}"`,
            `"${email}"`,
            `"${allEmails}"`,
            `"${repName}"`,
            `"${repRole}"`,
            `"${r.sourceUrl || ""}"`,
            `"${status}"`,
          ].join(";");
        });

        const csvContent = "\uFEFF" + [csvHeader, ...csvRows].join("\r\n");
        fs.writeFileSync(exportPath, csvContent, "utf8");
        console.log(`[Export] Rezultati spremljeni u CSV: ${exportPath}`);
      }
    }

    stats.durationSeconds = Math.round((Date.now() - startTime) / 1000);

    return {
      success: true,
      rawRecords: allRaw,
      enrichedRecords: allEnriched,
      stats,
      exportPath,
    };
  } catch (error: any) {
    stats.durationSeconds = Math.round((Date.now() - startTime) / 1000);
    stats.errorsCount++;
    console.error("[searchAndEnrichCompanies Greška]:", error);

    return {
      success: false,
      rawRecords: allRaw,
      enrichedRecords: allEnriched,
      stats,
    };
  }
}
