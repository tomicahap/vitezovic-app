import "server-only"
import { getAppDb } from "./database"
import { CHANGELOG_DATA } from "./changelog-data"
import { formatDateDMY, formatDateTimeDMY, isMandateActive } from "./utils"
import {
  CHRONICLE_CATEGORIES,
  hrPlural,
  parseChronicleDate,
  type ChronicleCategory,
  type ChronicleEventItem,
  type ChronicleInMemoriamRow,
  type ChronicleLectureRow,
  type ChronicleMandateItem,
  type ChronicleMemberJoinRow,
  type ChroniclePersonIndexRow,
  type ChronicleReport,
  type ParsedChronicleDate,
} from "./chronology"

export interface GenerateChronicleOptions {
  mode?: "range" | "all"
  startDate?: string
  endDate?: string
  categories?: ChronicleCategory[]
}

const VALID_CATEGORY_SET = new Set<ChronicleCategory>(CHRONICLE_CATEGORIES.map((c) => c.key))
const CATEGORY_LABEL_MAP = new Map(CHRONICLE_CATEGORIES.map((c) => [c.key, c.label]))
const CATEGORY_META_MAP = new Map(CHRONICLE_CATEGORIES.map((c) => [c.key, c]))

function stripHtmlClean(raw: unknown): string {
  if (!raw) return ""
  return String(raw)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]*>?/gm, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim()
}

