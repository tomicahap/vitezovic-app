import {
  assemblePdfDocument,
  encodeCroatianPdfString,
  measureTextWidth,
  wrapText,
} from "./report-pdf"
import { formatDateDMY, formatDateTimeDMY } from "./utils"

const PAGE_W = 595.28 // A4 Portrait width in pt (210 mm)
const PAGE_H = 841.89 // A4 Portrait height in pt (297 mm)
const MARGIN_L = 40
const MARGIN_R = 40
const MARGIN_T = 36
const MARGIN_B = 40
const CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R // 515.28 pt

const COLORS = {
  navy: [0.106, 0.169, 0.212] as const,     // #1B2B36
  gold: [0.808, 0.639, 0.412] as const,     // #CEA369
  emerald: [0.024, 0.231, 0.145] as const,  // #063B25
  slate700: [0.20, 0.255, 0.333] as const,
  slate500: [0.392, 0.455, 0.545] as const,
  slate400: [0.58, 0.639, 0.722] as const,
  slate200: [0.886, 0.910, 0.941] as const,
  bgLight: [0.976, 0.969, 0.957] as const,
  redBg: [0.996, 0.949, 0.949] as const,
  redText: [0.725, 0.110, 0.110] as const,
  white: [1, 1, 1] as const,
}

function fmtColor(c: readonly [number, number, number]) {
  return `${c[0].toFixed(3)} ${c[1].toFixed(3)} ${c[2].toFixed(3)}`
}

function pdfY(topY: number): number {
  return PAGE_H - topY
}

export function sanitizePdfFileNamePart(raw: string | undefined | null, fallback = "clan"): string {
  const cleaned = String(raw || fallback)
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
  return cleaned || fallback
}

