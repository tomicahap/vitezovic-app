import {
  assemblePdfDocument,
  encodeCroatianPdfString,
  measureTextWidth,
  wrapText,
} from "./report-pdf"
import { formatDateDMY, formatDateTimeDMY } from "./utils"

const PAGE_W = 841.89 // A4 Landscape width in pt (297 mm)
const PAGE_H = 595.28 // A4 Landscape height in pt (210 mm)
const MARGIN_L = 40
const MARGIN_R = 40
const MARGIN_T = 36
const MARGIN_B = 38
const CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R // 761.89 pt

interface RGB {
  r: number
  g: number
  b: number
}

const COLORS = {
  navy: { r: 0.106, g: 0.169, b: 0.212 },       // #1B2B36
  gold: { r: 0.808, g: 0.639, b: 0.412 },       // #CEA369
  slate900: { r: 0.059, g: 0.09, b: 0.165 },    // #0F172A
  slate700: { r: 0.2, g: 0.255, b: 0.333 },     // #334155
  slate500: { r: 0.392, g: 0.455, b: 0.545 },   // #64748B
  slate200: { r: 0.886, g: 0.91, b: 0.941 },    // #E2E8F0
  slate100: { r: 0.945, g: 0.961, b: 0.976 },   // #F1F5F9
  slate50: { r: 0.973, g: 0.98, b: 0.988 },     // #F8FAFC
  emerald700: { r: 0.016, g: 0.471, b: 0.341 }, // #047857
  amber800: { r: 0.573, g: 0.251, b: 0.055 },   // #92400E
  white: { r: 1, g: 1, b: 1 },
}

function fmtColor(c: RGB): string {
  return `${c.r.toFixed(3)} ${c.g.toFixed(3)} ${c.b.toFixed(3)}`
}

function pdfY(topY: number): number {
  return PAGE_H - topY
}

export interface LibraryBookPdfRow {
  id: number
  broj?: number | null
  naslov: string
  podnaslov?: string | null
  autor?: string | null
  izdavac?: string | null
  mjesto?: string | null
  godina?: string | null
  isbn?: string | null
  signatura?: string | null
  polica?: string | null
  loan_member_name?: string | null
  loan_date?: string | null
  loan_return_date?: string | null
  rights_contacted?: number | null
  rights_responded?: number | null
  rights_consent?: number | null
  is_scanned?: number | null
  is_digitized?: number | null
}

export interface LibraryBooksPdfInput {
  books: LibraryBookPdfRow[]
  filterLabel?: string
  generatedBy?: string
  generatedAt?: Date | string
}

interface TableColumn {
  header: string
  width: number
  align?: "left" | "right" | "center"
  bold?: boolean
  color?: RGB
}

