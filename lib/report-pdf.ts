import { formatDateDMY, formatDateTimeDMY } from "./utils"

/**
 * Generates an official A4 Landscape PDF document (297mm x 210mm = 841.89pt x 595.28pt)
 * with proper print margins and full Croatian diacritics support (č, ć, ž, š, đ, Č, Ć, Ž, Š, Đ, €).
 */

const PAGE_W = 841.89 // A4 Landscape width in points (297 mm)
const PAGE_H = 595.28 // A4 Landscape height in points (210 mm)
const MARGIN_L = 40   // ~14.1 mm left margin
const MARGIN_R = 40   // ~14.1 mm right margin
const MARGIN_T = 36   // ~12.7 mm top margin
const MARGIN_B = 38   // ~13.4 mm bottom margin
const CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R // 761.89 pt

// Custom byte mapping in 0x80-0x9F range for Croatian glyphs + common symbols via PDF /Differences
const CUSTOM_CHAR_MAP: Record<string, number> = {
  "€": 0x80,
  "č": 0x81,
  "Č": 0x82,
  "ć": 0x83,
  "Ć": 0x84,
  "ž": 0x85,
  "Ž": 0x86,
  "š": 0x87,
  "Š": 0x88,
  "đ": 0x89,
  "Đ": 0x8a,
  "•": 0x8b,
  "–": 0x8c,
  "—": 0x8d,
  "„": 0x8e,
  "”": 0x8f,
  "“": 0x90,
  "×": 0xd7, // standard WinAnsi multiply
}

export function encodeCroatianPdfString(input: string): string {
  if (!input) return "()"
  const str = String(input)
    .replace(/\r\n/g, " ")
    .replace(/[\r\n\t]+/g, " ")

  let out = "("
  for (let i = 0; i < str.length; i++) {
    const ch = str[i]
    const code = str.charCodeAt(i)

    if (ch === "(" || ch === ")" || ch === "\\") {
      out += "\\" + ch
    } else if (CUSTOM_CHAR_MAP[ch] !== undefined) {
      const b = CUSTOM_CHAR_MAP[ch]
      out += "\\" + b.toString(8).padStart(3, "0")
    } else if (code >= 0x20 && code <= 0x7e) {
      out += ch
    } else if (code >= 0xa0 && code <= 0xff) {
      out += "\\" + code.toString(8).padStart(3, "0")
    } else {
      // Fallback for any other unicode symbol
      out += "-"
    }
  }
  out += ")"
  return out
}

function estimateCharWidthFactor(ch: string, bold = false): number {
  if ("ilI.,:;!|'` ".includes(ch)) return bold ? 0.31 : 0.28
  if ("mwMW@%".includes(ch)) return bold ? 0.84 : 0.78
  if (ch >= "A" && ch <= "Z") return bold ? 0.68 : 0.64
  if ("ČĆŽŠĐ".includes(ch)) return bold ? 0.68 : 0.64
  if ("0123456789".includes(ch)) return bold ? 0.57 : 0.54
  return bold ? 0.56 : 0.52
}

export function measureTextWidth(text: string, fontSize: number, bold = false): number {
  if (!text) return 0
  let factorSum = 0
  for (let i = 0; i < text.length; i++) {
    factorSum += estimateCharWidthFactor(text[i], bold)
  }
  return factorSum * fontSize
}

