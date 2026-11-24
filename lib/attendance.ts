export interface ExternalAttendee {
  id: string
  name: string
  note?: string
}

export function parseExternalAttendees(raw: unknown): ExternalAttendee[] {
  let list: unknown[] = []
  if (typeof raw === "string") {
    const trimmed = raw.trim()
    if (!trimmed) return []
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) list = parsed
    } catch {
      return []
    }
  } else if (Array.isArray(raw)) {
    list = raw
  } else {
    return []
  }

  const out: ExternalAttendee[] = []
  const seenIds = new Set<string>()
  const seenNames = new Set<string>()

  list.forEach((item, idx) => {
    let rawName = ""
    let rawNote = ""
    let rawId = ""

    if (typeof item === "string") {
      rawName = item
    } else if (item && typeof item === "object") {
      const obj = item as Record<string, unknown>
      rawName = String(obj.name ?? "")
      rawNote = obj.note !== undefined && obj.note !== null ? String(obj.note) : ""
      rawId = obj.id !== undefined && obj.id !== null ? String(obj.id) : ""
    }

    const name = rawName.trim()
    if (!name) return
    const nameKey = name.toLowerCase()
    if (seenNames.has(nameKey)) return
    seenNames.add(nameKey)

    const note = rawNote.trim()
    const slug = nameKey.replace(/[^a-z0-9čćžšđ]/gi, "").slice(0, 12) || "gost"
    let id = rawId.trim() || `ext-${idx + 1}-${slug}`
    while (seenIds.has(id)) {
      id = `${id}_${idx + 1}`
    }
    seenIds.add(id)

    out.push(note ? { id, name, note } : { id, name })
  })

  return out
}

export function getExternalInitials(name: string): string {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase()
}

export function getTotalAttendanceCount(
  attendeeIds?: number[] | null,
  externalAttendees?: ExternalAttendee[] | null
): number {
  const memberCount = Array.isArray(attendeeIds) ? attendeeIds.length : 0
  const externalCount = Array.isArray(externalAttendees) ? externalAttendees.length : 0
  return memberCount + externalCount
}

export function formatAttendanceBreakdown(memberCount: number, externalCount: number): string {
  const m = Math.max(0, Number(memberCount) || 0)
  const e = Math.max(0, Number(externalCount) || 0)
  const total = m + e
  if (total === 0) return "0 prisutnih"
  if (m > 0 && e > 0) {
    const memberLabel = m === 1 ? "član" : m < 5 ? "člana" : "članova"
    const extLabel = e === 1 ? "nije član" : "nisu članovi"
    return `${total} prisutnih (${m} ${memberLabel} + ${e} ${extLabel})`
  }
  if (m > 0) {
    return `${m} ${m === 1 ? "član" : m < 5 ? "člana" : "članova"}`
  }
  return `${e} ${
    e === 1
      ? "vanjska osoba (nije član)"
      : e < 5
      ? "vanjske osobe (nisu članovi)"
      : "vanjskih osoba (nisu članovi)"
  }`
}
