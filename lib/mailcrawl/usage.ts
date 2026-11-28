import 'server-only'
import { db, getCampaignSettings, updateCampaignSettings } from './db'
import type {
  ApiProviderQuotaItem,
  ApiQuotaProviderKey,
  ApiQuotaSummaryResponse,
} from './types'

const FIRECRAWL_CACHE_TTL_MS = 5 * 60 * 1000

interface FirecrawlLiveCache {
  remainingCredits: number
  planCredits: number
  billingPeriodStart?: string | null
  billingPeriodEnd?: string | null
  syncedAt: string
  error?: string
}

function safePositiveInt(val: unknown, fallback: number): number {
  const n = parseInt(String(val ?? ''), 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

function safeNumber(val: unknown, fallback: number): number {
  const n = Number(String(val ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : fallback
}

export function getGeminiDayWindowStartIso(now = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(now)

    const getPart = (t: string) => Number(parts.find((p) => p.type === t)?.value || '0')
    let hour = getPart('hour')
    if (hour === 24) hour = 0
    const minute = getPart('minute')
    const second = getPart('second')
    const elapsedMs = ((hour * 60 + minute) * 60 + second) * 1000 + now.getUTCMilliseconds()
    return new Date(now.getTime() - elapsedMs).toISOString()
  } catch {
    const d = new Date(now)
    d.setUTCHours(0, 0, 0, 0)
    return d.toISOString()
  }
}

export function getCurrentMonthWindow(now = new Date()): {
  monthKey: string
  monthLabel: string
  startIso: string
} {
  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  return {
    monthKey: `${year}-${month}`,
    monthLabel: `Mjesečno (${month}/${year})`,
    startIso: `${year}-${month}-01T00:00:00.000Z`,
  }
}

export function recordApiUsage(entry: {
  provider: ApiQuotaProviderKey
  operation?: string
  model?: string
  credits?: number
  inputTokens?: number
  outputTokens?: number
  statusCode?: number
  success?: boolean
  errorMessage?: string
}) {
  try {
    const credits =
      typeof entry.credits === 'number' && Number.isFinite(entry.credits) && entry.credits >= 0
        ? entry.credits
        : entry.success === false
        ? 0
        : 1
    db.prepare(
      `INSERT INTO api_usage_logs (
        provider, operation, model, credits, input_tokens, output_tokens,
        status_code, success, error_message, created_at_iso
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      entry.provider,
      String(entry.operation || '').slice(0, 80),
      String(entry.model || '').slice(0, 100),
      credits,
      Math.max(0, Math.trunc(Number(entry.inputTokens || 0))),
      Math.max(0, Math.trunc(Number(entry.outputTokens || 0))),
      Math.trunc(Number(entry.statusCode ?? 200)),
      entry.success === false ? 0 : 1,
      String(entry.errorMessage || '').slice(0, 400),
      new Date().toISOString()
    )
  } catch (err) {
    console.warn('[Mailcrawl Usage] Greška pri upisu potrošnje API-ja:', err)
  }
}

export function adjustFirecrawlCachedCredits(usedCredits: number, exhausted = false) {
  try {
    const settings = getCampaignSettings()
    const rawCache = settings.quota_firecrawl_live_cache
    if (!rawCache) return
    const parsed = JSON.parse(rawCache) as FirecrawlLiveCache
    if (typeof parsed?.remainingCredits !== 'number') return
    const nextRemaining = exhausted ? 0 : Math.max(0, parsed.remainingCredits - Math.max(0, usedCredits))
    updateCampaignSettings({
      quota_firecrawl_live_cache: JSON.stringify({
        ...parsed,
        remainingCredits: nextRemaining,
        error: exhausted ? 'Krediti su iscrpljeni (402)' : undefined,
      }),
    })
  } catch {}
}

export async function fetchFirecrawlLiveCreditUsage(apiKey: string): Promise<{
  ok: boolean
  data?: FirecrawlLiveCache
  error?: string
}> {
  const cleanKey = (apiKey || '').trim()
  if (!cleanKey) {
    return { ok: false, error: 'Firecrawl API ključ nije konfiguriran.' }
  }

  const endpoints = [
    'https://api.firecrawl.dev/v2/team/credit-usage',
    'https://api.firecrawl.dev/v1/team/credit-usage',
  ]

  let lastError = 'Nije moguće dohvatiti stanje Firecrawl kredita.'
  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(8000),
        headers: {
          Authorization: `Bearer ${cleanKey}`,
        },
      })

      if (res.status === 404) {
        lastError = 'Endpoint nije pronađen (404).'
        continue
      }

      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        lastError = `Firecrawl status ${res.status}: ${txt.slice(0, 140)}`
        return { ok: false, error: lastError }
      }

      const payload = await res.json().catch(() => null)
      const data = payload?.data ?? payload
      const rawRem = data?.remainingCredits ?? data?.remaining_credits
      const rawPlan = data?.planCredits ?? data?.plan_credits
      const remainingCredits = Number(rawRem)
      if (!Number.isFinite(remainingCredits)) {
        lastError = 'Firecrawl API nije vratio broj preostalih kredita.'
        continue
      }

      const planCredits =
        Number.isFinite(Number(rawPlan)) && Number(rawPlan) > 0 ? Number(rawPlan) : 500

      return {
        ok: true,
        data: {
          remainingCredits: Math.max(0, remainingCredits),
          planCredits,
          billingPeriodStart: data?.billingPeriodStart ?? data?.billing_period_start ?? null,
          billingPeriodEnd: data?.billingPeriodEnd ?? data?.billing_period_end ?? null,
          syncedAt: new Date().toISOString(),
        },
      }
    } catch (err: any) {
      lastError = err?.message || 'Greška mreže pri dohvatu Firecrawl kredita.'
    }
  }

  return { ok: false, error: lastError }
}

function resolveStatus(
  configured: boolean,
  remaining: number,
  limit: number,
  recentExhaustedError = false
): ApiProviderQuotaItem['status'] {
  if (!configured) return 'unconfigured'
  if (remaining <= 0 || recentExhaustedError) return 'exhausted'
  const pct = limit > 0 ? (remaining / limit) * 100 : 0
  if (pct <= 10) return 'critical'
  if (pct <= 25) return 'warning'
  return 'ok'
}

export async function getApiQuotaSummary(options?: {
  forceLiveRefresh?: boolean
}): Promise<ApiQuotaSummaryResponse> {
  const settings = getCampaignSettings()
  const now = new Date()
  const nowIso = now.toISOString()

  const geminiKey = (settings.gemini_api_key || process.env.GEMINI_API_KEY || '').trim()
  const serperKey = (settings.serper_api_key || process.env.SERPER_API_KEY || '').trim()
  const tavilyKey = (settings.tavily_api_key || process.env.TAVILY_API_KEY || '').trim()
  const firecrawlKey = (settings.firecrawl_api_key || process.env.FIRECRAWL_API_KEY || '').trim()

  const getLastInfo = (provider: ApiQuotaProviderKey) => {
    const lastSuccess = db
      .prepare(
        `SELECT created_at_iso FROM api_usage_logs WHERE provider = ? AND success = 1 ORDER BY id DESC LIMIT 1`
      )
      .get(provider) as { created_at_iso?: string } | undefined
    const lastError = db
      .prepare(
        `SELECT status_code, error_message, created_at_iso FROM api_usage_logs WHERE provider = ? AND success = 0 ORDER BY id DESC LIMIT 1`
      )
      .get(provider) as { status_code?: number; error_message?: string; created_at_iso?: string } | undefined
    const totalCallsRow = db
      .prepare(`SELECT COUNT(*) as c FROM api_usage_logs WHERE provider = ?`)
      .get(provider) as { c?: number } | undefined

    return {
      lastCallAt: lastSuccess?.created_at_iso || null,
      lastErrorAt: lastError?.created_at_iso || null,
      lastErrorMessage: lastError?.error_message || null,
      lastErrorStatus: lastError?.status_code || 0,
      totalCalls: Number(totalCallsRow?.c || 0),
    }
  }

  // 1. GOOGLE GEMINI
  const geminiWindowStart = getGeminiDayWindowStartIso(now)
  const oneMinuteAgoIso = new Date(now.getTime() - 60 * 1000).toISOString()
  const geminiDailyLimit = safePositiveInt(settings.quota_gemini_daily_limit, 250)
  const geminiRpmLimit = safePositiveInt(settings.quota_gemini_rpm_limit, 10)
  const geminiTodayRow = db
    .prepare(
      `SELECT COUNT(*) as reqs, COALESCE(SUM(input_tokens), 0) as inTok, COALESCE(SUM(output_tokens), 0) as outTok
       FROM api_usage_logs
       WHERE provider = 'gemini' AND created_at_iso >= ? AND (success = 1 OR status_code = 200)`
    )
    .get(geminiWindowStart) as { reqs?: number; inTok?: number; outTok?: number }
  const geminiRpmRow = db
    .prepare(
      `SELECT COUNT(*) as rpm FROM api_usage_logs WHERE provider = 'gemini' AND created_at_iso >= ?`
    )
    .get(oneMinuteAgoIso) as { rpm?: number }
  const geminiRateLimitErrorsRow = db
    .prepare(
      `SELECT COUNT(*) as c FROM api_usage_logs WHERE provider = 'gemini' AND created_at_iso >= ? AND success = 0 AND status_code = 429`
    )
    .get(geminiWindowStart) as { c?: number }
  const geminiInfo = getLastInfo('gemini')
  const geminiUsedToday = Number(geminiTodayRow?.reqs || 0)
  const geminiRemaining = Math.max(0, geminiDailyLimit - geminiUsedToday)
  const geminiPctRem = geminiDailyLimit > 0 ? Math.min(100, Math.round((geminiRemaining / geminiDailyLimit) * 100)) : 0

  const geminiItem: ApiProviderQuotaItem = {
    provider: 'gemini',
    label: 'Google Gemini AI',
    subtitle: 'Personalizacija e-mailova, zahvale i AI pojmovi',
    configured: Boolean(geminiKey),
    mode: 'tracked',
    status: resolveStatus(Boolean(geminiKey), geminiRemaining, geminiDailyLimit),
    limit: geminiDailyLimit,
    used: geminiUsedToday,
    remaining: geminiRemaining,
    percentRemaining: geminiPctRem,
    percentUsed: Math.max(0, 100 - geminiPctRem),
    unitLabel: 'zahtjeva/dan',
    periodLabel: 'Dnevni ciklus (reset ~09:00 CET)',
    dashboardUrl: 'https://aistudio.google.com/usage',
    lastCallAt: geminiInfo.lastCallAt,
    lastErrorAt: geminiInfo.lastErrorAt,
    lastErrorMessage: geminiInfo.lastErrorMessage,
    note: 'Google nema javni endpoint za preostali saldo; prati se svaki zahtjev, RPM i tokeni iz aplikacije.',
    extra: {
      rpmCurrent: Number(geminiRpmRow?.rpm || 0),
      rpmLimit: geminiRpmLimit,
      inputTokensToday: Number(geminiTodayRow?.inTok || 0),
      outputTokensToday: Number(geminiTodayRow?.outTok || 0),
      rateLimitErrorsToday: Number(geminiRateLimitErrorsRow?.c || 0),
      configuredModel: (settings.gemini_model || 'gemini-flash-latest').replace(/^models\//, ''),
      totalCalls: geminiInfo.totalCalls,
    },
  }

  // 2. SERPER.DEV
  const serperLimit = safePositiveInt(settings.quota_serper_total_limit, 2500)
  const serperOffset = Math.max(0, safeNumber(settings.quota_serper_offset, 0))
  const serperUsedRow = db
    .prepare(`SELECT COALESCE(SUM(credits), 0) as used FROM api_usage_logs WHERE provider = 'serper' AND success = 1`)
    .get() as { used?: number }
  const serperInfo = getLastInfo('serper')
  const serperTrackedUsed = Math.round(Number(serperUsedRow?.used || 0) * 100) / 100
  const serperUsed = Math.round((serperTrackedUsed + serperOffset) * 100) / 100
  const serperRemaining = Math.max(0, Math.round((serperLimit - serperUsed) * 100) / 100)
  const serperPctRem = serperLimit > 0 ? Math.min(100, Math.round((serperRemaining / serperLimit) * 100)) : 0
  const serperExhaustedErr =
    Boolean(serperInfo.lastErrorAt) &&
    (!serperInfo.lastCallAt || serperInfo.lastErrorAt! >= serperInfo.lastCallAt) &&
    (serperInfo.lastErrorStatus === 402 || serperInfo.lastErrorStatus === 429)

  const serperItem: ApiProviderQuotaItem = {
    provider: 'serper',
    label: 'Serper.dev',
    subtitle: 'Google Search & Places pronalazak tvrtki',
    configured: Boolean(serperKey),
    mode: 'tracked',
    status: resolveStatus(Boolean(serperKey), serperRemaining, serperLimit, serperExhaustedErr),
    limit: serperLimit,
    used: serperUsed,
    remaining: serperRemaining,
    percentRemaining: serperPctRem,
    percentUsed: Math.max(0, 100 - serperPctRem),
    unitLabel: 'kredita ukupno',
    periodLabel: 'Jednokratni besplatni paket (2.500 kredita)',
    dashboardUrl: 'https://serper.dev/dashboard',
    lastCallAt: serperInfo.lastCallAt,
    lastErrorAt: serperInfo.lastErrorAt,
    lastErrorMessage: serperInfo.lastErrorMessage,
    note: 'Serper nema API za stanje salda; prati se cijena svakog poziva. Ako je ključ korišten ranije, unesite stanje s dashboarda putem „Kalibriraj”.',
    extra: {
      totalCalls: serperInfo.totalCalls,
    },
  }

  // 3. TAVILY
  const monthWin = getCurrentMonthWindow(now)
  const tavilyLimit = safePositiveInt(settings.quota_tavily_monthly_limit, 1000)
  const tavilyOffset =
    settings.quota_tavily_offset_month === monthWin.monthKey
      ? Math.max(0, safeNumber(settings.quota_tavily_offset, 0))
      : 0
  const tavilyUsedRow = db
    .prepare(
      `SELECT COALESCE(SUM(credits), 0) as used FROM api_usage_logs WHERE provider = 'tavily' AND created_at_iso >= ? AND success = 1`
    )
    .get(monthWin.startIso) as { used?: number }
  const tavilyInfo = getLastInfo('tavily')
  const tavilyTrackedUsed = Math.round(Number(tavilyUsedRow?.used || 0) * 100) / 100
  const tavilyUsed = Math.round((tavilyTrackedUsed + tavilyOffset) * 100) / 100
  const tavilyRemaining = Math.max(0, Math.round((tavilyLimit - tavilyUsed) * 100) / 100)
  const tavilyPctRem = tavilyLimit > 0 ? Math.min(100, Math.round((tavilyRemaining / tavilyLimit) * 100)) : 0
  const tavilyExhaustedErr =
    Boolean(tavilyInfo.lastErrorAt) &&
    tavilyInfo.lastErrorAt! >= monthWin.startIso &&
    (!tavilyInfo.lastCallAt || tavilyInfo.lastErrorAt! >= tavilyInfo.lastCallAt) &&
    [429, 432, 433].includes(tavilyInfo.lastErrorStatus)

  const tavilyItem: ApiProviderQuotaItem = {
    provider: 'tavily',
    label: 'Tavily Search',
    subtitle: 'Sekundarna web pretraga (fallback)',
    configured: Boolean(tavilyKey),
    mode: 'tracked',
    status: resolveStatus(Boolean(tavilyKey), tavilyRemaining, tavilyLimit, tavilyExhaustedErr),
    limit: tavilyLimit,
    used: tavilyUsed,
    remaining: tavilyRemaining,
    percentRemaining: tavilyPctRem,
    percentUsed: Math.max(0, 100 - tavilyPctRem),
    unitLabel: 'kredita/mj.',
    periodLabel: monthWin.monthLabel,
    dashboardUrl: 'https://app.tavily.com/home',
    lastCallAt: tavilyInfo.lastCallAt,
    lastErrorAt: tavilyInfo.lastErrorAt,
    lastErrorMessage: tavilyInfo.lastErrorMessage,
    note: 'Svaki upit šalje include_usage=true i bilježi stvarni trošak kredita u tekućem mjesecu.',
    extra: {
      totalCalls: tavilyInfo.totalCalls,
    },
  }

  // 4. FIRECRAWL (Live endpoint + cache + tracked fallback)
  const firecrawlInfo = getLastInfo('firecrawl')
  const firecrawlLimitSetting = safePositiveInt(settings.quota_firecrawl_total_limit, 500)
  const firecrawlOffset = Math.max(0, safeNumber(settings.quota_firecrawl_offset, 0))
  const firecrawlUsedRow = db
    .prepare(`SELECT COALESCE(SUM(credits), 0) as used FROM api_usage_logs WHERE provider = 'firecrawl' AND success = 1`)
    .get() as { used?: number }
  const firecrawlTrackedUsed = Math.round(Number(firecrawlUsedRow?.used || 0) * 100) / 100

  let cachedFc: FirecrawlLiveCache | null = null
  if (settings.quota_firecrawl_live_cache) {
    try {
      cachedFc = JSON.parse(settings.quota_firecrawl_live_cache) as FirecrawlLiveCache
    } catch {
      cachedFc = null
    }
  }

  const cacheFresh =
    cachedFc?.syncedAt &&
    Date.now() - new Date(cachedFc.syncedAt).getTime() < FIRECRAWL_CACHE_TTL_MS

  let liveError: string | undefined
  if (firecrawlKey && (options?.forceLiveRefresh || !cacheFresh || typeof cachedFc?.remainingCredits !== 'number')) {
    const liveRes = await fetchFirecrawlLiveCreditUsage(firecrawlKey)
    if (liveRes.ok && liveRes.data) {
      cachedFc = liveRes.data
      updateCampaignSettings({ quota_firecrawl_live_cache: JSON.stringify(liveRes.data) })
    } else if (liveRes.error) {
      liveError = liveRes.error
    }
  }

  const useLiveFc = Boolean(firecrawlKey && cachedFc && typeof cachedFc.remainingCredits === 'number')
  const fcLimit = useLiveFc ? cachedFc!.planCredits : firecrawlLimitSetting
  const fcRemaining = useLiveFc
    ? Math.max(0, cachedFc!.remainingCredits)
    : Math.max(0, Math.round((firecrawlLimitSetting - (firecrawlTrackedUsed + firecrawlOffset)) * 100) / 100)
  const fcUsed = useLiveFc
    ? Math.max(0, fcLimit - fcRemaining)
    : Math.round((firecrawlTrackedUsed + firecrawlOffset) * 100) / 100
  const fcPctRem = fcLimit > 0 ? Math.min(100, Math.round((fcRemaining / fcLimit) * 100)) : 0
  const fcExhaustedErr =
    Boolean(firecrawlInfo.lastErrorAt) &&
    (!firecrawlInfo.lastCallAt || firecrawlInfo.lastErrorAt! >= firecrawlInfo.lastCallAt) &&
    firecrawlInfo.lastErrorStatus === 402

  const firecrawlItem: ApiProviderQuotaItem = {
    provider: 'firecrawl',
    label: 'Firecrawl',
    subtitle: 'JS / zaštićeni web scraping (fallback)',
    configured: Boolean(firecrawlKey),
    mode: useLiveFc ? 'live' : 'tracked',
    status: resolveStatus(Boolean(firecrawlKey), fcRemaining, fcLimit, fcExhaustedErr),
    limit: fcLimit,
    used: fcUsed,
    remaining: fcRemaining,
    percentRemaining: fcPctRem,
    percentUsed: Math.max(0, 100 - fcPctRem),
    unitLabel: 'kredita',
    periodLabel:
      useLiveFc && cachedFc?.billingPeriodEnd
        ? 'Obračunsko razdoblje (API uživo)'
        : 'Stanje kredita (API uživo + lokalni fallback)',
    dashboardUrl: 'https://www.firecrawl.dev/app/usage',
    liveSyncedAt: useLiveFc ? cachedFc?.syncedAt || null : null,
    billingPeriodStart: useLiveFc ? cachedFc?.billingPeriodStart || null : null,
    billingPeriodEnd: useLiveFc ? cachedFc?.billingPeriodEnd || null : null,
    lastCallAt: firecrawlInfo.lastCallAt,
    lastErrorAt: firecrawlInfo.lastErrorAt,
    lastErrorMessage: liveError || firecrawlInfo.lastErrorMessage,
    note: useLiveFc
      ? 'Sinkronizirano izravno s Firecrawl API-jem (/v2/team/credit-usage).'
      : 'Lokalno praćenje (500 besplatnih kredita po prijavi); osvježite za sinkronizaciju uživo.',
    extra: {
      totalCalls: firecrawlInfo.totalCalls,
    },
  }

  return {
    checkedAt: nowIso,
    providers: [geminiItem, serperItem, tavilyItem, firecrawlItem],
  }
}

export function calibrateApiQuota(params: {
  provider: ApiQuotaProviderKey
  limit?: number
  rpmLimit?: number
  desiredRemaining?: number | null
  resetLocalCounter?: boolean
}) {
  const { provider, limit, rpmLimit, desiredRemaining, resetLocalCounter } = params
  const settings = getCampaignSettings()
  const now = new Date()

  if (resetLocalCounter) {
    db.prepare('DELETE FROM api_usage_logs WHERE provider = ?').run(provider)
  }

  const updates: Record<string, string> = {}

  if (provider === 'gemini') {
    const nextLimit =
      typeof limit === 'number' && Number.isFinite(limit) && limit > 0
        ? Math.trunc(limit)
        : safePositiveInt(settings.quota_gemini_daily_limit, 250)
    updates.quota_gemini_daily_limit = String(nextLimit)
    if (typeof rpmLimit === 'number' && Number.isFinite(rpmLimit) && rpmLimit > 0) {
      updates.quota_gemini_rpm_limit = String(Math.trunc(rpmLimit))
    }
  } else if (provider === 'serper') {
    const nextLimit =
      typeof limit === 'number' && Number.isFinite(limit) && limit > 0
        ? Math.trunc(limit)
        : safePositiveInt(settings.quota_serper_total_limit, 2500)
    updates.quota_serper_total_limit = String(nextLimit)
    if (resetLocalCounter) {
      updates.quota_serper_offset = '0'
    }
    if (typeof desiredRemaining === 'number' && Number.isFinite(desiredRemaining) && desiredRemaining >= 0) {
      const row = db
        .prepare(`SELECT COALESCE(SUM(credits), 0) as used FROM api_usage_logs WHERE provider = 'serper' AND success = 1`)
        .get() as { used?: number }
      const trackedUsed = Number(row?.used || 0)
      const nextOffset = Math.max(0, Math.round((nextLimit - trackedUsed - desiredRemaining) * 100) / 100)
      updates.quota_serper_offset = String(nextOffset)
    }
  } else if (provider === 'tavily') {
    const monthWin = getCurrentMonthWindow(now)
    const nextLimit =
      typeof limit === 'number' && Number.isFinite(limit) && limit > 0
        ? Math.trunc(limit)
        : safePositiveInt(settings.quota_tavily_monthly_limit, 1000)
    updates.quota_tavily_monthly_limit = String(nextLimit)
    if (resetLocalCounter) {
      updates.quota_tavily_offset = '0'
      updates.quota_tavily_offset_month = monthWin.monthKey
    }
    if (typeof desiredRemaining === 'number' && Number.isFinite(desiredRemaining) && desiredRemaining >= 0) {
      const row = db
        .prepare(
          `SELECT COALESCE(SUM(credits), 0) as used FROM api_usage_logs WHERE provider = 'tavily' AND created_at_iso >= ? AND success = 1`
        )
        .get(monthWin.startIso) as { used?: number }
      const trackedUsed = Number(row?.used || 0)
      const nextOffset = Math.max(0, Math.round((nextLimit - trackedUsed - desiredRemaining) * 100) / 100)
      updates.quota_tavily_offset = String(nextOffset)
      updates.quota_tavily_offset_month = monthWin.monthKey
    }
  } else if (provider === 'firecrawl') {
    const nextLimit =
      typeof limit === 'number' && Number.isFinite(limit) && limit > 0
        ? Math.trunc(limit)
        : safePositiveInt(settings.quota_firecrawl_total_limit, 500)
    updates.quota_firecrawl_total_limit = String(nextLimit)
    if (resetLocalCounter) {
      updates.quota_firecrawl_offset = '0'
    }
    if (typeof desiredRemaining === 'number' && Number.isFinite(desiredRemaining) && desiredRemaining >= 0) {
      const row = db
        .prepare(`SELECT COALESCE(SUM(credits), 0) as used FROM api_usage_logs WHERE provider = 'firecrawl' AND success = 1`)
        .get() as { used?: number }
      const trackedUsed = Number(row?.used || 0)
      const nextOffset = Math.max(0, Math.round((nextLimit - trackedUsed - desiredRemaining) * 100) / 100)
      updates.quota_firecrawl_offset = String(nextOffset)
    }
  }

  updateCampaignSettings(updates as any)
}
