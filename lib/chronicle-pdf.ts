import "server-only"
import {
  assemblePdfDocument,
  encodeCroatianPdfString,
  measureTextWidth,
  wrapText,
} from "./report-pdf"
import type { ChronicleReport } from "./chronology"

const PAGE_W = 595.28 // A4 Portrait width in pt (210 mm)
const PAGE_H = 841.89 // A4 Portrait height in pt (297 mm)
const MARGIN_L = 42
const MARGIN_R = 42
const MARGIN_T = 38
const MARGIN_B = 42
const CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R // 511.28 pt

const COLORS = {
  navy: [0.106, 0.169, 0.212] as const, // #1B2B36
  gold: [0.808, 0.639, 0.412] as const, // #CEA369
  terracotta: [0.486, 0.176, 0.071] as const, // #7C2D12
  slate800: [0.15, 0.2, 0.27] as const,
  slate600: [0.32, 0.39, 0.48] as const,
  slate400: [0.56, 0.62, 0.7] as const,
  slate200: [0.88, 0.9, 0.93] as const,
  parchment: [0.969, 0.961, 0.941] as const, // #F7F5F0
  white: [1, 1, 1] as const,
}

function fmtColor(c: readonly [number, number, number]) {
  return `${c[0].toFixed(3)} ${c[1].toFixed(3)} ${c[2].toFixed(3)}`
}

function pdfY(topY: number): number {
  return PAGE_H - topY
}

