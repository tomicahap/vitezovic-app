import { inspectMemberDate } from "./date-validation"
import { formatDateDMY } from "./utils"

export type ChronicleCategory =
  | "meetings"
  | "lectures"
  | "projects"
  | "membership"
  | "research"
  | "library"
  | "archive"
  | "governance"
  | "system"

export interface ChronicleCategoryMeta {
  key: ChronicleCategory
  label: string
  chapterTitle: string
  description: string
  defaultEnabled: boolean
}

export const CHRONICLE_CATEGORIES: ChronicleCategoryMeta[] = [
  {
    key: "meetings",
    label: "Sjednice i skupštine",
    chapterTitle: "I. Skupštine i sjednice tijela Društva",
    description: "Skupštine, sjednice Izvršnog odbora i radnih tijela s lokacijom, dnevnim redom i zapisnikom",
    defaultEnabled: true,
  },
  {
    key: "lectures",
    label: "Predavanja i gostovanja",
    chapterTitle: "II. Predavanja, tribine i javna gostovanja",
    description: "Održana predavanja, predavači, gradovi gostovanja, posjećenost i snimke",
    defaultEnabled: true,
  },
  {
    key: "projects",
    label: "Projekti i inicijative",
    chapterTitle: "III. Istraživački i nakladnički projekti",
    description: "Pokrenuti, aktivni i dovršeni projekti s voditeljima, suradnicima i ciljevima",
    defaultEnabled: true,
  },
  {
    key: "membership",
    label: "Članstvo, ustroj i spomen",
    chapterTitle: "IV. Članstvo, upravna tijela i In memoriam",
    description: "Godišnji sažeci pristupa novih članova, mandati dužnosnika, počasni članovi i In memoriam",
    defaultEnabled: true,
  },
  {
    key: "research",
    label: "Rodoslovna istraživanja",
    chapterTitle: "V. Rodoslovni upiti i pomoć građanima",
    description: "Zaprimljeni i riješeni rodoslovni upiti te obrađene teme (bez privatnih kontakata)",
    defaultEnabled: true,
  },
  {
    key: "library",
    label: "Knjižnica Društva",
    chapterTitle: "VI. Razvoj i fond knjižnice Društva",
    description: "Godišnji prirast katalogiziranih knjiga i časopisa prema datumu upisa u sustav te digitalizacija",
    defaultEnabled: true,
  },
  {
    key: "archive",
    label: "Arhiv i građa",
    chapterTitle: "VII. Prikupljanje arhivske i rodoslovne građe",
    description: "Sažeci terenskih i arhivskih kontakata za prikupljanje građe",
    defaultEnabled: true,
  },
  {
    key: "governance",
    label: "Odluke, glasovanja i obavijesti",
    chapterTitle: "VIII. Elektronička glasovanja i službene obavijesti tijelima",
    description: "Provedena e-glasovanja, odaziv i upućene službene obavijesti tijelima Društva",
    defaultEnabled: true,
  },
  {
    key: "system",
    label: "Razvoj sustava Rodoslovac",
    chapterTitle: "IX. Razvoj digitalnog sustava „Rodoslovac”",
    description: "Zabilježene nadogradnje informacijskog sustava Društva (iz popisa promjena)",
    defaultEnabled: false,
  },
]

export interface ChronicleEventItem {
  id: string
  dateIso: string
  dateDisplay: string
  year: number
  month: number
  precision: "day" | "year"
  category: ChronicleCategory
  categoryLabel: string
  title: string
  narrative: string
  details: string[]
  people: string[]
  location?: string
  sourceRef: string
  externalUrl?: string
}

export interface ChronicleMandateItem {
  memberName: string
  functionName: string
  fromYear: string
  toYear: string
  isActive: boolean
}

export interface ChronicleLectureRow {
  dateDisplay: string
  title: string
  city: string
  location: string
  host: string
  attendeesCount: number
  youtubeUrl?: string
}

export interface ChronicleMemberJoinRow {
  name: string
  dateDisplay: string
  precision: "day" | "year"
}

export interface ChronicleInMemoriamRow {
  name: string
  deathDateDisplay: string
  joinDateDisplay: string
  functions: string[]
}

export interface ChroniclePersonIndexRow {
  name: string
  mentionsCount: number
  roles: string[]
  years: number[]
}

