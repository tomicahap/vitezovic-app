const POLLS_CACHE_TTL_MS = 30_000

const inFlightByMember = new Map<number, Promise<any[]>>()
const cacheByMember = new Map<number, { data: any[]; fetchedAt: number }>()

export async function fetchPendingPollsForMember(memberId: number, force = false): Promise<any[]> {
  if (!Number.isFinite(memberId)) return []

  if (!force) {
    const cached = cacheByMember.get(memberId)
    if (cached && Date.now() - cached.fetchedAt < POLLS_CACHE_TTL_MS) {
      return cached.data
    }
  }

  const existing = inFlightByMember.get(memberId)
  if (existing) {
    return existing
  }

  const req = fetch(`/api/polls?memberId=${encodeURIComponent(String(memberId))}`)
    .then(async (res) => {
      if (!res.ok) return []
      const data = await res.json()
      const list = Array.isArray(data) ? data : []
      cacheByMember.set(memberId, { data: list, fetchedAt: Date.now() })
      return list
    })
    .catch(() => [])
    .finally(() => {
      inFlightByMember.delete(memberId)
    })

  inFlightByMember.set(memberId, req)
  return req
}

export function invalidatePollsCache(memberId?: number): void {
  if (typeof memberId === 'number') {
    cacheByMember.delete(memberId)
    return
  }
  cacheByMember.clear()
}
