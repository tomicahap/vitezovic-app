#!/usr/bin/env node

/**
 * CLI runner / pipeline za scraping i obogaćivanje podataka o hrvatskim tvrtkama
 * 
 * Primjeri pokretanja:
 *   npx tsx src/cli/run-company-scraper.ts --place="Pakrac" --limit=20 --faza=all --export=json
 *   npx tsx src/cli/run-company-scraper.ts --place="Varaždin" --limit=50 --faza=1
 *   npx tsx src/cli/run-company-scraper.ts --faza=2
 */

import { searchAndEnrichCompanies } from "../services/scrapers";
import { CompanySearchOptions } from "../types/company-search";

function parseArgs(): CompanySearchOptions & { help?: boolean } {
  const args = process.argv.slice(2);
  const options: CompanySearchOptions & { help?: boolean } = {
    faza: "all",
    resume: true,
    exportFormat: "json",
  };

  for (const arg of args) {
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    if (arg === "--all-places") {
      options.allPlaces = true;
      continue;
    }

    if (arg === "--no-resume") {
      options.resume = false;
      continue;
    }

    const match = arg.match(/^--([a-zA-Z0-9_-]+)=(.*)$/);
    if (match) {
      const key = match[1];
      let value = match[2];
      // Ukloni vanjske navodnike ako postoje
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      switch (key) {
        case "place":
        case "mjesto":
          options.place = value;
          break;
        case "limit":
          options.limit = parseInt(value, 10);
          break;
        case "faza":
        case "phase":
          if (value === "1" || value === "2" || value === "all") {
            options.faza = value;
          }
          break;
        case "export":
        case "format":
          if (value === "json" || value === "csv" || value === "none") {
            options.exportFormat = value;
          }
          break;
        case "out":
        case "output":
          options.outputFilePath = value;
          break;
      }
    }
  }

  return options;
}

function printHelp() {
  console.log(`
╔════════════════════════════════════════════════════════════════════╗
║     CROATIA.BIZ COMPANY SCRAPER & ENRICHMENT PIPELINE (RH)       ║
╚════════════════════════════════════════════════════════════════════╝

UPOTREBA:
  npx tsx src/cli/run-company-scraper.ts [OPCIJE]

DOSTUPNE OPCIJE:
  --place="Mjesto"        Odabrani grad/mjesto za pretragu (npr. "Pakrac", "Zagreb")
  --limit=N               Maksimalan broj subjekata za obradu (npr. --limit=30)
  --faza=1|2|all          Faza rada:
                            1   = Samo scraping kataloga i profila (croatia.biz)
                            2   = Samo obogaćivanje e-mailova i odgovornih osoba
                            all = Cjelokupni proces (Faza 1 + Faza 2)
  --all-places            Prolazi redom kroz sva mjesta iz indeksa
  --export=json|csv|none  Format spremanja izvoza (default: json)
  --out="putanja.json"    Prilagođena putanja za spremanje rezultata
  --no-resume             Zanemari prethodno spremljene rezultate u SQLite bazi
  --help                  Prikaz ove pomoći

PRIMJERI:
  npx tsx src/cli/run-company-scraper.ts --place="Pakrac" --limit=20 --faza=all
  npx tsx src/cli/run-company-scraper.ts --place="Lipik" --faza=1 --export=csv
  npx tsx src/cli/run-company-scraper.ts --faza=2 --limit=50
`);
}

async function main() {
  const options = parseArgs();

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  console.log("\n========================================================");
  console.log("   🚀 POKRETANJE PIPELINEA ZA HRVATSKE TVRTKE I OBRTE   ");
  console.log("========================================================");
  console.log(`Odabrano mjesto:  ${options.place || (options.allPlaces ? "SVA MJESTA" : "Pakrac (default)")}`);
  console.log(`Faza izvršavanja: ${options.faza?.toUpperCase()}`);
  console.log(`Limit zapisa:     ${options.limit ? options.limit : "Neograničeno"}`);
  console.log(`Format izvoza:    ${options.exportFormat?.toUpperCase()}`);
  console.log(`Resume cache:     ${options.resume !== false ? "UKLJUČEN (SQLite)" : "ISKLJUČEN"}`);
  console.log("--------------------------------------------------------\n");

  const result = await searchAndEnrichCompanies(options);

  console.log("\n========================================================");
  console.log("                    📊 SAŽETAK REZULTATA                ");
  console.log("========================================================");
  console.log(`Status izvođenja:             ${result.success ? "✅ USPJEŠNO" : "❌ S GREŠKAMA"}`);
  console.log(`Trajanje obrade:              ${result.stats.durationSeconds} sekundi`);
  console.log(`Mjesta obrađeno:              ${result.stats.placesProcessed}`);
  console.log(`Prikupljeno iz kataloga (F1): ${result.stats.companiesScraped}`);
  console.log(`Obogaćeno kontakata (F2):     ${result.stats.companiesEnriched}`);
  console.log(`Pronađeno e-mail adresa:      ${result.stats.emailsFound}`);
  console.log(`Pronađeno odgovornih osoba:   ${result.stats.representativesFound}`);
  if (result.exportPath) {
    console.log(`Izvoz spremljen u datoteku:   ${result.exportPath}`);
  }
  console.log("========================================================\n");

  // Prikaz uzorka rezultata u tablici
  if (result.enrichedRecords.length > 0) {
    console.log("Uzorak obrađenih subjekata:");
    console.table(
      result.enrichedRecords.slice(0, 10).map((r) => ({
        Tvrtka: r.companyName.substring(0, 30),
        Mjesto: r.place,
        OIB: r.oib || "N/A",
        Email: r.primaryEmail || "N/A",
        "Odgovorna osoba": r.legalRepresentative ? `${r.legalRepresentative.name} (${r.legalRepresentative.role})` : "N/A",
        Status: r.enrichmentStatus,
      }))
    );
  }
}

main().catch((err) => {
  console.error("Kritična greška u CLI pipelineu:", err);
  process.exit(1);
});