export interface ChronicleReport {
  period: {
    mode: "range" | "all"
    startDate: string
    endDate: string
    label: string
    generatedAt: string
  }
  availableYears: number[]
  includedCategories: ChronicleCategory[]
  summary: {
    totalEvents: number
    meetingsCount: number
    lecturesCount: number
    lectureCities: string[]
    projectsCount: number
    newMembersCount: number
    totalMembersCount: number
    honoraryCount: number
    inMemoriamCount: number
    activeMandatesCount: number
    inquiriesCount: number
    inquiriesResolvedCount: number
    libraryBooksAdded: number
    libraryJournalsAdded: number
    libraryTotalBooks: number
    libraryTotalJournals: number
    libraryDigitizedBooks: number
    archiveContactedCount: number
    archiveCollectedCount: number
    votesCount: number
    boardAnnouncementsCount: number
    membersWithoutJoinDateCount: number
  }
  introNarrative: string[]
  events: ChronicleEventItem[]
  yearGroups: Array<{
    year: number
    yearSummary: string
    events: ChronicleEventItem[]
  }>
  thematicSections: Array<{
    category: ChronicleCategory
    title: string
    intro: string
    events: ChronicleEventItem[]
  }>
  appendices: {
    mandates: ChronicleMandateItem[]
    lecturesList: ChronicleLectureRow[]
    newMembers: ChronicleMemberJoinRow[]
    honoraryMembers: Array<{ name: string; joinDateDisplay: string }>
    inMemoriam: ChronicleInMemoriamRow[]
    peopleIndex: ChroniclePersonIndexRow[]
  }
  dataQualityNotes: string[]
}

export interface ParsedChronicleDate {
  iso: string
  year: number
  month: number
  precision: "day" | "year"
  display: string
}

/**
 * Hrvatska deklinacija imenica uz broj.
 */
export function hrPlural(count: number, one: string, few: string, many: string): string {
  const n = Math.abs(Math.trunc(count))
  const mod100 = n % 100
  const mod10 = n % 10
  if (mod100 >= 11 && mod100 <= 14) return many
  if (mod10 === 1) return one
  if (mod10 >= 2 && mod10 <= 4) return few
  return many
}

/**
 * Normalizira datum iz baze u standardni ISO + prikaz DD/MM/YYYY ili YYYY. god.
 */
export function parseChronicleDate(raw: unknown): ParsedChronicleDate | null {
  if (raw === undefined || raw === null) return null
  const text = String(raw).trim()
  if (!text || text === "-" || text === "—") return null

  const inspected = inspectMemberDate(text)
  if ((inspected.status === "valid_iso" || inspected.status === "convertible") && inspected.isoDate) {
    const [yStr, mStr] = inspected.isoDate.split("-")
    const year = Number(yStr)
    const month = Number(mStr)
    if (Number.isInteger(year) && Number.isInteger(month)) {
      return {
        iso: inspected.isoDate,
        year,
        month,
        precision: "day",
        display: formatDateDMY(inspected.isoDate, inspected.isoDate),
      }
    }
  }

  const yearOnly = text.match(/^(\d{4})\.?$/)
  if (yearOnly) {
    const year = Number(yearOnly[1])
    if (year >= 1900 && year <= 2100) {
      return {
        iso: `${year}-01-01`,
        year,
        month: 1,
        precision: "year",
        display: `${year}. god.`,
      }
    }
  }

  return null
}

/**
 * Pomoćna funkcija kompatibilnosti za konverziju u Date objekt.
 */
