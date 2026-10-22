export interface CrawlLog {
  time: string
  message: string
  type: 'info' | 'success' | 'warn' | 'error' | 'done'
}

export interface CrawlJobState {
  running: boolean
  logs: CrawlLog[]
  foundCount: number
  insertedCount: number
  duplicateCount: number
  startedAt: string | null
  finishedAt: string | null
}

const globalForCrawler = globalThis as unknown as {
  currentCrawlJob?: CrawlJobState
}

export const currentCrawlJob: CrawlJobState = globalForCrawler.currentCrawlJob || {
  running: false,
  logs: [],
  foundCount: 0,
  insertedCount: 0,
  duplicateCount: 0,
  startedAt: null,
  finishedAt: null
}

if (process.env.NODE_ENV !== 'production') {
  globalForCrawler.currentCrawlJob = currentCrawlJob
}

export function addCrawlLog(msg: string, type: 'info' | 'success' | 'warn' | 'error' | 'done' = 'info') {
  currentCrawlJob.logs.push({
    time: new Date().toLocaleTimeString('hr-HR'),
    message: msg,
    type
  })
  if (currentCrawlJob.logs.length > 200) {
    currentCrawlJob.logs.shift()
  }
}
