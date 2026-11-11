import { formatDateDMY, formatDateTimeDMY, getMemberDisplayRole } from "./utils"
import { encodeCroatianPdfString, measureTextWidth, wrapText } from "./report-pdf"

/**
 * Generates an official A4 Portrait PDF document (210mm x 297mm = 595.28pt x 841.89pt)
 * with proper print margins (~15mm) and full Croatian diacritics support
 * for Meetings (Sjednice) and Lectures/Gatherings (Predavanja i druženja).
 */

const PAGE_W = 595.28 // A4 Portrait width in points (210 mm)
const PAGE_H = 841.89 // A4 Portrait height in points (297 mm)
const MARGIN_L = 42   // ~14.8 mm left margin
const MARGIN_R = 42   // ~14.8 mm right margin
const MARGIN_T = 40   // ~14.1 mm top margin
const MARGIN_B = 42   // ~14.8 mm bottom margin
const CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R // 511.28 pt

interface RGB {
  r: number
  g: number
  b: number
}

const COLORS = {
  navy: { r: 0.106, g: 0.169, b: 0.212 },       // #1B2B36
  gold: { r: 0.808, g: 0.639, b: 0.412 },       // #CEA369
  indigo: { r: 0.247, g: 0.318, b: 0.71 },      // #3F51B5
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

const MEETING_TYPE_LABELS: Record<string, string> = {
  general: "Opća sjednica",
  board: "Sjednica uprave",
  committee: "Posebni odbor",
  workshop: "Radionica",
  emergency: "Izvanredna sjednica",
}

const LECTURE_TYPE_LABELS: Record<string, string> = {
  lecture: "Predavanje",
  gathering: "Rodoslovno druženje",
  visit: "Gostovanje",
  guest: "Gost predavač",
  workshop: "Radionica",
  excursion: "Izlet / ekskurzija",
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Zakazano",
  completed: "Završeno / Održano",
  cancelled: "Otkazano",
}

function calcDuration(start?: string, end?: string): string {
  if (!start || !end) return ""
  const [sh, sm] = start.split(":").map(Number)
  const [eh, em] = end.split(":").map(Number)
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return ""
  const mins = eh * 60 + em - (sh * 60 + sm)
  if (mins <= 0) return ""
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h${m > 0 ? ` ${m}min` : ""}` : `${m}min`
}

function formatBytes(bytes?: number): string {
  if (!bytes) return "—"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatFileType(ft?: string): string {
  if (!ft) return "Dokument"
  if (ft === "pdf") return "PDF dokument"
  if (ft === "image") return "Slika / fotografija"
  return ft.toUpperCase()
}

export interface EventPdfContext {
  type: "meeting" | "lecture"
  item: any
  members: any[]
  polls?: any[]
  pollVotes?: Record<number, any[]>
  logs?: any[]
  generatedBy?: string
}

export function generateEventPdfBuffer(ctx: EventPdfContext): Buffer {
  const { type, item, members = [], polls = [], pollVotes = {}, logs = [], generatedBy = "Sustav Rodoslovac" } = ctx
  const isMeeting = type === "meeting"

  const pages: string[][] = []
  let currentCommands: string[] = []
  let cursorY = MARGIN_T

  const pdfY = (topY: number) => Number((PAGE_H - topY).toFixed(2))
  const fmtColor = (c: RGB) => `${c.r.toFixed(3)} ${c.g.toFixed(3)} ${c.b.toFixed(3)}`

  const docKindTitle = isMeeting
    ? `SLUŽBENI IZVJEŠTAJ O SJEDNICI (#${item.id || "—"})`
    : `SLUŽBENI IZVJEŠTAJ O PREDAVANJU / DRUŽENJU (#${item.id || "—"})`

  const startNewPage = (isFirstPage = false) => {
    if (!isFirstPage) {
      pages.push(currentCommands)
      currentCommands = []
    }
    cursorY = MARGIN_T

    if (!isFirstPage) {
      drawRect(MARGIN_L, cursorY, CONTENT_W, 18, COLORS.slate100, COLORS.slate200, 0.5)
      drawText(
        `RODOSLOVAC • HRD „Pavao Ritter Vitezović” — ${isMeeting ? "Izvještaj sa sjednice" : "Izvještaj s predavanja/druženja"}`,
        MARGIN_L + 6,
        cursorY + 12,
        7.5,
        true,
        COLORS.navy
      )
      drawText(
        `${formatDateDMY(item.date)}`,
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
    drawRect(MARGIN_L, cursorY, CONTENT_W, 19, COLORS.navy)
    drawRect(MARGIN_L, cursorY, 4, 19, COLORS.gold)
    drawText(title, MARGIN_L + 10, cursorY + 13, 8.5, true, COLORS.white)
    if (rightSubtitle) {
      drawText(rightSubtitle, PAGE_W - MARGIN_R - 8, cursorY + 13, 7.5, false, COLORS.gold, "right")
    }
    cursorY += 24
  }

  const drawKeyValueGrid = (pairs: { label: string; value: string }[]) => {
    const colW = (CONTENT_W - 8) / 2
    for (let i = 0; i < pairs.length; i += 2) {
      const left = pairs[i]
      const right = pairs[i + 1]

      const leftLines = wrapText(left.value || "—", colW - 14, 8.5, true)
      const rightLines = right ? wrapText(right.value || "—", colW - 14, 8.5, true) : []
      const maxLines = Math.max(leftLines.length, rightLines.length, 1)
      const boxH = 18 + maxLines * 11

      ensureSpace(boxH + 5)

      // Left box
      drawRect(MARGIN_L, cursorY, right ? colW : CONTENT_W, boxH, COLORS.slate50, COLORS.slate200, 0.5)
      drawText(left.label.toUpperCase(), MARGIN_L + 7, cursorY + 10, 6.5, true, COLORS.slate500)
      leftLines.forEach((ln, idx) => {
        drawText(ln, MARGIN_L + 7, cursorY + 21 + idx * 11, 8.5, true, COLORS.slate900)
      })

      // Right box
      if (right) {
        const rx = MARGIN_L + colW + 8
        drawRect(rx, cursorY, colW, boxH, COLORS.slate50, COLORS.slate200, 0.5)
        drawText(right.label.toUpperCase(), rx + 7, cursorY + 10, 6.5, true, COLORS.slate500)
        rightLines.forEach((ln, idx) => {
          drawText(ln, rx + 7, cursorY + 21 + idx * 11, 8.5, true, COLORS.slate900)
        })
      }

      cursorY += boxH + 5
    }
  }

  const drawLongTextBlock = (text: string, emptyText: string) => {
    const raw = (text || "").trim()
    if (!raw) {
      ensureSpace(22)
      drawRect(MARGIN_L, cursorY, CONTENT_W, 18, COLORS.slate50, COLORS.slate200, 0.5)
      drawText(emptyText, MARGIN_L + 8, cursorY + 12, 8, false, COLORS.slate500)
      cursorY += 22
      return
    }

    const lines = wrapText(raw, CONTENT_W - 18, 8.5, false)
    const lineHeight = 12

    // Render lines in chunks that fit on the current page
    let idx = 0
    while (idx < lines.length) {
      const availH = PAGE_H - MARGIN_B - cursorY - 12
      const maxLinesHere = Math.max(1, Math.floor(availH / lineHeight))
      if (availH < 24) {
        startNewPage(false)
        continue
      }
      const chunk = lines.slice(idx, idx + maxLinesHere)
      const boxH = chunk.length * lineHeight + 12
      drawRect(MARGIN_L, cursorY, CONTENT_W, boxH, COLORS.white, COLORS.slate200, 0.6)
      drawRect(MARGIN_L, cursorY, 3, boxH, COLORS.gold)
      chunk.forEach((ln, cIdx) => {
        drawText(ln, MARGIN_L + 10, cursorY + 13 + cIdx * lineHeight, 8.5, false, COLORS.slate900)
      })
      cursorY += boxH + 6
      idx += chunk.length
    }
  }

  const drawTable = (
    columns: TableColumn[],
    rows: string[][],
    options?: {
      emptyMessage?: string
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
      drawText(options?.emptyMessage || "Nema evidentiranih podataka.", MARGIN_L + 8, cursorY + 12, 8, false, COLORS.slate500)
      cursorY += 22
      return
    }

    const drawHeaderRow = () => {
      const headerH = 16
      drawRect(MARGIN_L, cursorY, CONTENT_W, headerH, COLORS.slate100, COLORS.slate200, 0.6)
      let colX = MARGIN_L
      for (const col of columns) {
        const align = col.align || "left"
        const textX =
          align === "right"
            ? colX + col.width - padX
            : align === "center"
            ? colX + col.width / 2
            : colX + padX
        drawText(col.header, textX, cursorY + 11, 7, true, COLORS.slate700, align)
        colX += col.width
      }
      cursorY += headerH
    }

    ensureSpace(34)
    drawHeaderRow()

    for (let rIdx = 0; rIdx < rows.length; rIdx++) {
      const row = rows[rIdx]
      const wrappedCells: string[][] = columns.map((col, cIdx) => {
        const cellText = row[cIdx] ?? "—"
        return wrapText(cellText, col.width - padX * 2, fontSize, col.bold || false)
      })
      const maxLines = Math.max(1, ...wrappedCells.map((lines) => lines.length))
      const rowH = maxLines * lineHeight + padY * 2

      if (cursorY + rowH > PAGE_H - MARGIN_B) {
        startNewPage(false)
        drawHeaderRow()
      }

      const rowBg = rIdx % 2 === 1 ? COLORS.slate50 : COLORS.white
      drawRect(MARGIN_L, cursorY, CONTENT_W, rowH, rowBg, COLORS.slate200, 0.4)

      let colX = MARGIN_L
      for (let cIdx = 0; cIdx < columns.length; cIdx++) {
        const col = columns[cIdx]
        const lines = wrappedCells[cIdx]
        const align = col.align || "left"
        const textX =
          align === "right"
            ? colX + col.width - padX
            : align === "center"
            ? colX + col.width / 2
            : colX + padX

        for (let lIdx = 0; lIdx < lines.length; lIdx++) {
          const lineBaseline = cursorY + padY + fontSize + lIdx * lineHeight
          drawText(
            lines[lIdx],
            textX,
            lineBaseline,
            fontSize,
            col.bold || false,
            col.color || COLORS.slate900,
            align
          )
        }
        colX += col.width
      }

      cursorY += rowH
    }

    cursorY += 6
  }

  // ─── START PAGE 1 ────────────────────────────────────────────────────────
  startNewPage(true)

  // Top Banner Header
  const titleLines = wrapText(item.title || "Bez naslova", CONTENT_W - 24, 13, true)
  const bannerH = 52 + titleLines.length * 15
  drawRect(MARGIN_L, cursorY, CONTENT_W, bannerH, COLORS.navy)
  drawRect(MARGIN_L, cursorY + bannerH - 3, CONTENT_W, 3, COLORS.gold)

  drawText(
    "RODOSLOVAC • HRVATSKO RODOSLOVNO DRUŠTVO „PAVAO RITTER VITEZOVIĆ”",
    MARGIN_L + 12,
    cursorY + 15,
    8,
    true,
    COLORS.gold
  )
  drawText(docKindTitle, MARGIN_L + 12, cursorY + 27, 8, false, COLORS.slate200)

  titleLines.forEach((ln, idx) => {
    drawText(ln, MARGIN_L + 12, cursorY + 43 + idx * 15, 13, true, COLORS.white)
  })

  drawText(
    `Generirano: ${formatDateTimeDMY(new Date())}`,
    PAGE_W - MARGIN_R - 12,
    cursorY + 15,
    7.5,
    false,
    COLORS.slate200,
    "right"
  )

  cursorY += bannerH + 8

  // Resolve attendees
  const attendeeIds: number[] = Array.isArray(item.attendee_ids) ? item.attendee_ids : []
  const attendeeMembers = attendeeIds
    .map((id) => members.find((m) => Number(m.id) === Number(id)))
    .filter(Boolean)

  const attachments: any[] = Array.isArray(item.attachments) ? item.attachments : []
  const duration = calcDuration(item.start_time, item.end_time)
  const timeStr = item.start_time
    ? `${item.start_time}${item.end_time ? ` – ${item.end_time}` : ""}${duration ? ` (${duration})` : ""}`
    : "—"

  if (isMeeting) {
    // ─── SJEDNICA ──────────────────────────────────────────────────────────
    drawSectionHeader("I. OSNOVNI PODACI O SJEDNICI", `ID sjednice: #${item.id}`)

    const meetingTypeLabel = MEETING_TYPE_LABELS[item.type] || item.type || "Sjednica"
    const statusLabel = STATUS_LABELS[item.status] || item.status || "—"

    const pairs: { label: string; value: string }[] = [
      { label: "Naziv sjednice", value: item.title || "—" },
      { label: "Vrsta i status sjednice", value: `${meetingTypeLabel} • ${statusLabel}` },
      { label: "Datum održavanja", value: formatDateDMY(item.date) },
      { label: "Vrijeme i trajanje", value: timeStr },
      { label: "Lokacija održavanja", value: item.location || "—" },
      { label: "Broj prisutnih članova i priloga", value: `${attendeeIds.length} prisutnih članova • ${attachments.length} priloga` },
      { label: "Voditelj sastanka (predsjedavajući)", value: item.chairperson || "—" },
      { label: "Zapisničar", value: item.minute_taker || "—" },
    ]

    if (item.youtube_url) {
      pairs.push({ label: "Video snimka (YouTube)", value: item.youtube_url })
    }

    drawKeyValueGrid(pairs)

    // II. DNEVNI RED
    const agendaItems: any[] = Array.isArray(item.agenda) ? item.agenda : []
    drawSectionHeader("II. DNEVNI RED SJEDNICE", `Ukupno točaka: ${agendaItems.length}`)
    drawTable(
      [
        { header: "R.br.", width: 40, align: "center", bold: true },
        { header: "Točka dnevnog reda", width: 381.28 },
        { header: "Status točke", width: 90, align: "center", bold: true },
      ],
      agendaItems.map((ag, i) => [
        `${i + 1}.`,
        ag.text || "—",
        ag.done ? "Odrađeno" : "U planu",
      ]),
      { emptyMessage: "Za ovu sjednicu nisu unesene pojedinačne točke dnevnog reda." }
    )

    // III. ZAPISNIK I ZAKLJUČCI
    drawSectionHeader("III. ZAPISNIK, RASPRAVA I ZAKLJUČCI SA SJEDNICE")
    drawLongTextBlock(
      item.minutes || item.notes || "",
      "Zapisnik za ovu sjednicu nije unesen."
    )

    // IV. POPIS PRISUTNIH ČLANOVA
    drawSectionHeader("IV. POPIS PRISUTNIH ČLANOVA DRUŠTVA", `Evidentirano prisutnih: ${attendeeIds.length}`)
    drawTable(
      [
        { header: "#", width: 28, align: "center" },
        { header: "Ime i prezime člana", width: 145, bold: true },
        { header: "Matični / Čl. br.", width: 80 },
        { header: "Dužnost / Funkcija u Društvu", width: 128.28 },
        { header: "E-pošta", width: 130 },
      ],
      attendeeMembers.map((m: any, i: number) => {
        const funcs = getMemberDisplayRole(m, item.date)
        const regNum = [m.registryNumber, m.membershipNumber].filter(Boolean).join(" / ") || "—"
        return [
          `${i + 1}.`,
          m.name || "—",
          regNum,
          funcs || "Član",
          m.email || "—",
        ]
      }),
      { emptyMessage: "Nema evidentiranih prisutnih članova na ovoj sjednici." }
    )

    // V. PROVEDENA GLASANJA I ODLUKE
    if (polls.length > 0) {
      drawSectionHeader("V. PROVEDENA GLASANJA I ODLUKE NA SJEDNICI", `Ukupno glasanja: ${polls.length}`)
      for (let pIdx = 0; pIdx < polls.length; pIdx++) {
        const poll = polls[pIdx]
        const votes = pollVotes[poll.id] || []
        const options: string[] = Array.isArray(poll.options)
          ? poll.options
          : typeof poll.options === "string"
          ? (() => { try { return JSON.parse(poll.options) } catch { return [] } })()
          : []

        ensureSpace(45)
        drawRect(MARGIN_L, cursorY, CONTENT_W, 18, COLORS.amber50, COLORS.gold, 0.5)
        drawText(
          `${pIdx + 1}. ${poll.title || "Glasanje"} (${poll.status === "active" ? "Aktivno" : "Završeno"} • Ukupno glasova: ${votes.length})`,
          MARGIN_L + 8,
          cursorY + 12,
          8,
          true,
          COLORS.navy
        )
        cursorY += 21

        if (poll.description) {
          const descLines = wrapText(poll.description, CONTENT_W - 16, 7.5, false)
          descLines.forEach((ln) => {
            ensureSpace(12)
            drawText(ln, MARGIN_L + 8, cursorY + 9, 7.5, false, COLORS.slate700)
            cursorY += 11
          })
          cursorY += 3
        }

        // Options summary table
        drawTable(
          [
            { header: "Ponuđena opcija", width: 351.28, bold: true },
            { header: "Broj glasova", width: 80, align: "right", bold: true },
            { header: "Udio (%)", width: 80, align: "right" },
          ],
          options.map((opt, oIdx) => {
            const c = votes.filter((v: any) => Number(v.option_index) === oIdx).length
            const pct = votes.length > 0 ? `${((c / votes.length) * 100).toFixed(1)}%` : "0.0%"
            return [opt, String(c), pct]
          }),
          { emptyMessage: "Nema ponuđenih opcija." }
        )

        // Who voted table
        if (votes.length > 0) {
          drawTable(
            [
              { header: "#", width: 28, align: "center" },
              { header: "Član koji je glasao", width: 190, bold: true },
              { header: "Funkcija u Društvu", width: 130 },
              { header: "Odabrana opcija", width: 163.28 },
            ],
            votes.map((v: any, vIdx: number) => {
              const voter = members.find((m: any) => Number(m.id) === Number(v.member_id))
              const voterRole = voter ? getMemberDisplayRole(voter, item.date) : "Član"
              return [
                `${vIdx + 1}.`,
                v.member_name || (voter ? voter.name : "Član"),
                voterRole || "Član",
                options[v.option_index] || `Opcija #${v.option_index + 1}`,
              ]
            })
          )
        }
      }
    }

    // VI. PRILOŽENI DOKUMENTI I DATOTEKE
    drawSectionHeader("VI. PRILOŽENI DOKUMENTI I MATERIJALI", `Ukupno priloga: ${attachments.length}`)
    drawTable(
      [
        { header: "#", width: 30, align: "center" },
        { header: "Naziv priložene datoteke / dokumenta", width: 311.28, bold: true },
        { header: "Vrsta datoteke", width: 100, align: "center" },
        { header: "Veličina", width: 70, align: "right" },
      ],
      attachments.map((att: any, idx: number) => [
        `${idx + 1}.`,
        att.name || att.url || "Dokument",
        formatFileType(att.fileType),
        formatBytes(att.size),
      ]),
      { emptyMessage: "Uz ovu sjednicu nema priloženih datoteka." }
    )

    // VII. SLJEDEĆA SJEDNICA (ako je definirana)
    const nextAgenda: any[] = Array.isArray(item.next_meeting_agenda) ? item.next_meeting_agenda : []
    if (item.next_meeting_date || item.next_meeting_location || nextAgenda.length > 0) {
      drawSectionHeader("VII. NAJAVA SLJEDEĆE SJEDNICE")
      drawKeyValueGrid([
        { label: "Planirani datum i vrijeme", value: `${item.next_meeting_date ? formatDateDMY(item.next_meeting_date) : "—"}${item.next_meeting_time ? ` u ${item.next_meeting_time}` : ""}` },
        { label: "Planirana lokacija", value: item.next_meeting_location || "—" },
      ])
      if (nextAgenda.length > 0) {
        drawTable(
          [
            { header: "R.br.", width: 40, align: "center", bold: true },
            { header: "Prijedlog točke za sljedeću sjednicu", width: 471.28 },
          ],
          nextAgenda.map((ag: any, idx: number) => [`${idx + 1}.`, typeof ag === "string" ? ag : ag.text || "—"])
        )
      }
    }
  } else {
    // ─── PREDAVANJE / RODOSLOVNO DRUŽENJE ──────────────────────────────────
    drawSectionHeader("I. OSNOVNI PODACI O PREDAVANJU / DRUŽENJU", `ID događanja: #${item.id}`)

    const lectureTypeLabel = LECTURE_TYPE_LABELS[item.type] || item.type || "Predavanje"
    const statusLabel = STATUS_LABELS[item.status] || item.status || "—"
    const hostsList =
      Array.isArray(item.hosts) && item.hosts.length > 0
        ? item.hosts.map((h: any) => h.name).filter(Boolean).join(", ")
        : item.host || "—"
    const placeAndLoc = [item.city, item.location].filter(Boolean).join(" • ") || "—"

    const pairs: { label: string; value: string }[] = [
      { label: "Naslov predavanja / druženja", value: item.title || "—" },
      { label: "Vrsta događanja i status", value: `${lectureTypeLabel} • ${statusLabel}` },
      { label: "Datum održavanja", value: formatDateDMY(item.date) },
      { label: "Vrijeme održavanja i trajanje", value: timeStr },
      { label: "Grad i lokacija (dvorana / ustanova)", value: placeAndLoc },
      { label: "Predavači / voditelji / gosti", value: hostsList },
      { label: "Evidentirana prisutnost", value: `${attendeeIds.length} prisutnih članova` },
      { label: "Priloženi materijali", value: `${attachments.length} priloženih datoteka` },
    ]

    if (item.youtube_url) {
      pairs.push({ label: "Video snimka (YouTube)", value: item.youtube_url })
    }

    drawKeyValueGrid(pairs)

    // II. OPIS, SAŽETAK I BILJEŠKE
    drawSectionHeader("II. OPIS, SAŽETAK I BILJEŠKE S DOGAĐANJA")
    drawLongTextBlock(
      item.description || "",
      "Opis ili sažetak za ovo predavanje / druženje nije unesen."
    )

    // III. POPIS PRISUTNIH ČLANOVA
    drawSectionHeader("III. POPIS PRISUTNIH ČLANOVA DRUŠTVA", `Evidentirano prisutnih: ${attendeeIds.length}`)
    drawTable(
      [
        { header: "#", width: 28, align: "center" },
        { header: "Ime i prezime člana", width: 145, bold: true },
        { header: "Matični / Čl. br.", width: 80 },
        { header: "Dužnost / Funkcija u Društvu", width: 128.28 },
        { header: "E-pošta", width: 130 },
      ],
      attendeeMembers.map((m: any, i: number) => {
        const funcs = getMemberDisplayRole(m, item.date)
        const regNum = [m.registryNumber, m.membershipNumber].filter(Boolean).join(" / ") || "—"
        return [
          `${i + 1}.`,
          m.name || "—",
          regNum,
          funcs || "Član",
          m.email || "—",
        ]
      }),
      { emptyMessage: "Nema evidentiranih prisutnih članova za ovo događanje." }
    )

    // IV. PRILOŽENI DOKUMENTI I MATERIJALI
    drawSectionHeader("IV. PRILOŽENI DOKUMENTI, PREZENTACIJE I FOTOGRAFIJE", `Ukupno priloga: ${attachments.length}`)
    drawTable(
      [
        { header: "#", width: 30, align: "center" },
        { header: "Naziv priložene datoteke / dokumenta", width: 311.28, bold: true },
        { header: "Vrsta datoteke", width: 100, align: "center" },
        { header: "Veličina", width: 70, align: "right" },
      ],
      attachments.map((att: any, idx: number) => [
        `${idx + 1}.`,
        att.name || att.url || "Dokument",
        formatFileType(att.fileType),
        formatBytes(att.size),
      ]),
      { emptyMessage: "Uz ovo predavanje / druženje nema priloženih datoteka." }
    )
  }

  // ─── EVIDENCIJA POSLANIH E-MAIL OBAVIJESTI (zajedničko ako postoje podaci) ───
  let storedRecipients: Array<{ name: string; email: string; sentAt?: string }> = []
  try {
    if (item.notification_recipients) {
      storedRecipients =
        typeof item.notification_recipients === "string"
          ? JSON.parse(item.notification_recipients)
          : item.notification_recipients
    }
  } catch {}

  if (item.notification_sent_at || storedRecipients.length > 0 || logs.length > 0) {
    drawSectionHeader(
      isMeeting ? "VIII. EVIDENCIJA POSLANIH OBAVIJESTI ČLANOVIMA" : "V. EVIDENCIJA POSLANIH OBAVIJESTI ČLANOVIMA",
      item.notification_sent_at ? `Zadnje slanje: ${formatDateTimeDMY(item.notification_sent_at)}` : undefined
    )

    if (storedRecipients.length > 0) {
      drawTable(
        [
          { header: "#", width: 30, align: "center" },
          { header: "Primatelj obavijesti", width: 185, bold: true },
          { header: "E-mail adresa", width: 186.28 },
          { header: "Vrijeme slanja", width: 110, align: "center" },
        ],
        storedRecipients.map((r, i) => [
          `${i + 1}.`,
          r.name || "Član",
          r.email || "—",
          formatDateTimeDMY(r.sentAt || item.notification_sent_at),
        ])
      )
    } else if (logs.length > 0) {
      drawTable(
        [
          { header: "Vrijeme", width: 100, align: "center" },
          { header: "Izvršitelj", width: 110, bold: true },
          { header: "Detalji poslane obavijesti", width: 301.28 },
        ],
        logs.map((l: any) => [
          formatDateTimeDMY(l.timestamp),
          l.userName || "Sustav",
          String(l.details || "").replace(/\s*\[ID:(meeting|lecture):\d+\]/g, ""),
        ])
      )
    }
  }

  // ─── SIGNATURE BLOCK ─────────────────────────────────────────────────────
  ensureSpace(75)
  cursorY += 14
  drawLine(MARGIN_L, cursorY, PAGE_W - MARGIN_R, cursorY, COLORS.slate200, 0.8)
  cursorY += 14

  const leftSignTitle = isMeeting ? "ZAPISNIČAR:" : "PREDAVAČ / VODITELJ:"
  const leftSignName = isMeeting
    ? item.minute_taker || "Potpis zapisničara"
    : Array.isArray(item.hosts) && item.hosts.length > 0
    ? item.hosts.map((h: any) => h.name).join(", ")
    : item.host || "Potpis voditelja"

  const rightSignTitle = isMeeting ? "VODITELJ SASTANKA / PREDSJEDNIK:" : "ZA HRD „PAVAO RITTER VITEZOVIĆ”:"
  const rightSignName = isMeeting ? item.chairperson || "M.P. / Potpis" : "M.P. / Ovlaštena osoba"

  drawText(leftSignTitle, MARGIN_L, cursorY, 8, true, COLORS.navy)
  drawText(rightSignTitle, PAGE_W - MARGIN_R, cursorY, 8, true, COLORS.navy, "right")

  cursorY += 26
  drawLine(MARGIN_L, cursorY, MARGIN_L + 175, cursorY, COLORS.slate400, 0.7)
  drawLine(PAGE_W - MARGIN_R - 175, cursorY, PAGE_W - MARGIN_R, cursorY, COLORS.slate400, 0.7)

  cursorY += 11
  drawText(leftSignName, MARGIN_L, cursorY, 7.5, false, COLORS.slate500)
  drawText(rightSignName, PAGE_W - MARGIN_R, cursorY, 7.5, false, COLORS.slate500, "right")

  // Push final page
  pages.push(currentCommands)

  // Add page numbers & bottom margin footer on all pages
  const totalPages = pages.length
  for (let pIdx = 0; pIdx < totalPages; pIdx++) {
    const footerCmds: string[] = []
    const footerLineY = PAGE_H - 26
    const footerTextY = PAGE_H - 15

    footerCmds.push(
      `q\n0.50 w\n${fmtColor(COLORS.slate200)} RG\n${MARGIN_L.toFixed(2)} ${pdfY(footerLineY).toFixed(2)} m ${(PAGE_W - MARGIN_R).toFixed(2)} ${pdfY(footerLineY).toFixed(2)} l S\nQ`
    )
    footerCmds.push(
      `BT\n${fmtColor(COLORS.slate400)} rg\n/F1 7.00 Tf\n1 0 0 1 ${MARGIN_L.toFixed(2)} ${pdfY(footerTextY).toFixed(2)} Tm\n${encodeCroatianPdfString(
        `Sustav Rodoslovac • HRD „Pavao Ritter Vitezović” Zagreb • ${isMeeting ? "Sjednica" : "Predavanje"} #${item.id || ""} (${formatDateDMY(item.date)})`
      )} Tj\nET`
    )
    const pageLabel = `Format A4 • Stranica ${pIdx + 1} od ${totalPages}`
    const labelW = measureTextWidth(pageLabel, 7, false)
    footerCmds.push(
      `BT\n${fmtColor(COLORS.slate500)} rg\n/F1 7.00 Tf\n1 0 0 1 ${(PAGE_W - MARGIN_R - labelW).toFixed(2)} ${pdfY(footerTextY).toFixed(2)} Tm\n${encodeCroatianPdfString(pageLabel)} Tj\nET`
    )

    pages[pIdx].push(...footerCmds)
  }

  // ─── ASSEMBLE PDF 1.4 OBJECTS ────────────────────────────────────────────
  const objects: string[] = []
  const addObject = (body: string) => {
    objects.push(body)
    return objects.length
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
