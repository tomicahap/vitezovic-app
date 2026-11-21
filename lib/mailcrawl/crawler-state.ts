export interface CrawlLog {
  time: string
  message: string
  type: 'info' | 'success' | 'warn' | 'error' | 'done'
}

export interface CrawlJobState {
  running: boolean
  cancelled: boolean
  phase: string
  provider: 'serper' | 'web' | 'urls'
  totalTerms: number
  completedTerms: number
  currentTerm: string
  logs: CrawlLog[]
  foundCount: number
  insertedCount: number
  duplicateCount: number
  startedAt: string | null
  finishedAt: string | null
}

const globalForCrawler = globalThis as unknown as {
  __mailcrawlCurrentCrawlJob?: CrawlJobState
  __mailcrawlCrawlAbortController?: AbortController | null
}

function createInitialCrawlJob(): CrawlJobState {
  return {
    running: false,
    cancelled: false,
    phase: 'idle',
    provider: 'web',
    totalTerms: 0,
    completedTerms: 0,
    currentTerm: '',
    logs: [],
    foundCount: 0,
    insertedCount: 0,
    duplicateCount: 0,
    startedAt: null,
    finishedAt: null,
  }
}

export const currentCrawlJob: CrawlJobState =
  globalForCrawler.__mailcrawlCurrentCrawlJob ||
  (globalForCrawler.__mailcrawlCurrentCrawlJob = createInitialCrawlJob())

export function startCrawlAbortController(): AbortSignal {
  if (globalForCrawler.__mailcrawlCrawlAbortController) {
    try {
      globalForCrawler.__mailcrawlCrawlAbortController.abort()
    } catch {}
  }
  const controller = new AbortController()
  globalForCrawler.__mailcrawlCrawlAbortController = controller
  return controller.signal
}

export function getCrawlAbortSignal(): AbortSignal | undefined {
  return globalForCrawler.__mailcrawlCrawlAbortController?.signal
}

export function cancelActiveCrawl(): boolean {
  if (!currentCrawlJob.running) return false
  currentCrawlJob.cancelled = true
  currentCrawlJob.phase = 'cancelling'
  if (globalForCrawler.__mailcrawlCrawlAbortController) {
    try {
      globalForCrawler.__mailcrawlCrawlAbortController.abort(new Error('Zaustavljeno od strane administratora'))
    } catch {}
  }
  addCrawlLog('Zahtjev za zaustavljanjem pretraživanja zaprimljen — prekidam preostale zadatke...', 'warn')
  return true
}

export function clearCrawlAbortController() {
  globalForCrawler.__mailcrawlCrawlAbortController = null
}

export function addCrawlLog(
  msg: string,
  type: 'info' | 'success' | 'warn' | 'error' | 'done' = 'info'
) {
  currentCrawlJob.logs.push({
    time: new Date().toLocaleTimeString('hr-HR'),
    message: msg,
    type,
  })
  if (currentCrawlJob.logs.length > 250) {
    currentCrawlJob.logs.shift()
  }
}
