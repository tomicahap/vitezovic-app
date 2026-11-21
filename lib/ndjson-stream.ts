import 'server-only'

export function createNdjsonStreamResponse(
  run: (emit: (obj: Record<string, any>) => void) => Promise<void>
): Response {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false
      const emit = (obj: Record<string, any>) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))
        } catch {
          closed = true
        }
      }

      try {
        await run(emit)
      } catch (err: any) {
        emit({
          type: 'error',
          error: err?.message || 'Interna greška poslužitelja.',
        })
      } finally {
        if (!closed) {
          try {
            controller.close()
          } catch {}
        }
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  })
}

export function abortableSleep(ms: number, signal?: AbortSignal): Promise<boolean> {
  if (ms <= 0) return Promise.resolve(!signal?.aborted)
  if (signal?.aborted) return Promise.resolve(false)

  return new Promise((resolve) => {
    const onAbort = () => {
      clearTimeout(timer)
      resolve(false)
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve(true)
    }, ms)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

export function computeSafePacingMs(total: number): number {
  if (total <= 1) return 0
  const base = total <= 15 ? 900 : 1400
  const jitter = Math.floor(Math.random() * 300)
  return base + jitter
}