export function normalizeDate(dateVal: unknown): Date | null {
  const parsed = parseChronicleDate(dateVal)
  if (!parsed) return null
  const d = new Date(`${parsed.iso}T12:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Sastavlja čisti tekstualni rukopis Ljetopisa za kopiranje, preuzimanje (.txt) i urednički rad.
 */
export function buildChroniclePlainText(report: ChronicleReport): string {
  const lines: string[] = []
  const rule = "=".repeat(72)
  const subRule = "-".repeat(56)

  lines.push("HRVATSKO RODOSLOVNO DRUŠTVO „PAVAO RITTER VITEZOVIĆ”")
  lines.push("LJETOPIS DRUŠTVA — PROVJERENI PODACI ZA SPOMENICU I MONOGRAFIJU")
  lines.push(rule)
  lines.push(`Razdoblje obuhvata: ${report.period.label}`)
  lines.push(`Datum izrade zapisa: ${report.period.generatedAt}`)
  lines.push(`Ukupno provjerenih ljetopisnih zapisa: ${report.summary.totalEvents}`)
  lines.push("")

  if (report.introNarrative.length > 0) {
    lines.push("1. UVODNI PRIPOVJEDNI SAŽETAK RAZDOBLJA")
    lines.push(subRule)
    report.introNarrative.forEach((p) => {
      lines.push(p)
      lines.push("")
    })
  }

  lines.push("2. KRONOLOŠKI PREGLED PROVJERENIH DOGAĐAJA PO GODINAMA")
  lines.push(subRule)

  if (report.yearGroups.length === 0) {
    lines.push("U odabranom razdoblju nema zabilježenih događaja za odabrane cjeline.")
    lines.push("")
  } else {
    for (const grp of report.yearGroups) {
      lines.push("")
      lines.push(`>>> ${grp.year}. GODINA <<<`)
      if (grp.yearSummary) {
        lines.push(grp.yearSummary)
      }
      lines.push("")

      for (const ev of grp.events) {
        lines.push(`[${ev.dateDisplay}] (${ev.categoryLabel}) ${ev.title}`)
        lines.push(ev.narrative)
        for (const det of ev.details) {
          lines.push(`  • ${det}`)
        }
        if (ev.people.length > 0) {
          lines.push(`  Sudionici / osobe: ${ev.people.join(", ")}`)
        }
        if (ev.externalUrl) {
          lines.push(`  Poveznica: ${ev.externalUrl}`)
        }
        lines.push(`  [Izvor: ${ev.sourceRef}]`)
        lines.push("")
      }
    }
  }

  lines.push("3. PROVJERENI PRILOZI ZA SPOMENICU")
  lines.push(subRule)

  lines.push("")
  lines.push("3.1. Tijela Društva i mandati dužnosnika u razdoblju")
  if (report.appendices.mandates.length === 0) {
    lines.push("  (Nema evidentiranih funkcija za ovo razdoblje.)")
  } else {
    report.appendices.mandates.forEach((m) => {
      const span = m.fromYear
        ? `${m.fromYear}. – ${m.toYear ? `${m.toYear}.` : "danas"}`
        : m.toYear
        ? `do ${m.toYear}.`
        : "mandat u tijeku"
      lines.push(`  • ${m.functionName}: ${m.memberName} (${span}${m.isActive ? ", aktivan" : ""})`)
    })
  }

  lines.push("")
  lines.push("3.2. Pregled predavanja i gostovanja")
  if (report.appendices.lecturesList.length === 0) {
    lines.push("  (Nema evidentiranih predavanja u ovom razdoblju.)")
  } else {
    report.appendices.lecturesList.forEach((l) => {
      const locPart = [l.city, l.location].filter(Boolean).join(" — ")
      const hostPart = l.host ? `; predavač/domaćin: ${l.host}` : ""
      lines.push(`  • [${l.dateDisplay}] ${l.title}${locPart ? ` (${locPart})` : ""}${hostPart}`)
    })
  }

  lines.push("")
  lines.push("3.3. Novoupisani članovi u razdoblju")
  if (report.appendices.newMembers.length === 0) {
    lines.push("  (Nema evidentiranih upisa članova s potvrđenim datumom u ovom razdoblju.)")
  } else {
    report.appendices.newMembers.forEach((m) => {
      lines.push(`  • ${m.name} (${m.dateDisplay})`)
    })
  }

  if (report.appendices.honoraryMembers.length > 0) {
    lines.push("")
    lines.push("3.4. Počasni članovi")
    report.appendices.honoraryMembers.forEach((h) => {
      lines.push(`  • ${h.name}${h.joinDateDisplay ? ` (član od ${h.joinDateDisplay})` : ""}`)
    })
  }

  if (report.appendices.inMemoriam.length > 0) {
    lines.push("")
    lines.push("3.5. In memoriam")
    report.appendices.inMemoriam.forEach((im) => {
      const meta = [
        im.deathDateDisplay ? `preminuo/la ${im.deathDateDisplay}` : "",
        im.joinDateDisplay ? `član od ${im.joinDateDisplay}` : "",
        im.functions.length > 0 ? `dužnosti: ${im.functions.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join("; ")
      lines.push(`  • † ${im.name}${meta ? ` (${meta})` : ""}`)
    })
  }

  if (report.appendices.peopleIndex.length > 0) {
    lines.push("")
    lines.push("3.6. Kazalo spomenutih osoba")
    report.appendices.peopleIndex.forEach((p) => {
      lines.push(
        `  • ${p.name} — ${p.mentionsCount}× (${p.roles.join(", ") || "sudionik"}; godine: ${p.years.join(", ")})`
      )
    })
  }

  lines.push("")
  lines.push("4. NAPOMENE O IZVORIMA I PROVJERENOSTI PODATAKA")
  lines.push(subRule)
  report.dataQualityNotes.forEach((n) => lines.push(`  • ${n}`))
  lines.push("")
  lines.push(rule)
  lines.push("Kraj službenog zapisa Ljetopisa — HRD „Pavao Ritter Vitezović”")

  return lines.join("\n")
}