export function generateChroniclePdfBuffer(report: ChronicleReport): Buffer {
  const pages: string[][] = []
  let cmds: string[] = []
  let y = MARGIN_T

  const pushPage = () => {
    pages.push(cmds)
    cmds = []
    y = MARGIN_T
  }

  const ensureSpace = (needed: number) => {
    if (y + needed > PAGE_H - MARGIN_B) {
      pushPage()
    }
  }

  const drawRect = (
    x: number,
    yTop: number,
    w: number,
    h: number,
    fill?: readonly [number, number, number],
    stroke?: readonly [number, number, number],
    lineWidth = 0.6
  ) => {
    let cmd = "q\n"
    if (fill) cmd += `${fmtColor(fill)} rg\n`
    if (stroke) cmd += `${lineWidth.toFixed(2)} w\n${fmtColor(stroke)} RG\n`
    cmd += `${x.toFixed(2)} ${pdfY(yTop + h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re\n`
    if (fill && stroke) cmd += "B\n"
    else if (fill) cmd += "f\n"
    else if (stroke) cmd += "S\n"
    cmd += "Q"
    cmds.push(cmd)
  }

  const drawLine = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: readonly [number, number, number],
    width = 0.6
  ) => {
    cmds.push(
      `q\n${width.toFixed(2)} w\n${fmtColor(color)} RG\n${x1.toFixed(2)} ${pdfY(y1).toFixed(
        2
      )} m ${x2.toFixed(2)} ${pdfY(y2).toFixed(2)} l S\nQ`
    )
  }

  const drawText = (
    text: string,
    x: number,
    baselineTop: number,
    fontSize: number,
    bold = false,
    color: readonly [number, number, number] = COLORS.navy,
    align: "left" | "right" = "left"
  ) => {
    const fontRef = bold ? "/F2" : "/F1"
    const drawX = align === "right" ? x - measureTextWidth(text, fontSize, bold) : x
    cmds.push(
      `BT\n${fmtColor(color)} rg\n${fontRef} ${fontSize.toFixed(2)} Tf\n1 0 0 1 ${drawX.toFixed(
        2
      )} ${pdfY(baselineTop).toFixed(2)} Tm\n${encodeCroatianPdfString(text)} Tj\nET`
    )
  }

  const drawParagraph = (
    text: string,
    x: number,
    maxW: number,
    fontSize: number,
    lineHeight: number,
    bold = false,
    color: readonly [number, number, number] = COLORS.slate800
  ) => {
    const lines = wrapText(text, maxW, fontSize, bold)
    for (const ln of lines) {
      ensureSpace(lineHeight + 2)
      drawText(ln, x, y + fontSize, fontSize, bold, color)
      y += lineHeight
    }
  }

  const drawChapterHeader = (title: string) => {
    ensureSpace(34)
    y += 6
    drawRect(MARGIN_L, y, CONTENT_W, 20, COLORS.navy)
    drawRect(MARGIN_L, y, 4, 20, COLORS.gold)
    drawText(title, MARGIN_L + 10, y + 13.5, 9.8, true, COLORS.white)
    y += 26
  }

  const drawSubHeader = (title: string) => {
    ensureSpace(24)
    y += 4
    drawText(title, MARGIN_L, y + 11, 10.5, true, COLORS.terracotta)
    drawLine(MARGIN_L, y + 14.5, PAGE_W - MARGIN_R, y + 14.5, COLORS.gold, 0.8)
    y += 20
  }

  // ─── NASLOVNICA / ZAGLAVLJE PRVE STRANICE ────────────────────────────────
  drawRect(MARGIN_L, y, CONTENT_W, 74, COLORS.navy)
  drawRect(MARGIN_L, y + 70, CONTENT_W, 4, COLORS.gold)
  drawText(
    "HRVATSKO RODOSLOVNO DRUŠTVO „PAVAO RITTER VITEZOVIĆ”",
    MARGIN_L + 14,
    y + 19,
    8.2,
    true,
    COLORS.gold
  )
  drawText(
    "Ljetopis društva — Provjereni podaci za spomenicu",
    MARGIN_L + 14,
    y + 39,
    15.5,
    true,
    COLORS.white
  )
  drawText(
    `Razdoblje obuhvata: ${report.period.label}  •  Izrađeno: ${report.period.generatedAt}`,
    MARGIN_L + 14,
    y + 57,
    8.4,
    false,
    COLORS.slate200
  )
  y += 84

  // Sažeta traka provjerenih brojki
  drawRect(MARGIN_L, y, CONTENT_W, 40, COLORS.parchment, COLORS.slate200, 0.6)
  const kpiLine1 = `Zapisa u ljetopisu: ${report.summary.totalEvents}   •   Sjednice: ${report.summary.meetingsCount}   •   Predavanja: ${report.summary.lecturesCount}   •   Projekti: ${report.summary.projectsCount}`
  const kpiLine2 = `Novoupisani članovi (u razdoblju): ${report.summary.newMembersCount} (ukupno u knjizi: ${report.summary.totalMembersCount})   •   Rodoslovni upiti: ${report.summary.inquiriesCount}   •   Knjižnica: ${report.summary.libraryTotalBooks} knjiga / ${report.summary.libraryTotalJournals} časopisa`
  drawText(kpiLine1, MARGIN_L + 10, y + 15, 8.2, true, COLORS.navy)
  drawText(kpiLine2, MARGIN_L + 10, y + 30, 8.0, false, COLORS.slate600)
  y += 50

  // ─── 1. UVODNI PRIPOVJEDNI SAŽETAK RAZDOBLJA ─────────────────────────────
  if (report.introNarrative.length > 0) {
    drawChapterHeader("1. UVODNI PRIPOVJEDNI SAŽETAK RAZDOBLJA")
    for (const para of report.introNarrative) {
      drawParagraph(para, MARGIN_L, CONTENT_W, 9.4, 13.5, false, COLORS.slate800)
      y += 4
    }
  }

  // ─── 2. KRONOLOŠKI PREGLED PO GODINAMA ───────────────────────────────────
  drawChapterHeader("2. KRONOLOŠKI PREGLED PROVJERENIH DOGAĐAJA PO GODINAMA")
  if (report.yearGroups.length === 0) {
    drawParagraph(
      "Za odabrano razdoblje i odabrane cjeline nema evidentiranih ljetopisnih zapisa.",
      MARGIN_L,
      CONTENT_W,
      9.2,
      13,
      false,
      COLORS.slate600
    )
  } else {
    for (const grp of report.yearGroups) {
      ensureSpace(44)
      y += 4
      drawRect(MARGIN_L, y, CONTENT_W, 20, COLORS.parchment, COLORS.gold, 0.7)
      drawText(`${grp.year}. GODINA`, MARGIN_L + 8, y + 13.5, 10.2, true, COLORS.navy)
      drawText(
        `${grp.events.length} zapisa`,
        PAGE_W - MARGIN_R - 8,
        y + 13.5,
        8.2,
        true,
        COLORS.terracotta,
        "right"
      )
      y += 24

      if (grp.yearSummary) {
        drawParagraph(grp.yearSummary, MARGIN_L, CONTENT_W, 8.8, 12.2, true, COLORS.slate600)
        y += 4
      }

      for (const ev of grp.events) {
        ensureSpace(46)
        // Naslov događaja + datum i kategorija
        drawText(`[${ev.dateDisplay}]  ${ev.title}`, MARGIN_L, y + 10, 9.5, true, COLORS.navy)
        drawText(ev.categoryLabel, PAGE_W - MARGIN_R, y + 10, 7.6, false, COLORS.terracotta, "right")
        y += 14

        drawParagraph(ev.narrative, MARGIN_L + 8, CONTENT_W - 8, 8.9, 12.6, false, COLORS.slate800)

        for (const det of ev.details) {
          drawParagraph(`• ${det}`, MARGIN_L + 14, CONTENT_W - 14, 8.2, 11.4, false, COLORS.slate600)
        }

        if (ev.people.length > 0 && !ev.id.startsWith("membership-joins-")) {
          drawParagraph(
            `Sudionici / spomenute osobe: ${ev.people.join(", ")}`,
            MARGIN_L + 14,
            CONTENT_W - 14,
            8.0,
            11.0,
            false,
            COLORS.slate600
          )
        }

        drawParagraph(`Izvor: ${ev.sourceRef}`, MARGIN_L + 8, CONTENT_W - 8, 7.6, 10.5, true, COLORS.slate400)
        drawLine(MARGIN_L, y + 2, PAGE_W - MARGIN_R, y + 2, COLORS.slate200, 0.4)
        y += 7
      }
    }
  }

  // ─── 3. PROVJERENI PRILOZI ZA SPOMENICU ──────────────────────────────────
  drawChapterHeader("3. PROVJERENI PRILOZI ZA SPOMENICU I MONOGRAFIJU")

  drawSubHeader(`3.1. Tijela Društva i mandati dužnosnika (${report.appendices.mandates.length})`)
  if (report.appendices.mandates.length === 0) {
    drawParagraph("Nema evidentiranih funkcija za odabrano razdoblje.", MARGIN_L, CONTENT_W, 8.8, 12, false, COLORS.slate600)
  } else {
    for (const m of report.appendices.mandates) {
      const span = m.fromYear
        ? `${m.fromYear}. – ${m.toYear ? `${m.toYear}.` : "danas"}`
        : m.toYear
        ? `do ${m.toYear}.`
        : "u tijeku"
      drawParagraph(
        `• ${m.functionName}: ${m.memberName} (${span}${m.isActive ? ", aktivan" : ""})`,
        MARGIN_L + 6,
        CONTENT_W - 6,
        8.6,
        12,
        false,
        COLORS.slate800
      )
    }
  }

  drawSubHeader(`3.2. Popis predavanja i gostovanja (${report.appendices.lecturesList.length})`)
  if (report.appendices.lecturesList.length === 0) {
    drawParagraph("Nema evidentiranih predavanja u ovom razdoblju.", MARGIN_L, CONTENT_W, 8.8, 12, false, COLORS.slate600)
  } else {
    for (const l of report.appendices.lecturesList) {
      const loc = [l.city, l.location !== "—" ? l.location : ""].filter((s) => s && s !== "—").join(", ")
      drawParagraph(
        `• [${l.dateDisplay}] ${l.title}${loc ? ` (${loc})` : ""}${l.host && l.host !== "—" ? ` — predavač/domaćin: ${l.host}` : ""}`,
        MARGIN_L + 6,
        CONTENT_W - 6,
        8.6,
        12,
        false,
        COLORS.slate800
      )
    }
  }

  drawSubHeader(`3.3. Novoupisani članovi u razdoblju (${report.appendices.newMembers.length})`)
  if (report.appendices.newMembers.length === 0) {
    drawParagraph("Nema upisanih članova s potvrđenim datumom u ovom razdoblju.", MARGIN_L, CONTENT_W, 8.8, 12, false, COLORS.slate600)
  } else {
    for (const nm of report.appendices.newMembers) {
      drawParagraph(`• ${nm.name} (${nm.dateDisplay})`, MARGIN_L + 6, CONTENT_W - 6, 8.5, 11.6, false, COLORS.slate800)
    }
  }

  if (report.appendices.honoraryMembers.length > 0) {
    drawSubHeader(`3.4. Počasni članovi (${report.appendices.honoraryMembers.length})`)
    for (const hm of report.appendices.honoraryMembers) {
      drawParagraph(
        `• ${hm.name}${hm.joinDateDisplay ? ` (član od ${hm.joinDateDisplay})` : ""}`,
        MARGIN_L + 6,
        CONTENT_W - 6,
        8.5,
        11.8,
        false,
        COLORS.slate800
      )
    }
  }

  if (report.appendices.inMemoriam.length > 0) {
    drawSubHeader(`3.5. In memoriam (${report.appendices.inMemoriam.length})`)
    for (const im of report.appendices.inMemoriam) {
      const meta = [
        `preminuo/la ${im.deathDateDisplay}`,
        im.joinDateDisplay ? `član od ${im.joinDateDisplay}` : "",
        im.functions.length > 0 ? `dužnosti: ${im.functions.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join("; ")
      drawParagraph(`• † ${im.name} (${meta})`, MARGIN_L + 6, CONTENT_W - 6, 8.5, 11.8, false, COLORS.slate800)
    }
  }

  if (report.appendices.peopleIndex.length > 0) {
    drawSubHeader(`3.6. Kazalo spomenutih osoba (${report.appendices.peopleIndex.length})`)
    for (const p of report.appendices.peopleIndex) {
      drawParagraph(
        `• ${p.name} — ${p.mentionsCount}× (${p.roles.join(", ")}; god. ${p.years.join(", ")})`,
        MARGIN_L + 6,
        CONTENT_W - 6,
        8.3,
        11.4,
        false,
        COLORS.slate600
      )
    }
  }

  // ─── 4. NAPOMENE O PROVJERENOSTI ─────────────────────────────────────────
  drawChapterHeader("4. NAPOMENE O IZVORIMA I PROVJERENOSTI PODATAKA")
  for (const note of report.dataQualityNotes) {
    drawParagraph(`• ${note}`, MARGIN_L + 4, CONTENT_W - 4, 8.4, 11.8, false, COLORS.slate600)
    y += 2
  }

  pages.push(cmds)

  // Podnožje na svim stranicama
  const totalPages = pages.length
  for (let pIdx = 0; pIdx < totalPages; pIdx++) {
    const footerLineY = PAGE_H - 28
    const footerTextY = PAGE_H - 16
    const fCmds: string[] = [
      `q\n0.50 w\n${fmtColor(COLORS.slate200)} RG\n${MARGIN_L.toFixed(2)} ${pdfY(footerLineY).toFixed(
        2
      )} m ${(PAGE_W - MARGIN_R).toFixed(2)} ${pdfY(footerLineY).toFixed(2)} l S\nQ`,
      `BT\n${fmtColor(COLORS.slate400)} rg\n/F1 7.20 Tf\n1 0 0 1 ${MARGIN_L.toFixed(2)} ${pdfY(
        footerTextY
      ).toFixed(2)} Tm\n${encodeCroatianPdfString(
        `HRD „Pavao Ritter Vitezović” • Ljetopis društva (${report.period.label})`
      )} Tj\nET`,
    ]
    const pageLabel = `Stranica ${pIdx + 1} / ${totalPages}`
    const labelW = measureTextWidth(pageLabel, 7.2, false)
    fCmds.push(
      `BT\n${fmtColor(COLORS.slate600)} rg\n/F1 7.20 Tf\n1 0 0 1 ${(
        PAGE_W -
        MARGIN_R -
        labelW
      ).toFixed(2)} ${pdfY(footerTextY).toFixed(2)} Tm\n${encodeCroatianPdfString(pageLabel)} Tj\nET`
    )
    pages[pIdx].push(...fCmds)
  }

  return assemblePdfDocument(pages, PAGE_W, PAGE_H)
}
