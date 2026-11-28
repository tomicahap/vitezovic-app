import 'server-only'

export const GEMINI_MIN_INTERVAL_MS = 6_700
export const GEMINI_WINDOW_MS = 60_000
export const GEMINI_MAX_RPM_SAFE = 9
export const GEMINI_WINDOW_SAFETY_MARGIN_MS = 500
export const GEMINI_RETRY_429_DELAYS_MS = [15_000, 30_000, 60_000] as const

export type GeminiWaitPhase =
  | 'idle'
  | 'queued'
  | 'pacing'
  | 'window_wait'
  | 'retry_429'
  | 'running'

export interface GeminiQueueStatusEvent {
  phase: GeminiWaitPhase
  message: string
  waitMs?: number
  attempt?: number
  maxRetries?: number
  rpmCurrent: number
  rpmSafeLimit: number
  queueLength: number
}

export interface GeminiEnqueueOptions {
  label?: string
  signal?: AbortSignal
  onStatus?: (event: GeminiQueueStatusEvent) => void
  retryOn429?: boolean
}

export interface GeminiLimiterStatus {
  rpmCurrent: number
  rpmSafeLimit: number
  minIntervalMs: number
  queueLength: number
  active: boolean
  isWaiting: boolean
  waitPhase: GeminiWaitPhase
  statusMessage: string | null
  waitUntilIso: string | null
  lastRequestAtIso: string | null
  totalRetries429: number
}

interface QueueTask<T> {
  executor: (ctx: { attempt: number }) => Promise<T>
  options?: GeminiEnqueueOptions
  resolve: (value: T | PromiseLike<T>) => void
  reject: (reason?: any) => void
}

export interface GeminiRateLimiterConfig {
  now?: () => number
  sleep?: (ms: number) => Promise<void>
  minIntervalMs?: number
  windowMs?: number
  maxRequestsPerWindow?: number
  safetyMarginMs?: number
  retry429DelaysMs?: readonly number[]
}

function createAbortError(message = 'Zahtjev prema Gemini API-ju je prekinut.'): Error {
  const err = new Error(message)
  err.name = 'AbortError'
  return err
}

