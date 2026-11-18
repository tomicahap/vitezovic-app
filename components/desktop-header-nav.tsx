"use client"

import React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { getInquiryPermissions, getFunctionsPermissions, getUserAccessRights } from "@/lib/inquiry-permissions"
import { GlobalQuickSearch } from "@/components/global-quick-search"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  LayoutDashboard,
  Users,
  Contact,
  Calendar,
  FolderKanban,
  Archive,
  Cloud,
  Settings,
  Activity,
  FileBarChart,
  BookOpen,
  Mic,
  Library,
  Mail,
  Link as LinkIcon,
  StickyNote,
  Sparkles,
  LogOut,
  Trash2,
  ChevronDown,
  LayoutGrid,
  HelpCircle,
  History,
} from "lucide-react"

interface DesktopHeaderNavProps {
  activeItem?: string
  className?: string
  showBar?: boolean
}

interface NavItemConfig {
  id: string
  label: string
  shortLabel: string
  icon: React.ComponentType<{ className?: string }>
  href: string
  adminOnly?: boolean
  modOrAdmin?: boolean
}

const ALL_DESKTOP_ITEMS: NavItemConfig[] = [
  { id: "dashboard", label: "Nadzorna ploča", shortLabel: "Početna", icon: LayoutDashboard, href: "/" },
  { id: "personal", label: "Moj kutak", shortLabel: "Moj kutak", icon: StickyNote, href: "/personal" },
  { id: "members", label: "Članovi", shortLabel: "Članovi", icon: Users, href: "/members" },
  { id: "contacts", label: "Adresar", shortLabel: "Adresar", icon: Contact, href: "/contacts" },
  { id: "meetings", label: "Sjednice i glasovanje", shortLabel: "Sjednice", icon: Calendar, href: "/meetings" },
  { id: "lectures", label: "Predavanja / druženja", shortLabel: "Predavanja", icon: Mic, href: "/lectures" },
  { id: "library", label: "Knjižnica", shortLabel: "Knjižnica", icon: Library, href: "/library" },
  { id: "projects", label: "Projekti i istraživanja", shortLabel: "Projekti", icon: FolderKanban, href: "/projects" },
  { id: "archive", label: "Arhiv", shortLabel: "Arhiv", icon: Archive, href: "/archive" },
  { id: "gmail", label: "Inbox (E-pošta)", shortLabel: "Inbox", icon: Mail, href: "/gmail" },
  { id: "links", label: "Linkovi", shortLabel: "Linkovi", icon: LinkIcon, href: "/links" },
  { id: "drive", label: "Google Drive", shortLabel: "Drive", icon: Cloud, href: "/drive" },
  { id: "donations", label: "Donacije & Kampanje", shortLabel: "Donacije", icon: Sparkles, href: "/admin/donations", adminOnly: true },
  { id: "reports", label: "Izvješća", shortLabel: "Izvješća", icon: FileBarChart, href: "/reports", modOrAdmin: true },
  { id: "logs", label: "Dnevnik rada", shortLabel: "Logovi", icon: Activity, href: "/logs", modOrAdmin: true },
  { id: "chronicle", label: "Ljetopis društva", shortLabel: "Ljetopis", icon: BookOpen, href: "/chronicle", modOrAdmin: true },
  { id: "trash", label: "Smeće", shortLabel: "Smeće", icon: Trash2, href: "/trash", adminOnly: true },
  { id: "settings", label: "Postavke", shortLabel: "Postavke", icon: Settings, href: "/settings", adminOnly: true },
]

