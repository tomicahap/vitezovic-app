export interface BulkEmailProgressState {
  active: boolean
  status: 'idle' | 'running' | 'done' | 'cancelled' | 'error'
  total: number
  processed: number
  sent: number
  failed: number
  skipped: number
  currentName?: string
  currentEmail?: string
  lastError?: string
  startedAt?: string | null
  finishedAt?: string | null
  delayMs?: number
  pausedReason?: string | null
  dailySentCount?: number
  dailyLimit?: number
  label?: string
}

export const INITIAL_BULK_EMAIL_PROGRESS: BulkEmailProgressState = {
  active: false,
  status: 'idle',
  total: 0,
  processed: 0,
  sent: 0,
  failed: 0,
  skipped: 0,
}

export async function consumeEmailSendStream<T = any>(
  url: string,
  payload: Record<string, any>,
  onProgress: (state: BulkEmailProgressState) => void,
  signal?: AbortSignal
): Promise<T> {
  const startedAt = new Date().toISOString()
  let state: BulkEmailProgressState = {
    active: true,
    status: 'running',
    total: 0,
    processed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    startedAt,
  }
  onProgress(state)

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, stream: true }),
    signal,
  })

  const contentType = (response.headers.get('content-type') || '').toLowerCase()

  if (!contentType.includes('application/x-ndjson') || !response.body) {
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      const errMsg = data?.error || data?.message || `HTTP greška ${response.status}`
      onProgress({
        ...state,
        active: false,
        status: 'error',
        lastError: errMsg,
        finishedAt: new Date().toISOString(),
      })
      throw new Error(errMsg)
    }

    const finalSent = Number(data?.sentCount ?? data?.count ?? 0)
    const finalFailed = Number(data?.failedCount ?? data?.errors ?? 0)
    const finalSkipped = Number(data?.skippedDoNotContactCount ?? 0)
    onProgress({
      ...state,
      active: false,
      status: 'done',
      total: finalSent + finalFailed,
      processed: finalSent + finalFailed,
      sent: finalSent,
      failed: finalFailed,
      skipped: finalSkipped,
      finishedAt: new Date().toISOString(),
    })
    return data as T
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let finalResult: any = null

  const applyEvent = (evt: any) => {
    if (!evt || typeof evt !== 'object') return
    if (evt.type === 'start') {
      state = {
        ...state,
        active: true,
        status: 'running',
        total: Number(evt.total ?? state.total ?? 0),
        skipped: Number(evt.skipped ?? state.skipped ?? 0),
        delayMs: evt.delayMs !== undefined ? Number(evt.delayMs) : state.delayMs,
        startedAt: evt.startedAt || state.startedAt,
      }
      onProgress({ ...state })
      return
    }

    if (evt.type === 'progress') {
      state = {
        ...state,
        active: true,
        status: 'running',
        total: Number(evt.total ?? state.total),
        processed: Number(evt.processed ?? state.processed),
        sent: Number(evt.sent ?? state.sent),
        failed: Number(evt.failed ?? state.failed),
        skipped: Number(evt.skipped ?? state.skipped),
        currentName: evt.currentName ?? state.currentName,
        currentEmail: evt.currentEmail ?? state.currentEmail,
        lastError: evt.lastError ?? state.lastError,
        delayMs: evt.delayMs !== undefined ? Number(evt.delayMs) : state.delayMs,
      }
      onProgress({ ...state })
      return
    }

    if (evt.type === 'done') {
      finalResult = evt.result ?? evt
      const wasCancelled = Boolean(evt.cancelled || finalResult?.cancelled)
      state = {
        ...state,
        active: false,
        status: wasCancelled ? 'cancelled' : 'done',
        total: Number(evt.total ?? state.total),
        processed: Number(evt.processed ?? state.processed),
        sent: Number(evt.sent ?? finalResult?.sentCount ?? finalResult?.count ?? state.sent),
        failed: Number(evt.failed ?? finalResult?.failedCount ?? finalResult?.errors ?? state.failed),
        skipped: Number(evt.skipped ?? finalResult?.skippedDoNotContactCount ?? state.skipped),
        pausedReason: evt.pausedReason ?? finalResult?.pausedReason ?? null,
        finishedAt: evt.finishedAt || new Date().toISOString(),
      }
      onProgress({ ...state })
      return
    }

    if (evt.type === 'error') {
      const msg = String(evt.error || evt.message || 'Greška pri slanju e-pošte.')
      state = {
        ...state,
        active: false,
        status: 'error',
        lastError: msg,
        finishedAt: new Date().toISOString(),
      }
      onProgress({ ...state })
      throw new Error(msg)
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      const parsed = JSON.parse(trimmed)
      applyEvent(parsed)
    }
  }

  const tail = buffer.trim()
  if (tail) {
    const parsed = JSON.parse(tail)
    applyEvent(parsed)
  }

  if (!finalResult) {
    throw new Error('Veza sa poslužiteljem je prekinuta prije završetka slanja.')
  }

  if (finalResult.error && !finalResult.success && !finalResult.ok) {
    throw new Error(finalResult.error)
  }

  return finalResult as T
}