function formatWaitSecondsHr(waitMs: number): string {
  const sec = Math.max(0.1, waitMs / 1000)
  return sec >= 10 ? String(Math.round(sec)) : sec.toFixed(1).replace('.', ',')
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export class GeminiRateLimiter {
  private readonly now: () => number
  private readonly rawSleep: (ms: number) => Promise<void>
  private readonly minIntervalMs: number
  private readonly windowMs: number
  private readonly maxRequestsPerWindow: number
  private readonly safetyMarginMs: number
  private readonly retry429DelaysMs: readonly number[]

  private queue: QueueTask<any>[] = []
  private processing = false
  private lastRequestStartedAt = 0
  private requestTimestamps: number[] = []
  private isWaiting = false
  private waitPhase: GeminiWaitPhase = 'idle'
  private statusMessage: string | null = null
  private waitUntilMs: number | null = null
  private totalRetries429 = 0

  constructor(config: GeminiRateLimiterConfig = {}) {
    this.now = config.now ?? (() => Date.now())
    this.rawSleep = config.sleep ?? defaultSleep
    this.minIntervalMs = config.minIntervalMs ?? GEMINI_MIN_INTERVAL_MS
    this.windowMs = config.windowMs ?? GEMINI_WINDOW_MS
    this.maxRequestsPerWindow = config.maxRequestsPerWindow ?? GEMINI_MAX_RPM_SAFE
    this.safetyMarginMs = config.safetyMarginMs ?? GEMINI_WINDOW_SAFETY_MARGIN_MS
    this.retry429DelaysMs = config.retry429DelaysMs ?? GEMINI_RETRY_429_DELAYS_MS
  }

  private pruneWindow(currentMs = this.now()): void {
    const cutoff = currentMs - this.windowMs
    while (this.requestTimestamps.length > 0 && this.requestTimestamps[0] <= cutoff) {
      this.requestTimestamps.shift()
    }
  }

  private async abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) {
      throw createAbortError()
    }
    if (ms <= 0) return

    if (!signal) {
      await this.rawSleep(ms)
      return
    }

    await new Promise<void>((resolve, reject) => {
      let settled = false
      const onAbort = () => {
        if (settled) return
        settled = true
        reject(createAbortError())
      }

      signal.addEventListener('abort', onAbort, { once: true })
      this.rawSleep(ms)
        .then(() => {
          if (settled) return
          settled = true
          signal.removeEventListener('abort', onAbort)
          if (signal.aborted) {
            reject(createAbortError())
          } else {
            resolve()
          }
        })
        .catch((err) => {
          if (settled) return
          settled = true
          signal.removeEventListener('abort', onAbort)
          reject(err)
        })
    })
  }

  private buildStatusSnapshot(currentMs = this.now()): {
    rpmCurrent: number
    rpmSafeLimit: number
    queueLength: number
  } {
    this.pruneWindow(currentMs)
    return {
      rpmCurrent: this.requestTimestamps.length,
      rpmSafeLimit: this.maxRequestsPerWindow,
      queueLength: this.queue.length,
    }
  }

  private emitTaskStatus(
    options: GeminiEnqueueOptions | undefined,
    phase: GeminiWaitPhase,
    message: string,
    extra?: { waitMs?: number; attempt?: number; maxRetries?: number }
  ): void {
    if (!options?.onStatus) return
    const snap = this.buildStatusSnapshot()
    try {
      options.onStatus({
        phase,
        message,
        waitMs: extra?.waitMs,
        attempt: extra?.attempt,
        maxRetries: extra?.maxRetries,
        rpmCurrent: snap.rpmCurrent,
        rpmSafeLimit: snap.rpmSafeLimit,
        queueLength: snap.queueLength,
      })
    } catch {
      // Never break queue processing due to UI status listener error
    }
  }

  private async waitForSlot(options?: GeminiEnqueueOptions): Promise<void> {
    while (true) {
      if (options?.signal?.aborted) {
        throw createAbortError()
      }

      const currentMs = this.now()
      this.pruneWindow(currentMs)

      const intervalWait =
        this.lastRequestStartedAt > 0
          ? Math.max(0, this.lastRequestStartedAt + this.minIntervalMs - currentMs)
          : 0

      const windowWait =
        this.requestTimestamps.length >= this.maxRequestsPerWindow
          ? Math.max(
              0,
              this.requestTimestamps[0] + this.windowMs + this.safetyMarginMs - currentMs
            )
          : 0

      const waitMs = Math.max(intervalWait, windowWait)
      if (waitMs <= 0) {
        return
      }

      const phase: GeminiWaitPhase =
        windowWait > 0 && windowWait >= intervalWait ? 'window_wait' : 'pacing'
      const waitSec = formatWaitSecondsHr(waitMs)
      const msg =
        phase === 'window_wait'
          ? `Pauza zbog API limita (${this.maxRequestsPerWindow}/10 RPM klizni prozor) — čekanje ${waitSec} s...`
          : `Pauza zbog API limita (${this.maxRequestsPerWindow}/10 RPM) — čekanje ${waitSec} s...`

      this.isWaiting = true
      this.waitPhase = phase
      this.statusMessage = msg
      this.waitUntilMs = currentMs + waitMs

      this.emitTaskStatus(options, phase, msg, { waitMs })
      await this.abortableSleep(waitMs, options?.signal)
    }
  }

  enqueue<T>(
    executor: (ctx: { attempt: number }) => Promise<T>,
    options?: GeminiEnqueueOptions
  ): Promise<T> {
    if (options?.signal?.aborted) {
      return Promise.reject(createAbortError())
    }

    return new Promise<T>((resolve, reject) => {
      this.queue.push({ executor, options, resolve, reject })
      if (this.processing || this.queue.length > 1) {
        this.emitTaskStatus(
          options,
          'queued',
          `Zahtjev u redu čekanja (${this.maxRequestsPerWindow}/10 RPM, pozicija ${this.queue.length})...`
        )
      }
      void this.processLoop()
    })
  }

  private async processLoop(): Promise<void> {
    if (this.processing) return
    this.processing = true

    try {
      while (this.queue.length > 0) {
        const task = this.queue.shift()!
        try {
          const result = await this.executeSingleTask(task)
          task.resolve(result)
        } catch (err) {
          task.reject(err)
        }
      }
    } finally {
      this.processing = false
      this.isWaiting = false
      this.waitPhase = 'idle'
      this.statusMessage = null
      this.waitUntilMs = null
    }
  }

  private async executeSingleTask<T>(task: QueueTask<T>): Promise<T> {
    const retryEnabled = task.options?.retryOn429 !== false
    const maxRetries = this.retry429DelaysMs.length

    for (let retryIndex = 0; ; retryIndex++) {
      await this.waitForSlot(task.options)

      if (task.options?.signal?.aborted) {
        throw createAbortError()
      }

      const startTs = this.now()
      this.lastRequestStartedAt = startTs
      this.requestTimestamps.push(startTs)
      this.pruneWindow(startTs)

      this.isWaiting = false
      this.waitPhase = 'running'
      this.statusMessage = null
      this.waitUntilMs = null

      this.emitTaskStatus(task.options, 'running', '', {
        attempt: retryIndex + 1,
        maxRetries,
      })

      const res = await task.executor({ attempt: retryIndex + 1 })

      const status =
        res && typeof res === 'object' && typeof (res as any).status === 'number'
          ? Number((res as any).status)
          : null

      if (status === 429 && retryEnabled && retryIndex < maxRetries) {
        this.totalRetries429++
        // Oslobodi tijelo 429 odgovora prije ponovnog pokušaja
        if (typeof (res as any).text === 'function') {
          await (res as any).text().catch(() => '')
        } else if ((res as any).body && typeof (res as any).body.cancel === 'function') {
          await (res as any).body.cancel().catch(() => '')
        }

        const backoffMs = this.retry429DelaysMs[retryIndex]
        const backoffSec = Math.round(backoffMs / 1000)
        const retryMsg = `Pauza zbog API limita (429) — čekanje ${backoffSec} s (pokušaj ${retryIndex + 1}/${maxRetries})...`

        this.isWaiting = true
        this.waitPhase = 'retry_429'
        this.statusMessage = retryMsg
        this.waitUntilMs = this.now() + backoffMs

        this.emitTaskStatus(task.options, 'retry_429', retryMsg, {
          waitMs: backoffMs,
          attempt: retryIndex + 1,
          maxRetries,
        })

        await this.abortableSleep(backoffMs, task.options?.signal)
        continue
      }

      return res
    }
  }

  getStatus(): GeminiLimiterStatus {
    const currentMs = this.now()
    this.pruneWindow(currentMs)
    return {
      rpmCurrent: this.requestTimestamps.length,
      rpmSafeLimit: this.maxRequestsPerWindow,
      minIntervalMs: this.minIntervalMs,
      queueLength: this.queue.length,
      active: this.processing,
      isWaiting: this.isWaiting,
      waitPhase: this.processing ? this.waitPhase : 'idle',
      statusMessage: this.processing ? this.statusMessage : null,
      waitUntilIso:
        this.processing && this.waitUntilMs
          ? new Date(this.waitUntilMs).toISOString()
          : null,
      lastRequestAtIso:
        this.lastRequestStartedAt > 0
          ? new Date(this.lastRequestStartedAt).toISOString()
          : null,
      totalRetries429: this.totalRetries429,
    }
  }
}

const globalForGeminiLimiter = globalThis as typeof globalThis & {
  __hrdGeminiRateLimiter?: GeminiRateLimiter
}

export function getGeminiRateLimiter(): GeminiRateLimiter {
  if (!globalForGeminiLimiter.__hrdGeminiRateLimiter) {
    globalForGeminiLimiter.__hrdGeminiRateLimiter = new GeminiRateLimiter()
  }
  return globalForGeminiLimiter.__hrdGeminiRateLimiter
}

export function enqueueGeminiRequest<T>(
  executor: (ctx: { attempt: number }) => Promise<T>,
  options?: GeminiEnqueueOptions
): Promise<T> {
  return getGeminiRateLimiter().enqueue(executor, options)
}

export function getGeminiLimiterStatus(): GeminiLimiterStatus {
  return getGeminiRateLimiter().getStatus()
}