export function wrapText(text: string, maxWidth: number, fontSize: number, bold = false): string[] {
  const clean = String(text ?? "")
    .replace(/\r\n/g, "\n")
    .trim()
  if (!clean) return ["—"]

  const paragraphs = clean.split("\n")
  const lines: string[] = []

  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean)
    if (words.length === 0) {
      lines.push("")
      continue
    }
    let currentLine = ""
    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word
      if (measureTextWidth(candidate, fontSize, bold) <= maxWidth) {
        currentLine = candidate
      } else {
        if (currentLine) {
          lines.push(currentLine)
        }
        // If single word is wider than maxWidth, break it by characters
        if (measureTextWidth(word, fontSize, bold) > maxWidth) {
          let chunk = ""
          for (const ch of word) {
            if (measureTextWidth(chunk + ch, fontSize, bold) <= maxWidth) {
              chunk += ch
            } else {
              if (chunk) lines.push(chunk)
              chunk = ch
            }
          }
          currentLine = chunk
        } else {
          currentLine = word
        }
      }
    }
    if (currentLine) lines.push(currentLine)
  }

  return lines.length > 0 ? lines : ["—"]
}

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
  slate400: { r: 0.58, g: 0.639, b: 0.722 },    // #94A3B8
  slate200: { r: 0.886, g: 0.91, b: 0.941 },    // #E2E8F0
  slate100: { r: 0.945, g: 0.961, b: 0.976 },   // #F1F5F9
  slate50: { r: 0.973, g: 0.98, b: 0.988 },     // #F8FAFC
  emerald700: { r: 0.016, g: 0.471, b: 0.341 }, // #047857
  emerald50: { r: 0.925, g: 0.992, b: 0.961 },  // #ECFDF5
  amber50: { r: 1.0, g: 0.984, b: 0.922 },      // #FFFBEB
  white: { r: 1, g: 1, b: 1 },
}

interface TableColumn {
  header: string
  width: number
  align?: "left" | "right" | "center"
  bold?: boolean
  color?: RGB
}

export interface ReportPdfInput {
  startDate: string
  endDate: string
  generatedBy: string
  generatedByRole: string
  reportData: any
}