export function generateLibraryBooksPdfBuffer(input: LibraryBooksPdfInput): Buffer {
  const books = Array.isArray(input.books) ? input.books : []
  const filterLabel = String(input.filterLabel || "Cijeli katalog knjiga").trim()
  const generatedBy = String(input.generatedBy || "Korisnik").trim()
  const generatedAtLabel = formatDateTimeDMY(input.generatedAt || new Date())

  const pages: string[][] = []
  let currentCommands: string[] = []
  let cursorY = MARGIN_T

  const drawRect = (
    x: number,
    topY: number,
    w: number,
    h: number,
    fill?: RGB,
    stroke?: RGB,
    lineWidth = 0.6
  ) => {
    const yBottom = pdfY(topY + h)
    let cmd = "q\n"
    cmd += `${lineWidth.toFixed(2)} w\n`
    if (fill) cmd += `${fmtColor(fill)} rg\n`
    if (stroke) cmd += `${fmtColor(stroke)} RG\n`
    const op = fill && stroke ? "B" : fill ? "f" : "S"
    cmd += `${x.toFixed(2)} ${yBottom.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re ${op}\n`
    cmd += "Q"
    currentCommands.push(cmd)
  }

  const drawLine = (x1: number, topY1: number, x2: number, topY2: number, stroke: RGB, lineWidth = 0.6) => {
    let cmd = "q\n"
    cmd += `${lineWidth.toFixed(2)} w\n`
    cmd += `${fmtColor(stroke)} RG\n`
    cmd += `${x1.toFixed(2)} ${pdfY(topY1).toFixed(2)} m ${x2.toFixed(2)} ${pdfY(topY2).toFixed(2)} l S\n`
    cmd += "Q"
    currentCommands.push(cmd)
  }

  const drawText = (
    text: string,
    x: number,
    baselineTopY: number,
    fontSize: number,
    bold = false,
    color: RGB = COLORS.slate900,
    align: "left" | "right" | "center" = "left"
  ) => {
    const str = String(text ?? "")
    if (!str) return
    let drawX = x
    if (align === "right") {
      drawX = x - measureTextWidth(str, fontSize, bold)
    } else if (align === "center") {
      drawX = x - measureTextWidth(str, fontSize, bold) / 2
    }

    const fontRef = bold ? "/F2" : "/F1"
    let cmd = "BT\n"
    cmd += `${fmtColor(color)} rg\n`
    cmd += `${fontRef} ${fontSize.toFixed(2)} Tf\n`
    cmd += `1 0 0 1 ${drawX.toFixed(2)} ${pdfY(baselineTopY).toFixed(2)} Tm\n`
    cmd += `${encodeCroatianPdfString(str)} Tj\n`
    cmd += "ET"
    currentCommands.push(cmd)
  }

  const startNewPage = (isFirstPage = false) => {
    currentCommands = []
    pages.push(currentCommands)
    cursorY = MARGIN_T

    if (!isFirstPage) {
      drawText(
        "HRD „Pavao Ritter Vitezović” — Katalog knjiga knjižnice",
        MARGIN_L,
        cursorY + 6,
        7.5,
        true,
        COLORS.slate500
      )
      drawText(filterLabel, PAGE_W - MARGIN_R, cursorY + 6, 7.5, false, COLORS.slate500, "right")
      drawLine(MARGIN_L, cursorY + 11, PAGE_W - MARGIN_R, cursorY + 11, COLORS.slate200, 0.5)
      cursorY += 18
    }
  }

  // ─── Page 1 Header ────────────────────────────────────────────────────────
  startNewPage(true)

  drawRect(MARGIN_L, cursorY, CONTENT_W, 48, COLORS.navy)
  drawRect(MARGIN_L, cursorY + 45, CONTENT_W, 3, COLORS.gold)

  drawText(
    "HRVATSKO RODOSLOVNO DRUŠTVO „PAVAO RITTER VITEZOVIĆ” ZAGREB",
    MARGIN_L + 14,
    cursorY + 17,
    12.5,
    true,
    COLORS.white
  )
  drawText(
    "KATALOG KNJIGA KNJIŽNICE DRUŠTVA",
    MARGIN_L + 14,
    cursorY + 30,
    9,
    true,
    COLORS.gold
  )
  drawText(
    `Obuhvat: ${filterLabel}`,
    MARGIN_L + 14,
    cursorY + 41,
    7.8,
    false,
    COLORS.white
  )

  drawText(
    `Generirano: ${generatedAtLabel}`,
    PAGE_W - MARGIN_R - 12,
    cursorY + 19,
    7.8,
    false,
    COLORS.white,
    "right"
  )
  drawText(
    `Izradio/la: ${generatedBy}`,
    PAGE_W - MARGIN_R - 12,
    cursorY + 32,
    7.8,
    true,
    COLORS.gold,
    "right"
  )

  cursorY += 56

  // ─── KPI Summary Row (5 boxes) ────────────────────────────────────────────
  const totalCount = books.length
  const scannedCount = books.filter((b) => b.is_scanned === 1).length
  const digitizedCount = books.filter((b) => b.is_digitized === 1).length
  const consentCount = books.filter((b) => b.rights_consent === 1).length
  const loanedCount = books.filter((b) => Boolean(b.loan_member_name && String(b.loan_member_name).trim())).length

  const kpis = [
    { label: "UKUPNO KNJIGA", value: String(totalCount), color: COLORS.navy },
    { label: "SKENIRANO", value: String(scannedCount), color: COLORS.amber800 },
    { label: "DIGITALIZIRANO", value: String(digitizedCount), color: COLORS.emerald700 },
    { label: "DOZVOLA POSUDBE", value: String(consentCount), color: COLORS.emerald700 },
    { label: "TRENUTNO POSUĐENO", value: String(loanedCount), color: COLORS.amber800 },
  ]

  const kpiGap = 6
  const kpiW = (CONTENT_W - kpiGap * (kpis.length - 1)) / kpis.length
  const kpiH = 34
  for (let i = 0; i < kpis.length; i++) {
    const x = MARGIN_L + i * (kpiW + kpiGap)
    drawRect(x, cursorY, kpiW, kpiH, COLORS.slate50, COLORS.slate200, 0.5)
    drawRect(x, cursorY, kpiW, 2.5, COLORS.gold)
    drawText(kpis[i].label, x + 8, cursorY + 13, 6.8, true, COLORS.slate500)
    drawText(kpis[i].value, x + 8, cursorY + 27, 12, true, kpis[i].color)
  }
  cursorY += kpiH + 10

  // ─── Books Table ──────────────────────────────────────────────────────────
  const columns: TableColumn[] = [
    { header: "Br.", width: 34, align: "center", bold: true, color: COLORS.slate700 },
    { header: "Naslov i podnaslov", width: 204, bold: true },
    { header: "Autor(i)", width: 120 },
    { header: "Izdavač / Mjesto / God.", width: 124 },
    { header: "ISBN / Signatura / Polica", width: 96 },
    { header: "Status / Prava", width: 94 },
    { header: "Posudba", width: 89.89 },
  ]

  const rows: string[][] = books.map((b) => {
    const numLabel = b.broj !== undefined && b.broj !== null ? String(b.broj) : "—"
    const titlePart = [b.naslov || "—", b.podnaslov ? String(b.podnaslov).trim() : ""]
      .filter(Boolean)
      .join("\n")
    const authorPart = b.autor ? String(b.autor).trim() : "—"
    const publisherParts = [
      b.izdavac ? String(b.izdavac).trim() : "",
      [b.mjesto, b.godina].filter(Boolean).join(", "),
    ].filter(Boolean)
    const publisherPart = publisherParts.length > 0 ? publisherParts.join("\n") : "—"

    const metaParts = [
      b.isbn ? `ISBN: ${String(b.isbn).trim()}` : "",
      b.signatura ? `Sig.: ${String(b.signatura).trim()}` : "",
      b.polica ? `Pol.: ${String(b.polica).trim()}` : "",
    ].filter(Boolean)
    const metaPart = metaParts.length > 0 ? metaParts.join("\n") : "—"

    const rightsTags: string[] = []
    if (b.rights_consent === 1) rightsTags.push("Dozvola: Da")
    if (b.is_scanned === 1) rightsTags.push("Skenirano")
    if (b.is_digitized === 1) rightsTags.push("Digitalizirano")
    if (b.rights_contacted === 1) rightsTags.push("Kontaktiran")
    if (b.rights_responded === 1) rightsTags.push("Odgovoreno")
    const statusPart = rightsTags.length > 0 ? rightsTags.join(", ") : "—"

    let loanPart = "Dostupno"
    if (b.loan_member_name && String(b.loan_member_name).trim()) {
      const loanDates = [
        b.loan_date ? formatDateDMY(b.loan_date, "") : "",
        b.loan_return_date ? `rok ${formatDateDMY(b.loan_return_date, "")}` : "",
      ]
        .filter(Boolean)
        .join(" / ")
      loanPart = [String(b.loan_member_name).trim(), loanDates].filter(Boolean).join("\n")
    }

    return [numLabel, titlePart, authorPart, publisherPart, metaPart, statusPart, loanPart]
  })

  const fontSize = 7.3
  const lineHeight = fontSize + 2.8
  const padX = 4.5
  const padY = 4

  const renderTableHeader = () => {
    const hHeight = 18
    drawRect(MARGIN_L, cursorY, CONTENT_W, hHeight, COLORS.navy)
    drawRect(MARGIN_L, cursorY + hHeight - 1.5, CONTENT_W, 1.5, COLORS.gold)
    let colX = MARGIN_L
    for (const col of columns) {
      const textX =
        col.align === "right"
          ? colX + col.width - padX
          : col.align === "center"
          ? colX + col.width / 2
          : colX + padX
      drawText(col.header, textX, cursorY + 12, 7.3, true, COLORS.white, col.align || "left")
      colX += col.width
    }
    cursorY += hHeight
  }

  if (rows.length === 0) {
    drawRect(MARGIN_L, cursorY, CONTENT_W, 24, COLORS.slate50, COLORS.slate200, 0.5)
    drawText(
      "Nema knjiga koje odgovaraju odabranim kriterijima.",
      MARGIN_L + 10,
      cursorY + 15,
      8.5,
      false,
      COLORS.slate500
    )
  } else {
    renderTableHeader()

    for (let rIdx = 0; rIdx < rows.length; rIdx++) {
      const row = rows[rIdx]
      const wrappedCells = columns.map((col, cIdx) =>
        wrapText(row[cIdx] ?? "—", col.width - padX * 2, fontSize, col.bold)
      )
      const maxLines = Math.max(1, ...wrappedCells.map((lines) => lines.length))
      const rowHeight = maxLines * lineHeight + padY * 2

      if (cursorY + rowHeight > PAGE_H - MARGIN_B) {
        startNewPage(false)
        renderTableHeader()
      }

      const bg = rIdx % 2 === 1 ? COLORS.slate50 : COLORS.white
      drawRect(MARGIN_L, cursorY, CONTENT_W, rowHeight, bg, COLORS.slate200, 0.4)

      let colX = MARGIN_L
      for (let cIdx = 0; cIdx < columns.length; cIdx++) {
        const col = columns[cIdx]
        const lines = wrappedCells[cIdx]
        const isLoanedCell = cIdx === 6 && row[6] !== "Dostupno"
        const textColor = isLoanedCell ? COLORS.amber800 : col.color || COLORS.slate900
        const textX =
          col.align === "right"
            ? colX + col.width - padX
            : col.align === "center"
            ? colX + col.width / 2
            : colX + padX

        for (let lIdx = 0; lIdx < lines.length; lIdx++) {
          const baseline = cursorY + padY + fontSize + lIdx * lineHeight
          const isBoldLine = Boolean(col.bold && (cIdx !== 1 || lIdx === 0)) || isLoanedCell
          drawText(lines[lIdx], textX, baseline, fontSize, isBoldLine, textColor, col.align || "left")
        }
        colX += col.width
      }
      cursorY += rowHeight
    }
  }

  // ─── Page Footers ─────────────────────────────────────────────────────────
  const totalPages = pages.length
  for (let pIdx = 0; pIdx < totalPages; pIdx++) {
    const cmds = pages[pIdx]
    const footerY = PAGE_H - 20
    let lineCmd = "q\n0.50 w\n"
    lineCmd += `${fmtColor(COLORS.slate200)} RG\n`
    lineCmd += `${MARGIN_L.toFixed(2)} ${pdfY(footerY - 10).toFixed(2)} m ${(PAGE_W - MARGIN_R).toFixed(2)} ${pdfY(
      footerY - 10
    ).toFixed(2)} l S\nQ`
    cmds.push(lineCmd)

    const leftFooter = `HRD „Pavao Ritter Vitezović” — Katalog knjiga (${totalCount} zapisa)`
    cmds.push(
      `BT\n${fmtColor(COLORS.slate500)} rg\n/F1 7.50 Tf\n1 0 0 1 ${MARGIN_L.toFixed(2)} ${pdfY(footerY).toFixed(
        2
      )} Tm\n${encodeCroatianPdfString(leftFooter)} Tj\nET`
    )

    const rightFooter = `Stranica ${pIdx + 1} / ${totalPages}`
    const rightX = PAGE_W - MARGIN_R - measureTextWidth(rightFooter, 7.5, true)
    cmds.push(
      `BT\n${fmtColor(COLORS.navy)} rg\n/F2 7.50 Tf\n1 0 0 1 ${rightX.toFixed(2)} ${pdfY(footerY).toFixed(
        2
      )} Tm\n${encodeCroatianPdfString(rightFooter)} Tj\nET`
    )
  }

  return assemblePdfDocument(pages, PAGE_W, PAGE_H)
}
