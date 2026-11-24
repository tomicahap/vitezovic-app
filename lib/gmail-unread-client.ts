"use client"

import { useEffect, useState } from "react"

const UNREAD_POLL_INTERVAL_MS = 60_000
const UNREAD_CLIENT_TTL_MS = 45_000

let currentCount = 0
let lastFetchedAt = 0
let inFlightPromise: Promise<number> | null = null
let activeSubscribers = 0
let intervalId: ReturnType<typeof setInterval> | null = null
let windowListenersAttached = false

const listeners = new Set<(count: number) => void>()

function notifyListeners() {
  for (const listener of listeners) {
    try {
      listener(currentCount)
    } catch {}
  }
}

export function publishGmailUnreadCount(count: number): void {
  const safe = Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0
  currentCount = safe
  lastFetchedAt = Date.now()
  notifyListeners()
}

export function adjustGmailUnreadCount(delta: number): void {
  if (!Number.isFinite(delta) || delta === 0) return
  currentCount = Math.max(0, currentCount + Math.trunc(delta))
  lastFetchedAt = Date.now()
  notifyListeners()
}

async function fetchGmailUnreadCount(force = false): Promise<number> {
  if (!force && lastFetchedAt > 0 && Date.now() - lastFetchedAt < UNREAD_CLIENT_TTL_MS) {
    return currentCount
  }

  if (inFlightPromise) {
    return inFlightPromise
  }

  inFlightPromise = fetch("/api/gmail?action=unread-count", { cache: "no-store" })
    .then(async (res) => {
      if (!res.ok) return currentCount
      const data = await res.json().catch(() => null)
      if (data && typeof data.unreadInboxCount === "number") {
        publishGmailUnreadCount(data.unreadInboxCount)
        return data.unreadInboxCount
      }
      return currentCount
    })
    .catch(() => currentCount)
    .finally(() => {
      inFlightPromise = null
    })

  return inFlightPromise
}

function handleVisibilityOrFocus() {
  if (typeof document !== "undefined" && document.visibilityState === "visible" && activeSubscribers > 0) {
    fetchGmailUnreadCount(false)
  }
}

function attachSharedPolling() {
  if (typeof window === "undefined") return
  if (!intervalId) {
    intervalId = setInterval(() => {
      if (document.visibilityState === "visible" && activeSubscribers > 0) {
        fetchGmailUnreadCount(true)
      }
    }, UNREAD_POLL_INTERVAL_MS)
  }
  if (!windowListenersAttached) {
    windowListenersAttached = true
    window.addEventListener("focus", handleVisibilityOrFocus)
    document.addEventListener("visibilitychange", handleVisibilityOrFocus)
  }
}

function detachSharedPollingIfUnused() {
  if (activeSubscribers > 0) return
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
  if (windowListenersAttached && typeof window !== "undefined") {
    windowListenersAttached = false
    window.removeEventListener("focus", handleVisibilityOrFocus)
    document.removeEventListener("visibilitychange", handleVisibilityOrFocus)
  }
}

export function useGmailUnreadCount(enabled: boolean): number {
  const [count, setCount] = useState<number>(() => (enabled ? currentCount : 0))

  useEffect(() => {
    if (!enabled) {
      setCount(0)
      return
    }

    setCount(currentCount)
    const listener = (nextCount: number) => setCount(nextCount)
    listeners.add(listener)
    activeSubscribers += 1
    attachSharedPolling()

    if (typeof document === "undefined" || document.visibilityState === "visible") {
      fetchGmailUnreadCount(false)
    }

    return () => {
      listeners.delete(listener)
      activeSubscribers = Math.max(0, activeSubscribers - 1)
      detachSharedPollingIfUnused()
    }
  }, [enabled])

  return enabled ? count : 0
}
