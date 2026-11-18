"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { AlertTriangle, CheckCircle, LogOut, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface UnsavedChangesGuardProps {
  when: boolean
  title?: string
  description?: string
  stayLabel?: string
  discardLabel?: string
  saveLabel?: string
  onDiscard?: () => void
  onSaveAndLeave?: () => Promise<boolean> | boolean
  pendingHref?: string | null
  onClearPendingHref?: () => void
}

export function UnsavedChangesGuard({
  when,
  title = "Promjene nisu spremljene",
  description = "Uređivanje je trenutno u tijeku i unesene izmjene nisu spremljene. Ako sada napustite ovu stranicu i prijeđete na drugi modul, nespremljeni podaci će se izgubiti.",
  stayLabel = "Ostani i nastavi uređivati",
  discardLabel = "Napusti bez spremanja",
  saveLabel = "Spremi promjene i nastavi",
  onDiscard,
  onSaveAndLeave,
  pendingHref,
  onClearPendingHref,
}: UnsavedChangesGuardProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [internalPendingHref, setInternalPendingHref] = React.useState<string | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)

  const whenRef = React.useRef(when)
  whenRef.current = when

  const allowNavigationRef = React.useRef(false)
  const currentRelativeUrlRef = React.useRef("")
  const lastHistoryStateRef = React.useRef<any>(null)

  React.useEffect(() => {
    if (typeof window === "undefined") return
    currentRelativeUrlRef.current =
      window.location.pathname + window.location.search + window.location.hash
    lastHistoryStateRef.current = window.history.state
  }, [pathname, when])

  React.useEffect(() => {
    if (!when) {
      setInternalPendingHref(null)
    }
  }, [when])

  React.useEffect(() => {
    if (typeof window === "undefined") return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!whenRef.current || allowNavigationRef.current) return
      e.preventDefault()
      e.returnValue = ""
    }

    const handleDocumentClick = (e: MouseEvent) => {
      if (!whenRef.current || allowNavigationRef.current) return
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
        return
      }

      const targetEl = e.target as HTMLElement | null
      if (!targetEl || targetEl.closest('[data-unsaved-guard-dialog="true"]')) {
        return
      }

      const anchor = targetEl.closest("a")
      if (!anchor) return
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return

      const rawHref = anchor.getAttribute("href")
      if (
        !rawHref ||
        rawHref.startsWith("#") ||
        rawHref.startsWith("mailto:") ||
        rawHref.startsWith("tel:") ||
        rawHref.startsWith("javascript:")
      ) {
        return
      }

      let nextUrl: URL
      try {
        nextUrl = new URL(anchor.href, window.location.href)
      } catch {
        return
      }

      if (nextUrl.origin !== window.location.origin) return

      const currentRelative =
        window.location.pathname + window.location.search + window.location.hash
      const nextRelative = nextUrl.pathname + nextUrl.search + nextUrl.hash
      if (nextRelative === currentRelative) return

      e.preventDefault()
      e.stopPropagation()
      if (typeof e.stopImmediatePropagation === "function") {
        e.stopImmediatePropagation()
      }

      setInternalPendingHref(nextRelative)
    }

    const handlePopState = () => {
      if (!whenRef.current || allowNavigationRef.current) return
      const targetRelative =
        window.location.pathname + window.location.search + window.location.hash
      if (currentRelativeUrlRef.current && targetRelative !== currentRelativeUrlRef.current) {
        try {
          window.history.pushState(lastHistoryStateRef.current, "", currentRelativeUrlRef.current)
        } catch {}
        setInternalPendingHref(targetRelative)
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    document.addEventListener("click", handleDocumentClick, true)
    window.addEventListener("popstate", handlePopState)

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
      document.removeEventListener("click", handleDocumentClick, true)
      window.removeEventListener("popstate", handlePopState)
    }
  }, [])

  const activePendingHref = pendingHref ?? internalPendingHref

  const clearPending = () => {
    setInternalPendingHref(null)
    onClearPendingHref?.()
  }

  const proceedToTarget = (href: string) => {
    allowNavigationRef.current = true
    clearPending()
    router.push(href)
    setTimeout(() => {
      allowNavigationRef.current = false
    }, 500)
  }

  const handleDiscardAndLeave = () => {
    const target = activePendingHref
    onDiscard?.()
    if (target) {
      proceedToTarget(target)
    } else {
      clearPending()
    }
  }

  const handleSaveAndProceed = async () => {
    const target = activePendingHref
    if (!target || !onSaveAndLeave) return
    setIsSaving(true)
    try {
      const ok = await onSaveAndLeave()
      if (ok) {
        proceedToTarget(target)
      } else {
        clearPending()
      }
    } finally {
      setIsSaving(false)
    }
  }

  if (!activePendingHref) return null

  return (
    <div
      data-unsaved-guard-dialog="true"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 backdrop-blur-xs px-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="unsaved-guard-title"
    >
      <div className="w-full max-w-md rounded-2xl border-2 border-amber-300 bg-background p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start gap-3 mb-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 border border-amber-300">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h3 id="unsaved-guard-title" className="text-lg font-bold text-foreground leading-tight">
              {title}
            </h3>
            <p className="text-xs font-medium text-amber-700 mt-0.5">
              Promjena podataka je u tijeku
            </p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed mb-5">
          {description}
        </p>

        <div className="flex flex-col gap-2">
          {onSaveAndLeave && (
            <Button
              type="button"
              disabled={isSaving}
              onClick={handleSaveAndProceed}
              className="w-full justify-center gap-2 bg-green-600 hover:bg-green-700 text-white"
            >
              <CheckCircle className="h-4 w-4" />
              {isSaving ? "Spremanje..." : saveLabel}
            </Button>
          )}
          <Button
            type="button"
            variant="default"
            disabled={isSaving}
            onClick={clearPending}
            className="w-full justify-center gap-2"
          >
            <Pencil className="h-4 w-4" />
            {stayLabel}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isSaving}
            onClick={handleDiscardAndLeave}
            className="w-full justify-center gap-2 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
          >
            <LogOut className="h-4 w-4" />
            {discardLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