export function HeaderUserLogout({ className }: { className?: string }) {
  const { user, logout } = useAuth()
  if (!user) return null

  const roleLabel =
    user.role === "admin"
      ? "Administrator"
      : user.role === "moderator"
      ? "Moderator"
      : "Član"

  return (
    <div className={cn("flex items-center gap-2.5 pl-3 border-l border-border shrink-0", className)}>
      <div className="text-right leading-tight">
        <p className="text-xs font-bold text-foreground truncate max-w-[160px]">{user.name}</p>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {roleLabel}
        </p>
      </div>
      <button
        type="button"
        onClick={logout}
        title="Odjava iz sustava"
        aria-label="Odjava iz sustava"
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-red-200 bg-red-50/80 text-red-600 hover:bg-red-600 hover:text-white hover:border-red-600 transition-all shadow-2xs shrink-0"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  )
}

export function DesktopHeaderNav({ activeItem, className, showBar = false }: DesktopHeaderNavProps) {
  const { user } = useAuth()
  const pathname = usePathname()

  const visibleItems = React.useMemo(() => {
    const inqPerms = getInquiryPermissions(user)
    const fnPerms = getFunctionsPermissions(user)
    const ar = getUserAccessRights(user)

    return ALL_DESKTOP_ITEMS.filter((item) => {
      if (user?.role === "admin") return true
      if (item.adminOnly) return false
      if (item.modOrAdmin && !["admin", "moderator"].includes(user?.role || "")) return false

      if (item.id === "dashboard" || item.id === "personal" || item.id === "meetings") return true

      if (item.id === "projects") {
        const rights = ar.projects
        return Boolean(user?.role === "moderator" || rights?.view || rights?.edit || inqPerms.canViewAny)
      }

      if (item.id === "members") {
        const rights = ar.members
        return Boolean(user?.role === "moderator" || rights?.view || rights?.edit || fnPerms.view)
      }

      if (user?.role === "moderator") return true
      const rights = ar[item.id]
      return rights?.view === true || rights?.edit === true
    }).map((item) => {
      if (item.id === "projects") {
        const rights = ar.projects
        const hasProjectView = user?.role === "admin" || user?.role === "moderator" || Boolean(rights?.view || rights?.edit)
        const hasInqView = inqPerms.canViewAny

        if (!hasProjectView && hasInqView) {
          return { ...item, label: "Upiti i istraživanja", shortLabel: "Upiti", href: "/projects?tab=inquiries" }
        }
        if (hasProjectView && !hasInqView) {
          return { ...item, label: "Projekti", shortLabel: "Projekti", href: "/projects" }
        }
        return { ...item, label: "Projekti i istraživanja", shortLabel: "Projekti", href: "/projects" }
      }
      if (user?.role !== "admin" && item.id === "members") {
        const rights = ar.members
        if (!rights?.view && !rights?.edit && fnPerms.view) {
          return { ...item, label: "Funkcije u društvu", shortLabel: "Funkcije", href: "/members?tab=organization" }
        }
      }
      return item
    })
  }, [user])

  const isCurrentActive = (item: NavItemConfig) => {
    if (activeItem) return activeItem === item.id
    if (item.href === "/" && pathname === "/") return true
    if (item.href !== "/" && pathname?.startsWith(item.href)) return true
    return false
  }

  const currentModule = React.useMemo(() => {
    const matched = visibleItems.find(isCurrentActive)
    if (matched) return matched
    if (pathname?.startsWith("/manual")) {
      return { id: "manual", label: "Korisnički priručnik", shortLabel: "Priručnik", icon: HelpCircle, href: "/manual" }
    }
    if (pathname?.startsWith("/changelog")) {
      return { id: "changelog", label: "Popis promjena (Changelog)", shortLabel: "Promjene", icon: History, href: "/changelog" }
    }
    return { id: "dashboard", label: "Rodoslovac", shortLabel: "Rodoslovac", icon: Sparkles, href: "/" }
  }, [visibleItems, activeItem, pathname])

  const quickShortcuts = React.useMemo(() => {
    const preferredIds = ["dashboard", "members", "meetings", "personal"]
    return preferredIds
      .map((id) => visibleItems.find((item) => item.id === id))
      .filter((item): item is NavItemConfig => Boolean(item))
  }, [visibleItems])

  const CurrentIcon = currentModule.icon

  const navContent = (
    <div className={cn("hidden md:flex items-center gap-3 min-w-0 flex-1", className)}>
      <div className="flex items-center gap-2 shrink-0">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
          <CurrentIcon className="h-4 w-4" />
        </span>
        <span className="text-sm font-bold text-foreground truncate max-w-[200px]">
          {currentModule.label}
        </span>
      </div>

      <div className="flex-1 flex items-center justify-center min-w-0 max-w-[380px]">
        <GlobalQuickSearch variant="bar" />
      </div>

      <nav aria-label="Brzi prečaci" className="hidden lg:flex items-center gap-1 ml-auto shrink-0">
        {quickShortcuts.map((item) => {
          const Icon = item.icon
          const active = isCurrentActive(item)
          return (
            <Link
              key={item.id}
              href={item.href}
              title={item.label}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors",
                active
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden xl:inline">{item.shortLabel}</span>
            </Link>
          )
        })}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/80 px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary transition-colors"
              title="Svi dostupni moduli sustava"
            >
              <LayoutGrid className="h-3.5 w-3.5 text-primary" />
              <span className="hidden xl:inline">Svi moduli</span>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60 max-h-[70vh] overflow-y-auto">
            <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Svi moduli sustava
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {visibleItems.map((item) => {
              const Icon = item.icon
              const active = isCurrentActive(item)
              return (
                <DropdownMenuItem key={item.id} asChild>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 cursor-pointer",
                      active && "bg-primary/10 font-semibold text-primary"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
    </div>
  )

  if (showBar) {
    return (
      <>
        <header
          className={cn(
            "print:hidden hidden md:flex items-center justify-between gap-4 px-5 py-2 border-b border-border bg-card/95 backdrop-blur-md fixed top-0 left-0 right-0 md:left-[var(--sidebar-width,220px)] z-40 shadow-xs h-[52px] transition-[left] duration-200",
            className
          )}
        >
          {navContent}
          <HeaderUserLogout />
        </header>
        {/* Placeholder spacer kako sadržaj stranice ne bi bio prekriven fiksnim zaglavljem */}
        <div className="print:hidden hidden md:block h-[52px] w-full shrink-0" aria-hidden="true" />
      </>
    )
  }

  return navContent
}