function safeJsonArray<T = any>(raw: unknown): T[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  if (typeof raw === "string") {
    try {
      let parsed = JSON.parse(raw)
      if (typeof parsed === "string") parsed = JSON.parse(parsed)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

function truncateClean(text: string, maxLen = 420): string {
  if (text.length <= maxLen) return text
  const cut = text.slice(0, maxLen)
  const lastSpace = cut.lastIndexOf(" ")
  return `${(lastSpace > 120 ? cut.slice(0, lastSpace) : cut).trim()}…`
}

function isIsoDateStr(val: string | undefined): val is string {
  return Boolean(val && /^\d{4}-\d{2}-\d{2}$/.test(val.trim()))
}

function formatNameList(names: string[], maxDisplay = 22): string {
  const unique = Array.from(new Set(names.map((n) => n.trim()).filter(Boolean)))
  if (unique.length === 0) return ""
  if (unique.length <= maxDisplay) return unique.join(", ")
  return `${unique.slice(0, maxDisplay).join(", ")} i još ${unique.length - maxDisplay} ${hrPlural(
    unique.length - maxDisplay,
    "član",
    "člana",
    "članova"
  )}`
}

export function generateVerifiedChronicleReport(
  options: GenerateChronicleOptions = {}
): ChronicleReport {
  const db = getAppDb()
  const now = new Date()
  const currentYear = now.getFullYear()

  const mode: "range" | "all" = options.mode === "all" ? "all" : "range"
  let startDate = isIsoDateStr(options.startDate)
    ? options.startDate.trim()
    : `${currentYear}-01-01`
  let endDate = isIsoDateStr(options.endDate)
    ? options.endDate.trim()
    : `${currentYear}-12-31`

  if (startDate > endDate) {
    const tmp = startDate
    startDate = endDate
    endDate = tmp
  }

  const startYear = Number(startDate.slice(0, 4))
  const endYear = Number(endDate.slice(0, 4))

  const requestedCategories =
    Array.isArray(options.categories) && options.categories.length > 0
      ? options.categories.filter((c): c is ChronicleCategory => VALID_CATEGORY_SET.has(c))
      : CHRONICLE_CATEGORIES.filter((c) => c.defaultEnabled).map((c) => c.key)

  const includedSet = new Set<ChronicleCategory>(
    requestedCategories.length > 0
      ? requestedCategories
      : CHRONICLE_CATEGORIES.filter((c) => c.defaultEnabled).map((c) => c.key)
  )

  const inRange = (parsed: ParsedChronicleDate | null): boolean => {
    if (!parsed) return false
    if (mode === "all") return true
    if (parsed.precision === "day") {
      return parsed.iso >= startDate && parsed.iso <= endDate
    }
    return parsed.year >= startYear && parsed.year <= endYear
  }

  const yearTouchesRange = (year: number): boolean => {
    if (mode === "all") return true
    return year >= startYear && year <= endYear
  }

  const mandateOverlapsRange = (fromYearRaw?: string, toYearRaw?: string): boolean => {
    if (mode === "all") return true
    const fromY = fromYearRaw && /^\d{4}/.test(fromYearRaw.trim()) ? Number(fromYearRaw.trim().slice(0, 4)) : null
    const toY = toYearRaw && /^\d{4}/.test(toYearRaw.trim()) ? Number(toYearRaw.trim().slice(0, 4)) : null
    if (fromY !== null && fromY > endYear) return false
    if (toY !== null && toY < startYear) return false
    return true
  }

  const availableYearsSet = new Set<number>([currentYear])
  const trackYear = (p: ParsedChronicleDate | null) => {
    if (p && p.year >= 1990 && p.year <= 2100) {
      availableYearsSet.add(p.year)
    }
  }

  // 1. ČLANOVI (bez osobnih kontakata, OIB-a, lozinki i uplatnica)
  const memberRows = db
    .prepare(
      `SELECT id, name, joinDate, functions, honorary, deceased, deathDate, death_date, status_clana
       FROM members
       WHERE LOWER(TRIM(COALESCE(role, ''))) != 'admin'
         AND LOWER(TRIM(COALESCE(email, ''))) != 'admin'
         AND LOWER(TRIM(COALESCE(name, ''))) NOT IN ('administrator', 'rezervni administrator')
       ORDER BY name ASC`
    )
    .all() as any[]

  const memberNameById = new Map<number, string>(
    memberRows.map((m) => [Number(m.id), String(m.name || "").trim()])
  )

  const newMembersInRange: Array<ChronicleMemberJoinRow & { year: number }> = []
  const honoraryMembers: Array<{ name: string; joinDateDisplay: string }> = []
  const inMemoriamInRange: Array<ChronicleInMemoriamRow & { year: number; parsedDeath: ParsedChronicleDate }> = []
  const mandatesInRange: ChronicleMandateItem[] = []
  const mandateStartsByYear = new Map<number, Array<{ memberName: string; functionName: string }>>()
  let membersWithoutJoinDateCount = 0

  for (const m of memberRows) {
    const memberName = String(m.name || "").trim()
    if (!memberName) continue

    const parsedJoin = parseChronicleDate(m.joinDate)
    if (!parsedJoin) {
      membersWithoutJoinDateCount++
    } else {
      trackYear(parsedJoin)
      if (inRange(parsedJoin)) {
        newMembersInRange.push({
          name: memberName,
          dateDisplay: parsedJoin.display,
          precision: parsedJoin.precision,
          year: parsedJoin.year,
        })
      }
    }

    if (m.honorary === 1 || m.honorary === true) {
      honoraryMembers.push({
        name: memberName,
        joinDateDisplay: parsedJoin ? parsedJoin.display : "",
      })
    }

    const funcs = safeJsonArray<any>(m.functions)
    const funcNames: string[] = []
    for (const f of funcs) {
      const fnName = String(f?.functionName || f || "").trim()
      if (!fnName) continue
      funcNames.push(fnName)
      const fromYear = String(f?.fromYear || "").trim()
      const toYear = String(f?.toYear || "").trim()
      if (fromYear && /^\d{4}/.test(fromYear)) {
        const fy = Number(fromYear.slice(0, 4))
        availableYearsSet.add(fy)
        if (yearTouchesRange(fy)) {
          const arr = mandateStartsByYear.get(fy) || []
          arr.push({ memberName, functionName: fnName })
          mandateStartsByYear.set(fy, arr)
        }
      }
      if (mandateOverlapsRange(fromYear, toYear)) {
        mandatesInRange.push({
          memberName,
          functionName: fnName,
          fromYear,
          toYear,
          isActive: isMandateActive(f),
        })
      }
    }

    if (m.deceased === 1 || m.deceased === true) {
      const parsedDeath = parseChronicleDate(m.deathDate || m.death_date)
      if (parsedDeath) {
        trackYear(parsedDeath)
        if (inRange(parsedDeath)) {
          inMemoriamInRange.push({
            name: memberName,
            deathDateDisplay: parsedDeath.display,
            joinDateDisplay: parsedJoin ? parsedJoin.display : "",
            functions: funcNames,
            year: parsedDeath.year,
            parsedDeath,
          })
        }
      }
    }
  }

  mandatesInRange.sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1
    const fnCmp = a.functionName.localeCompare(b.functionName, "hr")
    return fnCmp !== 0 ? fnCmp : a.memberName.localeCompare(b.memberName, "hr")
  })

  // 2. SJEDNICE I SKUPŠTINE
  const meetingRows = db
    .prepare(
      `SELECT id, title, type, date, start_time, location, minutes, attendee_ids, agenda, status, chairperson, minute_taker, youtube_url
       FROM meetings
       ORDER BY date ASC, id ASC`
    )
    .all() as any[]

  const meetingEvents: ChronicleEventItem[] = []
  for (const mt of meetingRows) {
    const parsedDate = parseChronicleDate(mt.date)
    trackYear(parsedDate)
    if (!parsedDate || !inRange(parsedDate)) continue

    const attendeeIds = safeJsonArray<number>(mt.attendee_ids)
    const attendeeNames = attendeeIds
      .map((id) => memberNameById.get(Number(id)))
      .filter((n): n is string => Boolean(n))

    const agendaArr = safeJsonArray<any>(mt.agenda)
      .map((a) => stripHtmlClean(typeof a === "string" ? a : a?.text || a?.title || ""))
      .filter(Boolean)

    const cleanMinutes = stripHtmlClean(mt.minutes)
    const meetingType = String(mt.type || "sjednica").trim()
    const location = String(mt.location || "").trim()
    const chairperson = String(mt.chairperson || "").trim()
    const minuteTaker = String(mt.minute_taker || "").trim()
    const timePart = mt.start_time ? ` u ${String(mt.start_time).trim()} sati` : ""
    const locPart = location ? ` u prostoru: ${location}` : ""
    const typeLower = meetingType.toLowerCase()
    const statusText = mt.status === "completed" ? "održana je" : "zabilježena je"

    const sentences: string[] = [
      `Dana ${parsedDate.display}${timePart}${locPart} ${statusText} ${
        typeLower.includes("skupštin") || typeLower.includes("sjednic") ? meetingType : `sjednica (${meetingType})`
      } pod nazivom „${String(mt.title || "").trim()}”.`,
    ]

    if (chairperson || minuteTaker) {
      const leadParts: string[] = []
      if (chairperson) leadParts.push(`sjednicom je predsjedao/la ${chairperson}`)
      if (minuteTaker) leadParts.push(`zapisnik je vodio/la ${minuteTaker}`)
      sentences.push(`Rad je obilježen sljedećim ustrojem: ${leadParts.join(", ")}.`)
    }

    if (attendeeNames.length > 0) {
      sentences.push(
        `Sjednici ${hrPlural(
          attendeeNames.length,
          "je prisustvovao",
          "su prisustvovala",
          "je prisustvovalo"
        )} ${attendeeNames.length} ${hrPlural(attendeeNames.length, "član", "člana", "članova")}.`
      )
    }

    if (cleanMinutes) {
      sentences.push(`Sažetak rasprave i zaključaka: ${truncateClean(cleanMinutes, 420)}`)
    }

    const details: string[] = []
    if (agendaArr.length > 0) {
      details.push(`Dnevni red (${agendaArr.length} ${hrPlural(agendaArr.length, "točka", "točke", "točaka")}): ${agendaArr.slice(0, 6).join("; ")}${agendaArr.length > 6 ? "…" : ""}`)
    }
    if (attendeeNames.length > 0) {
      details.push(`Prisutni članovi: ${formatNameList(attendeeNames, 20)}`)
    }

    const people = Array.from(
      new Set([chairperson, minuteTaker, ...attendeeNames].map((s) => s.trim()).filter(Boolean))
    )

    meetingEvents.push({
      id: `meeting-${mt.id}`,
      dateIso: parsedDate.iso,
      dateDisplay: parsedDate.display,
      year: parsedDate.year,
      month: parsedDate.month,
      precision: parsedDate.precision,
      category: "meetings",
      categoryLabel: CATEGORY_LABEL_MAP.get("meetings")!,
      title: String(mt.title || meetingType).trim(),
      narrative: sentences.join(" "),
      details,
      people,
      location: location || undefined,
      sourceRef: `Sjednica #${mt.id} (${meetingType})`,
      externalUrl: mt.youtube_url ? String(mt.youtube_url).trim() : undefined,
    })
  }

  // 3. PREDAVANJA I GOSTOVANJA
  const lectureRows = db
    .prepare(
      `SELECT id, title, type, date, start_time, city, location, description, host, hosts, attendee_ids, status, youtube_url
       FROM lectures
       ORDER BY date ASC, id ASC`
    )
    .all() as any[]

  const lectureEvents: ChronicleEventItem[] = []
  const lecturesAppendix: ChronicleLectureRow[] = []
  const lectureCitiesSet = new Set<string>()

  for (const lec of lectureRows) {
    const parsedDate = parseChronicleDate(lec.date)
    trackYear(parsedDate)
    if (!parsedDate || !inRange(parsedDate)) continue

    const hostsArr = safeJsonArray<any>(lec.hosts)
      .map((h) => String(typeof h === "string" ? h : h?.name || "").trim())
      .filter(Boolean)
    const fallbackHost = String(lec.host || "").trim()
    const hostList = Array.from(new Set([...hostsArr, ...(fallbackHost ? [fallbackHost] : [])]))
    const hostText = hostList.join(", ")

    const attendeeIds = safeJsonArray<number>(lec.attendee_ids)
    const attendeeNames = attendeeIds
      .map((id) => memberNameById.get(Number(id)))
      .filter((n): n is string => Boolean(n))

    const city = String(lec.city || "").trim()
    const location = String(lec.location || "").trim()
    if (city) lectureCitiesSet.add(city)

    const locText = [city, location && location !== city ? location : ""].filter(Boolean).join(", ")
    const timePart = lec.start_time ? ` u ${String(lec.start_time).trim()} sati` : ""
    const cleanDesc = stripHtmlClean(lec.description)
    const verb = lec.status === "completed" ? "održano je" : "evidentirano je"

    const sentences: string[] = [
      `Dana ${parsedDate.display}${timePart}${locText ? ` (${locText})` : ""} ${verb} predavanje i susret pod naslovom „${String(
        lec.title || ""
      ).trim()}”.`,
    ]
    if (hostText) {
      sentences.push(`Predavač odnosno domaćin susreta bio je ${hostText}.`)
    }
    if (cleanDesc) {
      sentences.push(truncateClean(cleanDesc, 380))
    }
    if (attendeeNames.length > 0) {
      sentences.push(
        `Susretu ${hrPlural(
          attendeeNames.length,
          "je nazočio",
          "su nazočila",
          "je nazočilo"
        )} ${attendeeNames.length} ${hrPlural(
          attendeeNames.length,
          "evidentirani član",
          "evidentirana člana",
          "evidentiranih članova"
        )}.`
      )
    }

    const details: string[] = []
    if (attendeeNames.length > 0) {
      details.push(`Evidentirani sudionici: ${formatNameList(attendeeNames, 18)}`)
    }
    if (lec.youtube_url) {
      details.push("Dostupna javna video-snimka predavanja (YouTube).")
    }

    const people = Array.from(new Set([...hostList, ...attendeeNames].filter(Boolean)))

    lectureEvents.push({
      id: `lecture-${lec.id}`,
      dateIso: parsedDate.iso,
      dateDisplay: parsedDate.display,
      year: parsedDate.year,
      month: parsedDate.month,
      precision: parsedDate.precision,
      category: "lectures",
      categoryLabel: CATEGORY_LABEL_MAP.get("lectures")!,
      title: String(lec.title || "Predavanje Društva").trim(),
      narrative: sentences.join(" "),
      details,
      people,
      location: locText || undefined,
      sourceRef: `Predavanje #${lec.id}`,
      externalUrl: lec.youtube_url ? String(lec.youtube_url).trim() : undefined,
    })

    lecturesAppendix.push({
      dateDisplay: parsedDate.display,
      title: String(lec.title || "").trim(),
      city: city || "—",
      location: location || "—",
      host: hostText || "—",
      attendeesCount: attendeeNames.length,
      youtubeUrl: lec.youtube_url ? String(lec.youtube_url).trim() : undefined,
    })
  }

  // 4. PROJEKTI
  const projectRows = db
    .prepare(
      `SELECT id, title, description, status, progress, start_date, end_date, lead_member_name, member_ids, goals, notes, contributors, project_url, created_at
       FROM projects
       ORDER BY COALESCE(start_date, substr(created_at, 1, 10)) ASC, id ASC`
    )
    .all() as any[]

  const projectEvents: ChronicleEventItem[] = []
  for (const pr of projectRows) {
    const startParsed = parseChronicleDate(pr.start_date) || parseChronicleDate(pr.created_at)
    const endParsed = parseChronicleDate(pr.end_date)
    trackYear(startParsed)
    trackYear(endParsed)

    const startMatches = inRange(startParsed)
    const endMatches = inRange(endParsed)
    const activeOverlap =
      mode === "range" &&
      startParsed &&
      startParsed.iso <= endDate &&
      (!endParsed || endParsed.iso >= startDate) &&
      String(pr.status || "").toLowerCase() === "active"

    if (!startMatches && !endMatches && !activeOverlap) continue

    const eventParsed =
      (endMatches ? endParsed : null) ||
      (startMatches ? startParsed : null) ||
      startParsed
    if (!eventParsed) continue

    const leadName = String(pr.lead_member_name || "").trim()
    const projMemberIds = safeJsonArray<number>(pr.member_ids)
    const projMemberNames = projMemberIds
      .map((id) => memberNameById.get(Number(id)))
      .filter((n): n is string => Boolean(n))
    const contributors = safeJsonArray<any>(pr.contributors)
      .map((c) => {
        const name = String(c?.name || c?.memberName || "").trim()
        const role = String(c?.role || c?.contribution || "").trim()
        return name ? (role ? `${name} (${role})` : name) : ""
      })
      .filter(Boolean)

    const statusLabel =
      pr.status === "completed" ? "dovršen" : pr.status === "paused" ? "privremeno pauziran" : "aktivan"
    const cleanDesc = stripHtmlClean(pr.description)
    const cleanGoals = stripHtmlClean(pr.goals)

    const sentences: string[] = []
    if (endMatches && endParsed) {
      sentences.push(
        `Dana ${endParsed.display} zaključen je projekt Društva „${String(pr.title || "").trim()}”${
          startParsed ? ` (pokrenut ${startParsed.display})` : ""
        }.`
      )
    } else if (startMatches && startParsed) {
      sentences.push(
        `Dana ${startParsed.display} pokrenut je projekt Društva „${String(pr.title || "").trim()}” (status: ${statusLabel}, napredak ${Number(
          pr.progress || 0
        )}%).`
      )
    } else {
      sentences.push(
        `Tijekom razdoblja nastavljen je rad na projektu „${String(pr.title || "").trim()}”${
          startParsed ? ` (započet ${startParsed.display})` : ""
        }, uz ostvareni napredak od ${Number(pr.progress || 0)}%.`
      )
    }

    if (leadName) {
      sentences.push(`Voditelj projekta je ${leadName}.`)
    }
    if (cleanDesc) {
      sentences.push(truncateClean(cleanDesc, 360))
    }

    const details: string[] = []
    if (cleanGoals) details.push(`Ciljevi projekta: ${truncateClean(cleanGoals, 260)}`)
    if (contributors.length > 0) details.push(`Suradnici i doprinosi: ${contributors.join(", ")}`)
    else if (projMemberNames.length > 0) details.push(`Članovi projektnog tima: ${formatNameList(projMemberNames, 15)}`)

    const people = Array.from(
      new Set(
        [
          leadName,
          ...projMemberNames,
          ...safeJsonArray<any>(pr.contributors).map((c) => String(c?.name || c?.memberName || "").trim()),
        ].filter(Boolean)
      )
    )

    const displayDate =
      startMatches || endMatches || mode === "all"
        ? eventParsed
        : {
            iso: `${Math.min(Math.max(eventParsed.year, startYear), endYear)}-01-01`,
            year: Math.min(Math.max(eventParsed.year, startYear), endYear),
            month: 1,
            precision: "year" as const,
            display: `${Math.min(Math.max(eventParsed.year, startYear), endYear)}. god.`,
          }

    projectEvents.push({
      id: `project-${pr.id}`,
      dateIso: displayDate.iso,
      dateDisplay: displayDate.display,
      year: displayDate.year,
      month: displayDate.month,
      precision: displayDate.precision,
      category: "projects",
      categoryLabel: CATEGORY_LABEL_MAP.get("projects")!,
      title: String(pr.title || "Projekt Društva").trim(),
      narrative: sentences.join(" "),
      details,
      people,
      sourceRef: `Projekt #${pr.id}`,
      externalUrl: pr.project_url ? String(pr.project_url).trim() : undefined,
    })
  }

  // 5. ČLANSTVO, MANDATI I IN MEMORIAM (sažeto po godinama umjesto 288 pojedinačnih redaka!)
  const membershipEvents: ChronicleEventItem[] = []
  const joinsByYear = new Map<number, Array<ChronicleMemberJoinRow & { year: number }>>()
  for (const jm of newMembersInRange) {
    const arr = joinsByYear.get(jm.year) || []
    arr.push(jm)
    joinsByYear.set(jm.year, arr)
  }

  for (const [yr, list] of Array.from(joinsByYear.entries()).sort((a, b) => a[0] - b[0])) {
    const count = list.length
    const dateIso = mode === "all" ? `${yr}-12-31` : endDate.startsWith(String(yr)) ? endDate : `${yr}-12-31`
    membershipEvents.push({
      id: `membership-joins-${yr}`,
      dateIso,
      dateDisplay: `${yr}. god.`,
      year: yr,
      month: 12,
      precision: "year",
      category: "membership",
      categoryLabel: CATEGORY_LABEL_MAP.get("membership")!,
      title: `Upis novih članova u ${yr}. godini (${count})`,
      narrative: `Tijekom ${yr}. godine u matičnu knjigu Hrvatskog rodoslovnog društva „Pavao Ritter Vitezović” upisano je ${count} ${hrPlural(
        count,
        "novi član",
        "nova člana",
        "novih članova"
      )}.`,
      details: [
        `Novoupisani članovi: ${formatNameList(
          list.map((x) => `${x.name} (${x.dateDisplay})`),
          24
        )}`,
      ],
      people: list.map((x) => x.name),
      sourceRef: `Matična knjiga članova (${yr}.)`,
    })
  }

  for (const [yr, mList] of Array.from(mandateStartsByYear.entries()).sort((a, b) => a[0] - b[0])) {
    const uniquePeople = Array.from(new Set(mList.map((x) => x.memberName)))
    const roleSummary = mList.map((x) => `${x.functionName}: ${x.memberName}`)
    membershipEvents.push({
      id: `membership-mandates-${yr}`,
      dateIso: `${yr}-01-01`,
      dateDisplay: `${yr}. god.`,
      year: yr,
      month: 1,
      precision: "year",
      category: "membership",
      categoryLabel: CATEGORY_LABEL_MAP.get("membership")!,
      title: `Ustroj i početak mandata u tijelima Društva (${yr}.)`,
      narrative: `U ${yr}. godini započelo je obnašanje ${mList.length} ${hrPlural(
        mList.length,
        "upravljačke i stručne dužnosti",
        "upravljačke i stručne dužnosti",
        "upravljačkih i stručnih dužnosti"
      )} u tijelima Društva.`,
      details: [`Dužnosnici i tijela: ${roleSummary.join("; ")}`],
      people: uniquePeople,
      sourceRef: `Evidencija funkcija i mandata (${yr}.)`,
    })
  }

  for (const im of inMemoriamInRange) {
    const funcsText =
      im.functions.length > 0 ? `, obnašajući dužnosti: ${im.functions.join(", ")}` : ""
    const joinText = im.joinDateDisplay ? ` (član Društva od ${im.joinDateDisplay})` : ""
    membershipEvents.push({
      id: `in-memoriam-${im.name}-${im.parsedDeath.iso}`,
      dateIso: im.parsedDeath.iso,
      dateDisplay: im.deathDateDisplay,
      year: im.year,
      month: im.parsedDeath.month,
      precision: im.parsedDeath.precision,
      category: "membership",
      categoryLabel: CATEGORY_LABEL_MAP.get("membership")!,
      title: `In memoriam: † ${im.name}`,
      narrative: `Dana ${im.deathDateDisplay} preminuo je cijenjeni član Društva ${im.name}${joinText}${funcsText}. Svojim radom ostavio je trajan trag u zajednici hrvatskih rodoslovaca.`,
      details: [],
      people: [im.name],
      sourceRef: `Matična knjiga — In memoriam`,
    })
  }

  // 6. RODOSLOVNA ISTRAŽIVANJA I UPITI (bez osobnih kontakata)
  let totalInquiriesInRange = 0
  let resolvedInquiriesInRange = 0
  const researchEvents: ChronicleEventItem[] = []
  try {
    const inquiryRows = db
      .prepare(
        `SELECT id, requester_name, inquiry_date, subject, assigned_to_name, research_result, status, project_name, created_at
         FROM research_inquiries
         ORDER BY COALESCE(inquiry_date, substr(created_at, 1, 10)) ASC`
      )
      .all() as any[]

    const inquiriesByYear = new Map<number, any[]>()
    for (const inq of inquiryRows) {
      const pDate = parseChronicleDate(inq.inquiry_date) || parseChronicleDate(inq.created_at)
      trackYear(pDate)
      if (!pDate || !inRange(pDate)) continue
      totalInquiriesInRange++
      if (String(inq.status || "").toLowerCase() === "completed") resolvedInquiriesInRange++
      const arr = inquiriesByYear.get(pDate.year) || []
      arr.push({ ...inq, parsedDate: pDate })
      inquiriesByYear.set(pDate.year, arr)
    }

    for (const [yr, list] of Array.from(inquiriesByYear.entries()).sort((a, b) => a[0] - b[0])) {
      const resolved = list.filter((x) => String(x.status || "").toLowerCase() === "completed").length
      const subjects = Array.from(new Set(list.map((x) => String(x.subject || "").trim()).filter(Boolean)))
      const researchers = Array.from(
        new Set(list.map((x) => String(x.assigned_to_name || "").trim()).filter(Boolean))
      )
      researchEvents.push({
        id: `research-summary-${yr}`,
        dateIso: `${yr}-12-31`,
        dateDisplay: `${yr}. god.`,
        year: yr,
        month: 12,
        precision: "year",
        category: "research",
        categoryLabel: CATEGORY_LABEL_MAP.get("research")!,
        title: `Rodoslovni upiti i istraživački rad (${yr}.)`,
        narrative: `U ${yr}. godini Društvo je zaprimilo ${list.length} ${hrPlural(
          list.length,
          "rodoslovni upit",
          "rodoslovna upita",
          "rodoslovnih upita"
        )} građana i istraživača, od čega je do sada zaključeno ${resolved}.`,
        details: [
          ...(subjects.length > 0
            ? [`Obrađene teme i prezimena: ${formatNameList(subjects, 12)}`]
            : []),
          ...(researchers.length > 0
            ? [`Angažirani istraživači Društva: ${researchers.join(", ")}`]
            : []),
        ],
        people: researchers,
        sourceRef: `Evidencija istraživanja i upita (${yr}.)`,
      })
    }
  } catch {}

  // 7. KNJIŽNICA DRUŠTVA (isključivo prema created_at — nikad godina tiskanja knjige!)
  let libraryTotalBooks = 0
  let libraryTotalJournals = 0
  let libraryDigitizedBooks = 0
  let libraryBooksAdded = 0
  let libraryJournalsAdded = 0
  const libraryEvents: ChronicleEventItem[] = []

  try {
    const bookRows = db
      .prepare(
        `SELECT id, broj, autor, naslov, izdavac, godina, is_scanned, is_digitized, created_at
         FROM library_books`
      )
      .all() as any[]
    libraryTotalBooks = bookRows.length
    libraryDigitizedBooks = bookRows.filter((b) => b.is_scanned === 1 || b.is_digitized === 1).length

    const journalRows = db
      .prepare(
        `SELECT id, broj, naslov, svesci, izdavac, created_at
         FROM library_journals`
      )
      .all() as any[]
    libraryTotalJournals = journalRows.length

    const booksByYear = new Map<number, any[]>()
    for (const b of bookRows) {
      const pDate = parseChronicleDate(b.created_at)
      trackYear(pDate)
      if (!pDate || !inRange(pDate)) continue
      libraryBooksAdded++
      const arr = booksByYear.get(pDate.year) || []
      arr.push(b)
      booksByYear.set(pDate.year, arr)
    }

    const journalsByYear = new Map<number, any[]>()
    for (const j of journalRows) {
      const pDate = parseChronicleDate(j.created_at)
      trackYear(pDate)
      if (!pDate || !inRange(pDate)) continue
      libraryJournalsAdded++
      const arr = journalsByYear.get(pDate.year) || []
      arr.push(j)
      journalsByYear.set(pDate.year, arr)
    }

    const allLibYears = Array.from(new Set([...booksByYear.keys(), ...journalsByYear.keys()])).sort(
      (a, b) => a - b
    )

    for (const yr of allLibYears) {
      const bList = booksByYear.get(yr) || []
      const jList = journalsByYear.get(yr) || []
      const sampleTitles = [
        ...bList.slice(0, 5).map((b) => `„${String(b.naslov || "").trim()}”${b.autor && b.autor !== "-" ? ` (${b.autor})` : ""}`),
        ...jList.slice(0, 3).map((j) => `časopis „${String(j.naslov || "").trim()}”`),
      ]

      libraryEvents.push({
        id: `library-summary-${yr}`,
        dateIso: `${yr}-12-31`,
        dateDisplay: `${yr}. god.`,
        year: yr,
        month: 12,
        precision: "year",
        category: "library",
        categoryLabel: CATEGORY_LABEL_MAP.get("library")!,
        title: `Prirast i katalogizacija knjižnice Društva (${yr}.)`,
        narrative: `Tijekom ${yr}. godine u digitalni katalog knjižnice Društva evidentirano je ${bList.length} ${hrPlural(
          bList.length,
          "knjiga",
          "knjige",
          "knjiga"
        )} i ${jList.length} ${hrPlural(
          jList.length,
          "serijska publikacija / časopis",
          "serijske publikacije / časopisa",
          "serijskih publikacija / časopisa"
        )} (ukupni fond sada broji ${libraryTotalBooks} knjiga i ${libraryTotalJournals} naslova časopisa, od čega je ${libraryDigitizedBooks} skeniranih/digitaliziranih jedinica).`,
        details: sampleTitles.length > 0 ? [`Izdvojeni zapisi iz kataloga: ${sampleTitles.join("; ")}`] : [],
        people: [],
        sourceRef: `Katalog knjižnice (${yr}., po datumu unosa)`,
      })
    }
  } catch {}

  // 8. ARHIV I PRIKUPLJANJE GRAĐE
  let archiveContactedCount = 0
  let archiveCollectedCount = 0
  const archiveEvents: ChronicleEventItem[] = []
  try {
    const archiveRows = db
      .prepare(
        `SELECT member_id, contacted, contacted_at, contact_result
         FROM archive_member_contacts
         WHERE contacted = 1`
      )
      .all() as any[]

    const archiveByYear = new Map<number, { total: number; agreed: number; collected: number }>()
    for (const ar of archiveRows) {
      const pDate = parseChronicleDate(ar.contacted_at)
      trackYear(pDate)
      if (!pDate || !inRange(pDate)) continue
      archiveContactedCount++
      const resCode = String(ar.contact_result || "").trim().toLowerCase()
      const isCollected = resCode.includes("preuzet")
      const isAgreed = resCode.includes("dogovor")
      if (isCollected) archiveCollectedCount++

      const cur = archiveByYear.get(pDate.year) || { total: 0, agreed: 0, collected: 0 }
      cur.total++
      if (isAgreed) cur.agreed++
      if (isCollected) cur.collected++
      archiveByYear.set(pDate.year, cur)
    }

    for (const [yr, stat] of Array.from(archiveByYear.entries()).sort((a, b) => a[0] - b[0])) {
      archiveEvents.push({
        id: `archive-summary-${yr}`,
        dateIso: `${yr}-12-31`,
        dateDisplay: `${yr}. god.`,
        year: yr,
        month: 12,
        precision: "year",
        category: "archive",
        categoryLabel: CATEGORY_LABEL_MAP.get("archive")!,
        title: `Prikupljanje arhivske i obiteljske građe (${yr}.)`,
        narrative: `U okviru rada modula Arhiv tijekom ${yr}. godine evidentirano je ${stat.total} ${hrPlural(
          stat.total,
          "kontakt s članom ili obitelji",
          "kontakta s članovima ili obiteljima",
          "kontakata s članovima ili obiteljima"
        )} radi prikupljanja rodoslovne građe (dogovoreno: ${stat.agreed}, preuzeto: ${stat.collected}).`,
        details: [],
        people: [],
        sourceRef: `Arhiv prikupljanja građe (${yr}.)`,
      })
    }
  } catch {}

  // 9. ODLUKE, GLASOVANJA I OBAVIJESTI TIJELIMA
  let votesCount = 0
  let boardAnnouncementsCount = 0
  const governanceEvents: ChronicleEventItem[] = []

  try {
    const voteRows = db
      .prepare(`SELECT id, title, description, status, created_at FROM votes`)
      .all() as any[]
    for (const v of voteRows) {
      const pDate = parseChronicleDate(v.created_at)
      trackYear(pDate)
      if (!pDate || !inRange(pDate)) continue
      votesCount++
      let cast = 0
      try {
        const r = db.prepare(`SELECT COUNT(*) as c FROM vote_results WHERE vote_id = ?`).get(v.id) as any
        cast = Number(r?.c || 0)
      } catch {}
      governanceEvents.push({
        id: `vote-${v.id}`,
        dateIso: pDate.iso,
        dateDisplay: pDate.display,
        year: pDate.year,
        month: pDate.month,
        precision: pDate.precision,
        category: "governance",
        categoryLabel: CATEGORY_LABEL_MAP.get("governance")!,
        title: `Elektroničko glasovanje: „${String(v.title || "").trim()}”`,
        narrative: `Dana ${pDate.display} provedeno je e-glasovanje pod nazivom „${String(
          v.title || ""
        ).trim()}” uz zabilježenih ${cast} ${hrPlural(cast, "glas", "glasa", "glasova")}.`,
        details: v.description ? [stripHtmlClean(v.description)] : [],
        people: [],
        sourceRef: `Glasovanje #${v.id}`,
      })
    }
  } catch {}

  try {
    const annRows = db
      .prepare(
        `SELECT id, subject, sender_name, sent_count, total_recipients, sent_at
         FROM board_announcements`
      )
      .all() as any[]
    for (const a of annRows) {
      const pDate = parseChronicleDate(a.sent_at)
      trackYear(pDate)
      if (!pDate || !inRange(pDate)) continue
      boardAnnouncementsCount++
      const sender = String(a.sender_name || "").trim()
      governanceEvents.push({
        id: `board-ann-${a.id}`,
        dateIso: pDate.iso,
        dateDisplay: pDate.display,
        year: pDate.year,
        month: pDate.month,
        precision: pDate.precision,
        category: "governance",
        categoryLabel: CATEGORY_LABEL_MAP.get("governance")!,
        title: `Službena obavijest tijelima Društva: „${String(a.subject || "").trim()}”`,
        narrative: `Dana ${pDate.display} ${
          sender ? `${sender} uputio/la je` : "upućena je"
        } službenu obavijest članovima tijela Društva (${Number(
          a.sent_count || a.total_recipients || 0
        )} primatelja) na temu „${String(a.subject || "").trim()}”.`,
        details: [],
        people: sender ? [sender] : [],
        sourceRef: `Obavijest tijelima #${a.id}`,
      })
    }
  } catch {}

  // 10. RAZVOJ SUSTAVA RODOSLOVAC (Changelog)
  const systemEvents: ChronicleEventItem[] = []
  for (const ch of CHANGELOG_DATA) {
    const pDate = parseChronicleDate(ch.dateLabel)
    trackYear(pDate)
    if (!pDate || !inRange(pDate)) continue
    systemEvents.push({
      id: `changelog-${ch.version}`,
      dateIso: pDate.iso,
      dateDisplay: pDate.display,
      year: pDate.year,
      month: pDate.month,
      precision: pDate.precision,
      category: "system",
      categoryLabel: CATEGORY_LABEL_MAP.get("system")!,
      title: `Sustav „Rodoslovac” ${ch.version}: ${ch.title}`,
      narrative: `Dana ${pDate.display} objavljeno je izdanje ${ch.version} informacijskog sustava Društva („${ch.title}”) s ${ch.changes.length} ${hrPlural(
        ch.changes.length,
        "zabilježenom promjenom",
        "zabilježene promjene",
        "zabilježenih promjena"
      )}.`,
      details: ch.changes.slice(0, 4).map((x) => truncateClean(x.text, 180)),
      people: [],
      sourceRef: `Popis promjena ${ch.version}`,
    })
  }

  // Filtriranje događaja prema odabranim kategorijama i kronološko sortiranje
  const allCandidates: ChronicleEventItem[] = [
    ...(includedSet.has("meetings") ? meetingEvents : []),
    ...(includedSet.has("lectures") ? lectureEvents : []),
    ...(includedSet.has("projects") ? projectEvents : []),
    ...(includedSet.has("membership") ? membershipEvents : []),
    ...(includedSet.has("research") ? researchEvents : []),
    ...(includedSet.has("library") ? libraryEvents : []),
    ...(includedSet.has("archive") ? archiveEvents : []),
    ...(includedSet.has("governance") ? governanceEvents : []),
    ...(includedSet.has("system") ? systemEvents : []),
  ]

  allCandidates.sort((a, b) => {
    const dateCmp = a.dateIso.localeCompare(b.dateIso)
    if (dateCmp !== 0) return dateCmp
    return a.title.localeCompare(b.title, "hr")
  })

  // Grupiranje po godinama s godišnjim pripovjednim uvodom
  const eventsByYear = new Map<number, ChronicleEventItem[]>()
  for (const ev of allCandidates) {
    const arr = eventsByYear.get(ev.year) || []
    arr.push(ev)
    eventsByYear.set(ev.year, arr)
  }

  const yearGroups = Array.from(eventsByYear.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([year, events]) => {
      const mCnt = events.filter((e) => e.category === "meetings").length
      const lCnt = events.filter((e) => e.category === "lectures").length
      const pCnt = events.filter((e) => e.category === "projects").length
      const parts: string[] = []
      if (mCnt > 0) parts.push(`${mCnt} ${hrPlural(mCnt, "sjednicu", "sjednice", "sjednica")}`)
      if (lCnt > 0) parts.push(`${lCnt} ${hrPlural(lCnt, "predavanje", "predavanja", "predavanja")}`)
      if (pCnt > 0) parts.push(`${pCnt} ${hrPlural(pCnt, "projekt", "projekta", "projekata")}`)
      const yearSummary =
        parts.length > 0
          ? `U ${year}. godini zabilježeno je ukupno ${events.length} ${hrPlural(
              events.length,
              "ljetopisni zapis",
              "ljetopisna zapisa",
              "ljetopisnih zapisa"
            )}, uključujući ${parts.join(", ")}.`
          : `U ${year}. godini evidentirano je ${events.length} ${hrPlural(
              events.length,
              "ljetopisni zapis",
              "ljetopisna zapisa",
              "ljetopisnih zapisa"
            )}.`
      return { year, yearSummary, events }
    })

  // Tematske cjeline (poglavlja buduće spomenice)
  const thematicSections = CHRONICLE_CATEGORIES.filter((meta) => includedSet.has(meta.key))
    .map((meta) => ({
      category: meta.key,
      title: meta.chapterTitle,
      intro: meta.description,
      events: allCandidates.filter((e) => e.category === meta.key),
    }))
    .filter((sec) => sec.events.length > 0)

  // Kazalo osoba (People Index)
  const peopleAcc = new Map<string, { count: number; roles: Set<string>; years: Set<number> }>()
  const addPersonMention = (name: string, role: string, year: number) => {
    const clean = name.trim()
    if (!clean) return
    const cur = peopleAcc.get(clean) || {
      count: 0,
      roles: new Set<string>(),
      years: new Set<number>(),
    }
    cur.count++
    cur.roles.add(role)
    if (year > 0) cur.years.add(year)
    peopleAcc.set(clean, cur)
  }

  for (const ev of allCandidates) {
    // Izbjegavamo napuhavanje kazala masovnim godišnjim upisima; dužnosnike i govornike uvijek uključujemo
    if (ev.id.startsWith("membership-joins-")) continue
    ev.people.forEach((p) => addPersonMention(p, ev.categoryLabel, ev.year))
  }
  mandatesInRange.forEach((m) =>
    addPersonMention(m.memberName, m.functionName, Number(m.fromYear?.slice(0, 4)) || currentYear)
  )

  const peopleIndex: ChroniclePersonIndexRow[] = Array.from(peopleAcc.entries())
    .map(([name, info]) => ({
      name,
      mentionsCount: info.count,
      roles: Array.from(info.roles),
      years: Array.from(info.years).sort((a, b) => a - b),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "hr"))

  // Oznaka perioda u formatu DD/MM/YYYY
  const periodLabel =
    mode === "all"
      ? "Cjelokupna evidentirana povijest Društva"
      : `${formatDateDMY(startDate, startDate)} – ${formatDateDMY(endDate, endDate)}`

  // Uvodni pripovjedni sažetak razdoblja
  const lectureCities = Array.from(lectureCitiesSet).sort((a, b) => a.localeCompare(b, "hr"))
  const activeMandatesCount = mandatesInRange.filter((m) => m.isActive).length
  const introNarrative: string[] = [
    `Ovaj ljetopis donosi pregled provjerenih činjenica o radu Hrvatskog rodoslovnog društva „Pavao Ritter Vitezović” za razdoblje: ${periodLabel}, izrađen izravno na temelju službenih zapisa u bazi podataka sustava „Rodoslovac”.`,
  ]

  const actParts: string[] = []
  if (meetingEvents.length > 0 && includedSet.has("meetings")) {
    actParts.push(
      `održano ${meetingEvents.length} ${hrPlural(
        meetingEvents.length,
        "sjednica ili skupština",
        "sjednice ili skupštine",
        "sjednica ili skupština"
      )}`
    )
  }
  if (lectureEvents.length > 0 && includedSet.has("lectures")) {
    const citiesSuffix =
      lectureCities.length > 0 ? ` (${lectureCities.join(", ")})` : ""
    actParts.push(
      `priređeno ${lectureEvents.length} ${hrPlural(
        lectureEvents.length,
        "javno predavanje i susret",
        "javna predavanja i susreta",
        "javnih predavanja i susreta"
      )}${citiesSuffix}`
    )
  }
  if (projectEvents.length > 0 && includedSet.has("projects")) {
    actParts.push(
      `vođeno ${projectEvents.length} ${hrPlural(
        projectEvents.length,
        "istraživački projekt",
        "istraživačka projekta",
        "istraživačkih projekata"
      )}`
    )
  }
  if (actParts.length > 0) {
    introNarrative.push(
      `U promatranom razdoblju u djelovanju Društva zabilježeno je sljedeće: ${actParts.join("; ")}.`
    )
  }

  introNarrative.push(
    `Matična knjiga trenutačno obuhvaća ukupno ${memberRows.length} ${hrPlural(
      memberRows.length,
      "člana",
      "člana",
      "članova"
    )}${
      newMembersInRange.length > 0
        ? `, od čega je u ovom razdoblju s potvrđenim datumom upisano ${newMembersInRange.length} ${hrPlural(
            newMembersInRange.length,
            "novi član",
            "nova člana",
            "novih članova"
          )}`
        : ""
    }. U knjižnici Društva katalogizirano je ukupno ${libraryTotalBooks} knjiga i ${libraryTotalJournals} naslova časopisa.`
  )

  const dataQualityNotes: string[] = [
    "Svi zapisi i brojčani pokazatelji generirani su uživo iz provjerenih zapisa službene baze sustava „Rodoslovac” (app.db), uz navođenje izvora uz svaki ljetopisni unos.",
    "Radi zaštite privatnosti članova i čistoće spomeničkog teksta, pojedinačne uplate članarina, OIB, adrese prebivališta, telefonski brojevi i e-mail adrese nikada se ne uključuju u Ljetopis.",
    "Prirast knjižnice razvrstava se prema datumu evidentiranja jedinice u katalog sustava (created_at), a ne prema godini tiskanja pojedine knjige.",
  ]
  if (membersWithoutJoinDateCount > 0) {
    dataQualityNotes.push(
      `Napomena za matičnu knjigu: ${membersWithoutJoinDateCount} ${hrPlural(
        membersWithoutJoinDateCount,
        "član trenutačno nema",
        "člana trenutačno nemaju",
        "članova trenutačno nema"
      )} upisan valjani datum pristupanja Društvu, pa nisu samovoljno svrstani ni u jednu pojedinačnu godinu upisa.`
    )
  }

  return {
    period: {
      mode,
      startDate,
      endDate,
      label: periodLabel,
      generatedAt: formatDateTimeDMY(now),
    },
    availableYears: Array.from(availableYearsSet).sort((a, b) => b - a),
    includedCategories: Array.from(includedSet),
    summary: {
      totalEvents: allCandidates.length,
      meetingsCount: meetingEvents.length,
      lecturesCount: lectureEvents.length,
      lectureCities,
      projectsCount: projectEvents.length,
      newMembersCount: newMembersInRange.length,
      totalMembersCount: memberRows.length,
      honoraryCount: honoraryMembers.length,
      inMemoriamCount: inMemoriamInRange.length,
      activeMandatesCount,
      inquiriesCount: totalInquiriesInRange,
      inquiriesResolvedCount: resolvedInquiriesInRange,
      libraryBooksAdded,
      libraryJournalsAdded,
      libraryTotalBooks,
      libraryTotalJournals,
      libraryDigitizedBooks,
      archiveContactedCount,
      archiveCollectedCount,
      votesCount,
      boardAnnouncementsCount,
      membersWithoutJoinDateCount,
    },
    introNarrative,
    events: allCandidates,
    yearGroups,
    thematicSections,
    appendices: {
      mandates: mandatesInRange,
      lecturesList: lecturesAppendix,
      newMembers: newMembersInRange.map(({ name, dateDisplay, precision }) => ({
        name,
        dateDisplay,
        precision,
      })),
      honoraryMembers,
      inMemoriam: inMemoriamInRange.map(({ name, deathDateDisplay, joinDateDisplay, functions }) => ({
        name,
        deathDateDisplay,
        joinDateDisplay,
        functions,
      })),
      peopleIndex,
    },
    dataQualityNotes,
  }
}