export function generateMemberPdfBuffer(member: any): Buffer {
  const pages: string[][] = []
  let currentCommands: string[] = []
  let cursorY = MARGIN_T

  const pushPage = () => {
    pages.push(currentCommands)
    currentCommands = []
    cursorY = MARGIN_T
  }

  const ensureSpace = (needed: number) => {
    if (cursorY + needed > PAGE_H - MARGIN_B) {
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
    const yBottom = pdfY(yTop + h)
    let cmd = "q\n"
    if (fill) cmd += `${fmtColor(fill)} rg\n`
    if (stroke) cmd += `${lineWidth.toFixed(2)} w\n${fmtColor(stroke)} RG\n`
    cmd += `${x.toFixed(2)} ${yBottom.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re\n`
    if (fill && stroke) cmd += "B\n"
    else if (fill) cmd += "f\n"
    else if (stroke) cmd += "S\n"
    cmd += "Q"
    currentCommands.push(cmd)
  }

  const drawLine = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: readonly [number, number, number],
    width = 0.6
  ) => {
    currentCommands.push(
      `q\n${width.toFixed(2)} w\n${fmtColor(color)} RG\n${x1.toFixed(2)} ${pdfY(y1).toFixed(2)} m ${x2.toFixed(2)} ${pdfY(y2).toFixed(2)} l S\nQ`
    )
  }

  const drawText = (
    text: string,
    x: number,
    yBaselineTop: number,
    fontSize: number,
    bold = false,
    color: readonly [number, number, number] = COLORS.navy,
    align: "left" | "right" = "left"
  ) => {
    const fontRef = bold ? "/F2" : "/F1"
    let drawX = x
    if (align === "right") {
      drawX = x - measureTextWidth(text, fontSize, bold)
    }
    currentCommands.push(
      `BT\n${fmtColor(color)} rg\n${fontRef} ${fontSize.toFixed(2)} Tf\n1 0 0 1 ${drawX.toFixed(2)} ${pdfY(yBaselineTop).toFixed(2)} Tm\n${encodeCroatianPdfString(text)} Tj\nET`
    )
  }

  // ─── HEADER BANNER ───────────────────────────────────────────────────────
  drawRect(MARGIN_L, cursorY, CONTENT_W, 66, COLORS.navy)
  drawRect(MARGIN_L, cursorY + 63, CONTENT_W, 3, COLORS.gold)

  drawText("HRVATSKO RODOSLOVNO DRUŠTVO „PAVAO RITTER VITEZOVIĆ”", MARGIN_L + 16, cursorY + 20, 9.5, true, COLORS.gold)
  drawText("EVIDENCIJSKI LIST ČLANA U MATIČNOJ KNJIZI", MARGIN_L + 16, cursorY + 38, 14, true, COLORS.white)
  drawText(
    `Član: ${member.name || "—"}   •   Datum ispisa: ${formatDateTimeDMY(new Date())}`,
    MARGIN_L + 16,
    cursorY + 54,
    8.5,
    false,
    COLORS.slate200
  )

  cursorY += 80

  // Helper to draw a section title
  const drawSectionHeader = (title: string) => {
    ensureSpace(34)
    drawRect(MARGIN_L, cursorY, CONTENT_W, 20, COLORS.bgLight, COLORS.slate200, 0.6)
    drawRect(MARGIN_L, cursorY, 4, 20, COLORS.gold)
    drawText(title, MARGIN_L + 12, cursorY + 13.5, 9.5, true, COLORS.navy)
    cursorY += 26
  }

  // Helper to draw field rows (label + value, highlights missing values)
  const drawFieldRow = (label: string, rawValue: any, markMissing = true) => {
    const strVal = rawValue !== null && rawValue !== undefined ? String(rawValue).trim() : ""
    const isMissing = strVal.length === 0
    const displayVal = isMissing
      ? (markMissing ? "[ Nedostaje podatak — molimo dopuniti ]" : "—")
      : strVal

    const labelW = 165
    const valW = CONTENT_W - labelW - 18
    const wrapped = wrapText(displayVal, valW, 8.8, isMissing && markMissing)
    const rowH = Math.max(20, wrapped.length * 12 + 8)

    ensureSpace(rowH + 2)

    if (isMissing && markMissing) {
      drawRect(MARGIN_L, cursorY, CONTENT_W, rowH, COLORS.redBg, COLORS.slate200, 0.4)
    } else {
      drawRect(MARGIN_L, cursorY, CONTENT_W, rowH, COLORS.white, COLORS.slate200, 0.4)
    }

    drawText(label, MARGIN_L + 8, cursorY + 13, 8.5, true, COLORS.slate500)
    for (let i = 0; i < wrapped.length; i++) {
      drawText(
        wrapped[i],
        MARGIN_L + labelW + 10,
        cursorY + 13 + i * 12,
        8.8,
        isMissing && markMissing,
        isMissing && markMissing ? COLORS.redText : COLORS.navy
      )
    }

    cursorY += rowH
  }

  // ─── 1. OSOBNI PODACI I ROĐENJE ──────────────────────────────────────────
  const nameParts = String(member.name || "").trim().split(/\s+/)
  const firstName = nameParts[0] || ""
  const lastName = nameParts.slice(1).join(" ") || ""

  drawSectionHeader("1. OSOBNI PODACI I ROĐENJE")
  drawFieldRow("Ime", firstName)
  drawFieldRow("Prezime", lastName)
  drawFieldRow("Djevojačko prezime", member.maidenName, false)
  drawFieldRow("OIB", member.oib)
  drawFieldRow("Datum rođenja", member.birthDate ? formatDateDMY(member.birthDate, member.birthDate) : "")
  drawFieldRow("Mjesto rođenja", member.birthPlace)
  drawFieldRow("Zemlja rođenja", member.birthCountry)
  cursorY += 10

  // ─── 2. KONTAKT I PREBIVALIŠTE ───────────────────────────────────────────
  drawSectionHeader("2. KONTAKT I PREBIVALIŠTE")
  drawFieldRow("Email adresa", member.email)
  drawFieldRow("Mobitel", member.phone)
  drawFieldRow("Telefon (fiksni)", member.landlinePhone, false)
  drawFieldRow("Adresa prebivališta", member.address)
  cursorY += 10

  // ─── 3. ZANIMANJE, VJEŠTINE I RODOSLOVNA ISTRAŽIVANJA ────────────────────
  const researchStr = Array.isArray(member.researchAreas)
    ? member.researchAreas.join(", ")
    : String(member.researchAreas || "")

  drawSectionHeader("3. ZANIMANJE, ISKUSTVO, VJEŠTINE I RODOSLOVNA ISTRAŽIVANJA")
  drawFieldRow("Zvanje i zanimanje", member.occupation)
  drawFieldRow("Radno iskustvo", member.workExperience)
  drawFieldRow("Strani jezici", member.foreignLanguages)
  drawFieldRow("Hobi / vještine i znanja", member.hobbiesSkills)
  drawFieldRow("Lokacije i prezimena koja istražuje", researchStr)
  cursorY += 10

  // ─── 4. OSTALI PODACI (DATUM UPISA U DRUŠTVO) ───────────────────────────
  drawSectionHeader("4. OSTALI PODACI")
  drawFieldRow(
    "Datum upisa u društvo",
    member.joinDate ? formatDateDMY(member.joinDate, member.joinDate) : "",
    true
  )

  // Napomena za dopunu na dnu
  ensureSpace(48)
  cursorY += 12
  drawRect(MARGIN_L, cursorY, CONTENT_W, 34, COLORS.bgLight, COLORS.gold, 0.8)
  drawText(
    "Napomena: Ako u gornjoj tablici primijetite polja označena crveno ili netočne podatke, molimo Vas",
    MARGIN_L + 10,
    cursorY + 13,
    8.2,
    true,
    COLORS.navy
  )
  drawText(
    "da nam odgovore pošaljete povratno putem e-pošte kako bismo ažurirali Vaš karton u matičnoj knjizi.",
    MARGIN_L + 10,
    cursorY + 25,
    8.2,
    false,
    COLORS.slate700
  )

  pages.push(currentCommands)

  // Footer on all pages
  const totalPages = pages.length
  for (let pIdx = 0; pIdx < totalPages; pIdx++) {
    const footerLineY = PAGE_H - 26
    const footerTextY = PAGE_H - 15
    const cmds: string[] = [
      `q\n0.50 w\n${fmtColor(COLORS.slate200)} RG\n${MARGIN_L.toFixed(2)} ${pdfY(footerLineY).toFixed(2)} m ${(PAGE_W - MARGIN_R).toFixed(2)} ${pdfY(footerLineY).toFixed(2)} l S\nQ`,
      `BT\n${fmtColor(COLORS.slate400)} rg\n/F1 7.00 Tf\n1 0 0 1 ${MARGIN_L.toFixed(2)} ${pdfY(footerTextY).toFixed(2)} Tm\n${encodeCroatianPdfString(
        `HRD „Pavao Ritter Vitezović” • Evidencijski list člana: ${member.name || ""}`
      )} Tj\nET`,
    ]
    const pageLabel = `Stranica ${pIdx + 1} od ${totalPages}`
    const labelW = measureTextWidth(pageLabel, 7, false)
    cmds.push(
      `BT\n${fmtColor(COLORS.slate500)} rg\n/F1 7.00 Tf\n1 0 0 1 ${(PAGE_W - MARGIN_R - labelW).toFixed(2)} ${pdfY(footerTextY).toFixed(2)} Tm\n${encodeCroatianPdfString(pageLabel)} Tj\nET`
    )
    pages[pIdx].push(...cmds)
  }

  return assemblePdfDocument(pages, PAGE_W, PAGE_H)
}