function escapeHtmlText(text: string): string {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/**
 * Generira strukturirani Word (.doc) rukopis spreman za lektora i prijelom spomenice/monografije.
 */
export function buildChronicleWordHtml(report: ChronicleReport): string {
  const introHtml = report.introNarrative
    .map((p) => `<p class="narrative">${escapeHtmlText(p)}</p>`)
    .join("\n")

  const yearsHtml =
    report.yearGroups.length === 0
      ? `<p>U odabranom razdoblju nema zabilježenih događaja za odabrane cjeline.</p>`
      : report.yearGroups
          .map((grp) => {
            const eventsHtml = grp.events
              .map((ev) => {
                const detailsHtml =
                  ev.details.length > 0
                    ? `<ul>${ev.details.map((d) => `<li>${escapeHtmlText(d)}</li>`).join("")}</ul>`
                    : ""
                const peopleHtml =
                  ev.people.length > 0
                    ? `<p class="meta"><strong>Sudionici i spomenute osobe:</strong> ${escapeHtmlText(
                        ev.people.join(", ")
                      )}</p>`
                    : ""
                const linkHtml = ev.externalUrl
                  ? `<p class="meta"><strong>Poveznica:</strong> ${escapeHtmlText(ev.externalUrl)}</p>`
                  : ""
                return `
                  <div class="event">
                    <h3>[${escapeHtmlText(ev.dateDisplay)}] ${escapeHtmlText(ev.title)}</h3>
                    <p class="category">${escapeHtmlText(ev.categoryLabel)} • Izvor: ${escapeHtmlText(
                      ev.sourceRef
                    )}</p>
                    <p class="narrative">${escapeHtmlText(ev.narrative)}</p>
                    ${detailsHtml}
                    ${peopleHtml}
                    ${linkHtml}
                  </div>`
              })
              .join("\n")

            return `
              <h2>${grp.year}. godina</h2>
              ${grp.yearSummary ? `<p class="year-intro">${escapeHtmlText(grp.yearSummary)}</p>` : ""}
              ${eventsHtml}`
          })
          .join("\n")

  const mandatesRows =
    report.appendices.mandates.length === 0
      ? `<tr><td colspan="4">Nema evidentiranih dužnosti za odabrano razdoblje.</td></tr>`
      : report.appendices.mandates
          .map(
            (m) => `<tr>
              <td>${escapeHtmlText(m.functionName)}</td>
              <td>${escapeHtmlText(m.memberName)}</td>
              <td>${escapeHtmlText(m.fromYear ? `${m.fromYear}.` : "—")}</td>
              <td>${escapeHtmlText(m.toYear ? `${m.toYear}.` : m.isActive ? "aktivan mandat" : "—")}</td>
            </tr>`
          )
          .join("\n")

  const lecturesRows =
    report.appendices.lecturesList.length === 0
      ? `<tr><td colspan="4">Nema evidentiranih predavanja u ovom razdoblju.</td></tr>`
      : report.appendices.lecturesList
          .map(
            (l) => `<tr>
              <td>${escapeHtmlText(l.dateDisplay)}</td>
              <td>${escapeHtmlText(l.title)}</td>
              <td>${escapeHtmlText([l.city, l.location].filter(Boolean).join(" — ") || "—")}</td>
              <td>${escapeHtmlText(l.host || "—")}</td>
            </tr>`
          )
          .join("\n")

  const peopleRows =
    report.appendices.peopleIndex.length === 0
      ? `<tr><td colspan="4">Nema spomenutih osoba.</td></tr>`
      : report.appendices.peopleIndex
          .map(
            (p) => `<tr>
              <td>${escapeHtmlText(p.name)}</td>
              <td>${p.mentionsCount}</td>
              <td>${escapeHtmlText(p.roles.join(", "))}</td>
              <td>${escapeHtmlText(p.years.join(", "))}</td>
            </tr>`
          )
          .join("\n")

  const newMembersHtml =
    report.appendices.newMembers.length === 0
      ? `<p>Nema evidentiranih upisa članova s potvrđenim datumom u ovom razdoblju.</p>`
      : `<ul>${report.appendices.newMembers
          .map((m) => `<li><strong>${escapeHtmlText(m.name)}</strong> (${escapeHtmlText(m.dateDisplay)})</li>`)
          .join("")}</ul>`

  const inMemoriamHtml =
    report.appendices.inMemoriam.length === 0
      ? ""
      : `<h3>In memoriam</h3><ul>${report.appendices.inMemoriam
          .map(
            (im) =>
              `<li><strong>† ${escapeHtmlText(im.name)}</strong> — preminuo/la ${escapeHtmlText(
                im.deathDateDisplay
              )}${im.joinDateDisplay ? `, član od ${escapeHtmlText(im.joinDateDisplay)}` : ""}${
                im.functions.length > 0 ? `, dužnosti: ${escapeHtmlText(im.functions.join(", "))}` : ""
              }</li>`
          )
          .join("")}</ul>`

  const notesHtml = `<ul>${report.dataQualityNotes
    .map((n) => `<li>${escapeHtmlText(n)}</li>`)
    .join("")}</ul>`

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40"
      lang="hr">
<head>
  <meta charset="utf-8" />
  <title>Ljetopis društva — HRD „Pavao Ritter Vitezović”</title>
  <style>
    body { font-family: Georgia, "Times New Roman", serif; color: #1B2B36; line-height: 1.55; margin: 2.2cm; }
    .header-box { border-bottom: 3px solid #CEA369; padding-bottom: 12px; margin-bottom: 18px; }
    .org { font-size: 10pt; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; color: #7C2D12; }
    h1 { font-size: 20pt; margin: 4px 0 6px; color: #1B2B36; }
    .subtitle { font-size: 10.5pt; color: #475569; margin: 0; }
    h2 { font-size: 14pt; color: #1B2B36; border-bottom: 1px solid #CEA369; padding-bottom: 3px; margin-top: 22px; }
    h3 { font-size: 11.5pt; color: #1B2B36; margin: 12px 0 3px; }
    .year-intro { font-style: italic; background: #F7F5F0; border-left: 3px solid #CEA369; padding: 6px 10px; }
    .event { margin-bottom: 12px; }
    .category { font-family: Arial, sans-serif; font-size: 8.5pt; color: #64748B; margin: 0 0 4px; }
    .narrative { margin: 4px 0 6px; text-align: justify; }
    .meta { font-size: 9.5pt; color: #334155; margin: 2px 0; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0 16px; font-size: 9.5pt; }
    th, td { border: 1px solid #CBD5E1; padding: 5px 8px; text-align: left; vertical-align: top; }
    th { background-color: #1B2B36; color: #FFFFFF; font-family: Arial, sans-serif; font-size: 9pt; }
    ul { margin: 4px 0 8px 18px; }
  </style>
</head>
<body>
  <div class="header-box">
    <div class="org">Hrvatsko rodoslovno društvo „Pavao Ritter Vitezović”</div>
    <h1>Ljetopis društva — Provjereni podaci za spomenicu</h1>
    <p class="subtitle">Razdoblje: <strong>${escapeHtmlText(
      report.period.label
    )}</strong> • Datum izrade: ${escapeHtmlText(
    report.period.generatedAt
  )} • Ukupno ljetopisnih zapisa: ${report.summary.totalEvents}</p>
  </div>

  <h2>1. Uvodni pripovjedni sažetak razdoblja</h2>
  ${introHtml}

  <h2>2. Kronološki pregled provjerenih događaja po godinama</h2>
  ${yearsHtml}

  <h2>3. Provjereni prilozi za spomenicu</h2>
  <h3>Tijela Društva i mandati dužnosnika</h3>
  <table>
    <thead><tr><th>Dužnost / funkcija</th><th>Ime i prezime</th><th>Od</th><th>Do</th></tr></thead>
    <tbody>${mandatesRows}</tbody>
  </table>

  <h3>Popis predavanja i gostovanja</h3>
  <table>
    <thead><tr><th>Datum</th><th>Naslov predavanja</th><th>Grad / lokacija</th><th>Predavač / domaćin</th></tr></thead>
    <tbody>${lecturesRows}</tbody>
  </table>

  <h3>Novoupisani članovi u razdoblju (${report.appendices.newMembers.length})</h3>
  ${newMembersHtml}
  ${inMemoriamHtml}

  <h3>Kazalo spomenutih osoba</h3>
  <table>
    <thead><tr><th>Ime i prezime</th><th>Spominjanja</th><th>Uloge / kontekst</th><th>Godine</th></tr></thead>
    <tbody>${peopleRows}</tbody>
  </table>

  <h2>4. Napomene o izvorima i provjerenosti podataka</h2>
  ${notesHtml}
</body>
</html>`
}