export function generateReportPdfBuffer(input: ReportPdfInput): Buffer {
  const { startDate, endDate, generatedBy, generatedByRole, reportData } = input
  const s = reportData?.summary || {}
  const d = reportData?.details || {}

  const pages: string[][] = []
  let currentCommands: string[] = []
  let cursorY = MARGIN_T // Top-down coordinate (0 = top of page, PAGE_H = bottom)

  const pdfY = (topY: number) => Number((PAGE_H - topY).toFixed(2))
  const fmtColor = (c: RGB) => `${c.r.toFixed(3)} ${c.g.toFixed(3)} ${c.b.toFixed(3)}`

  const startNewPage = (isFirstPage = false) => {
    if (!isFirstPage) {
      pages.push(currentCommands)
      currentCommands = []
    }
    cursorY = MARGIN_T

    if (!isFirstPage) {
      // Compact running header on continuation pages
      drawRect(MARGIN_L, cursorY, CONTENT_W, 18, COLORS.slate100, COLORS.slate200, 0.5)
      drawText(
        "HRVATSKO RODOSLOVNO DRUŠTVO „PAVAO RITTER VITEZOVIĆ” ZAGREB — Službeno periodičko izvješće",
        MARGIN_L + 6,
        cursorY + 12,
        7.5,
        true,
        COLORS.navy
      )
      drawText(
        `Razdoblje: ${formatDateDMY(startDate)} – ${formatDateDMY(endDate)}`,
        PAGE_W - MARGIN_R - 6,
        cursorY + 12,
        7.5,
        false,
        COLORS.slate700,
        "right"
      )
      cursorY += 26
    }
  }

  const ensureSpace = (neededHeight: number): boolean => {
    if (cursorY + neededHeight > PAGE_H - MARGIN_B) {
      startNewPage(false)
      return true
    }
    return false
  }

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

  const drawLine = (x1: number, topY1: number, x2: number, topY2: number, stroke: RGB, lineWidth = 0.8) => {
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

  const drawSectionHeader = (title: string, rightSubtitle?: string) => {
    ensureSpace(34)
    cursorY += 6
    drawRect(MARGIN_L, cursorY, CONTENT_W, 18, COLORS.navy)
    drawRect(MARGIN_L, cursorY, 4, 18, COLORS.gold)
    drawText(title, MARGIN_L + 10, cursorY + 12.5, 8.5, true, COLORS.white)
    if (rightSubtitle) {
      drawText(rightSubtitle, PAGE_W - MARGIN_R - 8, cursorY + 12.5, 8, false, COLORS.gold, "right")
    }
    cursorY += 22
  }

  const drawTable = (
    columns: TableColumn[],
    rows: string[][],
    options?: {
      emptyMessage?: string
      footerRow?: { label: string; value: string }
      fontSize?: number
    }
  ) => {
    const fontSize = options?.fontSize ?? 7.5
    const lineHeight = fontSize + 3
    const padX = 5
    const padY = 4

    if (!rows || rows.length === 0) {
      ensureSpace(20)
      drawRect(MARGIN_L, cursorY, CONTENT_W, 18, COLORS.slate50, COLORS.slate200, 0.5)
      drawText(options?.emptyMessage || "Nema zabilježenih podataka u odabranom razdoblju.", MARGIN_L + 8, cursorY + 12, 8, false, COLORS.slate500)
      cursorY += 22
      return
    }

    const renderHeaderRow = () => {
      const hHeight = 17
      drawRect(MARGIN_L, cursorY, CONTENT_W, hHeight, COLORS.slate100, COLORS.slate200, 0.5)
      let colX = MARGIN_L
      for (const col of columns) {
        const textX =
          col.align === "right"
            ? colX + col.width - padX
            : col.align === "center"
            ? colX + col.width / 2
            : colX + padX
        drawText(col.header, textX, cursorY + 11.5, 7.5, true, COLORS.slate700, col.align || "left")
        colX += col.width
      }
      cursorY += hHeight
    }

    ensureSpace(36)
    renderHeaderRow()

    for (let rIdx = 0; rIdx < rows.length; rIdx++) {
      const row = rows[rIdx]
      const wrappedCells: string[][] = columns.map((col, cIdx) =>
        wrapText(row[cIdx] ?? "—", col.width - padX * 2, fontSize, col.bold)
      )
      const maxLines = Math.max(1, ...wrappedCells.map((lines) => lines.length))
      const rowHeight = maxLines * lineHeight + padY * 2

      if (cursorY + rowHeight > PAGE_H - MARGIN_B) {
        startNewPage(false)
        renderHeaderRow()
      }

      const bg = rIdx % 2 === 1 ? COLORS.slate50 : COLORS.white
      drawRect(MARGIN_L, cursorY, CONTENT_W, rowHeight, bg, COLORS.slate200, 0.4)

      let colX = MARGIN_L
      for (let cIdx = 0; cIdx < columns.length; cIdx++) {
        const col = columns[cIdx]
        const lines = wrappedCells[cIdx]
        const textColor = col.color || COLORS.slate900
        const textX =
          col.align === "right"
            ? colX + col.width - padX
            : col.align === "center"
            ? colX + col.width / 2
            : colX + padX

        for (let lIdx = 0; lIdx < lines.length; lIdx++) {
          const baseline = cursorY + padY + fontSize + lIdx * lineHeight
          drawText(lines[lIdx], textX, baseline, fontSize, Boolean(col.bold), textColor, col.align || "left")
        }
        colX += col.width
      }
      cursorY += rowHeight
    }

    if (options?.footerRow) {
      const fHeight = 18
      if (cursorY + fHeight > PAGE_H - MARGIN_B) {
        startNewPage(false)
      }
      drawRect(MARGIN_L, cursorY, CONTENT_W, fHeight, COLORS.emerald50, COLORS.slate200, 0.5)
      drawText(options.footerRow.label, MARGIN_L + 8, cursorY + 12, 8, true, COLORS.navy)
      drawText(
        options.footerRow.value,
        PAGE_W - MARGIN_R - 8,
        cursorY + 12,
        8.5,
        true,
        COLORS.emerald700,
        "right"
      )
      cursorY += fHeight
    }

    cursorY += 4
  }

  // ─── START PAGE 1 ─────────────────────────────────────────────────────────
  startNewPage(true)

  // Official Memorandum Header
  drawRect(MARGIN_L, cursorY, CONTENT_W, 48, COLORS.navy)
  drawRect(MARGIN_L, cursorY + 45, CONTENT_W, 3, COLORS.gold)

  drawText(
    "HRVATSKO RODOSLOVNO DRUŠTVO „PAVAO RITTER VITEZOVIĆ” ZAGREB",
    MARGIN_L + 14,
    cursorY + 18,
    13,
    true,
    COLORS.white
  )
  drawText(
    "SLUŽBENO PERIODIČKO IZVJEŠĆE O RADU, FINANCIJAMA I AKTIVNOSTIMA DRUŠTVA",
    MARGIN_L + 14,
    cursorY + 31,
    8.5,
    true,
    COLORS.gold
  )
  drawText(
    `Izvještajno razdoblje: ${formatDateDMY(startDate)} — ${formatDateDMY(endDate)}`,
    MARGIN_L + 14,
    cursorY + 41,
    8,
    false,
    COLORS.white
  )

  drawText(
    `Generirano: ${formatDateTimeDMY(reportData?.generatedAt || new Date())}`,
    PAGE_W - MARGIN_R - 12,
    cursorY + 20,
    8,
    false,
    COLORS.white,
    "right"
  )
  drawText(
    `Izradio/la: ${generatedBy} (${generatedByRole})`,
    PAGE_W - MARGIN_R - 12,
    cursorY + 33,
    8,
    true,
    COLORS.gold,
    "right"
  )

  cursorY += 56

  // ─── I. SAŽETAK KLJUČNIH POKAZATELJA (6 Kartica u 1 redu) ─────────────────
  drawSectionHeader(
    "I. SAŽETAK KLJUČNIH POKAZATELJA I STATISTIKA",
    `Ukupni prihodi u razdoblju: ${Number(s.totalRevenue || 0).toFixed(2)} €`
  )

  const kpiGap = 6
  const kpiCount = 6
  const kpiWidth = (CONTENT_W - kpiGap * (kpiCount - 1)) / kpiCount
  const kpiHeight = 40
  const kpis = [
    {
      label: "NOVI ČLANOVI",
      value: `${s.newMembersCount ?? 0}`,
      sub: `Ukupno u bazi: ${s.totalMembers ?? 0} (Akt: ${s.activeMembers ?? 0})`,
      color: COLORS.navy,
    },
    {
      label: "ČLANARINE",
      value: `${Number(s.paymentsTotalAmount || 0).toFixed(2)} €`,
      sub: `${s.paymentsCount ?? 0} evidentiranih uplata`,
      color: COLORS.emerald700,
    },
    {
      label: "DONACIJE",
      value: `${Number(s.donationsTotalAmount || 0).toFixed(2)} €`,
      sub: `${s.donationsCount ?? 0} primljenih donacija`,
      color: COLORS.gold,
    },
    {
      label: "PRIMLJENI MAILOVI",
      value: `${s.receivedEmailsCount ?? 0}`,
      sub: "Službeni Gmail Inbox",
      color: COLORS.navy,
    },
    {
      label: "POSLANI MAILOVI",
      value: `${s.sentEmailsCount ?? 0}`,
      sub: `Opomene za članarinu: ${s.paymentRemindersSent ?? 0}`,
      color: COLORS.navy,
    },
    {
      label: "DOGAĐANJA",
      value: `${(s.meetingsCount ?? 0) + (s.lecturesCount ?? 0)}`,
      sub: `${s.meetingsCount ?? 0} sjednica / ${s.lecturesCount ?? 0} predavanja`,
      color: COLORS.navy,
    },
  ]

  for (let i = 0; i < kpis.length; i++) {
    const kx = MARGIN_L + i * (kpiWidth + kpiGap)
    const item = kpis[i]
    drawRect(kx, cursorY, kpiWidth, kpiHeight, COLORS.slate50, COLORS.slate200, 0.6)
    drawRect(kx, cursorY, kpiWidth, 2.5, item.color)
    drawText(item.label, kx + 6, cursorY + 12, 6.8, true, COLORS.slate500)
    drawText(item.value, kx + 6, cursorY + 25, 11.5, true, item.color)
    drawText(item.sub, kx + 6, cursorY + 35, 6.5, false, COLORS.slate500)
  }
  cursorY += kpiHeight + 8

  // ─── II. POPIS NOVIH ČLANOVA ─────────────────────────────────────────────
  const newMembers = d.newMembers || []
  drawSectionHeader(
    `II. POPIS NOVIH ČLANOVA U RAZDOBLJU (${newMembers.length})`,
    `Aktivni članovi: ${s.activeMembers ?? 0} | Dug članarine: ${s.overdueMembers ?? 0}`
  )
  drawTable(
    [
      { header: "R.br.", width: 32, align: "left", color: COLORS.slate500 },
      { header: "Ime i prezime", width: 175, align: "left", bold: true },
      { header: "E-pošta", width: 185, align: "left", color: COLORS.slate700 },
      { header: "Telefon", width: 95, align: "left", color: COLORS.slate700 },
      { header: "Br. matice", width: 65, align: "left" },
      { header: "Iskaznica", width: 65, align: "left" },
      { header: "Datum upisa", width: 75, align: "left" },
      { header: "Status", width: CONTENT_W - 692, align: "right", bold: true, color: COLORS.emerald700 },
    ],
    newMembers.map((m: any, idx: number) => [
      `${idx + 1}.`,
      m.name || "—",
      m.email || "—",
      m.phone || "—",
      m.registryNumber || "—",
      m.membershipNumber || "—",
      formatDateDMY(m.joinDate || m.created_at),
      m.status_clana || "AKTIVAN",
    ]),
    { emptyMessage: "U odabranom razdoblju nije bilo novoupisanih članova." }
  )

  // ─── III. EVIDENCIJA UPLATA ČLANARINA ────────────────────────────────────
  const payments = d.payments || []
  drawSectionHeader(
    `III. EVIDENCIJA UPLATA ČLANARINA (${payments.length})`,
    `Ukupno članarine: ${Number(s.paymentsTotalAmount || 0).toFixed(2)} €`
  )
  drawTable(
    [
      { header: "R.br.", width: 35, align: "left", color: COLORS.slate500 },
      { header: "Datum uplate", width: 85, align: "left" },
      { header: "Član (Ime i prezime)", width: 220, align: "left", bold: true },
      { header: "Br. matice", width: 80, align: "left", color: COLORS.slate700 },
      { header: "Opis / Napomena", width: 235, align: "left", color: COLORS.slate700 },
      { header: "Iznos (EUR)", width: CONTENT_W - 655, align: "right", bold: true, color: COLORS.emerald700 },
    ],
    payments.map((p: any, idx: number) => [
      `${idx + 1}.`,
      formatDateDMY(p.date || p.created_at),
      p.memberName || `Član #${p.memberId}`,
      p.registryNumber || "—",
      p.note || "Godišnja članarina",
      `${Number(p.amount || 0).toFixed(2)} €`,
    ]),
    {
      emptyMessage: "U odabranom razdoblju nema evidentiranih uplata članarina.",
      footerRow: {
        label: "UKUPNO UPLAĆENE ČLANARINE U RAZDOBLJU:",
        value: `${Number(s.paymentsTotalAmount || 0).toFixed(2)} €`,
      },
    }
  )

  // ─── IV. EVIDENCIJA PRIMLJENIH DONACIJA ──────────────────────────────────
  const donations = d.donations || []
  drawSectionHeader(
    `IV. EVIDENCIJA PRIMLJENIH DONACIJA (${donations.length})`,
    `Ukupno donacije: ${Number(s.donationsTotalAmount || 0).toFixed(2)} €`
  )
  drawTable(
    [
      { header: "R.br.", width: 35, align: "left", color: COLORS.slate500 },
      { header: "Datum", width: 80, align: "left" },
      { header: "Donator (Tvrtka / Osoba)", width: 200, align: "left", bold: true },
      { header: "Grad", width: 95, align: "left", color: COLORS.slate700 },
      { header: "E-pošta", width: 155, align: "left", color: COLORS.slate700 },
      { header: "Napomena", width: 105, align: "left", color: COLORS.slate700 },
      { header: "Iznos (EUR)", width: CONTENT_W - 670, align: "right", bold: true, color: COLORS.emerald700 },
    ],
    donations.map((dn: any, idx: number) => [
      `${idx + 1}.`,
      formatDateDMY(dn.donated_at),
      dn.name || "—",
      dn.city || "—",
      dn.email || "—",
      dn.donation_note || "Donacija za rad društva",
      `${Number(dn.donated_amount || 0).toFixed(2)} €`,
    ]),
    {
      emptyMessage: "U odabranom razdoblju nema evidentiranih donacija.",
      footerRow: {
        label: "UKUPNO PRIMLJENE DONACIJE U RAZDOBLJU:",
        value: `${Number(s.donationsTotalAmount || 0).toFixed(2)} €`,
      },
    }
  )

  // ─── V. ODRŽANE SJEDNICE ──────────────────────────────────────────────────
  const meetings = d.meetings || []
  drawSectionHeader(`V. ODRŽANE SJEDNICE (${meetings.length})`)
  drawTable(
    [
      { header: "R.br.", width: 35, align: "left", color: COLORS.slate500 },
      { header: "Datum i vrijeme", width: 110, align: "left" },
      { header: "Naziv sjednice", width: 270, align: "left", bold: true },
      { header: "Vrsta sjednice", width: 120, align: "left", color: COLORS.slate700 },
      { header: "Lokacija", width: 145, align: "left", color: COLORS.slate700 },
      { header: "Status", width: CONTENT_W - 680, align: "right", bold: true },
    ],
    meetings.map((m: any, idx: number) => [
      `${idx + 1}.`,
      `${formatDateDMY(m.date)}${m.start_time ? ` u ${m.start_time}` : ""}`,
      m.title || "—",
      m.type || "Redovna sjednica",
      m.location || "Sjedište društva",
      m.status || "održano",
    ]),
    { emptyMessage: "U odabranom razdoblju nije bilo održanih sjednica." }
  )

  // ─── VI. ODRŽANA PREDAVANJA I DRUŽENJA ───────────────────────────────────
  const lectures = d.lectures || []
  drawSectionHeader(`VI. ODRŽANA PREDAVANJA I DRUŽENJA (${lectures.length})`)
  drawTable(
    [
      { header: "R.br.", width: 35, align: "left", color: COLORS.slate500 },
      { header: "Datum i vrijeme", width: 110, align: "left" },
      { header: "Naslov predavanja / događanja", width: 250, align: "left", bold: true },
      { header: "Predavač / Voditelj", width: 145, align: "left", color: COLORS.slate700 },
      { header: "Lokacija / Grad", width: 140, align: "left", color: COLORS.slate700 },
      { header: "Status", width: CONTENT_W - 680, align: "right", bold: true },
    ],
    lectures.map((l: any, idx: number) => [
      `${idx + 1}.`,
      `${formatDateDMY(l.date)}${l.start_time ? ` u ${l.start_time}` : ""}`,
      l.title || "—",
      l.host || "—",
      l.location || l.city || "Sjedište društva",
      l.status || "održano",
    ]),
    { emptyMessage: "U odabranom razdoblju nije bilo održanih predavanja." }
  )

  // ─── VII. E-MAIL KOMUNIKACIJA I KORESPONDENCIJA ──────────────────────────
  const mailStats = d.mailSendersStats || []
  drawSectionHeader(
    "VII. E-MAIL KOMUNIKACIJA I KORESPONDENCIJA",
    `Sandučić: ${s.gmailMailbox || "Službeni Gmail"} | Primljeno: ${s.receivedEmailsCount ?? 0} | Poslano: ${s.sentEmailsCount ?? 0} | Opomene: ${s.paymentRemindersSent ?? 0}`
  )
  if (mailStats.length > 0) {
    drawTable(
      [
        { header: "R.br.", width: 35, align: "left", color: COLORS.slate500 },
        { header: "Korisnik / Administrator", width: 260, align: "left", bold: true },
        { header: "Uloga u sustavu", width: 160, align: "left", color: COLORS.slate700 },
        { header: "Vrsta komunikacije", width: 180, align: "left", color: COLORS.slate700 },
        { header: "Broj poslanih poruka", width: CONTENT_W - 635, align: "right", bold: true, color: COLORS.navy },
      ],
      mailStats.map((st: any, idx: number) => [
        `${idx + 1}.`,
        st.user_name || "Administrator",
        st.user_role || "admin",
        st.action_type === "reply" ? "Odgovori na poruke" : "Nove poslane poruke",
        `${st.count} poslanih`,
      ])
    )
  } else {
    drawTable([], [], {
      emptyMessage: `Primljeno e-mailova: ${s.receivedEmailsCount ?? 0} | Poslano e-mailova: ${s.sentEmailsCount ?? 0} | Poslano opomena za članarinu: ${s.paymentRemindersSent ?? 0}`,
    })
  }

  // ─── VIII. SAŽETAK KLJUČNIH OPERACIJA I AKTIVNOSTI SUSTAVA ───────────────
  const totalOps = d.totalLogsCount ?? (d.recentLogs?.length || 0)
  const logsByUser = d.logsSummaryByUser || []
  const logsByAction = d.logsSummaryByAction || []
  const logsByCat = d.logsSummaryByCategory || []

  drawSectionHeader(
    "VIII. DNEVNIK KLJUČNIH OPERACIJA I AKTIVNOSTI SUSTAVA (SAŽETAK)",
    `Ukupno zabilježenih operacija u razdoblju: ${totalOps}`
  )

  if (logsByCat.length > 0) {
    ensureSpace(34)
    const catCount = logsByCat.length
    const catGap = 6
    const catW = (CONTENT_W - catGap * (catCount - 1)) / catCount
    const catH = 26
    for (let i = 0; i < catCount; i++) {
      const cx = MARGIN_L + i * (catW + catGap)
      const c = logsByCat[i]
      drawRect(cx, cursorY, catW, catH, COLORS.slate50, COLORS.slate200, 0.5)
      drawText(String(c.category || "").toUpperCase(), cx + 5, cursorY + 10, 6.2, true, COLORS.slate500)
      drawText(`${c.count} radnji (${c.uniqueActionsCount} vrste)`, cx + 5, cursorY + 21, 8, true, COLORS.navy)
    }
    cursorY += catH + 6
  }

  if (logsByUser.length > 0) {
    drawTable(
      [
        { header: "A) Korisnik i uloga", width: 140, align: "left", bold: true },
        { header: "Sažetak izvršenih radnji po vrstama (broj ponavljanja)", width: 440, align: "left", color: COLORS.slate700 },
        { header: "Zadnja aktivnost", width: 110, align: "left", color: COLORS.slate500 },
        { header: "Ukupno", width: CONTENT_W - 690, align: "right", bold: true, color: COLORS.navy },
      ],
      logsByUser.map((u: any) => [
        `${u.userName} (${u.userRole || "korisnik"})`,
        (u.topActions || []).map((a: any) => `${a.action} (${a.count}×)`).join(", "),
        formatDateTimeDMY(u.lastTimestamp),
        `${u.totalCount}`,
      ])
    )
  }

  if (logsByAction.length > 0) {
    drawTable(
      [
        { header: "B) Vrsta operacije", width: 195, align: "left", bold: true },
        { header: "Područje sustava", width: 185, align: "left", color: COLORS.slate500 },
        { header: "Izvršitelji", width: 195, align: "left", color: COLORS.slate700 },
        { header: "Zadnje izvršeno", width: 110, align: "left", color: COLORS.slate500 },
        { header: "Broj radnji", width: CONTENT_W - 685, align: "right", bold: true, color: COLORS.navy },
      ],
      logsByAction.map((act: any) => [
        act.action || "—",
        act.category || "—",
        (act.users || []).join(", "),
        formatDateTimeDMY(act.lastTimestamp),
        `${act.count}×`,
      ])
    )
  }

  // ─── IX. OVJERA I POTPISI ────────────────────────────────────────────────
  ensureSpace(68)
  cursorY += 12
  drawLine(MARGIN_L, cursorY, PAGE_W - MARGIN_R, cursorY, COLORS.slate200, 0.8)
  cursorY += 14

  drawText("PREDSJEDNIK DRUŠTVA:", MARGIN_L, cursorY, 8, true, COLORS.navy)
  drawText("IZVJEŠĆE SASTAVIO/LA:", PAGE_W - MARGIN_R, cursorY, 8, true, COLORS.navy, "right")

  cursorY += 26
  drawLine(MARGIN_L, cursorY, MARGIN_L + 170, cursorY, COLORS.slate400, 0.7)
  drawLine(PAGE_W - MARGIN_R - 170, cursorY, PAGE_W - MARGIN_R, cursorY, COLORS.slate400, 0.7)

  cursorY += 11
  drawText("M.P. / Potpis", MARGIN_L, cursorY, 7.5, false, COLORS.slate500)
  drawText(`${generatedBy} (${generatedByRole})`, PAGE_W - MARGIN_R, cursorY, 7.5, false, COLORS.slate500, "right")

  // Push final page
  pages.push(currentCommands)

  // Add page numbers & bottom margin footer on all pages
  const totalPages = pages.length
  for (let pIdx = 0; pIdx < totalPages; pIdx++) {
    const footerCmds: string[] = []
    const footerLineY = PAGE_H - 24
    const footerTextY = PAGE_H - 14

    // Footer divider line
    footerCmds.push(
      `q\n0.50 w\n${fmtColor(COLORS.slate200)} RG\n${MARGIN_L.toFixed(2)} ${pdfY(footerLineY).toFixed(2)} m ${(PAGE_W - MARGIN_R).toFixed(2)} ${pdfY(footerLineY).toFixed(2)} l S\nQ`
    )
    // Left footer text
    footerCmds.push(
      `BT\n${fmtColor(COLORS.slate400)} rg\n/F1 7.00 Tf\n1 0 0 1 ${MARGIN_L.toFixed(2)} ${pdfY(footerTextY).toFixed(2)} Tm\n${encodeCroatianPdfString(
        `Hrvatsko rodoslovno društvo „Pavao Ritter Vitezović” Zagreb • Izvješće: ${formatDateDMY(startDate)} – ${formatDateDMY(endDate)}`
      )} Tj\nET`
    )
    // Right footer page number
    const pageLabel = `Format A4 Landscape • Stranica ${pIdx + 1} od ${totalPages}`
    const labelW = measureTextWidth(pageLabel, 7, false)
    footerCmds.push(
      `BT\n${fmtColor(COLORS.slate500)} rg\n/F1 7.00 Tf\n1 0 0 1 ${(PAGE_W - MARGIN_R - labelW).toFixed(2)} ${pdfY(footerTextY).toFixed(2)} Tm\n${encodeCroatianPdfString(pageLabel)} Tj\nET`
    )

    pages[pIdx].push(...footerCmds)
  }

  // ─── ASSEMBLE PDF 1.4 OBJECTS ────────────────────────────────────────────
  // Object 1: Catalog
  // Object 2: Pages
  // Object 3: Encoding (WinAnsi + Croatian Differences)
  // Object 4: Font F1 (Helvetica)
  // Object 5: Font F2 (Helvetica-Bold)
  // Objects 6..(5 + totalPages*2): Page & Content stream objects

  const objects: string[] = []
  const addObject = (body: string) => {
    objects.push(body)
    return objects.length // 1-based object number
  }

  addObject(`<< /Type /Catalog /Pages 2 0 R >>`) // 1
  addObject(``) // 2 placeholder for Pages
  addObject(
    `<< /Type /Encoding /BaseEncoding /WinAnsiEncoding /Differences [ 128 /Euro /ccaron /Ccaron /cacute /Cacute /zcaron /Zcaron /scaron /Scaron /dcroat /Dcroat /bullet /endash /emdash /quotedblbase /quotedblright /quotedblleft ] >>`
  ) // 3
  addObject(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding 3 0 R >>`) // 4
  addObject(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding 3 0 R >>`) // 5

  const pageObjNums: number[] = []
  for (let pIdx = 0; pIdx < totalPages; pIdx++) {
    const streamContent = pages[pIdx].join("\n")
    const streamBytes = Buffer.byteLength(streamContent, "binary")
    const contentObjNum = addObject(`<< /Length ${streamBytes} >>\nstream\n${streamContent}\nendstream`)
    const pageObjNum = addObject(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W.toFixed(2)} ${PAGE_H.toFixed(2)}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents ${contentObjNum} 0 R >>`
    )
    pageObjNums.push(pageObjNum)
  }

  objects[1] = `<< /Type /Pages /Kids [${pageObjNums.map((n) => `${n} 0 R`).join(" ")}] /Count ${totalPages} >>`

  let pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n"
  const offsets: number[] = []

  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(pdf, "binary"))
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`
  }

  const xrefOffset = Buffer.byteLength(pdf, "binary")
  pdf += `xref\n0 ${objects.length + 1}\n`
  pdf += `0000000000 65535 f \n`
  for (const off of offsets) {
    pdf += `${String(off).padStart(10, "0")} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`

  return Buffer.from(pdf, "binary")
}
