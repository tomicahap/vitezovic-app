"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

export type SectionTabBadgeTone = "default" | "accent" | "success" | "warning" | "danger"

export interface SectionTabItem<T extends string = string> {
  id: T
  label: string
  shortLabel?: string
  icon?: React.ComponentType<{ className?: string }>
  count?: number | string
  badgeTone?: SectionTabBadgeTone
  hasDot?: boolean
  disabled?: boolean
  title?: string
}

export const SECTION_TABS_STYLES = {
  detailWrapper:
    "shrink-0 border-b-2 border-[#CEA369]/45 bg-[#FBF9F6] px-3 py-2.5 sm:px-6 sm:py-3 shadow-[0_2px_10px_rgba(27,43,54,0.06)]",
  pageWrapper: "mb-4 sm:mb-6",
  compactWrapper: "inline-flex max-w-full",
  track:
    "rounded-2xl bg-[#E8E4DE]/90 border border-[#1B2B36]/15 p-1.5 shadow-2xs",
  compactTrack:
    "rounded-xl bg-[#E8E4DE]/90 border border-[#1B2B36]/15 p-1 shadow-2xs",
  tabBase:
    "group relative inline-flex items-center justify-center gap-2 rounded-xl transition-all duration-150 touch-manipulation select-none outline-none focus-visible:ring-2 focus-visible:ring-[#CEA369] focus-visible:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none",
  tabActive:
    "bg-[#1B2B36] text-[#F2EFE9] border-2 border-[#CEA369] shadow-md font-bold",
  tabInactive:
    "bg-white/95 text-[#1B2B36] border border-[#1B2B36]/15 hover:bg-white hover:border-[#CEA369] hover:shadow-sm font-semibold shadow-2xs",
} as const

interface SectionTabsBarProps<T extends string = string> {
  tabs: SectionTabItem<T>[]
  value: T
  onValueChange: (value: T) => void
  variant?: "detail" | "page" | "compact"
  mobileLayout?: "auto" | "grid" | "scroll"
  fullWidth?: boolean
  ariaLabel?: string
  className?: string
  trackClassName?: string
}

function getBadgeClasses(active: boolean, tone: SectionTabBadgeTone = "default", count?: number | string) {
  if (active) {
    if (tone === "danger") {
      return "bg-red-500 text-white font-extrabold"
    }
    if (tone === "success") {
      return "bg-emerald-400 text-[#1B2B36] font-extrabold"
    }
    if (tone === "warning") {
      return "bg-amber-400 text-[#1B2B36] font-extrabold"
    }
    return "bg-[#CEA369] text-[#1B2B36] font-extrabold"
  }

  if (tone === "danger") {
    return "bg-red-100 text-red-800 border border-red-300 font-bold"
  }
  if (tone === "success") {
    return "bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold"
  }
  if (tone === "warning") {
    return "bg-amber-100 text-amber-900 border border-amber-300 font-bold"
  }
  if (tone === "accent") {
    return "bg-[#CEA369]/25 text-[#1B2B36] border border-[#CEA369]/60 font-bold"
  }

  const numeric = typeof count === "number" ? count : Number(String(count ?? "").split("/")[0])
  if (!Number.isNaN(numeric) && numeric > 0) {
    return "bg-[#CEA369]/25 text-[#1B2B36] border border-[#CEA369]/60 font-bold"
  }
  return "bg-[#E8E4DE] text-[#1B2B36]/75 border border-[#1B2B36]/10 font-semibold"
}

export function SectionTabsBar<T extends string = string>({
  tabs,
  value,
  onValueChange,
  variant = "detail",
  mobileLayout = "auto",
  fullWidth,
  ariaLabel = "Izbornik sekcija",
  className,
  trackClassName,
}: SectionTabsBarProps<T>) {
  const resolvedLayout: "grid" | "scroll" =
    mobileLayout === "auto"
      ? variant === "detail" && tabs.length >= 6
        ? "scroll"
        : "grid"
      : mobileLayout

  const isCompact = variant === "compact"
  const isDetail = variant === "detail"
  const shouldStretch = fullWidth ?? (isDetail || resolvedLayout === "grid")

  const listRef = React.useRef<HTMLDivElement>(null)
  const tabRefs = React.useRef<Record<string, HTMLButtonElement | null>>({})
  const [canScrollLeft, setCanScrollLeft] = React.useState(false)
  const [canScrollRight, setCanScrollRight] = React.useState(false)

  const updateScrollArrows = React.useCallback(() => {
    const el = listRef.current
    if (!el || resolvedLayout !== "scroll") {
      setCanScrollLeft(false)
      setCanScrollRight(false)
      return
    }
    const maxScroll = el.scrollWidth - el.clientWidth
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(maxScroll - el.scrollLeft > 4)
  }, [resolvedLayout])

  React.useEffect(() => {
    updateScrollArrows()
    const el = listRef.current
    if (!el || resolvedLayout !== "scroll") return
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateScrollArrows) : null
    ro?.observe(el)
    el.addEventListener("scroll", updateScrollArrows, { passive: true })
    window.addEventListener("resize", updateScrollArrows)
    return () => {
      ro?.disconnect()
      el.removeEventListener("scroll", updateScrollArrows)
      window.removeEventListener("resize", updateScrollArrows)
    }
  }, [updateScrollArrows, tabs.length, resolvedLayout])

  React.useEffect(() => {
    if (resolvedLayout !== "scroll") return
    const activeBtn = tabRefs.current[value]
    if (activeBtn && typeof activeBtn.scrollIntoView === "function") {
      activeBtn.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" })
    }
  }, [value, resolvedLayout])

  const scrollByAmount = (dir: -1 | 1) => {
    const el = listRef.current
    if (!el) return
    el.scrollBy({ left: dir * 180, behavior: "smooth" })
  }

  const enabledTabs = tabs.filter(t => !t.disabled)

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, currentId: T) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return
    const idx = enabledTabs.findIndex(t => t.id === currentId)
    if (idx === -1) return
    e.preventDefault()

    let nextTab: SectionTabItem<T> | undefined
    if (e.key === "ArrowRight") {
      nextTab = enabledTabs[(idx + 1) % enabledTabs.length]
    } else if (e.key === "ArrowLeft") {
      nextTab = enabledTabs[(idx - 1 + enabledTabs.length) % enabledTabs.length]
    } else if (e.key === "Home") {
      nextTab = enabledTabs[0]
    } else if (e.key === "End") {
      nextTab = enabledTabs[enabledTabs.length - 1]
    }

    if (nextTab) {
      onValueChange(nextTab.id)
      tabRefs.current[nextTab.id]?.focus()
    }
  }

  const wrapperCls =
    variant === "detail"
      ? SECTION_TABS_STYLES.detailWrapper
      : variant === "page"
      ? SECTION_TABS_STYLES.pageWrapper
      : SECTION_TABS_STYLES.compactWrapper

  const trackShellCls = isCompact ? SECTION_TABS_STYLES.compactTrack : SECTION_TABS_STYLES.track

  const layoutListCls =
    resolvedLayout === "scroll"
      ? "flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth md:flex-wrap"
      : tabs.length <= 1
      ? "grid grid-cols-1 gap-1.5 sm:flex sm:flex-wrap sm:items-center"
      : "grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap sm:items-center"

  const isOddGridCount = resolvedLayout === "grid" && tabs.length >= 3 && tabs.length % 2 === 1

  return (
    <div className={cn(wrapperCls, className)}>
      <div className={cn("relative", trackShellCls, shouldStretch ? "w-full" : "w-full sm:w-fit", trackClassName)}>
        {resolvedLayout === "scroll" && canScrollLeft && (
          <button
            type="button"
            aria-label="Pomakni kartice ulijevo"
            onClick={() => scrollByAmount(-1)}
            className="md:hidden absolute left-1.5 top-1/2 -translate-y-1/2 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-[#1B2B36]/20 bg-white/95 text-[#1B2B36] shadow-md hover:bg-white"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}

        <div
          ref={listRef}
          role="tablist"
          aria-label={ariaLabel}
          className={cn(
            layoutListCls,
            resolvedLayout === "scroll" && (canScrollLeft || canScrollRight) ? "px-6 md:px-0" : ""
          )}
        >
          {tabs.map((tab, index) => {
            const active = tab.id === value
            const Icon = tab.icon
            const isLastOdd = isOddGridCount && index === tabs.length - 1
            const sizeCls = isCompact
              ? "min-h-[38px] px-3 py-1.5 text-xs"
              : "min-h-[44px] sm:min-h-[42px] px-3 sm:px-3.5 py-2 text-xs sm:text-sm"

            return (
              <button
                key={tab.id}
                ref={el => {
                  tabRefs.current[tab.id] = el
                }}
                type="button"
                role="tab"
                aria-selected={active}
                disabled={tab.disabled}
                title={tab.title || tab.label}
                onClick={() => onValueChange(tab.id)}
                onKeyDown={e => handleKeyDown(e, tab.id)}
                className={cn(
                  SECTION_TABS_STYLES.tabBase,
                  sizeCls,
                  active ? SECTION_TABS_STYLES.tabActive : SECTION_TABS_STYLES.tabInactive,
                  resolvedLayout === "scroll"
                    ? "shrink-0 whitespace-nowrap md:flex-1 md:min-w-fit"
                    : cn(
                        isLastOdd ? "col-span-2 sm:col-span-1" : "",
                        isDetail || fullWidth ? "sm:flex-1 sm:min-w-fit" : "sm:flex-initial"
                      )
                )}
              >
                {Icon && (
                  <Icon
                    className={cn(
                      "shrink-0 transition-colors",
                      isCompact ? "h-3.5 w-3.5" : "h-4 w-4",
                      active ? "text-[#CEA369]" : "text-[#1B2B36]/70 group-hover:text-[#1B2B36]"
                    )}
                  />
                )}

                {tab.shortLabel ? (
                  <>
                    <span className="sm:hidden leading-tight text-center">{tab.shortLabel}</span>
                    <span className="hidden sm:inline leading-tight whitespace-nowrap">{tab.label}</span>
                  </>
                ) : (
                  <span className="leading-tight text-center sm:whitespace-nowrap">{tab.label}</span>
                )}

                {tab.count !== undefined && (
                  <span
                    className={cn(
                      "inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[11px] leading-none tabular-nums shrink-0",
                      getBadgeClasses(active, tab.badgeTone, tab.count)
                    )}
                  >
                    {tab.count}
                  </span>
                )}

                {tab.hasDot && (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "h-2 w-2 rounded-full shrink-0",
                      tab.badgeTone === "warning"
                        ? "bg-amber-500"
                        : tab.badgeTone === "danger"
                        ? "bg-red-500"
                        : "bg-emerald-500",
                      active ? "ring-2 ring-[#F2EFE9]/50" : ""
                    )}
                  />
                )}
              </button>
            )
          })}
        </div>

        {resolvedLayout === "scroll" && canScrollRight && (
          <button
            type="button"
            aria-label="Pomakni kartice udesno"
            onClick={() => scrollByAmount(1)}
            className="md:hidden absolute right-1.5 top-1/2 -translate-y-1/2 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-[#1B2B36]/20 bg-white/95 text-[#1B2B36] shadow-md hover:bg-white"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}
